// /js/utils/util.js
// One small, browser-friendly module that exposes formatting and generic helper
// utilities under a single global namespace.
//
// Usage (no imports):
//   const { makeId, normPhone, formatUSPhone, formatMoney } = Util.format;
//   const { getByPath, setDefault, evalMaybe, deepClone } = Util.helpers;

(function (global) {
  'use strict';
  const root = global.Util || (global.Util = {});

  // ------------------------------
  // Formatting helpers (UI-facing)
  // ------------------------------
  function randInt(bound) {
    if (!Number.isFinite(bound) || bound <= 0) return 0;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(1);
      const max = Math.floor(256 / bound) * bound; // largest multiple of bound <= 256
      let x;
      do {
        crypto.getRandomValues(buf);
        x = buf[0];
      } while (x >= max);
      return x % bound;
    }
    return Math.floor(Math.random() * bound);
  }

  function groupDigits(s, groupSize = 4) {
    const str = String(s || '');
    if (!groupSize || groupSize <= 0) return str;
    const m = str.match(new RegExp(`\\d{1,${groupSize}}`, 'g'));
    return m ? m.join('-') : str;
  }

  function randomNumericString(len = 12, forbidLeadingZero = true) {
    const L = Math.max(1, len | 0);
    let out = '';
    out += String(forbidLeadingZero ? 1 + randInt(9) : randInt(10));
    for (let i = 1; i < L; i++) out += String(randInt(10));
    return out;
  }

  function makeId(prefix, length = 12, groupSize = 4, forbidLeadingZero = true) {
    const digits = randomNumericString(length, forbidLeadingZero);
    const formatted = groupDigits(digits, groupSize);
    return `${prefix}:${formatted}`;
  }

  const normPhone = (s = '') => String(s || '').replace(/\D+/g, '');

  function formatUSPhone(raw = '') {
    const d = normPhone(raw).slice(0, 10);
    if (!d) return '';
    if (d.length < 4) return `(${d}`;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  const formatMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

  // ------------------------------
  // Generic helpers (data/object)
  // ------------------------------
  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    return String(path)
      .split('.')
      .reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }

  function setDefault(target, column, value) {
    const keys = String(column).split('.');
    let obj = target;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (obj[k] == null || typeof obj[k] !== 'object') obj[k] = {};
      obj = obj[k];
    }
    obj[keys[keys.length - 1]] = value;
  }

  const evalMaybe = (val, ctx) => (typeof val === 'function' ? val(ctx) : val);

  function deepClone(obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  }

  /** Build school-year choices like 2023-24 around a base year.
   * before: # years before baseYear (inclusive range)
   * after:  # years after  baseYear (inclusive range)
   * baseYear: defaults to current July-based school year
   */
  function getCurrentSchoolYear(now = new Date()) {
    const m = now.getMonth() + 1; // 1..12
    return m >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  }

  // Public surface (non-breaking shape)
  root.Format = { randInt, groupDigits, randomNumericString, makeId, normPhone, formatUSPhone, formatMoney };
  root.Helpers = { getByPath, setDefault, evalMaybe, deepClone, getCurrentSchoolYear };
})(typeof window !== 'undefined' ? (window.Util ? window : (window.Util = {}) && window) : globalThis);
