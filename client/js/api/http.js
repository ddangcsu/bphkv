// =========================
// File: /js/api/http.js
// Purpose: Centralize Axios config so swapping backends is easy
// Exposes: window.API.http (Axios instance) and window.API.setBaseURL()
// =========================
(function initHttp(global) {
  'use strict';
  const root = global.API || (global.API = {});

  const DEFAULT_BASE_URL =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000';

  // Create axios instance
  const http = axios.create({
    baseURL: DEFAULT_BASE_URL,
    headers: { Accept: 'application/json' },
    timeout: 5000,
  });

  // after you create the axios instance
  http.interceptors.request.use((config) => {
    if (config && config.method && config.method.toLowerCase() === 'get') {
      // remove legacy cache-buster, if present
      if (config.params && Object.prototype.hasOwnProperty.call(config.params, '_')) {
        delete config.params._;
      }
      // prefer headers for no-cache behavior (harmless if upstream ignores)
      config.headers = config.headers || {};
      config.headers['Cache-Control'] = 'no-cache';
      config.headers['Pragma'] = 'no-cache';
    }
    return config;
  });

  // Response interceptor hook (optional: ETag/304, auth, logging)
  http.interceptors.response.use(
    (resp) => resp,
    (err) => {
      // Central place to log / transform errors
      return Promise.reject(err);
    },
  );

  // Allow runtime swap of baseURL (e.g., dev -> staging -> prod)
  function setBaseURL(url) {
    http.defaults.baseURL = url || DEFAULT_BASE_URL;
  }

  // Expose globally (no module bundler needed)
  root.Http = http;
  root.setBaseURL = setBaseURL;
})(typeof window !== 'undefined' ? (window.API ? window : (window.API = {}) && window) : globalThis);
