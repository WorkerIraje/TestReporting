// Minimal in-browser test harness: tests register on import, run.js runs them in order.

export const registry = [];
let currentFile = '';

export const setFile = (name) => { currentFile = name; };

export function test(name, fn) {
  registry.push({ file: currentFile, name, fn });
}

export function ok(cond, msg = 'expected a truthy value') {
  if (!cond) throw new Error(msg);
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ? `${msg}: ` : ''}expected ${e}, got ${a}`);
}

/** Runs fn, expects it to reject, and checks the error; returns the error. */
export async function rejects(fn, check = () => true) {
  try {
    await fn();
  } catch (err) {
    if (!check(err)) throw new Error(`rejected with an unexpected error: ${err?.title || ''} ${err?.message || err}`);
    return err;
  }
  throw new Error('expected a rejection');
}
