// /js/mappers/families.js
// Maps Family records <-> Form model.
(function (global) {
  'use strict';
  const root = global.Mappers || (global.Mappers = {});

  const { formatUSPhone, makeId } = Util.Format;

  const Families = {
    toUi(row = {}) {
      const contacts = Array.isArray(row.contacts)
        ? row.contacts.map((c) => ({
            lastName: c.lastName || '',
            firstName: c.firstName || '',
            middle: c.middle || '',
            relationship: c.relationship || '',
            phone: formatUSPhone(c.phone || ''),
            email: c.email || '',
            isEmergency: !!c.isEmergency,
          }))
        : [{ lastName: '', firstName: '', middle: '', relationship: '', phone: '', email: '', isEmergency: false }];

      const children = Array.isArray(row.children)
        ? row.children.map((ch) => ({
            childId: ch.childId || makeId('C'),
            lastName: ch.lastName || '',
            firstName: ch.firstName || '',
            middle: ch.middle || '',
            saintName: ch.saintName || '',
            dob: (ch.dob || '').slice(0, 10),
            allergiesStr: Array.isArray(ch.allergies) ? ch.allergies.join(',') : '',
            isNameException: !!ch.isNameException,
            exceptionNotes: ch.exceptionNotes || '',
          }))
        : [
            {
              childId: makeId('C'),
              lastName: '',
              firstName: '',
              middle: '',
              saintName: '',
              dob: '',
              allergiesStr: '',
              isNameException: false,
              exceptionNotes: '',
            },
          ];

      const notes = Array.isArray(row.notes)
        ? row.notes.map((n) => ({
            timeStamp: n.timeStamp || new Date().toLocaleString(),
            note: n.note || '',
            updatedBy: n.updatedBy || '',
          }))
        : [];

      return {
        id: row.id || makeId('F'),
        parishMember: !!row.parishMember,
        parishNumber: row.parishMember ? row.parishNumber || '' : '',
        address: {
          street: row.address?.street || '',
          city: row.address?.city || '',
          state: row.address?.state || 'CA',
          zip: row.address?.zip || '',
        },
        contacts,
        children,
        notes,
      };
    },

    toApi(form) {
      return {
        id: form.id,
        parishMember: !!form.parishMember,
        parishNumber: form.parishMember ? form.parishNumber || null : null,
        address: {
          street: form.address?.street || '',
          city: form.address?.city || '',
          state: form.address?.state || '',
          zip: form.address?.zip || '',
        },
        contacts: (form.contacts || []).map((c) => ({
          lastName: c.lastName || '',
          firstName: c.firstName || '',
          middle: c.middle || null,
          relationship: c.relationship || '',
          phone: c.phone || null,
          email: c.email || null,
          isEmergency: !!c.isEmergency,
        })),
        children: (form.children || []).map((ch) => ({
          childId: ch.childId || makeId('C'),
          lastName: ch.lastName || '',
          firstName: ch.firstName || '',
          middle: ch.middle || null,
          saintName: ch.saintName || null,
          dob: ch.dob ? new Date(ch.dob).toISOString() : null,
          allergies: (ch.allergiesStr || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isNameException: !!ch.isNameException,
          exceptionNotes: ch.exceptionNotes || null,
        })),
        notes: (form.notes || []).map((n) => ({
          timeStamp: n.timeStamp || new Date().toLocaleString(),
          note: n.note || '',
          updatedBy: n.updatedBy || '',
        })),
      };
    },
  };

  root.Families = Families;
})(typeof window !== 'undefined' ? (window.Mappers ? window : (window.Mappers = {}) && window) : globalThis);
