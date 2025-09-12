// /js/schemas/forms.families.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});
  const forms = root.Forms || (root.Forms = {});
  const { Options } = root;

  const Ctx = {
    onContactPhoneInput: () => {},
    needsNameException: () => {},
    parentLastNameSet: () => {},
  };

  const familyFields = {
    household: {
      main: [
        {
          col: 'id',
          label: 'Family ID',
          type: 'text',
          placeholder: '',
          default: () => Util.Format.makeId('F'),
          disabled: true,
          show: true,
          required: true,
        },
        {
          col: 'parishMember',
          label: 'Parish Member',
          type: 'select',
          selOpt: () => Options.YES_NO_OPTIONS,
          default: true,
          required: true,
          api: { fromApi: (v) => Boolean(v), toApi: (v) => Boolean(v) },
        },
        {
          col: 'parishNumber',
          label: 'Parish Number',
          type: 'text',
          default: '',
          required: true,
          show: ({ form }) => form.parishMember === true,
        },
      ],
      address: [
        { col: 'street', label: 'Number and Street', type: 'text', default: '', required: true },
        { col: 'city', label: 'City', type: 'text', default: '', required: true },
        { col: 'state', label: 'State', type: 'text', default: 'CA', disabled: true },
        {
          col: 'zip',
          label: 'Zip Code',
          type: 'text',
          default: '',
          validate: (value) => (!/^\d{5}(-\d{4})?$/.test(value || '') ? 'must be 5 digits' : ''),
        },
      ],
    },
    contacts: [
      { col: 'lastName', label: 'Last Name', type: 'text', default: '', required: true },
      { col: 'firstName', label: 'First Name', type: 'text', default: '', required: true },
      { col: 'middle', label: 'Middle', type: 'text', default: '' },
      {
        col: 'relationship',
        label: 'Relationship',
        type: 'select',
        selOpt: () => Options.RELATIONSHIP_OPTIONS,
        default: '',
        required: true,
      },
      {
        col: 'phone',
        label: 'Contact Phone',
        type: 'tel',
        onInput: (f, ctx, e) => {
          Ctx.onContactPhoneInput && Ctx.onContactPhoneInput(f, ctx, e);
        },
        placeholder: '(714) 123-4567',
        default: '',
        validate: (value) => (!value.trim() || Util.Format.normPhone(value).length !== 10 ? 'must be 10 digit' : ''),
      },
      {
        col: 'email',
        label: 'Email Address',
        type: 'text',
        default: '',
        validate: (value) =>
          (value || '').trim() && !/^\S+@\S+\.\S+$/.test(value) ? 'leave blank or enter valid email' : '',
      },
      {
        col: 'isEmergency',
        label: 'Primary Contact',
        type: 'checkbox',
        default: false,
        required: true,
        api: { fromApi: (v) => Boolean(v), toApi: (v) => Boolean(v) },
      },
    ],
    children: [
      { col: 'childId', label: 'Child ID', type: 'text', show: false, default: () => Util.Format.makeId('S') },
      {
        col: 'lastName',
        label: 'Last Name',
        type: 'text',
        default: '',
        required: true,
        validate: (value, { row }) => {
          const matchesParent = Ctx.parentLastNameSet.value.has((value.trim() || '').toLowerCase());
          return !matchesParent && !(row.isNameException && row.exceptionNotes?.trim()) ? 'mismatch w/ parents' : '';
        },
      },
      { col: 'firstName', label: 'First Name', type: 'text', default: '', required: true },
      { col: 'middle', label: 'Middle', type: 'text', default: '' },
      { col: 'saintName', label: 'Saint Name', type: 'text', default: '', required: true },
      { col: 'dob', label: 'Date of Birth', type: 'date', default: '', required: true },
      {
        col: 'allergies',
        label: 'Allergies (comma)',
        type: 'text',
        default: '',
        api: {
          fromApi: (v) => Util.Helpers.listToString(v),
          toApi: (v) => Util.Helpers.stringToList(v),
        },
      },
      {
        col: 'isNameException',
        label: 'Name Exception',
        type: 'checkbox',
        default: false,
        required: true,
        api: { fromApi: (v) => Boolean(v), toApi: (v) => Boolean(v) },
        show: (ctx) => Ctx.needsNameException(ctx),
      },
      {
        col: 'exceptionNotes',
        label: 'Exception Notes',
        type: 'text',
        default: '',
        required: true,
        show: (ctx) => Ctx.needsNameException(ctx),
      },
    ],
    notes: [
      {
        col: 'timeStamp',
        label: 'Time Stamp',
        type: 'text',
        default: () => new Date().toLocaleString(),
        disabled: true,
        show: true,
      },
      {
        col: 'note',
        label: 'Family Note',
        type: 'text',
        default: '',
        show: true,
        classes: 'col-span-2',
        required: true,
      },
      {
        col: 'updatedBy',
        label: 'Updated By',
        type: 'select',
        default: '',
        required: true,
        selOpt: () => Options.VOLUNTEERS_OPTIONS,
      },
    ],
  };

  function Families(familyCtx = {}) {
    if (familyCtx && typeof familyCtx === 'object') Object.assign(Ctx, familyCtx);
    return familyFields;
  }

  Families.newContact = function () {
    return Util.Helpers.buildFromFields(familyFields.contacts);
  };

  Families.newChild = function () {
    return Util.Helpers.buildFromFields(familyFields.children);
  };

  Families.newNote = function () {
    return Util.Helpers.buildFromFields(familyFields.notes);
  };

  Families.new = function () {
    const main = Util.Helpers.buildFromFields(familyFields.household.main);
    const address = Util.Helpers.buildFromFields(familyFields.household.address);
    return {
      ...main,
      address: { ...address },
      contacts: [Families.newContact()],
      children: [Families.newChild()],
      notes: [],
    };
  };

  forms.Families = Families;
})(typeof window !== 'undefined' ? window : globalThis);
