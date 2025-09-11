// /js/utils/filter.menu.js
(function (global) {
  "use strict";
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
        : typeof def.default === "function"
        ? def.default()
        : def.default ?? def.emptyValue ?? "";
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
        const empty = def.emptyValue !== undefined ? def.emptyValue : "";
        state[def.key] = Array.isArray(state[def.key]) ? [] : empty;
      });
    }
    function reset() {
      Object.keys(snapshot).forEach((k) => {
        state[k] = snapshot[k];
      });
    }

    const activeCount = computed(() => {
      let count = 0;
      definitions.forEach((def) => {
        const value = state[def.key];
        const empty = def.emptyValue !== undefined ? def.emptyValue : "";
        if (Array.isArray(value) ? value.length : value !== empty && value !== "" && value != null) count++;
      });
      return count;
    });

    function applyTo(list) {
      return (Array.isArray(list) ? list : []).filter((row) => {
        return definitions.every((def) => {
          const value = state[def.key];
          const empty = def.emptyValue !== undefined ? def.emptyValue : "";
          const isUnset = Array.isArray(value) ? value.length === 0 : value === empty || value === "" || value == null;
          if (isUnset) return true;

          if (typeof def.matches === "function") return def.matches(row, value, state);

          let rowValue;
          if (typeof def.get === "function") {
            rowValue = def.get(row, state);
          } else if (def.field) {
            rowValue = Helpers.getByPath(row, def.field);
          } else {
            rowValue = row[def.key];
          }

          if (def.type === "text") {
            const q = String(value).toLowerCase().trim();
            return String(rowValue ?? "")
              .toLowerCase()
              .includes(q);
          }
          if (def.type === "select") {
            return String(rowValue ?? "") === String(value);
          }
          if (def.type === "multiselect") {
            return Array.isArray(value) ? value.includes(rowValue) : true;
          }
          if (def.type === "checkbox") {
            return !!rowValue === !!value;
          }
          return true;
        });
      });
    }

    return {
      get isOpen() {
        return isOpen.value;
      },
      open,
      close,
      toggle,
      clear,
      reset,
      get activeCount() {
        return activeCount.value;
      },
      definitions,
      state,
      applyTo,
    };
  };

  // NEW: simple external text search helper
  Helpers.createTextSearchFilter = function createTextSearchFilter({
    fields = ["title"], // which fields to search
    mode = "includes", // 'includes' | 'startsWith' | 'equals'
    normalize, // optional custom normalizer
  } = {}) {
    const queryRef = ref("");

    function normalizeText(value) {
      const s = String(value ?? "");
      return normalize ? normalize(s) : s.toLowerCase().trim();
    }

    function matchesRow(row, query) {
      if (!query) return true;
      const q = normalizeText(query);
      return fields.some((field) => {
        const v = normalizeText(row[field]);
        if (mode === "equals") return v === q;
        if (mode === "startsWith") return v.startsWith(q);
        return v.includes(q);
      });
    }

    function applyTo(list) {
      const data = Array.isArray(list) ? list : [];
      const q = queryRef.value;
      if (!q) return data;
      return data.filter((row) => matchesRow(row, q));
    }

    function clear() {
      queryRef.value = "";
    }

    return {
      get query() {
        return queryRef.value;
      },
      set query(v) {
        queryRef.value = v;
      },
      clear,
      applyTo,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
