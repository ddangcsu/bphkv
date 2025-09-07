(function (global) {
  'use strict';
  const root = global.API || (global.API = {});
  const http = root.Http;
  const map = (global.Mappers && global.Mappers.Families) || { toUi: (x) => x, toApi: (x) => x };
  const BASE = '/families';

  async function list() {
    const { data } = await http.get(BASE, { params: { _: Date.now() } });
    return Array.isArray(data) ? data.map(map.toUi) : [];
  }
  async function get(id) {
    const { data } = await http.get(`${BASE}/${encodeURIComponent(id)}`);
    return map.toUi(data);
  }
  async function create(uiPayload) {
    const { data } = await http.post(BASE, map.toApi(uiPayload));
    return map.toUi(data);
  }
  async function update(id, uiPatch) {
    const { data } = await http.put(`${BASE}/${encodeURIComponent(id)}`, map.toApi(uiPatch));
    return map.toUi(data);
  }
  async function remove(id) {
    await http.delete(`${BASE}/${encodeURIComponent(id)}`);
    return true;
  }

  root.Families = { list, get, create, update, remove };
})(typeof window !== 'undefined' ? (window.API ? window : (window.API = {}) && window) : globalThis);
