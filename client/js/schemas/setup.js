// /js/schemas/setup.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});

  const SETUP_DEFAULT_ID = 'app';

  // ---- Seed data used when /settings/app does not exist on first run ----
  const FALLBACK_SETUP = {
    programs: [
      { key: 'BPH', value: 'BPH', label: 'Ban Phu Huynh' },
      { key: 'TNTT', value: 'TNTT', label: 'Thieu Nhi Thanh The' },
    ],
    relationships: [
      { value: 'Mother', label: 'Mother' },
      { value: 'Father', label: 'Father' },
      { value: 'Guardian', label: 'Guardian' },
      { value: 'Grandparent', label: 'Grandparent' },
      { value: 'Aunt', label: 'Aunt' },
      { value: 'Uncle', label: 'Uncle' },
      { value: 'Sibling', label: 'Sibling' },
    ],
    feeCodes: [
      { key: 'REG_FEE', value: 'REGF', label: 'Registration Fee' },
      { key: 'EVT_FEE', value: 'EVTF', label: 'Event Fee' },
      { key: 'SEC_FEE', value: 'SECF', label: 'Security Fee' },
      { key: 'NPM_FEE', value: 'NPMF', label: 'NonParish Fee' },
    ],
    eventTypes: [
      { key: 'ADMIN', value: 'ADM', label: 'Security' },
      { key: 'REGISTRATION', value: 'REG', label: 'Registration' },
      { key: 'EVENT', value: 'EVT', label: 'Event' },
    ],
    levels: [
      { key: 'PER_FAMILY', value: 'PF', label: 'Per Family' },
      { key: 'PER_CHILD', value: 'PC', label: 'Per Child' },
    ],
    paymentMethods: [
      { key: 'CASH', value: 'cash', label: 'Cash' },
      { key: 'CHECK', value: 'check', label: 'Check' },
      { key: 'ZELLE', value: 'zelle', label: 'Zelle' },
    ],
    volunteers: [{ program: '', value: 'Huy', label: 'Huy' }],
  };

  /** Merge a remote / normalized settings doc with our seed.
   * - keeps the remote values if present
   * - ensures shape stability if backend returns partials
   */
  function mergeSetupWithFallback(remote) {
    const src = remote && typeof remote === 'object' ? remote : {};
    const { id: _ignore, ...rest } = src; // never keep id inside the object you bind to UI
    return Object.assign({}, FALLBACK_SETUP, rest);
  }

  // Public surface
  root.Setup = { SETUP_DEFAULT_ID, FALLBACK_SETUP, mergeSetupWithFallback };
})(typeof window !== 'undefined' ? (window.Schema ? window : (window.Schema = {}) && window) : globalThis);
