// /js/schemas/forms.families.js
(function (global) {
  'use strict';
  const root = global.Schema || (global.Schema = {});
  const forms = root.Forms || (root.Forms = {});
  const { Options } = root;

  function Families(familyCtx = {}) {
    const familyFields = {
      household: {
        main: [
          {
            col: 'id',
            label: 'Family ID',
            type: 'text',
            placeholder: '',
            default: Util.Format.makeId('F'),
            disabled: true,
            show: true,
          },
          { col: 'parishMember', label: 'Parish Member', type: 'select', selOpt: () => Options.YES_NO_OPTIONS, default: true },
          {
            col: 'parishNumber',
            label: 'Parish Number',
            type: 'text',
            default: '',
            show: ({ form }) => form.parishMember === true,
          },
        ],
        address: [
          { col: 'street', label: 'Number and Street', type: 'text', default: '' },
          { col: 'city', label: 'City', type: 'text', default: '' },
          { col: 'state', label: 'State', type: 'text', default: 'CA' },
          { col: 'zip', label: 'Zip Code', type: 'text', default: '' },
        ],
      },
      contacts: [
        { col: 'lastName', label: 'Last Name', type: 'text', default: '' },
        { col: 'firstName', label: 'First Name', type: 'text', default: '' },
        { col: 'middle', label: 'Middle', type: 'text', default: '' },
        { col: 'relationship', label: 'Relationship', type: 'select', selOpt: () => Options.RELATIONSHIP_OPTIONS, default: '' },
        {
          col: 'phone',
          label: 'Contact Phone',
          type: 'tel',
          onInput: familyCtx?.onContactPhoneInput || null,
          placeholder: '(714) 123-4567',
          default: '',
        },
        { col: 'email', label: 'Email Address', type: 'text', default: '' },
        { col: 'isEmergency', label: 'Primary Contact', type: 'checkbox', default: false },
      ],
      children: [
        { col: 'childId', label: 'Child ID', type: 'text', show: false, default: Util.Format.makeId('S') },
        { col: 'lastName', label: 'Last Name', type: 'text', default: '' },
        { col: 'firstName', label: 'First Name', type: 'text', default: '' },
        { col: 'middle', label: 'Middle', type: 'text', default: '' },
        { col: 'saintName', label: 'Saint Name', type: 'text', default: '' },
        { col: 'dob', label: 'Date of Birth', type: 'date', default: '' },
        { col: 'allergiesStr', label: 'Allergies (comma separated)', type: 'text', default: '' },
        {
          col: 'is_name_exception',
          label: 'Name Exception',
          type: 'checkbox',
          default: false,
          show: ({ form }) => familyCtx?.needsNameException(form),
        },
        { col: 'exception_notes', label: 'Exception Notes', type: 'text', default: '', show: ({ form }) => familyCtx?.needsNameException(form) },
      ],
      notes: [
        { col: 'timeStamp', label: 'Time Stamp', type: 'text', default: () => new Date().toLocaleString(), disabled: true, show: true },
        { col: 'note', label: 'Family Note', type: 'text', default: '', show: true, classes: 'col-span-2' },
        { col: 'updatedBy', label: 'Updated By', type: 'select', default: '', selOpt: () => Options.VOLUNTEERS_OPTIONS },
      ],
    };

    return familyFields;
  }

  forms.Families = Families;
})(typeof window !== 'undefined' ? window : globalThis);
