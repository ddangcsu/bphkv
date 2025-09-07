// /js/schemas/options.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});

  const YES_NO_OPTIONS = [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
  ];

  const REG_STATUS_OPTIONS = [
    { value: 'paid', label: 'Paid' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  function getYearOptions({ before = 4, after = 2 } = {}) {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const arr = [];
    for (let i = 0 - before; i <= after; i++) {
      const y = year + i;
      arr.push({ value: y, label: `${String(y)}-${String(y + 1).slice(2)}` });
    }
    return arr;
  }

  let _live = null;
  function setLiveSetupRef(ref) {
    _live = ref;
  }

  const arr = (a) => (Array.isArray(a) ? a : []);

  function buildEnumMap(list, keyField = 'key', valueField = 'value') {
    const out = {};
    if (Array.isArray(list)) {
      list.forEach((it) => {
        if (it && it[keyField] != null && it[valueField] != null) {
          out[it[keyField]] = it[valueField];
        }
      });
    }
    return out;
  }

  const Options = {
    YES_NO_OPTIONS,
    REG_STATUS_OPTIONS,
    getYearOptions,
    setLiveSetupRef,
  };

  Object.defineProperties(Options, {
    PROGRAM_OPTIONS: {
      get() {
        return arr(_live?.programs);
      },
    },
    RELATIONSHIP_OPTIONS: {
      get() {
        return arr(_live?.relationships);
      },
    },
    FEE_CODES: {
      get() {
        return arr(_live?.feeCodes);
      },
    },
    EVENT_TYPES: {
      get() {
        return arr(_live?.eventTypes);
      },
    },
    LEVEL_OPTIONS: {
      get() {
        return arr(_live?.levels);
      },
    },
    PAYMENT_METHOD_OPTIONS: {
      get() {
        return arr(_live?.paymentMethods);
      },
    },
    VOLUNTEERS_OPTIONS: {
      get() {
        return arr(_live?.volunteers);
      },
    },
    YEAR_OPTIONS: {
      get() {
        return getYearOptions({ before: 2, after: 2 });
      },
    },
    ENUMS: {
      get() {
        const s = _live || FALLBACK_SETUP;
        return {
          PROGRAM: buildEnumMap(s.programs),
          EVENT: buildEnumMap(s.eventTypes),
          LEVEL: buildEnumMap(s.levels),
          METHOD: buildEnumMap(s.paymentMethods),
        };
      },
    },
  });

  root.Options = Options;
})(typeof window !== 'undefined' ? window : globalThis);
