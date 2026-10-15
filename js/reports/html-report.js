// Self-contained HTML report drawn from a report document: one file with embedded fonts, logo and
// screenshots, search + filters + image zoom on screen, and a repeating logo header and
// "Iraje Software" watermark on every printed page.

import { escapeHtml as e, blobToDataUrl, nextFrame } from '../core/util.js';
import { fetchBinary } from '../core/loader.js';
import { loadLogo } from './model.js';
import { TONES, tone, cellValue, cellStyle } from './tones.js';

const FONT_FILES = { 400: 'assets/fonts/poppins-latin-400-normal.woff2', 600: 'assets/fonts/poppins-latin-600-normal.woff2', 700: 'assets/fonts/poppins-latin-700-normal.woff2' };

async function fontFaces() {
  const out = [];
  for (const [weight, url] of Object.entries(FONT_FILES)) {
    try {
      const buf = await fetchBinary(url);
      const url64 = await blobToDataUrl(new Blob([buf], { type: 'font/woff2' }));
      out.push(`@font-face{font-family:'Poppins';font-weight:${weight};font-style:normal;font-display:swap;src:url(${url64}) format('woff2')}`);
    } catch { /* fall back to system fonts */ }
  }
  return out.join('\n');
}

const text = (v) => (v ? e(v) : '<span class="empty">—</span>');
const t = (key) => `t-${TONES[key] ? key : 'none'}`;

// every tone sets the same four custom properties; components read them
const TONE_CSS = Object.entries(TONES).map(([k, x]) => `.t-${k}{--fg:${x.fg};--bg:${x.bg};--soft:${x.soft};--bd:${x.border}}`).join('\n');

