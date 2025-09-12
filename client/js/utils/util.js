// /js/utils/util.js

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

  function phone(raw = '') {
    const d = normPhone(raw).slice(0, 10);
    if (!d) return '';
    if (d.length < 4) return `(${d}`;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  const formatMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  const maskLast4 = (s = '') => {
    const d = normPhone(s);
    return d ? `•${d.slice(-4)}` : '';
  };

  function displayChildNameAndAge(child) {
    if (typeof child !== 'object') return null;

    const ln = (child?.lastName ?? '').trim();
    const fn = (child?.firstName ?? '').trim();
    const mn = (child?.middle ?? '').trim();
    // Use array to join it
    const name = [ln, [fn, mn].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const age = computeAgeByYear(child?.dob);
    return age == null ? name : `${name} - ${age} yo`;
  }

  // ------------------------------
  // Generic helpers (data/object)
  // ------------------------------
  function getByPath(object, path) {
    if (!object || !path) return undefined;
    return String(path)
      .split('.')
      .reduce((acc, key) => (acc == null ? acc : acc[key]), object);
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

  function evalMaybe(val, ctx) {
    return typeof val === 'function' ? val(ctx) : val;
  }

  function onFormFieldChange(fieldMeta, ctx = {}, event) {
    if (typeof fieldMeta?.onChange === 'function') {
      fieldMeta.onChange(fieldMeta, ctx, event);
    }
  }
  function onFormFieldInput(fieldMeta, ctx = {}, event) {
    if (typeof fieldMeta?.onInput === 'function') {
      fieldMeta.onInput(fieldMeta, ctx, event);
    }
  }

  function getFieldDisabled(field, ctx = {}) {
    // Global readonly flag
    if (ctx.isReadOnly && ctx.isReadOnly === true) return true;

    if (!('disabled' in field)) return false;
    return !!evalMaybe(field.disabled, ctx);
  }

  // Options resolver (now passes fieldMeta to selOpt functions)
  function getOptions(fieldMeta, ctx = {}) {
    const src = fieldMeta?.selOpt || fieldMeta?.options;
    if (!src) return [];
    if (Array.isArray(src)) return src;
    if (typeof src === 'function') return src(fieldMeta, ctx) || [];
    if (typeof src === 'object' && 'value' in src) {
      const v = src.value;
      return Array.isArray(v) ? v : [];
    }
    return [];
  }

  function formatOptionLabel(opt, withValue = false) {
    if (opt == null) return '';
    if (opt.label == null || opt.label === '' || opt.label === opt.value) return String(opt.value);
    if (typeof opt.value === 'boolean' || !withValue) return opt.label;
    return `${opt.value} - ${opt.label}`;
  }

  // Accept Array | Function(ctx)=>Array | Ref<Array> | undefined
  function resolveOptions(source, ctx) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (typeof source === 'function') return source(ctx) || [];
    if (typeof source === 'object' && 'value' in source) {
      const v = source.value;
      return Array.isArray(v) ? v : [];
    }
    return [];
  }

  // Option → label
  function codeToLabel(value, source, ctx = undefined, { withCode = false, fallback = '' } = {}) {
    const options = resolveOptions(source, ctx);
    const found = options.find((o) => o && o.value === value);
    if (!found) return fallback || (value ?? '');
    const label = found.label ?? found.value;
    return withCode ? `${found.value} - ${label}` : label;
  }

  function isVisible(field, ctx = {}) {
    if (!('show' in field)) return true;
    return !!evalMaybe(field.show, ctx);
  }

  function fieldClass(fieldMeta, ctx = {}) {
    // supports string | array | object | function(ctx)=>any of those
    const v =
      typeof fieldMeta?.classes === 'function' ? fieldMeta.classes(ctx) : fieldMeta?.classes ?? fieldMeta?.class;
    return v || null;
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

  function getDefaultValue(field, ctx) {
    if ('default' in field) return evalMaybe(field.default, ctx);
    return field.type === 'checkbox' ? false : '';
  }

  function buildFromFields(fields, { ctx = {}, overrides = {} } = {}) {
    const out = {};
    for (const f of fields) setDefault(out, f.col, getDefaultValue(f, ctx));
    for (const [path, value] of Object.entries(overrides)) setDefault(out, path, value);
    return out;
  }

  // Pure helper: returns ONE best-fit option (or [] if none)
  // Uses your existing computeAgeByYear(dob)
  // Internal: produce TNTT label by exact age
  function ageGroupLabelTNTT(age) {
    if (age == null) return null;
    if (age < 7) return 'Under Age';
    if (age >= 7 && age <= 9) return `Ấu Nhi Cấp ${age - 7 + 1}`; // 7→C1, 8→C2, 9→C3
    if (age >= 10 && age <= 12) return `Thiếu Nhi Cấp ${age - 10 + 1}`; // 10→C1, 11→C2, 12→C3
    if (age >= 13 && age <= 15) return `Nghĩa Sĩ Cấp ${age - 13 + 1}`; // 13→C1, 14→C2, 15→C3
    if (age >= 16) return 'Hiệp Sĩ';
    return null;
  }

  function getYearPart(input) {
    if (!input) return null;
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
      const m = input.match(/^(\d{4})/);
      if (m) return Number(m[1]);
      const d = new Date(input);
      if (!isNaN(d)) return d.getFullYear();
      return null;
    }
    if (input instanceof Date && !isNaN(input)) return input.getFullYear();
    return null;
  }

  function computeAgeByYear(dob) {
    const birthYear = getYearPart(dob);
    if (birthYear == null) return null;
    const age = getCurrentSchoolYear() - birthYear;
    return age < 0 ? 0 : age;
  }

  function listToString(arr, sep = ',') {
    return Array.isArray(arr) ? arr.join(sep) : typeof arr === 'string' ? arr : '';
  }

  function stringToList(str, sep = ',') {
    return Array.isArray(str)
      ? str
      : (str || '')
          .split(sep)
          .map((s) => s.trim())
          .filter(Boolean);
  }

  function toNumber(str) {
    return str == null || str === '' || Number.isFinite(Number(str)) ? Number(str) : 0;
  }

  function isoLocalString(date = new Date()) {
    const pad2 = (n) => String(n).padStart(2, '0');
    const pad3 = (n) => String(n).padStart(3, '0');

    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());
    const ms = pad3(date.getMilliseconds());

    const tz = -date.getTimezoneOffset(); // minutes east of UTC
    const sign = tz >= 0 ? '+' : '-';
    const tzh = pad2(Math.floor(Math.abs(tz) / 60));
    const tzm = pad2(Math.abs(tz) % 60);

    return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}${sign}${tzh}:${tzm}`;
  }

  function isoNowLocal() {
    return isoLocalString(new Date());
  }

  function isNonNegativeNumber(val) {
    if (val === null || val === undefined || val === '') return false;
    if (typeof val !== 'number' || !Number.isFinite(val)) return false;
    return val >= 0;
  }

  // ----- Schema-driven validation (generic + tiny) -----
  function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  function shouldSkip(fieldMeta, scope) {
    // Skip validate if disabled or hidden by `show`
    if (typeof fieldMeta.disabled === 'function' ? fieldMeta.disabled(scope) : fieldMeta.disabled) return true;
    if (typeof fieldMeta.show === 'function') {
      const shown = fieldMeta.show(scope);
      if (!shown) return true;
    } else if (fieldMeta.show === false) {
      return true;
    }
    return false;
  }

  function validateFields(fields, data, ctx) {
    const errors = {};
    const scope = { form: ctx?.form || data, row: data, index: ctx?.index, ctx };

    (fields || []).forEach((fieldMeta) => {
      if (!fieldMeta || !fieldMeta.col) return;
      if (shouldSkip(fieldMeta, scope)) return;

      const value = data ? data[fieldMeta.col] : undefined;

      if (fieldMeta.required && isEmpty(value)) {
        errors[fieldMeta.col] = fieldMeta.requiredMessage || 'Required';
        return;
      }

      if (typeof fieldMeta.validate === 'function') {
        const msg = fieldMeta.validate(value, scope);
        if (msg) errors[fieldMeta.col] = msg;
      }
    });

    return errors;
  }

  function validateRowArray(rowFields, rows, ctx) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, i) => validateFields(rowFields, row, { ...ctx, index: i, form: ctx?.form }));
  }

  // Public surface (non-breaking shape)
  root.Format = {
    normPhone,
    phone,
    formatMoney,
    capitalize,
    codeToLabel,
    ageGroupLabelTNTT,
    maskLast4,
    displayChildNameAndAge,
  };
  root.Helpers = {
    makeId,
    getByPath,
    setDefault,
    buildFromFields,
    evalMaybe,
    getCurrentSchoolYear,
    onFormFieldChange,
    onFormFieldInput,
    getOptions,
    formatOptionLabel,
    isVisible,
    fieldClass,
    getFieldDisabled,
    computeAgeByYear,
    listToString,
    stringToList,
    toNumber,
    isoNowLocal,
    isNonNegativeNumber,
    validateFields,
    validateRowArray,
    isEmpty,
  };
})(typeof window !== 'undefined' ? (window.Util ? window : (window.Util = {}) && window) : globalThis);
