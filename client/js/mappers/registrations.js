// /js/mappers/registrations.js
(function (global) {
  'use strict';
  const root = global.Mappers || (global.Mappers = {});
  const { formatUSPhone, makeId } = Util.Format;

  const Registrations = {
    toUi(row = {}) {
      return {
        id: row.id || makeId('R'),
        eventId: row.eventId || '',
        familyId: row.familyId || '',
        status: row.status || '',
        acceptedBy: row.acceptedBy || '',
        parishMember: row.parishMember ?? null,
        event: {
          title: row.event?.title || '',
          year: row.event?.year || '',
          programId: row.event?.programId || '',
          eventType: row.event?.eventType || '',
        },
        contacts: Array.isArray(row.contacts)
          ? row.contacts.map((c) => ({
              name: c.name || '',
              relationship: c.relationship || '',
              phone: formatUSPhone(c.phone || ''),
            }))
          : [],
        children: Array.isArray(row.children)
          ? row.children.map((c) => ({
              childId: c.childId || '',
              saintName: c.saintName || '',
              fullName: c.fullName || '',
              dob: c.dob || '',
              allergies: Array.isArray(c.allergies) ? c.allergies.slice() : [],
              status: c.status || 'pending',
            }))
          : [],
        payments: Array.isArray(row.payments)
          ? row.payments.map((p) => ({
              code: p.code,
              unitAmount: Number(p.unitAmount ?? p.amount) || 0,
              amount: Number(p.amount) || 0,
              quantity: Number(p.quantity) || 0,
              method: p.method || '',
              txnRef: p.txnRef || '',
              receiptNo: p.receiptNo || '',
              receivedBy: p.receivedBy || '',
            }))
          : [],
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      };
    },

    toApi(form, { nowISO = new Date().toISOString() } = {}) {
      return {
        id: form.id,
        eventId: form.eventId,
        familyId: form.familyId,
        status: form.status,
        parishMember: form.parishMember ?? null,
        event: {
          title: form.event?.title || '',
          year: form.event?.year || '',
          programId: form.event?.programId || '',
          eventType: form.event?.eventType || '',
        },
        contacts: (form.contacts || []).map((c) => ({
          name: c.name || '',
          relationship: c.relationship || '',
          phone: c.phone || '',
        })),
        children: (form.children || [])
          .filter((c) => c.childId)
          .map((c) => ({
            childId: c.childId,
            saintName: c.saintName || '',
            fullName: c.fullName || '',
            dob: c.dob || '',
            allergies: Array.isArray(c.allergies) ? c.allergies.slice() : [],
            status: c.status || 'pending',
          })),
        payments: (form.payments || []).map((p) => ({
          code: p.code,
          unitAmount: Number(p.unitAmount) || 0,
          amount: Number(p.amount) || 0,
          quantity: Number(p.quantity) || 0,
          method: p.method || null,
          txnRef: p.txnRef || null,
          receiptNo: p.receiptNo || null,
          receivedBy: p.receivedBy || null,
          paidAt: p.method ? nowISO : null,
        })),
        acceptedBy: form.acceptedBy || null,
        createdAt: form.createdAt ? form.createdAt : nowISO,
        updatedAt: nowISO,
      };
    },
  };

  root.Registrations = Registrations;
})(typeof window !== 'undefined' ? (window.Mappers ? window : (window.Mappers = {}) && window) : globalThis);
