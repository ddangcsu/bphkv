// /js/utils/filter.menu.js
(function (global) {
  'use strict';
  const U = global.Util || (global.Util = {});
  const Helpers = U.Helpers || (U.Helpers = {});
  const { ref, reactive, computed } = Vue;

  Helpers.createFilterMenu = function createFilterMenu(definitions = [], initialState = {}) {
    const isOpen = ref(false);
    const state = reactive({});

    definitions.forEach((def) => {
      const key = def.key;
      const hasInitial = Object.prototype.hasOwnProperty.call(initialState, key);
      const initial = hasInitial
        ? initialState[key]
        : typeof def.default === 'function'
        ? def.default()
        : def.default ?? def.emptyValue ?? '';
      state[key] = initial;
    });

    const snapshot = JSON.parse(JSON.stringify(state));

    function open() {
      isOpen.value = true;
    }
    function close() {
      isOpen.value = false;
    }
    function toggle() {
      isOpen.value = !isOpen.value;
    }
    function clear() {
      definitions.forEach((def) => {
        const empty = def.emptyValue !== undefined ? def.emptyValue : '';
        state[def.key] = Array.isArray(state[def.key]) ? [] : empty;
      });
      return true;
    }

    const activeCount = computed(() => {
      let count = 0;
      definitions.forEach((def) => {
        const value = state[def.key];
        const empty = def.emptyValue !== undefined ? def.emptyValue : '';
        if (Array.isArray(value) ? value.length : value !== empty && value !== '' && value != null) count++;
      });
      return count;
    });

    function applyTo(list) {
      return (Array.isArray(list) ? list : []).filter((row) => {
        return definitions.every((def) => {
          const value = state[def.key];
          const empty = def.emptyValue !== undefined ? def.emptyValue : '';
          const isUnset = Array.isArray(value) ? value.length === 0 : value === empty || value === '' || value == null;
          if (isUnset) return true;

          if (typeof def.matches === 'function') return def.matches(row, value, state);

          let rowValue;
          if (typeof def.get === 'function') {
            rowValue = def.get(row, state);
          } else if (def.field) {
            rowValue = Helpers.getByPath(row, def.field);
          } else {
            rowValue = row[def.key];
          }

          if (def.type === 'text') {
            const q = String(value).toLowerCase().trim();
            return String(rowValue ?? '')
              .toLowerCase()
              .includes(q);
          }
          if (def.type === 'select') {
            return String(rowValue ?? '') === String(value);
          }
          if (def.type === 'multiselect') {
            return Array.isArray(value) ? value.includes(rowValue) : true;
          }
          if (def.type === 'checkbox') {
            return !!rowValue === !!value;
          }
          return true;
        });
      });
    }

    // NEW: dynamic options resolver; templates call menu.opt(def, rows)
    const opt = (def, ctx = {}) => {
      const Ctx = ctx;
      Ctx.state = state;
      return Helpers.getOptions(def, Ctx);
    };

    return {
      get isOpen() {
        return isOpen.value;
      },
      open,
      close,
      toggle,
      clear,
      get activeCount() {
        return activeCount.value;
      },
      definitions,
      state,
      applyTo,
      opt,
    };
  };

  // Usage:
  //   const textFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => { ... });
  //   const filtered = textFilter.applyTo(list); // uses textFilter.query internally
  //   <input v-model="textFilter.querySearch" ... />
  Helpers.createTextFilter = function createTextFilter(matchesFn) {
    const query = ref('');

    function normalize(input) {
      return String(input ?? '').toLowerCase();
    }
    function tokenize(raw) {
      return normalize(raw).split(/\s+/).filter(Boolean);
    }
    function includesAllTerms(haystack, terms) {
      return terms.every((t) => haystack.includes(t));
    }

    function defaultMatch(row, raw, terms, utils) {
      const haystack = utils.normalize(
        // Fallback: stringify a couple of common fields, then whole object
        (row && (row.id || row.title || row.name)) ?? JSON.stringify(row),
      );
      return utils.includesAllTerms(haystack, terms);
    }

    function applyTo(rows, overrideQuery) {
      const list = Array.isArray(rows) ? rows : [];
      const raw = overrideQuery !== undefined ? overrideQuery : query.value;
      const terms = tokenize(raw);
      if (terms.length === 0) return list;
      const utils = { normalize, tokenize, includesAllTerms };
      const fn = typeof matchesFn === 'function' ? matchesFn : defaultMatch;
      return list.filter((row) => fn(row, raw, terms, utils));
    }

    function set(newQuery) {
      query.value = String(newQuery ?? '');
    }
    function clear() {
      query.value = '';
      return true;
    }

    // Provide a property that works nicely with v-model in templates
    const api = { query, set, clear, applyTo };
    Object.defineProperty(api, 'querySearch', {
      get: () => query.value,
      set: (v) => set(v),
      enumerable: true,
    });

    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
