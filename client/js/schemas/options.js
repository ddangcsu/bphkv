// /client/js/schemas/options.js
/* eslint-env browser, es2021 */
/* global Vue */
(function attachOptionsModule(global) {
  'use strict';

  const { reactive, watch } = Vue;

  // Establish Schema namespace
  const SchemaRoot = global.Schema || (global.Schema = {});
  const SetupApi = SchemaRoot.Setup || {};

  // Fallback structure (kept minimal; use your global fallback if present)
  const FALLBACK_SETUP = SetupApi.FALLBACK_SETUP || {
    programs: [],
    relationships: [],
    feeCodes: [],
    eventTypes: [],
    levels: [],
    paymentMethods: [],
    volunteers: [],
  };

  // ---------------------------------------------------------------------------
  // Internal state – live setup reference (reactive object filled by app.js)
  // ---------------------------------------------------------------------------
  let liveSetupRef = null;
  let enumsWatcherInstalled = false;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function buildEnumMap(sourceList, keyField = 'key', valueField = 'value') {
    const resultMap = {};
    if (Array.isArray(sourceList)) {
      for (const item of sourceList) {
        const key = item?.[keyField];
        const value = item?.[valueField];
        if (key != null && value != null) {
          resultMap[key] = value;
        }
      }
    }
    return resultMap;
  }

  function replaceEnumMap(targetMap, sourceMap) {
    for (const existingKey of Object.keys(targetMap)) {
      delete targetMap[existingKey];
    }
    for (const [enumKey, enumValue] of Object.entries(sourceMap || {})) {
      targetMap[enumKey] = enumValue;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API object
  // ---------------------------------------------------------------------------
  const Options = {
    /**
     * Wire the options module to the app's reactive setup object.
     * Call once during bootstrap in app.js.
     */
    setLiveSetupRef(setupRef) {
      if (!setupRef) {
        throw new Error('Schema.Options.setLiveSetupRef: setupRef is required');
      }
      liveSetupRef = setupRef;
    },

    // Static option lists you already used
    YES_NO_OPTIONS: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],

    REG_STATUS_OPTIONS: [
      { value: 'paid', label: 'Paid' },
      { value: 'cancelled', label: 'Cancelled' },
    ],

    /**
     * School-year helper: returns an array like
     *   [{value: 2024, label: "2024-25"}, ...]
     */
    getYearOptions({ before = 2, after = 2 } = {}) {
      const now = new Date();
      const currentSchoolYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

      const options = [];
      for (let offset = 0 - before; offset <= after; offset++) {
        const y = currentSchoolYear + offset;
        options.push({ value: y, label: `${String(y)}-${String(y + 1).slice(2)}` });
      }
      return options;
    },
  };

  // ---------------------------------------------------------------------------
  // Getters that read directly from the live setup (reactive arrays)
  // Keep shapes exactly as they are in your data.
  // ---------------------------------------------------------------------------
  Object.defineProperties(Options, {
    PARENTS: {
      get() {
        // Build a Set of relationship "value" entries where isParent === true
        const list = asArray(liveSetupRef?.relationships);
        const parentsOnly = list.filter((rel) => rel?.isParent === true);
        const normalized = parentsOnly.map((rel) => String(rel?.value ?? '').trim()).filter(Boolean);
        return new Set(normalized);
      },
    },

    PROGRAM_OPTIONS: { get: () => asArray(liveSetupRef?.programs) },
    RELATIONSHIP_OPTIONS: { get: () => asArray(liveSetupRef?.relationships) },
    FEE_CODES: { get: () => asArray(liveSetupRef?.feeCodes) },
    EVENT_TYPES: { get: () => asArray(liveSetupRef?.eventTypes) },
    LEVEL_OPTIONS: { get: () => asArray(liveSetupRef?.levels) },
    PAYMENT_METHOD_OPTIONS: { get: () => asArray(liveSetupRef?.paymentMethods) },
    VOLUNTEERS_OPTIONS: { get: () => asArray(liveSetupRef?.volunteers) },

    YEAR_OPTIONS: {
      get() {
        // Your app uses a small range; keep consistent
        return Options.getYearOptions({ before: 2, after: 2 });
      },
    },
  });

  // ---------------------------------------------------------------------------
  // Stable reactive ENUM maps (mutated in-place to remain referentially stable)
  // ---------------------------------------------------------------------------
  const ENUMS = {
    PROGRAM: reactive({}),
    EVENT: reactive({}),
    LEVEL: reactive({}),
    METHOD: reactive({}),
    FEE: reactive({}),
  };

  /**
   * Rebuild all ENUM maps from the live setup (or fallback).
   * Keeps objects stable so any refs bound in app.js remain valid.
   */
  function rebuildEnums() {
    const source = liveSetupRef || FALLBACK_SETUP;

    replaceEnumMap(ENUMS.PROGRAM, buildEnumMap(source.programs));
    replaceEnumMap(ENUMS.EVENT, buildEnumMap(source.eventTypes));
    replaceEnumMap(ENUMS.LEVEL, buildEnumMap(source.levels));
    replaceEnumMap(ENUMS.METHOD, buildEnumMap(source.paymentMethods));
    replaceEnumMap(ENUMS.FEE, buildEnumMap(source.feeCodes));
  }

  Object.defineProperty(Options, 'ENUMS', {
    get() {
      // Return the stable reactive objects
      return ENUMS;
    },
  });

  /**
   * Install a deep watcher on the live setup to keep ENUMS synchronized.
   * Call once from app.js right after setLiveSetupRef(...).
   */
  Options.initializeEnums = function initializeEnums() {
    if (!liveSetupRef) {
      throw new Error('Schema.Options.initializeEnums: call setLiveSetupRef(...) first');
    }
    if (enumsWatcherInstalled) return;

    // Build immediately, then keep in sync
    rebuildEnums();

    watch(
      liveSetupRef,
      () => {
        rebuildEnums();
      },
      { deep: true, immediate: false },
    );

    enumsWatcherInstalled = true;
  };

  // Alias the ENUMS to the global root
  Object.defineProperty(global, 'ENUMS', {
    get() {
      return Options.ENUMS;
    },
    enumerable: true,
  });

  // Expose
  SchemaRoot.Options = Options;
})(typeof window !== 'undefined' ? window : globalThis);