const CSS = `
:root{--blue:#0451CC;--navy:#1D2548;--ink:#1D2548;--ink2:#434C6B;--muted:#687290;--line:#E1E7F2;--line2:#EDF1F8;--bg:#F6F8FC;--soft:#F2F6FF}
${TONE_CSS}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Poppins,'Segoe UI',Roboto,Arial,sans-serif;color:var(--ink);background:#F6F8FC;font-size:14px;line-height:1.55}
h1,h2,h3,h4{margin:0;color:var(--navy);line-height:1.25}p{margin:0}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:50;overflow:hidden}
.wm span{transform:rotate(-35deg);font-size:min(12vw,130px);font-weight:700;color:rgba(4,81,204,.055);white-space:nowrap;letter-spacing:.02em;user-select:none}
.topbar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.topbar-in{max-width:1100px;margin:0 auto;padding:10px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.topbar img{height:30px}.topbar .t{font-weight:600;font-size:15px;flex:1;min-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.search{padding:9px 14px;border-radius:999px;border:1.5px solid var(--line);font:inherit;min-width:220px;background:#fff}
.search:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 4px rgba(4,81,204,.15)}
.chips{display:flex;gap:6px;flex-wrap:wrap}.chips button{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font:600 12.5px Poppins,sans-serif;color:var(--ink2);cursor:pointer}
.chips button[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}
.print{border:0;background:var(--blue);color:#fff;border-radius:999px;padding:9px 18px;font:600 13px Poppins,sans-serif;cursor:pointer}
table.frame{width:100%;border-collapse:collapse}table.frame>thead>tr>td,table.frame>tfoot>tr>td,table.frame>tbody>tr>td{padding:0}
.ph{display:flex;align-items:center;gap:12px;padding:0 0 8px;margin-bottom:14px;border-bottom:2px solid var(--blue);font-size:11px;color:var(--muted)}
.ph img{height:22px}.ph .grow{flex:1;text-align:right}
.pf{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:6px;margin-top:14px}
@media screen{table.frame>thead,table.frame>tfoot{display:none}}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 60px}
.card{background:#fff;border-radius:24px;border:1px solid var(--line2);box-shadow:0 6px 18px -8px rgba(29,37,72,.14);padding:28px;margin-bottom:22px;position:relative}
.cover{border-bottom:5px solid var(--blue);padding:40px 36px;background:linear-gradient(160deg,#fff 55%,#F2F6FF)}
.cover .logo{height:44px;margin-bottom:34px}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}
.cover h1{font-size:40px;letter-spacing:-.02em;margin:10px 0 6px}.cover .sub{color:var(--muted);font-size:16px}
.cover-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:28px;margin-top:30px;align-items:center}
.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.meta div{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 14px}
.meta small{display:block;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.meta b{font-weight:600;word-break:break-word}
.donut{position:relative;width:200px;height:200px;margin:0 auto}.donut svg{width:100%;height:100%;display:block}
.donut>div{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.donut b{font-size:32px;color:var(--navy);display:block;line-height:1}.donut small{color:var(--muted);font-size:12px}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;margin-top:14px;font-size:12.5px;color:var(--ink2)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
h2.sec{font-size:20px;margin-bottom:16px;display:flex;align-items:center;gap:10px}
h2.sec:before{content:'';width:6px;height:22px;border-radius:4px;background:var(--blue)}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:18px}
.kpi{border:1px solid var(--line2);border-radius:16px;padding:14px;border-bottom:3px solid var(--blue)}
.kpi small{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.kpi b{display:block;font-size:26px;color:var(--navy)}
.kpi[class*=" t-"]{border-bottom-color:var(--fg)}.kpi[class*=" t-"] b{color:var(--fg)}
.kpi.rate{background:var(--blue);border-color:var(--blue)}.kpi.rate b,.kpi.rate small{color:#fff}
.bar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--line2);margin-bottom:20px}
.grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:18px}.tbl+.tbl,.grid2+.tbl,.tbl+.grid2{margin-top:18px}
table.data{width:100%;border-collapse:collapse;font-size:13px}
table.data th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);background:#F9FBFF;padding:9px 10px;border-bottom:1px solid var(--line)}
table.data td{padding:9px 10px;border-bottom:1px solid var(--line2);vertical-align:top}
table.data .n{text-align:right;font-variant-numeric:tabular-nums}
table.data a{color:var(--blue);font-weight:700;text-decoration:none;white-space:nowrap}
.badge{display:inline-flex;align-items:center;gap:6px;padding:3px 11px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:var(--bg);color:var(--fg)}
.badge:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
.tx{color:var(--fg);font-weight:600}
.tc{border-left:6px solid var(--fg)}
.tc-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
.tid{font-weight:700;color:var(--blue);background:#F2F6FF;border:1px solid #E6EEFF;border-radius:999px;padding:4px 12px;font-size:13px}
.tc-head h3{flex:1;min-width:220px;font-size:18px;line-height:1.35}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}.facts.f4{grid-template-columns:repeat(4,minmax(0,1fr))}
.facts div{background:#F9FBFF;border:1px solid var(--line2);border-radius:12px;padding:8px 12px}
.facts small{display:block;font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.facts b{font-weight:600;font-size:13px;word-break:break-word}
.blk{margin-top:12px}.blk h4{font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--blue);margin-bottom:4px}
.blk p{white-space:pre-wrap;word-break:break-word;color:var(--ink2)}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.cmp>div{border-radius:14px;padding:12px 14px;border:1px solid var(--line2);background:#F9FBFF}
.cmp>div.act{background:var(--soft);border-color:var(--bd)}.cmp h4{font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px;color:var(--blue)}
.cmp>div.act h4{color:var(--ink2)}.cmp p{white-space:pre-wrap;word-break:break-word}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:10px}
figure{margin:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}
figure img{width:100%;display:block;cursor:zoom-in;background:#fff}
figcaption{font-size:12px;color:var(--muted);padding:7px 12px;border-top:1px solid var(--line2)}
.empty{color:#98A1B7}
.signoff .note{color:var(--muted);margin:-6px 0 14px}
table.sign th,table.sign td{border:1px solid var(--line)}table.sign td{height:58px;vertical-align:middle;color:var(--navy)}
table.sign td:first-child{width:22%}table.sign td:nth-child(2){width:28%}table.sign td:last-child{width:18%}
.foot{text-align:center;color:var(--muted);font-size:12.5px;padding:10px 0 30px}
.lb{position:fixed;inset:0;background:rgba(13,18,38,.92);display:none;align-items:center;justify-content:center;z-index:100;padding:20px;cursor:zoom-out}
.lb.on{display:flex}.lb img{max-width:100%;max-height:100%;border-radius:8px;background:#fff}
.hide{display:none!important}
@media screen and (max-width:760px){.cover-grid,.grid2,.cmp{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}.facts,.facts.f4{grid-template-columns:1fr 1fr}.meta{grid-template-columns:1fr}.cover h1{font-size:30px}.card{padding:18px;border-radius:18px}.shots{grid-template-columns:1fr}}
@page{size:A4;margin:12mm 12mm 12mm}
@media print{body{background:#fff;font-size:11.5px}.topbar,.lb{display:none!important}.wrap{max-width:none;padding:0}
.card{box-shadow:none;border-radius:12px;padding:16px;margin-bottom:12px;break-inside:auto}
.cover{min-height:0;break-after:page;break-inside:avoid;border:0;border-bottom:5px solid var(--blue);padding:22px 20px}.cover .logo{height:34px;margin-bottom:22px}.cover h1{font-size:30px}.cover-grid{margin-top:18px;gap:18px}.donut{width:170px;height:170px;break-inside:avoid}.donut b{font-size:26px}
.summary{break-after:page}.index{break-after:page}.signoff{break-inside:avoid}.per-page .signoff{break-before:page}
.tc{break-inside:auto}.tc-head,.facts,.cmp>div,figure,.blk{break-inside:avoid}
.per-page .tc{break-before:page}.per-page .tc:first-of-type{break-before:auto}
.shots{grid-template-columns:1fr}figure img{max-height:160mm;object-fit:contain}.blk.ev{break-inside:auto}.blk.ev h4{break-after:avoid}
.hide{display:block!important}.tc.hide{display:block!important}tr.hide{display:table-row!important}
.wm span{font-size:96px;color:rgba(4,81,204,.06)}}
`;

