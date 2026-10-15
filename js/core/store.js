// Workspace state: the ordered cards (test cases or enhancement requests), the current position,
// report details and dropdown lists. One store per workspace, each autosaved to its own
// IndexedDB database (debounced).

import { createDb } from './db.js';
import { APP } from './config.js';
import { TESTCASES, ENHANCEMENTS } from './workspaces.js';
import { uid, cleanText, isBlank, debounce, clamp, todayISO } from './util.js';

const META_KEY = 'session';
const ALIASES = { passed: 'pass', failed: 'fail', block: 'blocked' };

function pickOption(value, options) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return '';
  const wanted = ALIASES[v] || v;
  return options.find((o) => o.toLowerCase() === wanted) || '';
}

export function createStore(def) {
  const db = createDb(def.dbName);
  const listeners = new Map();
  const idPattern = new RegExp(`^${def.uidPrefix}_[\\w-]{4,40}$`);
  const optionFields = def.fields.filter((f) => f.options);
  const clearRules = def.fields.filter((f) => f.clears);

  function emit(type, detail = {}) {
    for (const fn of listeners.get(type) || []) {
      try { fn(detail); } catch (err) { console.error(err); }
    }
    for (const fn of listeners.get('*') || []) {
      try { fn({ type, ...detail }); } catch (err) { console.error(err); }
    }
  }

  function on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type)?.delete(fn);
  }

  function blank() {
    const c = { id: uid(def.uidPrefix), bookmarked: false, images: [], createdAt: Date.now(), updatedAt: Date.now() };
    for (const k of def.fieldKeys) c[k] = '';
    return c;
  }

  // e.g. a test case with Status "Pass" has no Severity
  function applyRules(c) {
    for (const f of clearRules) {
      if (c[f.key] === f.clears.when) for (const k of f.clears.fields) c[k] = '';
    }
  }

  /** Coerces any loosely-shaped object (import, project file, old save) into a valid card. */
  function normalize(raw = {}) {
    const c = blank();
    if (typeof raw.id === 'string' && idPattern.test(raw.id)) c.id = raw.id;
    for (const k of def.fieldKeys) c[k] = cleanText(raw[k], APP.maxFieldLength);
    for (const f of optionFields) c[f.key] = pickOption(c[f.key], f.options);
    applyRules(c);
    c.bookmarked = raw.bookmarked === true;
    c.images = Array.isArray(raw.images) ? raw.images.filter((x) => typeof x === 'string').slice(0, APP.maxImagesPerCase) : [];
    if (Number.isFinite(raw.createdAt)) c.createdAt = raw.createdAt;
    if (Number.isFinite(raw.updatedAt)) c.updatedAt = raw.updatedAt;
    return c;
  }

  const isComplete = (c) => def.requiredKeys.every((k) => !isBlank(c[k]));
  const missingFields = (c) => def.requiredKeys.filter((k) => isBlank(c[k]));
  const hasContent = (c) => def.fieldKeys.some((k) => !isBlank(c[k])) || c.images.length > 0;

  const defaultReport = () => Object.fromEntries(def.reportFields.map((f) => [f.key, f.type === 'date' ? todayISO() : '']));

  const state = {
    ready: false,
    persistent: true,
    cases: [],
    index: 0,
    report: defaultReport(),
    lists: Object.fromEntries(Object.entries(def.lists).map(([k, v]) => [k, [...v]])),
    restored: null,
    createdAt: Date.now(),
    savedAt: 0,
  };

  // ---- persistence -------------------------------------------------------------------------

  const dirty = new Set();
  const removed = new Set();
  let metaDirty = false;
  let saving = Promise.resolve();
  const protectedImages = new Set(); // images of deleted/cleared cards while their Undo is offered

  function metaRecord() {
    return {
      version: 1,
      order: state.cases.map((c) => c.id),
      index: state.index,
      report: state.report,
      createdAt: state.createdAt,
      updatedAt: Date.now(),
    };
  }

  async function flush() {
    if (!state.persistent) return;
    if (!dirty.size && !removed.size && !metaDirty) return;
    const ops = [];
    const byId = new Map(state.cases.map((c) => [c.id, c]));
    for (const id of dirty) if (byId.has(id)) ops.push({ store: 'cases', type: 'put', value: byId.get(id) });
    for (const id of removed) if (!byId.has(id)) ops.push({ store: 'cases', type: 'delete', key: id });
    ops.push({ store: 'kv', type: 'put', key: META_KEY, value: metaRecord() });
    dirty.clear();
    removed.clear();
    metaDirty = false;
    emit('saving');
    saving = saving.then(() => db.write(ops)).then(() => {
      state.savedAt = Date.now();
      emit('saved', { at: state.savedAt });
    }).catch((err) => {
      console.error('Autosave failed', err);
      emit('save-error', { error: err });
    });
    await saving;
  }

  const scheduleSave = debounce(flush, 250);

  function touch(c) {
    if (c) {
      c.updatedAt = Date.now();
      dirty.add(c.id);
    }
    metaDirty = true;
    scheduleSave();
  }

  // ---- image object-URL cache ----------------------------------------------------------------

  const urlCache = new Map(); // `${id}:${kind}` -> objectURL
  // Used only when IndexedDB is unavailable (private mode in some browsers).
  const memoryImages = new Map();

  async function imageUrl(id, kind = 'thumb') {
    const key = `${id}:${kind}`;
    if (urlCache.has(key)) return urlCache.get(key);
    const rec = await db.get('images', id).catch(() => null) || memoryImages.get(id);
    if (!rec) return '';
    const blob = kind === 'thumb' ? (rec.thumb || rec.blob) : rec.blob;
    const url = URL.createObjectURL(blob);
    urlCache.set(key, url);
    return url;
  }

  function revokeImage(id) {
    for (const kind of ['thumb', 'full']) {
      const key = `${id}:${kind}`;
      if (urlCache.has(key)) {
        URL.revokeObjectURL(urlCache.get(key));
        urlCache.delete(key);
      }
    }
  }

  async function putImages(records) {
    if (!records.length) return;
    if (state.persistent) {
      await db.write(records.map((r) => ({ store: 'images', type: 'put', value: r })));
    } else {
      for (const r of records) memoryImages.set(r.id, r);
    }
  }

  async function deleteImages(ids) {
    ids = ids.filter((id) => !protectedImages.has(id));
    if (!ids.length) return;
    ids.forEach(revokeImage);
    if (state.persistent) await db.write(ids.map((id) => ({ store: 'images', type: 'delete', key: id })));
    else ids.forEach((id) => memoryImages.delete(id));
  }

  async function collectGarbage() {
    if (!state.persistent) return;
    try {
      const used = new Set(state.cases.flatMap((c) => c.images));
      const all = await db.keys('images');
      const orphans = all.filter((id) => !used.has(id) && !protectedImages.has(id));
      if (orphans.length) await deleteImages(orphans);
    } catch (err) {
      console.warn('Image cleanup skipped', err);
    }
  }

  // ---- public API ----------------------------------------------------------------------------

  return {
    def,
    state,
    on,
    blank,
    normalize,
    isComplete,
    missingFields,
    hasContent,

    async init() {
      state.persistent = await db.available();
      if (state.persistent) {
        try {
          const meta = await db.get('kv', META_KEY);
          const rows = await db.getAll('cases');
          if (meta && rows.length) {
            const byId = new Map(rows.map((r) => [r.id, normalize(r)]));
            const ordered = meta.order.map((id) => byId.get(id)).filter(Boolean);
            // cards present in the store but missing from the order (interrupted save) go last
            for (const c of byId.values()) if (!meta.order.includes(c.id)) ordered.push(c);
            state.cases = ordered.slice(0, def.maxItems);
            state.index = clamp(meta.index | 0, 0, state.cases.length - 1);
            state.report = { ...defaultReport(), ...(meta.report || {}) };
            state.createdAt = meta.createdAt || Date.now();
            state.savedAt = meta.updatedAt || 0;
            const meaningful = state.cases.filter(hasContent).length;
            if (meaningful) state.restored = { count: meaningful, savedAt: state.savedAt };
          }
        } catch (err) {
          console.error('Could not restore the previous session', err);
        }
        db.persist();
      }
      if (!state.cases.length) {
        state.cases = [blank()];
        state.index = 0;
      }
      state.ready = true;
      collectGarbage();
      addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      addEventListener('pagehide', () => flush());
      emit('ready');
    },

    flush,

    get count() { return state.cases.length; },
    get index() { return state.index; },
    get current() { return state.cases[state.index]; },
    caseAt: (i) => state.cases[i],
    indexOf: (id) => state.cases.findIndex((c) => c.id === id),

    goTo(i) {
      const next = clamp(i, 0, state.cases.length - 1);
      if (next === state.index) return false;
      const from = state.index;
      state.index = next;
      metaDirty = true;
      scheduleSave();
      emit('navigate', { from, to: next });
      return true;
    },

    setField(id, key, value) {
      const c = state.cases.find((x) => x.id === id);
      if (!c || !def.fieldByKey[key]) return;
      const v = cleanText(value, APP.maxFieldLength);
      if (c[key] === v) return;
      c[key] = v;
      applyRules(c);
      touch(c);
      emit('case', { id, key });
    },

    /** Appends a blank card after the last one; returns its index or -1 at the limit. */
    addCase() {
      if (state.cases.length >= def.maxItems) return -1;
      const c = blank();
      state.cases.push(c);
      touch(c);
      emit('structure');
      return state.cases.length - 1;
    },

    /** Removes a card; returns an undo handle. The last remaining card is replaced by a blank one. */
    deleteCase(i) {
      const c = state.cases[i];
      if (!c) return null;
      state.cases.splice(i, 1);
      removed.add(c.id);
      c.images.forEach((id) => protectedImages.add(id));
      let placeholder = null;
      if (!state.cases.length) {
        placeholder = blank();
        state.cases.push(placeholder);
        dirty.add(placeholder.id);
      }
      state.index = clamp(state.index > i ? state.index - 1 : state.index, 0, state.cases.length - 1);
      touch(null);
      emit('structure');
      return {
        undo: () => {
          if (placeholder && state.cases.length === 1 && state.cases[0] === placeholder && !hasContent(placeholder)) {
            state.cases = [];
            removed.add(placeholder.id);
          }
          const at = clamp(i, 0, state.cases.length);
          state.cases.splice(at, 0, c);
          removed.delete(c.id);
          c.images.forEach((id) => protectedImages.delete(id));
          state.index = at;
          touch(c);
          emit('structure');
        },
        commit: () => {
          c.images.forEach((id) => protectedImages.delete(id));
          if (!state.cases.includes(c)) deleteImages(c.images);
        },
      };
    },

    /** Clears every field and screenshot of a card (bookmark is kept); returns an undo handle. */
    clearCase(id) {
      const c = state.cases.find((x) => x.id === id);
      if (!c) return null;
      const snapshot = Object.fromEntries(def.fieldKeys.map((k) => [k, c[k]]));
      const images = c.images.slice();
      images.forEach((x) => protectedImages.add(x));
      for (const k of def.fieldKeys) c[k] = '';
      c.images = [];
      touch(c);
      emit('case', { id, key: '*' });
      return {
        undo: () => {
          Object.assign(c, snapshot);
          c.images = images.concat(c.images.filter((x) => !images.includes(x)));
          images.forEach((x) => protectedImages.delete(x));
          touch(c);
          emit('case', { id, key: '*' });
        },
        commit: () => {
          images.forEach((x) => protectedImages.delete(x));
          deleteImages(images.filter((x) => !c.images.includes(x)));
        },
      };
    },

    toggleBookmark(id) {
      const c = state.cases.find((x) => x.id === id);
      if (!c) return false;
      c.bookmarked = !c.bookmarked;
      touch(c);
      emit('bookmark', { id, value: c.bookmarked });
      return c.bookmarked;
    },

    clearBookmarks() {
      for (const c of state.cases) if (c.bookmarked) { c.bookmarked = false; dirty.add(c.id); }
      touch(null);
      emit('bookmark', {});
    },

    moveCase(from, to) {
      if (from === to || !state.cases[from]) return;
      const currentId = state.cases[state.index].id;
      const [c] = state.cases.splice(from, 1);
      state.cases.splice(clamp(to, 0, state.cases.length), 0, c);
      state.index = state.cases.findIndex((x) => x.id === currentId);
      touch(null);
      emit('structure');
    },

    /** Removes cards that have no content at all (used before reporting). Returns how many. */
    pruneEmpty() {
      if (state.cases.length <= 1) return 0;
      const keep = state.cases.filter(hasContent);
      const dropped = state.cases.length - keep.length;
      if (!dropped) return 0;
      for (const c of state.cases) if (!keep.includes(c)) removed.add(c.id);
      const currentId = state.cases[state.index]?.id;
      state.cases = keep.length ? keep : [blank()];
      const idx = state.cases.findIndex((c) => c.id === currentId);
      state.index = idx >= 0 ? idx : 0;
      touch(null);
      emit('structure');
      return dropped;
    },

    // ---- screenshots ----

    async addImages(caseId, records) {
      const c = state.cases.find((x) => x.id === caseId);
      if (!c) return 0;
      const room = APP.maxImagesPerCase - c.images.length;
      const accepted = records.slice(0, Math.max(0, room));
      await putImages(accepted);
      c.images.push(...accepted.map((r) => r.id));
      touch(c);
      emit('images', { id: caseId });
      return accepted.length;
    },

    removeImage(caseId, imageId) {
      const c = state.cases.find((x) => x.id === caseId);
      if (!c) return null;
      const at = c.images.indexOf(imageId);
      if (at < 0) return null;
      c.images.splice(at, 1);
      protectedImages.add(imageId);
      touch(c);
      emit('images', { id: caseId });
      return {
        undo: () => {
          c.images.splice(Math.min(at, c.images.length), 0, imageId);
          protectedImages.delete(imageId);
          touch(c);
          emit('images', { id: caseId });
        },
        commit: () => {
          protectedImages.delete(imageId);
          if (!c.images.includes(imageId)) deleteImages([imageId]);
        },
      };
    },

    moveImage(caseId, from, to) {
      const c = state.cases.find((x) => x.id === caseId);
      if (!c || from === to) return;
      const [x] = c.images.splice(from, 1);
      c.images.splice(clamp(to, 0, c.images.length), 0, x);
      touch(c);
      emit('images', { id: caseId });
    },

    imageUrl,

    async imageRecord(id) {
      if (!state.persistent) return memoryImages.get(id) || null;
      return (await db.get('images', id)) || null;
    },

    // ---- bulk replace / append (upload, project file) ----

    async loadCases(cases, images = [], { mode = 'replace', report = null } = {}) {
      const incoming = cases.map(normalize);
      const ids = new Set(state.cases.map((c) => c.id));
      for (const c of incoming) if (ids.has(c.id)) c.id = uid(def.uidPrefix);
      await putImages(images);
      let firstNew = 0;
      if (mode === 'append') {
        const keep = state.cases.filter(hasContent);
        for (const c of state.cases) if (!keep.includes(c)) removed.add(c.id);
        const room = def.maxItems - keep.length;
        const added = incoming.slice(0, Math.max(0, room));
        firstNew = keep.length;
        state.cases = keep.concat(added);
        added.forEach((c) => dirty.add(c.id));
      } else {
        for (const c of state.cases) removed.add(c.id);
        state.cases = incoming.slice(0, def.maxItems);
        state.cases.forEach((c) => dirty.add(c.id));
        state.createdAt = Date.now();
      }
      if (!state.cases.length) state.cases = [blank()];
      if (report) {
        for (const [k, v] of Object.entries(report)) {
          if (k in state.report && !isBlank(v) && (mode === 'replace' || isBlank(state.report[k]))) state.report[k] = cleanText(v, 300);
        }
      }
      state.index = clamp(firstNew, 0, state.cases.length - 1);
      state.restored = null;
      touch(null);
      await flush();
      collectGarbage();
      emit('structure');
      emit('report');
      return firstNew;
    },

    async reset() {
      for (const c of state.cases) removed.add(c.id);
      state.cases = [blank()];
      state.index = 0;
      state.report = defaultReport();
      state.restored = null;
      state.createdAt = Date.now();
      urlCache.forEach((url) => URL.revokeObjectURL(url));
      urlCache.clear();
      memoryImages.clear();
      protectedImages.clear();
      touch(state.cases[0]);
      await flush();
      if (state.persistent) await db.write([{ store: 'images', type: 'clear' }]);
      emit('structure');
      emit('report');
    },

    // ---- report details & lists ----

    setReport(key, value) {
      if (!(key in state.report)) return;
      state.report[key] = cleanText(value, 300);
      touch(null);
      emit('report', { key });
    },

    setLists(lists) {
      for (const k of Object.keys(state.lists)) {
        if (Array.isArray(lists?.[k]) && lists[k].length) state.lists[k] = lists[k];
      }
      emit('lists');
    },

    /** Dropdown suggestions: the workspace list + values already used in this session. */
    suggestions(key) {
      const base = state.lists[key] || [];
      const seen = new Set(base.map((x) => x.toLowerCase()));
      const out = base.slice();
      for (const c of state.cases) {
        const v = (c[key] || '').trim();
        if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
        if (out.length > 300) break;
      }
      return out;
    },

    bookmarks() {
      const out = [];
      state.cases.forEach((c, i) => { if (c.bookmarked) out.push({ c, i }); });
      return out;
    },

    stats(cases = state.cases) {
      return def.stats(cases, { isComplete });
    },
  };
}

export const store = createStore(TESTCASES);
export const enhancementStore = createStore(ENHANCEMENTS);

// Test-case helpers used by the Test Cases-only pages (upload, reporting).
export const { isComplete, missingFields, hasContent } = store;
