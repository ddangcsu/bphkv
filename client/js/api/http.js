// =========================
// File: /js/api/http.js
// Purpose: Centralize Axios config so swapping backends is easy
// Exposes: window.API.http (Axios instance) and window.API.setBaseURL()
// =========================
(function initHttp(global) {
  'use strict';
  const root = global.API || (global.API = {});

  const DEFAULT_BASE_URL = 'http://localhost:3000';

  // Create axios instance
  const http = axios.create({
    baseURL: DEFAULT_BASE_URL,
    headers: { Accept: 'application/json' },
    timeout: 5000,
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