const SCRIPT = `
(function(){
var q=document.getElementById('q'),chips=document.querySelectorAll('.chips button'),filter='all';
function apply(){var t=(q.value||'').trim().toLowerCase();
document.querySelectorAll('[data-s]').forEach(function(el){var ok=(filter==='all'||el.getAttribute('data-st')===filter)&&(!t||el.getAttribute('data-s').indexOf(t)>-1);el.classList.toggle('hide',!ok);});}
q.addEventListener('input',apply);
chips.forEach(function(b){b.addEventListener('click',function(){filter=b.getAttribute('data-f');chips.forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});apply();});});
var lb=document.getElementById('lb'),lbi=lb.querySelector('img');
document.addEventListener('click',function(ev){var img=ev.target.closest('figure img');if(img){lbi.src=img.src;lbi.alt=img.alt;lb.classList.add('on');}else if(ev.target.closest('#lb')){lb.classList.remove('on');}});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape')lb.classList.remove('on');});
document.getElementById('pr').addEventListener('click',function(){window.print();});
})();`;

/** One data table: numeric / right-aligned columns get class n, toned cells colour, badge cells a pill. */
function dataTable(tbl, firstCell = (v) => text(v)) {
  const head = tbl.cols.map((c) => `<th${c.align === 'right' ? ' class="n"' : ''}>${e(c.head)}</th>`).join('');
  const rows = tbl.rows.map((r, ri) => {
    const cells = r.map((c, i) => {
      const v = cellValue(c);
      const st = cellStyle(c);
      const col = tbl.cols[i];
      if (i === 0 && firstCell) return `<td>${firstCell(v, ri)}</td>`;
      if (st.badge) return `<td><span class="badge ${t(st.tone)}">${e(v)}</span></td>`;
      const cls = [col.align === 'right' ? 'n' : '', st.tone ? `tx ${t(st.tone)}` : ''].filter(Boolean).join(' ');
      const body = v === '' || v === '—' || v === null || v === undefined ? text('') : e(v);
      return `<td${cls ? ` class="${cls}"` : ''}>${st.bold || col.bold ? `<b>${body}</b>` : body}</td>`;
    }).join('');
    return `<tr${tbl.rowAttrs ? tbl.rowAttrs(ri) : ''}>${cells}</tr>`;
  }).join('');
  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

export async function build(model, { store, onProgress = () => {} }) {
  onProgress(0.03, 'Preparing fonts and logo…');
  const [logo, fonts] = await Promise.all([loadLogo(), fontFaces()]);
  const { glance, summary, index } = model;
  const parts = [];
  const push = (...x) => parts.push(...x);
  // SVG donut (prints reliably in every browser and PDF viewer, unlike CSS conic gradients)
  const R = 80;
  const CIRC = 2 * Math.PI * R;
  const barTotal = glance.bar.reduce((n, b) => n + b.value, 0);
  let offset = 0;
  const arcs = glance.bar
    .filter((b) => b.value > 0 && barTotal)
    .map((b) => {
      const len = (b.value / barTotal) * CIRC;
      const arc = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${tone(b.tone).fg}" stroke-width="30" stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 100 100)"/>`;
      offset += len;
      return arc;
    }).join('');
  const donut = `<svg viewBox="0 0 200 200" role="img" aria-label="${e(glance.label)}"><circle cx="100" cy="100" r="${R}" fill="none" stroke="#E1E7F2" stroke-width="30"/>${arcs}</svg>`;
  const legend = (bar) => bar.map((b) => `<span><i style="background:${tone(b.tone).fg}"></i>${e(b.label)} ${b.value}</span>`).join('');
  const bar = (segments) => {
    const sum = segments.reduce((n, b) => n + b.value, 0);
    return `<div class="bar">${segments.map((b) => `<span style="width:${sum ? (b.value / sum) * 100 : 0}%;background:${tone(b.tone).fg}"></span>`).join('')}</div>`;
  };
  const productLine = model.productParts.map(e).join(' · ');

  push(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="${e(model.appName)}"><title>${e(model.title)}</title><style>${fonts}\n${CSS}</style></head><body>
<div class="wm" aria-hidden="true"><span>Iraje Software</span></div>
<header class="topbar"><div class="topbar-in"><img src="${logo.dataUrl}" alt="Iraje"><div class="t">${e(model.title)}</div>
<input id="q" class="search" type="search" placeholder="${e(model.searchPlaceholder)}" aria-label="${e(model.searchPlaceholder.replace('…', ''))}">
<div class="chips" role="group" aria-label="Filter">${model.filters.map((f, i) => `<button data-f="${e(f.key)}" aria-pressed="${i === 0}">${e(f.label)}</button>`).join('')}</div>
<button id="pr" class="print" type="button">Print / PDF</button></div></header>
<table class="frame"><thead><tr><td><div class="ph"><img src="${logo.dataUrl}" alt="Iraje"><span>${e(model.title)}</span><span class="grow">${productLine}</span></div></td></tr></thead>
<tfoot><tr><td><div class="pf"><span>Iraje Software · ${e(model.appName)}</span><span>Generated ${e(model.generatedLabel)}</span></div></td></tr></tfoot>
<tbody><tr><td><main class="wrap${model.layout === 'page' ? ' per-page' : ''}">`);

  // cover
  push(`<section class="card cover"><img class="logo" src="${logo.dataUrl}" alt="Iraje">
<div class="eyebrow">${e(model.subtitle)}</div><h1>${e(model.title)}</h1><p class="sub">${productLine || e(model.coverFallback)}</p>
<div class="cover-grid"><div class="meta">${model.meta.map(([k, v]) => `<div><small>${e(k)}</small><b>${e(v)}</b></div>`).join('')}</div>
<div><div class="donut">${donut}<div><div><b>${e(glance.hero.value)}</b><small>${e(glance.hero.label.toLowerCase())}</small></div></div></div>
<div class="legend">${legend(glance.bar)}</div></div></div></section>`);

  // executive summary
  push(`<section class="card summary"><h2 class="sec">${e(summary.title)}</h2><div class="kpis">
${summary.kpis.map((k) => `<div class="kpi${k.highlight ? ' rate' : k.tone === 'navy' ? '' : ` ${t(k.tone)}`}"><small>${e(k.label)}</small><b>${e(k.value)}</b></div>`).join('')}</div>
${bar(summary.bar)}`);
  const tables = summary.tables;
  for (let i = 0; i < tables.length; i++) {
    const block = (tbl) => `<div><h3 style="font-size:15px;margin-bottom:10px">${e(tbl.title)}</h3>${dataTable(tbl, null)}</div>`;
    if (tables[i].half && tables[i + 1]?.half) {
      push(`<div class="grid2">${block(tables[i])}${block(tables[i + 1])}</div>`);
      i++;
    } else {
      push(`<div class="tbl">${block(tables[i])}</div>`);
    }
  }
  push('</section>');

  // index
  const indexTable = {
    ...index,
    rowAttrs: (ri) => ` data-s="${e(model.items[ri].searchText)}" data-st="${e(model.items[ri].filterKey)}"`,
  };
  push(`<section class="card index"><h2 class="sec">${e(index.title)}</h2>${dataTable(indexTable, (v) => `<a href="#${e(v)}">${e(v)}</a>`)}</section>`);

  // items
  const total = model.items.length;
  for (let k = 0; k < total; k++) {
    const item = model.items[k];
    const fact = (f) => `<div><small>${e(f.label)}</small><b${f.tone && f.value ? ` class="tx ${t(f.tone)}"` : ''}>${text(f.value)}</b></div>`;
    push(`<article class="card tc ${t(item.accent)}" id="${e(item.id)}" data-s="${e(item.searchText)}" data-st="${e(item.filterKey)}">
<div class="tc-head"><span class="tid">${e(item.id)}</span><h3>${text(item.title)}</h3><span class="badge ${t(item.badge.tone)}">${e(item.badge.text)}</span></div>
<div class="facts${item.factsPerRow === 4 ? ' f4' : ''}">${item.facts.map(fact).join('')}</div>
${item.sections.map((s) => (s.type === 'compare'
    ? `<div class="cmp ${t(s.tone)}"><div><h4>${e(s.left.title)}</h4><p>${text(s.left.text)}</p></div><div class="act"><h4>${e(s.right.title)}</h4><p>${text(s.right.text)}</p></div></div>`
    : `<div class="blk"><h4>${e(s.title)}</h4><p>${text(s.text)}</p></div>`)).join('\n')}`);
    if (item.images.length) {
      push(`<div class="blk ev"><h4>${e(item.evidenceLabel)} · ${item.images.length} screenshot${item.images.length > 1 ? 's' : ''}</h4><div class="shots">`);
      for (let n = 0; n < item.images.length; n++) {
        const rec = await store.imageRecord(item.images[n]);
        if (!rec) continue;
        const src = await blobToDataUrl(rec.blob);
        push(`<figure><img src="${src}" alt="${e(item.id)} screenshot ${n + 1}" loading="lazy" width="${rec.w}" height="${rec.h}"><figcaption>${e(item.id)} · Screenshot ${n + 1} of ${item.images.length}</figcaption></figure>`);
      }
      push('</div></div>');
    }
    push('</article>');
    if (k % 10 === 0) {
      onProgress(0.08 + (k / total) * 0.88, `Adding ${item.id} (${k + 1} of ${total})…`);
      await nextFrame();
    }
  }

  if (model.signoff) {
    const so = model.signoff;
    push(`<section class="card signoff"><h2 class="sec">${e(so.title)}</h2>${so.note ? `<p class="note">${e(so.note)}</p>` : ''}
<table class="data sign"><thead><tr><th>Role</th><th>Name</th><th>Signature</th><th>Date</th></tr></thead><tbody>
${so.rows.map((r) => `<tr><td><b>${e(r.role)}</b></td><td>${e(r.name)}</td><td></td><td></td></tr>`).join('')}</tbody></table></section>`);
  }

  push(`<p class="foot">Generated by ${e(model.appName)} on ${e(model.generatedLabel)} · ${total} ${total === 1 ? model.noun.one : model.noun.many} · Iraje Software</p>
</main></td></tr></tbody></table><div class="lb" id="lb" role="dialog" aria-label="Screenshot"><img alt=""></div>
<script>${SCRIPT}</script></body></html>`);
  onProgress(1, 'Done');
  return new Blob(parts, { type: 'text/html;charset=utf-8' });
}
