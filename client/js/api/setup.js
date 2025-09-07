// /js/api/setup.js
// Thin wrapper around API.Http for the Setup (app settings) resource.
// Usage:
//   API.Setup.get()                 -> returns merged, id-less settings
//   API.Setup.getOrSeed()           -> ensures the doc exists (creates on 404)
//   API.Setup.create(payload?)      -> creates { id: 'app', ...payload }
//   API.Setup.update(patch)         -> updates and returns id-less settings
//   API.Setup.list()                -> lists all settings docs (raw array)

(function (global) {
  'use strict';

  const root = global.API || (global.API = {});
  const http = root.Http; // provided by /js/api/http.js
  const BASE = '/settings';

  // Be tolerant to load order
  const { Schema = {} } = global;
  const { Setup: SetupSchema = {} } = Schema;
  const { FALLBACK_SETUP = {}, SETUP_DEFAULT_ID = 'app', mergeSetupWithFallback = (x) => x || {} } = SetupSchema;

  function stripId(obj) {
    if (!obj || typeof obj !== 'object') return {};
    const { id: _ignore, ...rest } = obj;
    return rest;
  }

  async function list() {
    const { data } = await http.get(BASE, { params: { _: Date.now() } });
    // The settings collection is expected to be an array
    return Array.isArray(data) ? data : [];
  }

  async function get() {
    const { data } = await http.get(`${BASE}/${encodeURIComponent(SETUP_DEFAULT_ID)}`);
    // Always return an id-less, merged view for the UI
    return mergeSetupWithFallback(stripId(data));
  }

  async function getOrSeed() {
    try {
      return await get();
    } catch (err) {
      // If not found, create it and return the fallback
      if (err && (err.status === 404 || err.code === 404)) {
        await create(FALLBACK_SETUP);
        return mergeSetupWithFallback(FALLBACK_SETUP);
      }
      throw err;
    }
  }

  async function create(payload = FALLBACK_SETUP) {
    const result = { id: SETUP_DEFAULT_ID, ...payload };
    const { data } = await http.post(BASE, result);
    return stripId(data);
  }

  async function update(patch) {
    const result = { id: SETUP_DEFAULT_ID, ...patch };
    const { data } = await http.put(`${BASE}/${encodeURIComponent(SETUP_DEFAULT_ID)}`, result);
    return stripId(data);
  }

  root.Setup = { list, get, getOrSeed, create, update };
})(typeof window !== 'undefined' ? (window.API ? window : ((window.API = {}), window)) : globalThis);
