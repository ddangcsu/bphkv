// /js/schemas/forms.events.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});
  const forms = root.Forms || (root.Forms = {});
  const { Options } = root;

  function Events(eventCtx = {}) {
    const eventFields = {
      main: [
        { col: 'id', label: 'Event ID', type: 'text', placeholder: 'Self Generated', default: () => Util.Format.makeId('E'), disabled: true },
        {
          col: 'programId',
          label: 'Program Code',
          type: 'select',
          selOpt: () => Options.PROGRAM_OPTIONS,
          default: '',
        },
        {
          col: 'eventType',
          label: 'Event Type',
          type: 'select',
          selOpt: () => Options.EVENT_TYPES,
          default: '',
        },
        { col: 'title', label: 'Description', type: 'text', default: '', placeholder: 'TNTT Roster 2025-26' },
        {
          col: 'year',
          label: 'School Year',
          type: 'select',
          selOpt: () => Options.YEAR_OPTIONS,
          default: () => Util.Helpers.getCurrentSchoolYear(),
        },
        {
          col: 'level',
          label: 'Scope Level',
          type: 'select',
          selOpt: () => Options.LEVEL_OPTIONS,
          default: '',
        },
        { col: 'openDate', label: 'Open Date', type: 'date', default: '' },
        { col: 'endDate', label: 'End Date', type: 'date', default: '' },
      ],
      feeRow: [
        {
          col: 'code',
          label: 'Fee Type',
          type: 'select',
          selOpt: () => Options.FEE_CODES,
          default: '',
        },
        { col: 'amount', label: 'Fee Amount', type: 'number', default: 0, attrs: { min: 0, step: 1 } },
      ],
      prerequisiteRow: [
        {
          col: 'eventId',
          label: 'Prerequisite Event',
          type: 'select',
          selOpt: (fieldMeta, ctx) => {
            const index = Number.isInteger(ctx?.index) ? ctx.index : -1;
            const getList = (typeof eventCtx.availablePrerequisiteOptions === 'function' && eventCtx.availablePrerequisiteOptions) || null;
            const list = getList ? getList(index) : [];
            return list.map((e) => ({
              value: e.id,
              label: `${e.programId}_${e.eventType}_${e.year} ${e.title}`,
            }));
          },
          default: '',
          relativeDisplay: [
            {
              label: 'Type',
              rdSource: 'eventRows',
              rdKey: 'id',
              rdCol: 'eventType',
              map: () => {
                return Options.EVENT_TYPES;
              },
            },
            { label: 'Description', rdSource: 'eventRows', rdKey: 'id', rdCol: 'title' },
          ],
        },
      ],
    };

    return eventFields;
  }

  forms.Events = Events;
})(typeof window !== 'undefined' ? window : globalThis);
