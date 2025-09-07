// /js/schemas/forms.registrations.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});
  const forms = root.Forms || (root.Forms = {});
  const { Options } = root;

  // Need: onRegFamilyChange, onRegEventChange, eventOptionsForRegistration, codeToLabel, signedRegistrationOptions, childRegistrationOptions, hydrateChildSnapshot, ageGroupOptionsForRow, receivedByOptions
  function Registrations(regCtx = {}) {
    const registrationFields = {
      main: [
        { col: 'id', label: 'Registration ID', type: 'text', disabled: true },
        {
          col: 'familyId',
          label: 'Family ID',
          type: 'datalist',
          placeholder: 'Start typing ID or name…',
          onChange: regCtx?.onRegFamilyChange,
          disabled: () => regCtx?.MODE.EDIT,
        },
        {
          col: 'eventId',
          label: 'Registration Event',
          type: 'select',
          selOpt: regCtx?.eventOptionsForRegistration,
          onChange: regCtx?.onRegEventChange,
          disabled: ({ form }) => (regCtx?.MODE.CREATE && !form.familyId) || regCtx?.MODE.EDIT,
        },
        {
          col: 'parishMember',
          label: 'Parish Member',
          type: 'select',
          selOpt: () => Options.YES_NO_OPTIONS,
          disabled: true,
          show: ({ form }) => !!form.familyId, // only show after a family is chosen
        },
      ],
      eventSnapshot: [
        { col: 'title', label: 'Event Description', disabled: true },
        { col: 'year', label: 'School Year', disabled: true, transform: (v) => regCtx?.codeToLabel(v, Options.YEAR_OPTIONS) },
        { col: 'programId', label: 'Program', disabled: true, transform: (v) => regCtx?.codeToLabel(v, Options.PROGRAM_OPTIONS) },
        { col: 'eventType', label: 'Event Type', disabled: true, transform: (v) => regCtx?.codeToLabel(v, Options.EVENT_TYPES) },
      ],
      contactSnapshot: [
        { col: 'name', label: 'Contact Name', disabled: true },
        { col: 'relationship', label: 'Relationship', disabled: true },
        { col: 'phone', label: 'Phone', disabled: true },
      ],
      meta: [
        { col: 'status', label: 'Status', type: 'select', selOpt: () => Options.REG_STATUS_OPTIONS },
        {
          col: 'acceptedBy',
          label: 'Accepted & Signed By',
          type: 'select',
          selOpt: regCtx?.signedRegistrationOptions,
        },
      ],
      childrenRow: [
        {
          col: 'childId',
          label: 'Child Name',
          type: 'select',
          selOpt: regCtx?.childRegistrationOptions,
          onChange: regCtx?.hydrateChildSnapshot,
        },
        { col: 'fullName', label: 'Full Name', type: 'text', disabled: true, show: false },
        { col: 'saintName', label: 'Saint Name', type: 'text', disabled: true },
        { col: 'dob', label: 'Age to Grade', type: 'select', selOpt: regCtx?.ageGroupOptionsForRow, disabled: true },
        {
          col: 'allergies',
          label: 'Allergies',
          type: 'text',
          disabled: true,
          transform: (v) => (Array.isArray(v) ? v.join(', ') : ''),
        },
      ],
      paymentsRow: [
        { col: 'code', label: 'Fee Type', type: 'select', selOpt: () => Options.FEE_CODES, disabled: true },
        { col: 'unitAmount', label: 'Unit Price', disabled: true, show: true },
        { col: 'quantity', label: 'Quantity', disabled: true },
        { col: 'amount', label: 'Total Amount', disabled: true },
        { col: 'method', label: 'Method', type: 'select', selOpt: () => Options.PAYMENT_METHOD_OPTIONS },
        { col: 'txnRef', label: 'Ref/Check #', type: 'text', show: ({ row }) => (row?.method || '') !== Options.ENUMS.METHOD?.CASH },
        { col: 'receiptNo', label: 'Receipt #', type: 'text' },
        {
          col: 'receivedBy',
          label: 'Received By',
          type: 'select',
          selOpt: regCtx?.receivedByOptions,
        },
      ],
    };

    return registrationFields;
  }

  forms.Registrations = Registrations;
})(typeof window !== 'undefined' ? window : globalThis);
