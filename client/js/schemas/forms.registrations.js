// /js/schemas/forms.registrations.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});
  const forms = root.Forms || (root.Forms = {});
  const { Options } = root;

  const Ctx = {
    onRegFamilyChange: () => {},
    onRegEventChange: () => {},
    eventOptionsForRegistration: [],
    signedRegistrationOptions: () => [],
    childRegistrationOptions: () => [],
    hydrateChildSnapshot: () => {},
    ageGroupOptionsForRow: () => [],
    receivedByOptions: () => [],
    MODE: {},
  };

  const registrationFields = {
    main: [
      {
        col: 'id',
        label: 'Registration ID',
        type: 'text',
        placeholder: '',
        disabled: true,
        show: true,
        default: () => Util.Helpers.makeId('R'),
        required: true,
      },
      {
        col: 'familyId',
        label: 'Family ID',
        type: 'datalist',
        default: '',
        placeholder: 'Start typing ID or name…',
        onChange: (fieldMeta, ctx, event) => Ctx.onRegFamilyChange(ctx),
        disabled: () => Ctx.MODE.EDIT,
        required: true,
      },
      {
        col: 'eventId',
        label: 'Registration Event',
        type: 'select',
        default: '',
        required: true,
        selOpt: () => {
          const src = Ctx.eventOptionsForRegistration;
          return typeof src === 'function' ? src() || [] : (src && src.value) || src || [];
        },
        onChange: (fieldMeta, ctx, event) => Ctx.onRegEventChange(ctx),
        disabled: ({ form }) => (Ctx.MODE.CREATE && !form.familyId) || Ctx.MODE.EDIT,
      },
      {
        col: 'parishMember',
        label: 'Parish Member',
        type: 'select',
        default: null,
        selOpt: () => Options.YES_NO_OPTIONS,
        disabled: true,
        show: ({ form }) => !!form.familyId, // only show after a family is chosen
      },
    ],
    eventSnapshot: [
      { col: 'title', type: 'text', default: '', label: 'Event Description', disabled: true },
      {
        col: 'year',
        label: 'School Year',
        type: 'text',
        default: '',
        disabled: true,
        transform: (v) => Util.Format.codeToLabel(v, Options.YEAR_OPTIONS),
        api: {
          toApi: (v) => Util.Helpers.toNumber(v),
        },
      },
      {
        col: 'programId',
        label: 'Program',
        type: 'text',
        default: '',
        disabled: true,
        transform: (v) => Util.Format.codeToLabel(v, Options.PROGRAM_OPTIONS),
      },
      {
        col: 'eventType',
        label: 'Event Type',
        type: 'text',
        default: '',
        disabled: true,
        transform: (v) => Util.Format.codeToLabel(v, Options.EVENT_TYPES),
      },
    ],
    contactSnapshot: [
      { col: 'name', label: 'Contact Name', type: 'text', default: '', disabled: true },
      { col: 'relationship', label: 'Relationship', type: 'text', default: '', disabled: true },
      { col: 'phone', label: 'Phone', type: 'text', default: '', disabled: true },
    ],
    meta: [
      {
        col: 'status',
        label: 'Status',
        type: 'select',
        default: '',
        required: true,
        selOpt: () => Options.REG_STATUS_OPTIONS,
      },
      {
        col: 'acceptedBy',
        label: 'Accepted & Signed By',
        type: 'select',
        required: true,
        default: '',
        selOpt: (fieldMeta, ctx) => Ctx.signedRegistrationOptions(ctx),
      },
    ],
    childrenRow: [
      {
        col: 'childId',
        label: 'Child Name',
        type: 'select',
        default: '',
        required: true,
        selOpt: (fieldMeta, ctx) => Ctx.childRegistrationOptions(fieldMeta, ctx),
        onChange: (fieldMeta, ctx, event) => Ctx.hydrateChildSnapshot(fieldMeta, ctx),
      },
      { col: 'fullName', label: 'Full Name', type: 'text', disabled: true, show: false },
      { col: 'saintName', label: 'Saint Name', type: 'text', default: '', disabled: true },
      {
        col: 'dob',
        label: 'Age to Grade',
        type: 'select',
        default: '',
        selOpt: (fieldMeta, ctx) => Ctx.ageGroupOptionsForRow(fieldMeta, ctx),
        disabled: true,
      },
      {
        col: 'allergies',
        label: 'Allergies',
        type: 'text',
        default: [],
        disabled: true,
        transform: (v) => (Array.isArray(v) ? v.join(', ') : ''),
        api: {
          toApi: (v) => Util.Helpers.stringToList(v),
        },
      },
      { col: 'status', label: 'Child Status', type: 'text', default: 'pending', show: false, disabled: true },
    ],
    paymentsRow: [
      { col: 'code', label: 'Fee Type', type: 'select', default: '', selOpt: () => Options.FEE_CODES, disabled: true },
      {
        col: 'unitAmount',
        label: 'Unit Price',
        type: 'text',
        default: '',
        disabled: true,
        show: true,
        api: { toApi: (v) => Util.Helpers.toNumber(v) },
      },
      {
        col: 'quantity',
        label: 'Quantity',
        type: 'text',
        default: '',
        disabled: true,
        api: { toApi: (v) => Util.Helpers.toNumber(v) },
      },
      {
        col: 'amount',
        label: 'Total Amount',
        type: 'text',
        default: '',
        disabled: true,
        api: { toApi: (v) => Util.Helpers.toNumber(v) },
      },
      {
        col: 'method',
        label: 'Method',
        type: 'select',
        default: '',
        required: true,
        selOpt: () => Options.PAYMENT_METHOD_OPTIONS,
      },
      {
        col: 'txnRef',
        label: 'Ref/Check #',
        type: 'text',
        default: '',
        required: true,
        show: ({ row }) => (row?.method || '') !== Options.ENUMS.METHOD?.CASH,
      },
      { col: 'receiptNo', label: 'Receipt #', type: 'text', default: '', required: true },
      {
        col: 'receivedBy',
        label: 'Received By',
        type: 'select',
        default: '',
        required: true,
        selOpt: (fieldMeta, ctx) => Ctx.receivedByOptions(ctx),
      },
    ],
  };

  function Registrations(regCtx = {}) {
    if (regCtx && typeof regCtx === 'object') Object.assign(Ctx, regCtx);
    return registrationFields;
  }

  Registrations.newEvent = function ({ ctx = {}, overrides = {} } = {}) {
    return Util.Helpers.buildFromFields(registrationFields.eventSnapshot, { ctx, overrides });
  };

  Registrations.newContact = function ({ ctx = {}, overrides = {} } = {}) {
    return Util.Helpers.buildFromFields(registrationFields.contactSnapshot, { ctx, overrides });
  };

  Registrations.newChild = function ({ ctx = {}, overrides = {} } = {}) {
    return Util.Helpers.buildFromFields(registrationFields.childrenRow, { ctx, overrides });
  };

  Registrations.newPayment = function ({ ctx = {}, overrides = {} } = {}) {
    return Util.Helpers.buildFromFields(registrationFields.paymentsRow, { ctx, overrides });
  };

  Registrations.new = function ({ ctx = {}, overrides = {} } = {}) {
    const main = Util.Helpers.buildFromFields(registrationFields.main, { ctx, overrides });
    const meta = Util.Helpers.buildFromFields(registrationFields.meta, { ctx, overrides });
    const event = Util.Helpers.buildFromFields(registrationFields.eventSnapshot, { ctx, overrides });

    return {
      ...main,
      ...meta,
      event: { ...event },
      contacts: [],
      children: [],
      payments: [],
      createdAt: null,
      updatedAt: null,
    };
  };

  forms.Registrations = Registrations;
})(typeof window !== 'undefined' ? window : globalThis);
