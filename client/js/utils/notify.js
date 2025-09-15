const listeners = new Set();
export function setStatus(message, level = 'info', ms = 1500) {
  for (const l of listeners) l({ message, level, ms, at: Date.now() });
}
export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
