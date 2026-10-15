// Minimal promise wrapper over IndexedDB, one database per workspace. Stores:
//   kv      - session metadata (key/value)
//   cases   - cards: test cases or enhancement requests (keyPath id)
//   images  - screenshots as Blobs (keyPath id)
// Everything stays in this browser; nothing is sent to a server.

const DB_VERSION = 1;

const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  tx.onerror = () => reject(tx.error);
});

const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export function createDb(name) {
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not available in this browser'));
        return;
      }
      const req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('cases')) db.createObjectStore('cases', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('The database is blocked by another tab'));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  return {
    name,

    async available() {
      try { await open(); return true; } catch { return false; }
    },

    async get(store, key) {
      const d = await open();
      return request(d.transaction(store).objectStore(store).get(key));
    },

    async getAll(store) {
      const d = await open();
      return request(d.transaction(store).objectStore(store).getAll());
    },

    async keys(store) {
      const d = await open();
      return request(d.transaction(store).objectStore(store).getAllKeys());
    },

    /**
     * Runs several writes in one transaction.
     * ops: [{ store, type: 'put'|'delete'|'clear', value?, key? }]
     */
    async write(ops) {
      if (!ops.length) return;
      const d = await open();
      const stores = [...new Set(ops.map((o) => o.store))];
      const tx = d.transaction(stores, 'readwrite');
      for (const op of ops) {
        const s = tx.objectStore(op.store);
        if (op.type === 'put') op.key === undefined ? s.put(op.value) : s.put(op.value, op.key);
        else if (op.type === 'delete') s.delete(op.key);
        else if (op.type === 'clear') s.clear();
      }
      return done(tx);
    },

    async estimate() {
      try {
        return await navigator.storage?.estimate?.();
      } catch {
        return null;
      }
    },

    async persist() {
      try {
        if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
          await navigator.storage.persist?.();
        }
      } catch { /* best effort */ }
    },
  };
}

// Test Cases database (name unchanged, so sessions saved by earlier versions are restored).
export const db = createDb('iraje-qa-management');
