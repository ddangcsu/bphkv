// /js/mappers/events.js
(function (global) {
  'use strict';
  const root = global.Mappers || (global.Mappers = {});
  const { makeId } = Util.Format;

  const Events = {
    toUi(row = {}) {
      return {
        id: row.id || makeId('E'),
        programId: row.programId || '',
        eventType: row.eventType || '',
        title: row.title || '',
        year: row.year ?? '',
        level: row.level || '',
        openDate: row.openDate || '',
        endDate: row.endDate || '',
        fees: Array.isArray(row.fees)
          ? row.fees.map((f) => ({ code: f.code || '', amount: Number(f.amount) || 0 }))
          : [],
        prerequisites: Array.isArray(row.prerequisites)
          ? row.prerequisites.map((p) => (typeof p === 'string' ? { eventId: p } : { eventId: p?.eventId || '' }))
          : [],
      };
    },

    toApi(form) {
      return {
        id: form.id,
        programId: form.programId,
        eventType: form.eventType,
        title: form.title,
        year: Number(form.year) || null,
        level: form.level,
        openDate: form.openDate || '',
        endDate: form.endDate || '',
        fees: (form.fees || []).map((f) => ({ code: f.code, amount: Number(f.amount) || 0 })),
        prerequisites: (form.prerequisites || []).map((p) => ({ eventId: p.eventId })),
      };
    },
  };

  root.Events = Events;
})(typeof window !== 'undefined' ? (window.Mappers ? window : (window.Mappers = {}) && window) : globalThis);
