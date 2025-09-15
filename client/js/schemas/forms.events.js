// /js/schemas/forms.events.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});
  const forms = root.Forms || (root.Forms = {});
  const { Options } = root;

  const Ctx = {
    availablePrerequisiteOptions: () => [],
    eventOption(e) {
      return { value: e.id, label: `${e.programId}_${e.eventType}_${e.year} ${e.title}` };
    },
  };

  const eventFields = {
    main: [
      {
        col: 'id',
        label: 'Event ID',
        type: 'text',
        placeholder: 'Self Generated',
        default: () => Util.Helpers.makeId('E'),
        disabled: true,
        required: true,
      },
      {
        col: 'programId',
        label: 'Program Code',
        type: 'select',
        selOpt: () => Options.PROGRAM_OPTIONS,
        default: '',
        required: true,
      },
      {
        col: 'eventType',
        label: 'Event Type',
        type: 'select',
        selOpt: () => Options.EVENT_TYPES,
        default: '',
        required: true,
      },
      {
        col: 'title',
        label: 'Description',
        type: 'text',
        default: '',
        placeholder: 'Event Description',
        required: true,
      },
      {
        col: 'year',
        label: 'School Year',
        type: 'select',
        selOpt: () => Options.YEAR_OPTIONS,
        default: () => Util.Helpers.getCurrentSchoolYear(),
        required: true,
        api: {
          toApi: (v) => Util.Helpers.toNumber(v),
        },
      },
      {
        col: 'level',
        label: 'Scope Level',
        type: 'select',
        selOpt: () => Options.LEVEL_OPTIONS,
        default: '',
        required: true,
      },
      {
        col: 'openDate',
        label: 'Open Date',
        type: 'date',
        min: '2020-01-01',
        default: '',
        required: true,
      },
      { col: 'endDate', label: 'End Date', type: 'date', min: '2020-01-01', default: '', required: true },
    ],
    feeRow: [
      { col: 'code', label: 'Fee Type', type: 'select', selOpt: () => Options.FEE_CODES, default: '', required: true },
      {
        col: 'amount',
        label: 'Fee Amount',
        type: 'number',
        default: 0,
        attrs: { min: 0, step: 1 },
        require: true,
        api: {
          toApi: (v) => Util.Helpers.toNumber(v),
        },
        validate: (value) => (!Util.Helpers.isNonNegativeNumber(value) ? 'Required number >= 0' : ''),
      },
    ],
    prerequisiteRow: [
      {
        col: 'eventId',
        label: 'Prerequisite Event',
        type: 'select',
        selOpt: (_meta, ctx) => {
          const list = (Ctx.availablePrerequisiteOptions && Ctx.availablePrerequisiteOptions(ctx)) || [];
          return list.map(Ctx.eventOption);
        },
        required: true,
        default: '',
        relativeDisplay: [
          { label: 'Type', rdSource: 'eventRows', rdKey: 'id', rdCol: 'eventType', map: () => Options.EVENT_TYPES },
          { label: 'Description', rdSource: 'eventRows', rdKey: 'id', rdCol: 'title' },
        ],
      },
    ],
  };

  function Events(eventCtx = {}) {
    Object.assign(Ctx, eventCtx);
    return eventFields;
  }

  Events.newFee = function ({ ctx = {}, overrides = {} } = {}) {
    return Util.Helpers.buildFromFields(eventFields.feeRow, { ctx, overrides });
  };

  Events.newPreq = function ({ ctx = {}, overrides = {} } = {}) {
    return Util.Helpers.buildFromFields(eventFields.prerequisiteRow, { ctx, overrides });
  };

  Events.new = function ({ ctx = {}, overrides = {} } = {}) {
    const base = Util.Helpers.buildFromFields(eventFields.main, { ctx, overrides });
    return { ...base, fees: [Events.newFee()], prerequisites: [] };
  };

  Events.validate = function (eventDataRef, eventErrorRef) {
    const eventForm = eventDataRef || {};
    const eventErrors = eventErrorRef || {};

    function requiredPrereqType() {
      if (eventForm.eventType === Options.ENUMS.EVENT.REGISTRATION) return Options.ENUMS.EVENT.ADMIN;
      if (eventForm.eventType === Options.ENUMS.EVENT.EVENT) return Options.ENUMS.EVENT.REGISTRATION;
      return null; // ADM => none
    }

    const errors = {};
    // main
    errors.main = Util.Helpers.validateFields(eventFields.main, eventForm, { form: eventForm });
    // arrays
    errors.fees = Util.Helpers.validateRowArray(eventFields.feeRow, eventForm.fees, { form: eventForm });
    errors.prerequisites = Util.Helpers.validateRowArray(eventFields.prerequisiteRow, eventForm.prerequisites, {
      form: eventForm,
    });
    // Custom item
    if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) {
      errors.feeErrors = 'Event must have at least one fee entry';
    }
    if (requiredPrereqType() && (!Array.isArray(eventForm.prerequisites) || eventForm.prerequisites.length === 0))
      errors.preqErrors = 'Event required at least one prerequisite';

    if (
      Options.YEAR_OPTIONS.some((o) => Number(o.value) === Number(eventForm.year)) &&
      eventForm.openDate &&
      eventForm.endDate
    ) {
      const boundStart = new Date(Number(eventForm.year), 6, 1); // July = month 6 (0-based)
      const boundEnd = new Date(Number(eventForm.year) + 1, 6, 0, 23, 59, 59, 999); // June 30 end-of-day
      const start = new Date(eventForm.openDate);
      const end = new Date(eventForm.endDate);
      if (start > end) errors.main.openDate = 'Must <= End Date';
      if (start < boundStart) errors.main.openDate = 'Not in School Year';
      if (end > boundEnd) errors.main.endDate = 'Not in School Year';
    }

    eventErrors.value = {
      ...errors.main,
      fees: errors.fees || [],
      prerequisites: errors.prerequisites || [],
      feeErrors: errors.feeErrors,
      preqErrors: errors.preqErrors,
    };

    const mainErrors = Object.keys(errors.main).length === 0 && !errors.feeErrors && !errors.preqErrors;
    const feeErrors = (errors.fees || []).every((obj) => !obj || Object.keys(obj).length === 0);
    const prereqErrors = (errors.prerequisites || []).every((obj) => !obj || Object.keys(obj).length === 0);

    return mainErrors && feeErrors && prereqErrors;
  };

  forms.Events = Events;
})(typeof window !== 'undefined' ? window : globalThis);
