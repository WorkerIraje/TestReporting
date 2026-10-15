// Loads every test file (or ?only=<part of a file name>), runs the tests in order and reports.

import { registry, setFile } from './harness.js';

const FILES = ['store.test.js', 'project-file.test.js', 'report-model.test.js'];
const ON_DEMAND = ['report-parity.test.js']; // slow, writes files: only with ?only=
const TIMEOUT = 60_000;

const only = new URLSearchParams(location.search).get('only');
const list = document.getElementById('results');
const summary = document.getElementById('summary');
let pass = 0;
let fail = 0;

function report(file, name, err) {
  if (err) fail++;
  else pass++;
  const li = document.createElement('li');
  li.className = err ? 'fail' : 'pass';
  li.textContent = `${err ? 'FAIL' : 'ok'} · ${file} · ${name}`;
  if (err) {
    const small = document.createElement('small');
    small.textContent = String(err.stack || err.message || err);
    li.append(small);
  }
  list.append(li);
}

for (const file of only ? [...FILES, ...ON_DEMAND].filter((f) => f.includes(only)) : FILES) {
  setFile(file);
  try {
    await import(`./${file}`);
  } catch (err) {
    report(file, 'import', err);
  }
}

for (const t of registry) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(t.fn),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${TIMEOUT} ms`)), TIMEOUT); }),
    ]);
    report(t.file, t.name, null);
  } catch (err) {
    report(t.file, t.name, err);
  } finally {
    clearTimeout(timer);
  }
}

summary.dataset.status = fail ? 'fail' : 'pass';
summary.textContent = `${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`;
