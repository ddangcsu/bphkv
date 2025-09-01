/* eslint-env browser, es2021 */
/* global Vue, axios */
/* eslint no-unused-vars: ["warn", {
  "vars": "all",
  "args": "after-used",
  "argsIgnorePattern": "^_",
  "varsIgnorePattern": "^_",
  "ignoreRestSiblings": true
}] */

// Vue 3 Composition API
const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

// ---------- API ----------
const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { Accept: 'application/json' },
  timeout: 5000,
});

const STORAGE_KEYS = {
  section: 'ui.currentSection',
  mode: 'ui.currentMode',
  fromSection: 'ui.fromSection',
};

const app = createApp({
  setup() {
    // =========================================================
    // GLOBAL UI / STATUS
    // =========================================================

    // === Enum Modes / Sections ===
    const MODE_NAMES = Object.freeze({ LIST: 'list', CREATE: 'create', EDIT: 'edit' });
    const SECTION_NAMES = Object.freeze({ FAMILIES: 'families', EVENTS: 'events', REGISTRATIONS: 'registrations', ROSTERS: 'rosters' });

    const currentSection = ref(sessionStorage.getItem(STORAGE_KEYS.section) || SECTION_NAMES.FAMILIES);
    watch(currentSection, (v) => sessionStorage.setItem(STORAGE_KEYS.section, v));

    const currentMode = ref(sessionStorage.getItem(STORAGE_KEYS.mode) || MODE_NAMES.LIST);
    watch(currentMode, (v) => sessionStorage.setItem(STORAGE_KEYS.mode, v));

    const fromSection = ref(sessionStorage.getItem(STORAGE_KEYS.fromSection) || SECTION_NAMES.FAMILIES);
    watch(fromSection, (v) => sessionStorage.setItem(STORAGE_KEYS.fromSection, v));

    function mapFlags(enumObj, sourceRef) {
      const map = {};
      for (const [key, val] of Object.entries(enumObj)) {
        map[key] = computed(() => sourceRef.value === val);
      }
      return reactive(map);
    }

    // Create reactive map from enums
    const SECTION = mapFlags(SECTION_NAMES, currentSection);
    const MODE = mapFlags(MODE_NAMES, currentMode);

    const menuOpen = ref(false);

    function isKnownSection(s) {
      return typeof s === 'string' && Object.values(SECTION_NAMES).includes(s);
    }
    // Update your existing switchSection so it *optionally* takes a mode
    function switchSection(s, mode = MODE_NAMES.LIST, { rememberFrom = true } = {}) {
      if (rememberFrom && isKnownSection(s) && currentSection.value !== fromSection.value) {
        fromSection.value = currentSection.value;
      }
      currentSection.value = s;
      currentMode.value = mode;
      menuOpen.value = false;
    }

    function goBackSection(overrideSection = null) {
      const override = isKnownSection(overrideSection) ? overrideSection : null;
      const target = override || (isKnownSection(fromSection.value) ? fromSection.value : SECTION_NAMES.FAMILIES);

      // don’t overwrite fromSection while going “back”
      switchSection(target, MODE_NAMES.LIST, { rememberFrom: false });
    }

    const BURGER_MENU = [
      { id: SECTION_NAMES.FAMILIES, label: 'Families Data', icon: 'fa-solid fa-people-roof', onClick: switchSection },
      { id: SECTION_NAMES.EVENTS, label: 'Events Setup', icon: 'fa-solid fa-calendar-days', onClick: switchSection },
      {
        id: SECTION_NAMES.REGISTRATIONS,
        label: 'Registrations',
        icon: 'fa-solid fa-clipboard-list',
        onClick: switchSection,
      },
      {
        id: SECTION_NAMES.ROSTERS,
        label: 'Enrollment Rosters',
        icon: 'fa-solid fa-clipboard-list',
        onClick: switchSection,
      },
    ];

    const breadcrumbs = computed(() => {
      if (SECTION.FAMILIES) {
        return [{ label: 'Families', onClick: goFamilyList }, { label: MODE.LIST ? 'Browse Families' : MODE.CREATE ? 'Create Family' : 'Edit Family' }];
      }
      if (SECTION.EVENTS) {
        return [{ label: 'Events', onClick: goEventList }, { label: MODE.LIST ? 'Browse Events' : MODE.CREATE ? 'Create Event' : 'Edit Event' }];
      }
      if (SECTION.REGISTRATIONS) {
        return [
          { label: 'Registrations', onClick: goRegistrationList },
          {
            label: MODE.LIST ? 'Browse Registrations' : MODE.CREATE ? 'Create Registration' : 'Edit Registration',
          },
        ];
      }
      if (SECTION.ROSTERS) {
        return [
          { label: 'Rosters', onClick: goRosterList },
          {
            label: MODE.LIST ? 'Enrollment Rosters' : '',
          },
        ];
      }
    });

    const status = reactive({ text: '', variant: 'info', visible: false });

    const statusIcon = computed(
      () =>
        ({
          success: 'fa-solid fa-circle-check',
          warn: 'fa-solid fa-triangle-exclamation',
          error: 'fa-solid fa-circle-exclamation',
          info: 'fa-solid fa-circle-info',
        }[status.variant] || 'fa-solid fa-circle-info'),
    );

    function setStatus(text, variant = 'info', ms = 2000) {
      status.text = text;
      status.variant = variant;
      status.visible = true;
      if (ms) setTimeout(() => (status.visible = false), ms);
    }

    // =========================================================
    // OPTIONS ({ value, label }) — codes/labels centralized
    // =========================================================

    const RELATIONSHIP_OPTIONS = [
      { value: 'Mother', label: 'Mother' },
      { value: 'Father', label: 'Father' },
      { value: 'Guardian', label: 'Guardian' },
      { value: 'Grandparent', label: 'Grandparent' },
      { value: 'Aunt', label: 'Aunt' },
      { value: 'Uncle', label: 'Uncle' },
      { value: 'Sibling', label: 'Sibling' },
    ];

    // The first 3 object.value of RELATIONSHIP_OPTIONS
    const PARENT_RELATIONSHIPS = new Set(RELATIONSHIP_OPTIONS.slice(0, 3).map((e) => e.value));

    const YES_NO_OPTIONS = [
      { key: 'YES', value: true, label: 'Yes' },
      { key: 'NO', value: false, label: 'No' },
    ];

    const PROGRAM_OPTIONS = [
      { key: 'BPH', value: 'BPH', label: 'Ban Phu Huynh' },
      { key: 'TNTT', value: 'TNTT', label: 'Thieu Nhi TT' },
    ];

    const LEVEL_OPTIONS = [
      { key: 'PER_FAMILY', value: 'PF', label: 'Per Family' },
      { key: 'PER_CHILD', value: 'PC', label: 'Per Child' },
    ];
    const EVENT_TYPES = [
      { key: 'ADMIN', value: 'ADM', label: 'Security' },
      { key: 'REGISTRATION', value: 'REG', label: 'Registration' },
      { key: 'EVENT', value: 'EVT', label: 'Event' },
    ];
    const FEE_CODES = [
      { key: 'REG_FEE', value: 'REGF', label: 'Registration Fee' },
      { key: 'EVT_FEE', value: 'EVTF', label: 'Event Fee' },
      { key: 'SEC_FEE', value: 'SECF', label: 'Security Fee' },
      { key: 'NPM_FEE', value: 'NPMF', label: 'NonParish Fee' },
    ];

    // Registration-specific option lists
    const PAYMENT_METHOD_OPTIONS = [
      { value: 'cash', label: 'Cash' },
      { value: 'check', label: 'Check' },
      { value: 'zelle', label: 'Zelle' },
    ];
    const RECEIVED_BY_OPTIONS = [
      { value: 'Alice', label: 'Alice' },
      { value: 'Bob', label: 'Bob' },
      { value: 'Timothy', label: 'Timothy' },
    ];

    const YEAR_OPTIONS = computed(() => {
      const y = new Date().getFullYear();
      const years = [];
      for (let i = -4; i <= 2; i++) {
        years.push({
          value: y + i,
          label: `${String(y + i)}-${String(y + i + 1).slice(2)}`,
        });
      }
      return years;
    });

    // Create ENUM for some of the OPTIONS to allow easy of value changes
    function makeEnumFromOptions(options) {
      // { key:'ADMIN', value:'ADM' } -> EVENT.ADMIN === 'ADM'
      return Object.freeze(
        (options || []).reduce((acc, o) => {
          if (o && o.key != null) acc[o.key] = o.value;
          return acc;
        }, {}),
      );
    }

    const EVENT = makeEnumFromOptions(EVENT_TYPES); // { ADMIN:'ADM', REGISTRATION:'REG', EVENT:'EVT' }
    const LEVEL = makeEnumFromOptions(LEVEL_OPTIONS); // { PER_FAMILY:'PF', PER_CHILD:'PC' }
    const PROGRAM = makeEnumFromOptions(PROGRAM_OPTIONS); // { BPH:'BPH', TNTT:'TNTT' }

    // --- Relative Display: source registry ------------------------------------
    const RD_SOURCES = {
      eventRows: () => eventRows.value,
    };

    // =========================================================
    // COMMON HELPERS (refactored & only what's used)
    // =========================================================

    function randInt(bound) {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint8Array(1);
        const max = Math.floor(256 / bound) * bound; // largest multiple of bound <= 256
        let x;
        do {
          crypto.getRandomValues(buf);
          x = buf[0];
        } while (x >= max);
        return x % bound;
      }
      // Fallback
      return Math.floor(Math.random() * bound);
    }
    function randomNumericString(len = 12, forbidLeadingZero = true) {
      if (len <= 0) return '';
      let out = '';
      out += String(forbidLeadingZero ? 1 + randInt(9) : randInt(10));
      for (let i = 1; i < len; i++) out += String(randInt(10));
      return out;
    }
    function groupDigits(s, groupSize = 4) {
      if (!groupSize || groupSize <= 0) return s;
      return s.match(new RegExp(`\\d{1,${groupSize}}`, 'g')).join('-');
    }
    function makeId(prefix, length = 12, groupSize = 4, forbidLeadingZero = true) {
      const digits = randomNumericString(length, forbidLeadingZero);
      const formatted = groupDigits(digits, groupSize);
      return `${prefix}:${formatted}`;
    }

    // Safe shallow path getter
    function getByPath(obj, path) {
      if (!obj || !path) return undefined;
      return String(path)
        .split('.')
        .reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
    }

    function relativeDisplayValue(row, fld, rd) {
      if (!row || !fld || !rd) return '';
      const src = RD_SOURCES[rd.rdSource];
      if (!src) return '';
      const list = src() || [];
      const controlValue = row[fld.col];
      if (!controlValue) return '';

      const keyProp = rd.rdKey || 'id';
      const match = list.find((item) => item && item[keyProp] === controlValue);
      if (!match) return '';

      const raw = getByPath(match, rd.rdCol);
      if (raw == null) return '';

      if (rd.map) return codeToLabel(raw, rd.map);
      return String(raw);
    }

    // Accept Array | Function(ctx)=>Array | Ref<Array> | undefined
    function resolveOptions(source, ctx) {
      if (!source) return [];
      if (Array.isArray(source)) return source;
      if (typeof source === 'function') return source(ctx) || [];
      if (typeof source === 'object' && 'value' in source) {
        const v = source.value;
        return Array.isArray(v) ? v : [];
      }
      return [];
    }

    // Option → label
    function codeToLabel(value, source, ctx = undefined, { withCode = false, fallback = '' } = {}) {
      const options = resolveOptions(source, ctx);
      const found = options.find((o) => o && o.value === value);
      if (!found) return fallback || (value ?? '');
      const label = found.label ?? found.value;
      return withCode ? `${found.value} - ${label}` : label;
    }

    // Unified meta-driven handlers
    function onFormFieldChange(fieldMeta, ctx = {}, event) {
      if (typeof fieldMeta?.onChange === 'function') {
        fieldMeta.onChange(fieldMeta, ctx, event);
      }
    }
    function onFormFieldInput(fieldMeta, ctx = {}, event) {
      if (typeof fieldMeta?.onInput === 'function') {
        fieldMeta.onInput(fieldMeta, ctx, event);
      }
    }

    // Options resolver (now passes fieldMeta to selOpt functions)
    function getOptions(fieldMeta, ctx = {}) {
      const src = fieldMeta?.selOpt;
      if (!src) return [];
      if (Array.isArray(src)) return src;
      if (typeof src === 'function') return src(fieldMeta, ctx) || [];
      if (typeof src === 'object' && 'value' in src) {
        const v = src.value;
        return Array.isArray(v) ? v : [];
      }
      return [];
    }

    function formatOptionLabel(opt, withValue = false) {
      if (opt == null) return '';
      if (opt.label == null || opt.label === '' || opt.label === opt.value) return String(opt.value);
      if (typeof opt.value === 'boolean' || !withValue) return opt.label;
      return `${opt.value} - ${opt.label}`;
    }

    const normPhone = (s = '') => (s || '').replace(/\D+/g, '');

    function formatUSPhone(raw = '') {
      const d = normPhone(raw).slice(0, 10);
      if (!d) return '';
      if (d.length < 4) return `(${d}`;
      if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }

    function evalMaybe(val, ctx) {
      return typeof val === 'function' ? val(ctx) : val;
    }

    function setDefault(target, column, value) {
      const keys = String(column).split('.');
      let obj = target;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (obj[k] == null || typeof obj[k] !== 'object') obj[k] = {};
        obj = obj[k];
      }
      obj[keys[keys.length - 1]] = value;
    }

    function getDefaultValue(field, ctx) {
      if ('default' in field) return evalMaybe(field.default, ctx);
      return field.type === 'checkbox' ? false : '';
    }

    function buildFromFields(fields, { ctx = {}, overrides = {} } = {}) {
      const out = {};
      for (const f of fields) setDefault(out, f.col, getDefaultValue(f, ctx));
      for (const [path, value] of Object.entries(overrides)) setDefault(out, path, value);
      return out;
    }

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // === Unified meta switches ===
    function isVisible(field, ctx = {}) {
      if (!('show' in field)) return true;
      return !!evalMaybe(field.show, ctx);
    }

    function getFieldDisabled(field, ctx = {}) {
      if (!('disabled' in field)) return false;
      return !!evalMaybe(field.disabled, ctx);
    }

    function isNonNegativeNumber(val) {
      if (val === null || val === undefined || val === '') return false;
      if (typeof val !== 'number' || !Number.isFinite(val)) return false;
      return val >= 0;
    }

    function displayEventFees(evt) {
      return evt.fees?.length > 0 ? evt.fees.map((item) => item.code + '-$' + String(item.amount)).join(' / ') : '—';
    }

    const maskLast4 = (s = '') => {
      const d = normPhone(s);
      return d ? `•${d.slice(-4)}` : '';
    };

    // =========================================================
    // FAMILIES
    // =========================================================
    const familySearch = ref('');
    const editingFamilyId = ref(null);

    const familyRows = ref([]);
    function normalizeFamilyRow(f) {
      return { ...f, _show: false };
    }

    async function loadFamilies({ showStatusIfActive = false } = {}) {
      try {
        const { data } = await api.get('/families', { params: { _: Date.now() } });
        const list = Array.isArray(data) ? data : Array.isArray(data.families) ? data.families : [];
        familyRows.value = list.map(normalizeFamilyRow);
        if (showStatusIfActive && SECTION.FAMILIES) setStatus('Families loaded.', 'info', 1200);
      } catch {
        familyRows.value = [];
      }
    }

    const contactDisplay = (f) => {
      const contacts = Array.isArray(f.contacts) ? f.contacts : [];
      if (!contacts.length) return '—';

      // Prioritize the first 2 among Father / Mother / Guardian
      const prioritized = contacts.filter((c) => PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const pick = [...prioritized, ...others].slice(0, 2);
      const result = pick.map((c) => {
        return `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''} · ${maskLast4(c.phone)}`;
      });

      return result.join(' — ');
    };

    function onContactPhoneInput(fieldMeta, ctx, event) {
      const raw = event?.target?.value ?? '';
      const formatted = formatUSPhone(raw);
      // write-back here (meta function owns mutation)
      if (ctx?.form && fieldMeta?.col) {
        // setDefault supports deep paths if you ever use nested cols
        setDefault(ctx.form, fieldMeta.col, formatted);
      }
    }

    const hasActiveFamilyFilter = computed(() => !!familySearch.value);

    function resetFamilyFilters() {
      familySearch.value = '';
    }

    const needsNameException = (row) => {
      const last = String(row?.lastName ?? '')
        .trim()
        .toLowerCase();
      return !!last && !parentLastNameSet.value.has(last);
    };

    // FAMILIES_META
    const familyFields = {
      household: {
        main: [
          {
            col: 'id',
            label: 'Family ID',
            type: 'text',
            placeholder: '',
            default: makeId('F'),
            disabled: true,
            show: true,
          },
          { col: 'parishMember', label: 'Parish Member', type: 'select', selOpt: YES_NO_OPTIONS, default: true },
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
        { col: 'relationship', label: 'Relationship', type: 'select', selOpt: RELATIONSHIP_OPTIONS, default: '' },
        {
          col: 'phone',
          label: 'Contact Phone',
          type: 'tel',
          onInput: onContactPhoneInput,
          placeholder: '(714) 123-4567',
          default: '',
        },
        { col: 'email', label: 'Email Address', type: 'text', default: '' },
        { col: 'isEmergency', label: 'Emergency Contact', type: 'checkbox', default: false },
      ],
      children: [
        { col: 'childId', label: 'Child ID', type: 'text', show: false, default: makeId('S') },
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
          show: ({ form }) => needsNameException(form),
        },
        { col: 'exception_notes', label: 'Exception Notes', type: 'text', default: '', show: ({ form }) => needsNameException(form) },
      ],
    };

    function newFamilyContact() {
      return buildFromFields(familyFields.contacts);
    }
    function newFamilyChild() {
      return buildFromFields(familyFields.children);
    }
    function newFamilyForm() {
      const main = buildFromFields(familyFields.household.main);
      const address = buildFromFields(familyFields.household.address);
      return { ...main, address: { ...address }, contacts: [newFamilyContact()], children: [newFamilyChild()] };
    }
    const familyForm = reactive(newFamilyForm());
    const familyErrors = reactive({ household: {}, contacts: [{}], children: [{}] });

    function hydrateFamilyErrors() {
      familyErrors.household = {};
      familyErrors.contacts = familyForm.contacts.map(() => ({}));
      familyErrors.children = familyForm.children.map(() => ({}));
    }

    function validateFamily() {
      const s = familyForm;
      let e = { household: {}, contacts: [], children: [] };

      if (!s.id?.trim()) e.household.id = 'required';
      if (!s.parishNumber?.trim() && s.parishMember) e.household.parishNumber = 'required';
      if (!s.address.street?.trim()) e.household.street = 'required';
      if (!s.address.city?.trim()) e.household.city = 'required';
      if (!/^\d{5}(-\d{4})?$/.test(s.address.zip || '')) e.household.zip = 'must be 5 digits.';

      e.contacts = s.contacts.map((c) => {
        const ce = {};
        if (!c.lastName?.trim()) ce.lastName = 'required';
        if (!c.firstName?.trim()) ce.firstName = 'required';
        if (!c.relationship?.trim()) ce.relationship = 'required';
        if (!c.phone?.trim() || normPhone(c.phone).length !== 10) ce.phone = 'required and must be 10 digit';
        if ((c.email || '').trim() && !/^\S+@\S+\.\S+$/.test(c.email)) ce.email = 'blank or valid email';
        return ce;
      });

      e.children = s.children.map((c) => {
        const ce = {};
        if (!c.lastName?.trim()) ce.lastName = 'required';
        if (!c.firstName?.trim()) ce.firstName = 'required';
        if (!c.dob?.trim()) ce.dob = 'required.';
        const matchesParent = parentLastNameSet.value.has((c.lastName || '').toLowerCase());
        if (!matchesParent) {
          if (!c.is_name_exception) ce.is_name_exception = 'Check here if name exception';
          if (!c.exception_notes?.trim()) ce.exception_notes = 'required';
          if (!(c.is_name_exception && c.exception_notes?.trim())) ce.lastName = ce.lastName || 'mismatch w/ parents';
        }
        return ce;
      });
      familyErrors.household = e.household;
      familyErrors.contacts = e.contacts;
      familyErrors.children = e.children;

      // final result (pure booleans)
      const noHouseHoldErrors = Object.keys(e.household).length === 0;
      const noContactsErrors = (e.contacts || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const noChildrenErrors = (e.children || []).every((obj) => !obj || Object.keys(obj).length === 0);

      return noHouseHoldErrors && noContactsErrors && noChildrenErrors;
    }

    // paging
    const familyContactsMode = ref('single');
    const familyChildrenMode = ref('single');
    const familyContactsIndex = ref(0);
    const familyChildrenIndex = ref(0);

    const visibleFamilyContacts = computed(() => {
      if (!familyForm.contacts.length) return [];
      if (familyContactsMode.value === 'all') return familyForm.contacts.map((c, i) => ({ c, i }));
      const i = Math.min(familyContactsIndex.value, familyForm.contacts.length - 1);
      return [{ c: familyForm.contacts[i], i }];
    });
    const visibleFamilyChildren = computed(() => {
      if (!familyForm.children.length) return [];
      if (familyChildrenMode.value === 'all') return familyForm.children.map((c, i) => ({ c, i }));
      const i = Math.min(familyChildrenIndex.value, familyForm.children.length - 1);
      return [{ c: familyForm.children[i], i }];
    });

    function nextFamilyContact() {
      if (familyContactsIndex.value < familyForm.contacts.length - 1) familyContactsIndex.value++;
    }
    function prevFamilyContact() {
      if (familyContactsIndex.value > 0) familyContactsIndex.value--;
    }
    function nextFamilyChild() {
      if (familyChildrenIndex.value < familyForm.children.length - 1) familyChildrenIndex.value++;
    }
    function prevFamilyChild() {
      if (familyChildrenIndex.value > 0) familyChildrenIndex.value--;
    }

    watch(
      () => familyForm.contacts.length,
      (n) => {
        if (familyContactsIndex.value > n - 1) familyContactsIndex.value = Math.max(0, n - 1);
        hydrateFamilyErrors();
      },
    );
    watch(
      () => familyForm.children.length,
      (n) => {
        if (familyChildrenIndex.value > n - 1) familyChildrenIndex.value = Math.max(0, n - 1);
        hydrateFamilyErrors();
      },
    );

    watch(
      () => familyForm.children,
      () => {
        for (const ch of familyForm.children || []) {
          if (!needsNameException(ch)) {
            ch.is_name_exception = false;
            ch.exception_notes = '';
          }
        }
      },
      { deep: true },
    );

    // dirty tracking
    const familyOriginalSnapshot = ref('');
    const isFamilyDirty = computed(() => JSON.stringify(familyForm) !== familyOriginalSnapshot.value);
    function snapshotFamilyForm() {
      familyOriginalSnapshot.value = JSON.stringify(familyForm);
    }

    // nav

    function goFamilyList() {
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.LIST);
      familySearch.value = '';
    }
    function beginCreateFamily() {
      Object.assign(familyForm, newFamilyForm());
      hydrateFamilyErrors();
      snapshotFamilyForm();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.CREATE);
      setStatus('Creating new family…', 'info', 1200);
    }
    function beginEditFamily(f) {
      editingFamilyId.value = f.id;
      Object.assign(familyForm, newFamilyForm());
      familyForm.id = f.id;
      familyForm.parishMember = f.parishMember;
      familyForm.parishNumber = f.parishNumber || '';
      familyForm.address = { ...f.address };
      familyForm.contacts = (f.contacts || []).map((c) => ({
        lastName: c.lastName,
        firstName: c.firstName,
        middle: c.middle,
        relationship: c.relationship,
        phone: formatUSPhone(c.phone) || '',
        email: c.email || '',
        isEmergency: !!c.isEmergency,
      }));
      familyForm.children = (f.children || []).map((ch, i) => ({
        childId: ch.childId || `C${i + 1}`,
        lastName: ch.lastName,
        firstName: ch.firstName,
        middle: ch.middle,
        saintName: ch.saintName,
        dob: (ch.dob || '').slice(0, 10),
        allergiesStr: Array.isArray(ch.allergies) ? ch.allergies.join(',') : '',
        is_name_exception: !!ch.isNameException,
        exception_notes: ch.exceptionNotes || '',
      }));
      hydrateFamilyErrors();
      snapshotFamilyForm();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.EDIT);
      setStatus(`Editing ${f.id}`, 'info', 1200);
    }

    const parentLastNameSet = computed(() => {
      const s = new Set();
      for (const c of familyForm.contacts ?? []) {
        const rel = String(c?.relationship ?? '').trim();
        if (!PARENT_RELATIONSHIPS.has(rel)) continue;

        const ln = String(c?.lastName ?? '')
          .trim()
          .toLowerCase();
        if (ln) s.add(ln);
      }
      return s; // Set<string> of lowercase names
    });

    // Display-friendly string
    const parentLastNamesDisplay = computed(() => [...parentLastNameSet.value].map((e) => capitalize(e)).join(' / '));

    const filteredFamilyRows = computed(() => {
      if (!familySearch.value) return familyRows.value;
      const q = familySearch.value.toLowerCase();
      const qDigits = normPhone(familySearch.value);
      return familyRows.value.filter((f) => {
        const hitsTop =
          (f.id || '').toLowerCase().includes(q) || (f.parishNumber || '').toLowerCase().includes(q) || (f.address?.city || '').toLowerCase().includes(q);
        const hitsContacts = (f.contacts || []).some(
          (c) =>
            (c.lastName || '').toLowerCase().includes(q) ||
            (c.firstName || '').toLowerCase().includes(q) ||
            (c.middle || '').toLowerCase().includes(q) ||
            (c.lastName + c.firstName + c.middle).toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (qDigits && normPhone(c.phone).includes(qDigits)),
        );
        return hitsTop || hitsContacts;
      });
    });

    function getYearPart(input) {
      if (!input) return null;
      if (typeof input === 'number') return input;
      if (typeof input === 'string') {
        const m = input.match(/^(\d{4})/);
        if (m) return Number(m[1]);
        const d = new Date(input);
        if (!isNaN(d)) return d.getFullYear();
        return null;
      }
      if (input instanceof Date && !isNaN(input)) return input.getFullYear();
      return null;
    }

    function computeAgeByYear(dob) {
      const birthYear = getYearPart(dob);
      if (birthYear == null) return null;
      const age = getCurrentSchoolYear() - birthYear;
      return age < 0 ? 0 : age;
    }

    function displayChildNameAndAge(child) {
      const ln = (child?.lastName || '').trim();
      const fn = (child?.firstName || '').trim();
      const name = ln && fn ? `${ln}, ${fn}` : ln || fn || 'Child';
      const age = computeAgeByYear(child?.dob);
      return age == null ? name : `${name} - ${age} yo`;
    }

    async function addFamilyContact() {
      familyForm.contacts.push(newFamilyContact());
      familyErrors.contacts.push({});
      if (familyContactsMode.value === 'single') familyContactsIndex.value = familyForm.contacts.length - 1;
      await nextTick();
    }
    function removeFamilyContact(i) {
      familyForm.contacts.splice(i, 1);
      familyErrors.contacts.splice(i, 1);
    }
    async function addFamilyChild() {
      familyForm.children.push(newFamilyChild());
      familyErrors.children.push({});
      if (familyChildrenMode.value === 'single') familyChildrenIndex.value = familyForm.children.length - 1;
      await nextTick();
    }
    function removeFamilyChild(i) {
      familyForm.children.splice(i, 1);
      familyErrors.children.splice(i, 1);
    }
    function resetFamilyForm() {
      Object.assign(familyForm, newFamilyForm());
      hydrateFamilyErrors();
      snapshotFamilyForm();
      setStatus('Form reset.', 'info', 1200);
    }

    function buildFamilyPayload() {
      return {
        id: familyForm.id,
        parishMember: familyForm.parishMember,
        parishNumber: familyForm.parishMember ? familyForm.parishNumber : null,
        address: {
          street: familyForm.address.street,
          city: familyForm.address.city,
          state: familyForm.address.state,
          zip: familyForm.address.zip,
        },
        contacts: familyForm.contacts.map((c) => ({
          lastName: c.lastName,
          firstName: c.firstName,
          middle: c.middle || null,
          relationship: c.relationship,
          phone: c.phone || null,
          email: c.email || null,
          isEmergency: !!c.isEmergency,
        })),
        children: familyForm.children.map((ch) => ({
          childId: ch.childId,
          lastName: ch.lastName,
          firstName: ch.firstName,
          middle: ch.middle || null,
          saintName: ch.saintName || null,
          dob: ch.dob ? new Date(ch.dob).toISOString() : null,
          allergies: (ch.allergiesStr || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isNameException: !!ch.is_name_exception,
          exceptionNotes: ch.exception_notes || null,
        })),
      };
    }

    function submitFamilyForm() {
      if (!validateFamily()) {
        setStatus('Error found. Please fix errors before trying to save', 'error', 3500);
        return;
      }
      if (!isFamilyDirty.value) {
        setStatus('No changes to save.', 'warn', 1500);
        return;
      }
      saveFamilyRecord();
    }

    async function saveFamilyRecord() {
      if (!familyForm.id?.trim()) {
        setStatus('Family ID is required.', 'error', 2000);
        return;
      }
      setStatus('Saving Family data...');
      const payload = buildFamilyPayload();
      if (MODE.CREATE) {
        try {
          await api.post('/families', payload);
          await loadFamilies();
          setStatus('Family created.', 'success', 1500);
          await nextTick();
          goBackSection();
        } catch (e) {
          setStatus('Create failed.', 'error', 3000);
          console.error(e);
        }
        return;
      }
      const encodeId = encodeURIComponent(editingFamilyId.value);
      const patch = { ...payload };
      delete patch.id;
      try {
        await api.patch(`/families/${encodeId}`, patch);
        await loadFamilies();
        setStatus('Family updated.', 'success', 1500);
        await nextTick();
        goBackSection();
      } catch (e) {
        setStatus('Update failed.', 'error', 3000);
        console.error(e);
      }
    }

    // =========================================================
    // EVENTS
    // =========================================================
    const eventRows = ref([]);

    async function loadEvents({ showStatusIfActive = false } = {}) {
      const { data } = await api.get('/events', { params: { _: Date.now() } });
      eventRows.value = Array.isArray(data) ? data : data?.events || [];
      if (showStatusIfActive && SECTION.EVENTS) setStatus('Events loaded.', 'info', 1200);
    }

    const eventSearch = ref('');
    const eventFilter = reactive({ programId: '', level: '', year: '' });
    const eventErrors = reactive({});
    const editingEventId = ref(null);

    const hasActiveEventFilter = computed(() => !!(eventFilter.programId || eventFilter.level || eventFilter.year));

    function resetEventFilters() {
      eventFilter.programId = '';
      eventFilter.level = '';
      eventFilter.year = '';
      eventSearch.value = '';
    }

    function clearEventErrors() {
      for (const k of Object.keys(eventErrors)) delete eventErrors[k];
    }

    // EVENTS_META
    const eventFields = {
      main: [
        {
          col: 'id',
          label: 'Event ID',
          type: 'text',
          placeholder: 'Self Generated',
          default: () => makeId('E'),
          disabled: true,
        },
        {
          col: 'programId',
          label: 'Program Code',
          type: 'select',
          selOpt: PROGRAM_OPTIONS,
          default: PROGRAM_OPTIONS[0].value,
        },
        { col: 'eventType', label: 'Event Type', type: 'select', selOpt: EVENT_TYPES, default: '' },
        { col: 'title', label: 'Description', type: 'text', default: '', placeholder: 'TNTT Roster 2025-26' },
        {
          col: 'year',
          label: 'School Year',
          type: 'select',
          selOpt: YEAR_OPTIONS,
          default: () => getCurrentSchoolYear(),
        },
        { col: 'level', label: 'Apply Level', type: 'select', selOpt: LEVEL_OPTIONS, default: LEVEL_OPTIONS[0].value },
        { col: 'openDate', label: 'Open Date', type: 'date', default: '' },
        { col: 'endDate', label: 'End Date', type: 'date', default: '' },
      ],
      feeRow: [
        { col: 'code', label: 'Fee Type', type: 'select', selOpt: FEE_CODES, default: FEE_CODES[0].value },
        { col: 'amount', label: 'Fee Amount', type: 'number', default: 0, attrs: { min: 0, step: 1 } },
      ],
      prerequisiteRow: [
        {
          col: 'eventId',
          label: 'Prerequisite Event',
          type: 'select',
          selOpt: (fieldMeta, ctx) => {
            const index = Number.isInteger(ctx?.index) ? ctx.index : -1;
            return availablePrerequisiteOptions(index).map((e) => ({
              value: e.id,
              label: `${e.programId}_${e.eventType}_${e.year}`,
            }));
          },
          default: '',
          relativeDisplay: [
            { label: 'Type', rdSource: 'eventRows', rdKey: 'id', rdCol: 'eventType', map: EVENT_TYPES },
            { label: 'Description', rdSource: 'eventRows', rdKey: 'id', rdCol: 'title' },
          ],
        },
      ],
    };

    function availablePrerequisiteOptions(rowIndex) {
      const reqType = requiredPrereqType();
      if (!reqType) return [];
      const selectedElsewhere = new Set((eventForm.prerequisites || []).map((p, i) => (i === rowIndex ? null : p.eventId)).filter(Boolean));
      return eventRows.value.filter(
        (ev) => Number(ev.year) === Number(eventForm.year) && ev.id !== eventForm.id && (ev.eventType || '') === reqType && !selectedElsewhere.has(ev.id),
      );
    }

    function newEventForm() {
      const main = buildFromFields(eventFields.main);
      return { ...main, prerequisites: [], fees: [] };
    }
    const eventForm = reactive(newEventForm());

    const showPrerequisites = computed(() => eventForm.eventType !== EVENT.ADMIN);

    function requiredPrereqType() {
      if (eventForm.eventType === EVENT.REGISTRATION) return EVENT.ADMIN;
      if (eventForm.eventType === EVENT.EVENT) return EVENT.REGISTRATION;
      return null; // ADM => none
    }

    watch(
      () => [eventForm.year, eventForm.id, eventForm.eventType],
      () => {
        const reqType = requiredPrereqType();
        if (!reqType) {
          eventForm.prerequisites = [];
        } else {
          eventForm.prerequisites = (eventForm.prerequisites || []).filter((p) => {
            const id = (p?.eventId || '').trim();
            if (!id) return true;
            const ev = eventRows.value.find((e) => e.id === id);
            if (!ev) return false;
            if (Number(ev.year) !== Number(eventForm.year)) return false;
            if (ev.id === eventForm.id) return false;
            return (ev.eventType || '') === reqType;
          });
          if (eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
        }
      },
    );

    function addEventFee() {
      eventForm.fees.push(buildFromFields(eventFields.feeRow));
    }
    function removeEventFee(i) {
      eventForm.fees.splice(i, 1);
    }

    function addEventPrerequisiteRow() {
      eventForm.prerequisites.push(buildFromFields(eventFields.prerequisiteRow, { ctx: { index: 0, form: eventForm } }));
    }
    function removeEventPrerequisiteRow(i) {
      eventForm.prerequisites.splice(i, 1);
      if (showPrerequisites.value && eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
    }

    const filteredEventRows = computed(() => {
      const q = (eventSearch.value || '').toLowerCase();
      return eventRows.value.filter((e) => {
        const matchesQ =
          e.id.toLowerCase().includes(q) ||
          (e.title || '').toLowerCase().includes(q) ||
          (e.programId || '').toLowerCase().includes(q) ||
          (e.level || '').toLowerCase().includes(q) ||
          (e.eventType || '').toLowerCase().includes(q) ||
          String(e.year || '').includes(q);
        const byProg = !eventFilter.programId || e.programId === eventFilter.programId;
        const byLevel = !eventFilter.level || e.level === eventFilter.level;
        const byYear = !eventFilter.year || Number(e.year) === Number(eventFilter.year);
        return matchesQ && byProg && byLevel && byYear;
      });
    });

    function goEventList() {
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.LIST);
    }

    function beginCreateEvent() {
      Object.assign(eventForm, newEventForm());
      clearEventErrors();
      editingEventId.value = null;

      if (eventForm.fees.length === 0) addEventFee();
      if (showPrerequisites.value && eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.CREATE);
      setStatus('Creating new event…', 'info', 1200);
    }

    function beginEditEvent(e) {
      const snap = JSON.parse(JSON.stringify(e));

      const prerequisites = (Array.isArray(snap.prerequisites) ? snap.prerequisites : []).map((p) =>
        typeof p === 'string' ? { eventId: p } : { eventId: p?.eventId || '' },
      );

      const fees = (snap.fees || []).map((f) => ({ code: f.code, amount: f.amount }));

      Object.assign(eventForm, newEventForm(), snap, { prerequisites, fees });

      if (!EVENT_TYPES.some((t) => t.value === eventForm.eventType)) eventForm.eventType = EVENT.REGISTRATION;

      if (eventForm.eventType === EVENT.ADMIN) {
        eventForm.prerequisites = [];
      } else if (!Array.isArray(eventForm.prerequisites) || eventForm.prerequisites.length === 0) {
        addEventPrerequisiteRow();
      }

      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) addEventFee();

      clearEventErrors();

      editingEventId.value = e.id;
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.EDIT);

      setStatus(`Editing ${e.id}`, 'info', 1200);
    }

    function validateEventForm() {
      clearEventErrors();
      const e = {};
      if (MODE.CREATE && !eventForm.id?.trim()) e.id = 'required';

      if (!PROGRAM_OPTIONS.some((o) => o.value === eventForm.programId)) e.programId = 'required';
      if (!EVENT_TYPES.some((o) => o.value === eventForm.eventType)) e.eventType = 'required';
      if (!eventForm.title?.trim()) e.title = 'required';
      if (!YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year))) e.year = 'year required';
      if (!LEVEL_OPTIONS.some((o) => o.value === eventForm.level)) e.level = 'invalid';
      if (!eventForm.openDate) e.openDate = 'required';
      if (!eventForm.endDate) e.endDate = 'required';

      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) {
        e.fees = 'at least one fee';
      } else {
        for (const f of eventForm.fees) {
          if (!FEE_CODES.some((o) => o.value === f.code)) {
            e.fees = 'invalid fee code';
            break;
          }
          if (!isNonNegativeNumber(f.amount)) {
            e.fees = 'fee amount ≥ 0';
            break;
          }
        }
      }

      const reqType = requiredPrereqType();
      if (reqType) {
        if (!Array.isArray(eventForm.prerequisites) || eventForm.prerequisites.length === 0) {
          e.prerequisites = 'at least one prerequisite';
        } else {
          const seen = new Set();
          for (const p of eventForm.prerequisites) {
            const id = (p?.eventId || '').trim();
            if (!id) {
              e.prerequisites = 'every prerequisite must select an event';
              break;
            }
            if (id === eventForm.id) {
              e.prerequisites = 'cannot include itself';
              break;
            }
            const ev = eventRows.value.find((x) => x.id === id);
            if (!ev) {
              e.prerequisites = 'unknown event';
              break;
            }
            if ((ev.eventType || '') !== reqType) {
              e.prerequisites = `must be ${reqType} type`;
              break;
            }
            if (Number(ev.year) !== Number(eventForm.year)) {
              e.prerequisites = 'must match selected year';
              break;
            }
            if (seen.has(id)) {
              e.prerequisites = 'no duplicates';
              break;
            }
            seen.add(id);
          }
        }
      } else {
        eventForm.prerequisites = [];
      }

      Object.assign(eventErrors, e);
      return Object.keys(e).length === 0;
    }

    function quickCheckEventForm() {
      if (MODE.CREATE && !eventForm.id?.trim()) return false;
      if (!PROGRAM_OPTIONS.some((o) => o.value === eventForm.programId)) return false;
      if (!EVENT_TYPES.some((o) => o.value === eventForm.eventType)) return false;
      if (!eventForm.title?.trim()) return false;
      if (!YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year))) return false;
      if (!LEVEL_OPTIONS.some((o) => o.value === eventForm.level)) return false;
      if (!eventForm.openDate || !eventForm.endDate) return false;
      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) return false;
      if (!eventForm.fees.every((f) => FEE_CODES.some((o) => o.value === f.code) && Number(f.amount) >= 0)) return false;

      const reqType = requiredPrereqType();
      if (reqType) {
        if (!Array.isArray(eventForm.prerequisites) || eventForm.prerequisites.length === 0) return false;
        const first = eventForm.prerequisites[0];
        if (!first?.eventId) return false;
      }
      return true;
    }
    const canSaveEvent = computed(() => quickCheckEventForm());

    function buildEventPayload() {
      return {
        id: eventForm.id,
        programId: eventForm.programId,
        eventType: eventForm.eventType,
        title: eventForm.title,
        year: Number(eventForm.year),
        level: eventForm.level,
        openDate: eventForm.openDate,
        endDate: eventForm.endDate,
        fees: (eventForm.fees || []).map((f) => ({
          code: f.code,
          amount: Number(f.amount || 0),
        })),
        prerequisites: requiredPrereqType() ? (eventForm.prerequisites || []).map((p) => ({ eventId: p.eventId })) : [],
      };
    }

    async function submitEventForm() {
      if (!validateEventForm()) {
        setStatus('Please fix errors before saving.', 'error', 2500);
        return;
      }
      const payload = buildEventPayload();

      if (MODE.CREATE) {
        try {
          await api.post('/events', payload);
          await loadEvents();
          setStatus('Event created.', 'success', 1500);
          goBackSection();
        } catch (err) {
          console.error(err);
          setStatus('Create failed.', 'error', 3000);
        }
      } else {
        try {
          const id = encodeURIComponent(editingEventId.value);
          const patchPayload = { ...payload };
          delete patchPayload.id;
          await api.patch(`/events/${id}`, patchPayload);
          await loadEvents();
          setStatus('Event updated.', 'success', 1500);
          goBackSection();
        } catch (err) {
          console.error(err);
          setStatus('Update failed.', 'error', 3000);
        }
      }
    }

    // =========================================================
    // REGISTRATION — fields-metadata renderer
    // =========================================================
    const registrationRows = ref([]);

    async function loadRegistrations({ showStatusIfActive = false } = {}) {
      try {
        const { data } = await api.get('/registrations', { params: { _: Date.now() } });
        registrationRows.value = Array.isArray(data) ? data : data?.registrations || [];
        if (showStatusIfActive && SECTION.REGISTRATIONS) setStatus('Registrations loaded.', 'info', 1200);
      } catch {
        registrationRows.value = [];
      }
    }

    const REG_STATUS_OPTIONS = [
      { value: 'paid', label: 'Paid' },
      { value: 'cancelled', label: 'Cancelled' },
    ];

    const registrationSearch = ref('');
    const registrationFilter = reactive({ year: '', programId: '', eventType: '' });

    const editingRegistrationId = ref(null);

    const registrationForm = reactive(newRegistrationForm());
    const registrationErrors = reactive({ main: {}, children: [], payments: [] });

    const hasActiveRegFilter = computed(() => !!(registrationFilter.programId || registrationFilter.eventType || registrationFilter.year));

    function resetRegFilters() {
      registrationFilter.year = '';
      registrationFilter.programId = '';
      registrationFilter.eventType = '';
      registrationSearch.value = '';
    }

    function newRegistrationForm() {
      return {
        id: makeId('R'),
        eventId: '',
        familyId: '',
        status: '',
        acceptedBy: '',
        parishMember: null,
        event: { title: '', year: '', programId: '', eventType: '' }, // snapshot (disabled)
        contacts: [], // snapshot (disabled) - 2 rows
        children: [], // [{childId, fullName, saintName, dob, allergies, status}]
        payments: [], // [{code, quantity, amount, method, txnRef, receiptNo, receivedBy}]
        createdAt: null,
        updatedAt: null,
      };
    }

    // --- Helpers --------------------------------------------------------------

    const isOpenEventFilter = (ev) => {
      const todayPST = new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 10);
      return (!ev?.openDate || ev?.openDate <= todayPST) && (!ev?.endDate || todayPST <= ev?.endDate);
    };

    function getCurrentSchoolYear() {
      // July-start version (optional):
      const now = new Date();
      const julyStartYear = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      return julyStartYear;
    }

    function isCurrentSchoolYear(ev) {
      return Number(ev?.year) === Number(getCurrentSchoolYear());
    }

    // Check whether a given family has registered for the year
    function alreadyRegistered({ familyId, year = getCurrentSchoolYear(), eventId = null, programId = null, eventType = null }) {
      if (!familyId || !Number.isFinite(Number(year))) return false;
      return registrationRows.value.some((r) => {
        if (r.familyId !== familyId) return false;
        if (Number(r.event?.year) !== Number(year)) return false;
        if (eventId != null && r.eventId !== eventId) return false;
        if (programId != null && r.event?.programId !== programId) return false;
        if (eventType != null && r.event?.eventType !== eventType) return false;
        return true;
      });
    }

    // Does this family meet all prerequisites for the event (same year)?
    function familyMetPrereqs(ev, familyId) {
      const prereqIds = Array.isArray(ev?.prerequisites) ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean) : [];

      // No prereqs → automatically OK
      if (prereqIds.length === 0) return true;

      // If no family yet, we can’t assert prereqs. Treat as not met so the UI nudges user to pick family first.
      if (!familyId) return false;

      const yr = Number(ev.year);
      return prereqIds.every((pid) => registrationRows.value.some((r) => r.familyId === familyId && r.eventId === pid && Number(r.event?.year) === yr));
    }

    // --- Select options for eventId on Registration Form ----------------------
    const eventOptionsForRegistration = computed(() => {
      const familyId = (registrationForm.familyId || '').trim();

      if (!familyId && MODE.CREATE) return [];

      // Create base from eventRows
      const base = eventRows.value
        // Rule 1: only show events open for registration
        .filter(isOpenEventFilter)
        // Rule 2: same (current) school year
        .filter(isCurrentSchoolYear)
        // Rule 3: exclude events the family already registered for (once a familyId is chosen)
        .filter((ev) => !alreadyRegistered({ familyId: familyId, year: ev.year, eventId: ev.id }))
        // Rule 4: require the family to have registrations for all prerequisite events (once a familyId is chosen)
        .filter((ev) => familyMetPrereqs(ev, familyId));

      // set the filtered to base if in CREATE mode else just show everything
      const filtered = MODE.CREATE ? base : eventRows.value;

      // Map to return the lookup array of objects [{value, label}]
      return filtered.map((ev) => ({
        value: ev.id,
        //label: `${ev.programId}_${ev.eventType}_${ev.year} — ${ev.title}`,
        label: ev.title,
      }));
    });

    watch(
      () => registrationForm.children.map((c) => c.childId).join(','),
      () => {
        recomputePayments();
      },
    );

    // Derived helpers
    const selectedEvent = computed(() => eventRows.value.find((e) => e.id === registrationForm.eventId) || null);
    const selectedEventLevel = computed(() => selectedEvent.value?.level || '');

    const familyById = (id) => familyRows.value.find((f) => f.id === id) || null;

    // Full families list for Family ID (kept computed for easy future rules)
    const familyDatalistOptions = computed(() =>
      familyRows.value.map((f) => ({
        value: f.id,
        label: `${f.parishMember ? 'Member' : 'NonMember'} — ${f.contacts?.[0]?.lastName || ''}, ${f.contacts?.[0]?.firstName || ''}
        — ${f.contacts?.[0]?.phone} - ${f.address?.city || ''}`,
      })),
    );

    const filteredRegistrationRows = computed(() => {
      const q = (registrationSearch.value || '').toLowerCase();
      const qDigits = normPhone(registrationSearch.value);
      return registrationRows.value.filter((r) => {
        const hitTop =
          (r.id || '').toLowerCase().includes(q) ||
          (r.familyId || '').toLowerCase().includes(q) ||
          (r.event?.programId || '').toLowerCase().includes(q) ||
          (r.event?.eventType || '').toLowerCase().includes(q) ||
          (r.event?.title || '').toLowerCase().includes(q) ||
          String(r.event?.year || '').includes(q);
        const hitContacts = (r.contacts || []).some((c) => (c.name || '').toLowerCase().includes(q) || (qDigits && normPhone(c.phone).includes(qDigits)));
        const byYear = !registrationFilter.year || Number(r.event?.year) === Number(registrationFilter.year);
        const byProg = !registrationFilter.programId || r.event?.programId === registrationFilter.programId;
        const byType = !registrationFilter.eventType || r.event?.eventType === registrationFilter.eventType;

        return (hitTop || hitContacts) && byYear && byProg && byType;
      });
    });

    function goRegistrationList() {
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.LIST);
    }

    function beginCreateRegistration() {
      Object.assign(registrationForm, newRegistrationForm());
      registrationErrors.main = {};
      registrationErrors.children = [];
      registrationErrors.payments = [];
      editingRegistrationId.value = null;
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.CREATE);
      setStatus('Creating new registration…', 'info', 1200);
    }

    const adminRegistration = computed(
      () => eventRows.value.find((e) => e.programId === PROGRAM.BPH && e.eventType === EVENT.ADMIN && isOpenEventFilter(e)) || null,
    );

    const tnttRegistration = computed(
      () => eventRows.value.find((e) => e.programId === PROGRAM.TNTT && e.eventType === EVENT.REGISTRATION && isOpenEventFilter(e)) || null,
    );

    function getRegistrationFor(familyId, eventId) {
      const reg = registrationRows.value.find((r) => r.familyId === familyId && r.eventId === eventId) || null;
      return reg;
    }

    function registerAdminForFamily(f) {
      if (alreadyRegistered({ familyId: f.id, programId: PROGRAM.BPH, eventType: EVENT.ADMIN })) {
        beginEditRegistration(getRegistrationFor(f.id, adminRegistration.value.id));
      } else {
        beginCreateRegistration();
        registrationForm.familyId = f?.id || '';
        registrationForm.eventId = adminRegistration.value.id || '';
        onRegFamilyChange();
        onRegEventChange();
      }
    }

    function registerTNTTForFamily(f) {
      if (alreadyRegistered({ familyId: f.id, programId: PROGRAM.TNTT, eventType: EVENT.REGISTRATION })) {
        beginEditRegistration(getRegistrationFor(f.id, tnttRegistration.value.id));
      } else if (alreadyRegistered({ familyId: f.id, programId: PROGRAM.BPH, eventType: EVENT.ADMIN })) {
        beginCreateRegistration();
        registrationForm.familyId = f?.id || '';
        registrationForm.eventId = tnttRegistration.value.id || '';
        onRegFamilyChange();
        onRegEventChange();
      } else {
        setStatus('Must already register for ADMIN event first', 'error', 3000);
      }
    }

    function beginEditRegistration(r) {
      Object.assign(registrationForm, newRegistrationForm(), r);
      editingRegistrationId.value = r.id;
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.EDIT);
      setStatus(`Editing ${r.id}`, 'info', 1200);
    }

    // Children selection logic for the "Add Child" button
    // Reuses the same rules as `childRegistrationOptions`
    // (no family → none, non-PC event → none, PF-only prereqs → all,
    // any PC prereq → only kids who registered that PC prereq this year)
    const availableChildOptions = computed(() => {
      // pass an index that does not match any row so ALL currently
      // selected children are excluded from options
      return childRegistrationOptions(null, { index: -1 });
    });

    // selOpt for childId (understands { form: <row>, index })
    function childRegistrationOptions(_fieldMeta, ctx = {}) {
      const idx = Number.isInteger(ctx.index) ? ctx.index : -1;

      // 1) no family selected → no options
      const famId = (registrationForm.familyId || '').trim();
      if (!famId) return [];

      // 2) event not selected or not PC → no options
      const ev = selectedEvent.value;
      if (!ev || ev.level !== LEVEL.PER_CHILD) return [];

      // Family + anti-duplication set
      const fam = familyById(famId);
      if (!fam) return [];
      const chosenElsewhere = new Set((registrationForm.children || []).map((c, i) => (i === idx ? null : c.childId)).filter(Boolean));

      // Collect prerequisite ids
      const prereqIds = Array.isArray(ev?.prerequisites) ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean) : [];

      // 3) PC event:
      //    - No prereq OR only PF prereqs → full children for selected family
      const prereqEvents = prereqIds.map((id) => eventRows.value.find((e) => e.id === id)).filter(Boolean);

      const hasPCPrereq = prereqEvents.some((p) => p.level === LEVEL.PER_CHILD);

      if (!hasPCPrereq) {
        return (fam.children || []).filter((c) => !chosenElsewhere.has(c.childId)).map((c) => ({ value: c.childId, label: displayChildNameAndAge(c) }));
      }

      //    - Any PC prereq → only children that registered for *any* PC prereq
      //      in the current school year for this family
      const pcPrereqIds = new Set(prereqEvents.filter((p) => p.level === LEVEL.PER_CHILD).map((p) => p.id));

      const eligibleChildIds = new Set(
        registrationRows.value
          .filter(
            (r) => r.familyId === famId && pcPrereqIds.has(r.eventId) && isCurrentSchoolYear(r.event), // uses r.event.year snapshot
          )
          .flatMap((r) => (r.children || []).map((ch) => ch.childId).filter(Boolean)),
      );

      return (fam.children || [])
        .filter((c) => eligibleChildIds.has(c.childId) && !chosenElsewhere.has(c.childId))
        .map((c) => ({ value: c.childId, label: displayChildNameAndAge(c) }));
    }

    // onChange for childId (hydrates snapshot into that row)
    function hydrateChildSnapshot(_fieldMeta, ctx = {}) {
      const row = ctx.form;
      if (!row) return;

      const fam = familyById(registrationForm.familyId);
      const ch = (fam?.children || []).find((c) => c.childId === row.childId);
      if (!ch) return;

      row.fullName = `${ch.lastName}, ${ch.firstName}`;
      row.saintName = ch.saintName;
      row.dob = ch.dob;
      row.allergies = Array.isArray(ch.allergies) ? ch.allergies.slice() : [];
      row.status = row.status || 'pending';

      // keep payments in sync with selected children
      recomputePayments();
    }

    function addRegChildRow() {
      registrationForm.children.push({
        childId: '',
        fullName: '',
        saintName: '',
        dob: '',
        allergies: [],
        status: 'pending',
      });
      registrationErrors.children.push({});
    }
    function removeRegChildRow(i) {
      registrationForm.children.splice(i, 1);
      registrationErrors.children.splice(i, 1);
      recomputePayments();
    }

    // Prerequisites per same year
    function checkPrerequisites() {
      const ev = selectedEvent.value;
      if (!ev) return { ok: true };
      const prereqs = Array.isArray(ev.prerequisites) ? ev.prerequisites : [];
      if (prereqs.length === 0) return { ok: true };
      const famId = (registrationForm.familyId || '').trim();
      if (!famId) return { ok: false, message: 'Select family to check prerequisite' };
      const mustHaveIds = new Set(prereqs.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean));
      const year = Number(ev.year);
      const hasAll = Array.from(mustHaveIds).every((reqId) =>
        registrationRows.value.some((r) => r.familyId === famId && r.eventId === reqId && Number(r.event?.year) === year),
      );
      return hasAll ? { ok: true } : { ok: false, message: 'Prerequisite not met for this family/year.' };
    }

    // Snapshots & payments prefills
    function hydrateRegistrationEvent() {
      const ev = selectedEvent.value;
      registrationForm.event = ev
        ? { title: ev.title, year: ev.year, programId: ev.programId, eventType: ev.eventType }
        : { title: '', year: '', programId: '', eventType: '' };
    }

    function hydrateRegistrationContacts() {
      const fam = familyById(registrationForm.familyId);
      if (!fam) {
        registrationForm.contacts = [];
        registrationForm.parishMember = null;
        return;
      }
      const contacts = Array.isArray(fam.contacts) ? fam.contacts : [];

      // Prioritize the first 2 among Father / Mother / Guardian
      const prioritized = contacts.filter((c) => PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const pick = [...prioritized, ...others].slice(0, 2);

      registrationForm.contacts = pick.map((c) => ({
        name: `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`,
        relationship: c.relationship || '',
        phone: formatUSPhone(c.phone || ''),
      }));

      registrationForm.parishMember = !!fam.parishMember;
    }

    function computeQuantity(ev) {
      return ev?.level === LEVEL.PER_CHILD ? Math.max(1, (registrationForm.children || []).filter((c) => c.childId).length) : 1;
    }

    function hydrateRegistrationPayments() {
      const ev = selectedEvent.value;
      if (!ev) {
        registrationForm.payments = [];
        return;
      }

      const fam = familyById(registrationForm.familyId);
      if (!fam) {
        registrationForm.payments = [];
        return;
      }

      const qty = computeQuantity(ev);

      const fees = Array.isArray(ev.fees) ? ev.fees : [];

      registrationForm.payments = fees
        .filter((f) => {
          if (registrationForm.parishMember === true) {
            return f.code !== 'NPMF';
          }
          return true;
        })
        .map((f) => {
          const unitAmount = Number(f.amount || 0);
          return {
            code: f.code,
            unitAmount: unitAmount,
            quantity: qty,
            amount: unitAmount * qty,
            method: '',
            txnRef: '',
            receiptNo: '',
            receivedBy: '',
          };
        });
    }

    // Recalculate the quantity and the total amount.
    function recomputePayments() {
      const qty = computeQuantity(selectedEvent.value);
      (registrationForm.payments || []).forEach((p) => {
        p.quantity = qty;
        const unit = Number(p.unitAmount || 0);
        p.amount = Math.round(unit * qty * 100) / 100;
      });
    }

    function onRegEventChange() {
      // (a) Snapshot event data
      hydrateRegistrationEvent();

      // (b) Hydrate payments from event fees (user fills method/refs later)
      hydrateRegistrationPayments();

      // (c) If per-child event, ensure one empty row exists at start
      const ev = selectedEvent.value;
      if (ev?.level === LEVEL.PER_CHILD && registrationForm.children.length === 0) {
        addRegChildRow();
      }
    }

    function onRegFamilyChange() {
      // Snapshot (two) contacts, prioritized Father/Mother/Guardian
      hydrateRegistrationContacts();

      // Remove any already-chosen children that don't belong to this family
      const fam = familyById(registrationForm.familyId);
      registrationForm.children = (registrationForm.children || []).filter((row) => fam?.children?.some((c) => c.childId === row.childId));
      registrationErrors.children = registrationForm.children.map(() => ({}));

      // Recompute total amounts in case quantity depends on children
      hydrateRegistrationPayments();
    }

    // Pure helper: returns ONE best-fit option (or [] if none)
    // Uses your existing computeAgeByYear(dob)
    // Internal: produce TNTT label by exact age
    function ageGroupLabelTNTT(age) {
      if (age == null) return null;
      if (age < 7) return 'Under Age';
      if (age >= 7 && age <= 9) return `Ấu Nhi Cấp ${age - 7 + 1}`; // 7→C1, 8→C2, 9→C3
      if (age >= 10 && age <= 12) return `Thiếu Nhi Cấp ${age - 10 + 1}`; // 10→C1, 11→C2, 12→C3
      if (age >= 13 && age <= 15) return `Nghĩa Sĩ Cấp ${age - 13 + 1}`; // 13→C1, 14→C2, 15→C3
      if (age >= 16) return 'Hiệp Sĩ';
      return null;
    }

    // Public: get a single { value: dob, label } option for the given DOB + program
    function ageGroupOptionsByProgram(dob, programId) {
      const age = computeAgeByYear(dob);
      if (age == null) return [];
      // If you created PROGRAM_STABLE or similar, prefer that constant. Fallback 'TNTT'.
      if (programId === (PROGRAM?.TNTT || 'TNTT')) {
        const label = ageGroupLabelTNTT(age);
        return label ? [{ value: dob, label }] : [];
      }
      return [];
    }

    // Meta-friendly adapter: use inside children row selOpt
    // Signature matches your meta handlers: (fieldMeta, ctx)
    function ageGroupOptionsForRow(_fieldMeta, ctx = {}) {
      const dob = ctx?.form?.dob;
      const programId = selectedEvent.value?.programId || null;
      return ageGroupOptionsByProgram(dob, programId);
    }

    watch(
      () => registrationForm.familyId,
      () => {
        const opts = eventOptionsForRegistration.value;
        if (!opts.some((o) => o.value === registrationForm.eventId)) {
          registrationForm.eventId = '';
          registrationForm.children = [];
          registrationForm.payments = [];
        }
      },
    );

    // REG_META
    const registrationFields = {
      main: [
        { col: 'id', label: 'Registration ID', type: 'text', disabled: true },
        {
          col: 'familyId',
          label: 'Family ID',
          type: 'datalist',
          placeholder: 'Start typing ID or name…',
          onChange: onRegFamilyChange,
          onInput: () => {},
          disabled: () => MODE.EDIT,
        },
        {
          col: 'eventId',
          label: 'Registration Event',
          type: 'select',
          selOpt: eventOptionsForRegistration,
          onChange: onRegEventChange,
          disabled: ({ form }) => (MODE.CREATE && !form.familyId) || MODE.EDIT,
        },
        {
          col: 'parishMember',
          label: 'Parish Member',
          type: 'select',
          selOpt: YES_NO_OPTIONS,
          disabled: true,
          show: ({ form }) => !!form.familyId, // only show after a family is chosen
        },
      ],
      eventSnapshot: [
        { col: 'title', label: 'Event Description', disabled: true },
        { col: 'year', label: 'School Year', disabled: true, transform: (v) => codeToLabel(v, YEAR_OPTIONS) },
        { col: 'programId', label: 'Program', disabled: true, transform: (v) => codeToLabel(v, PROGRAM_OPTIONS) },
        { col: 'eventType', label: 'Event Type', disabled: true, transform: (v) => codeToLabel(v, EVENT_TYPES) },
      ],
      contactSnapshot: [
        { col: 'name', label: 'Contact Name', disabled: true },
        { col: 'relationship', label: 'Relationship', disabled: true },
        { col: 'phone', label: 'Phone', disabled: true },
      ],
      meta: [
        { col: 'status', label: 'Status', type: 'select', selOpt: REG_STATUS_OPTIONS },
        {
          col: 'acceptedBy',
          label: 'Accepted & Signed By',
          type: 'select',
          selOpt: () => {
            const fam = familyById(registrationForm.familyId);
            return (fam?.contacts || []).map((c) => {
              const name = `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`;
              return { value: name, label: `${name} (${c.relationship || 'Contact'})` };
            });
          },
        },
      ],
      childrenRow: [
        {
          col: 'childId',
          label: 'Child Name',
          type: 'select',
          selOpt: childRegistrationOptions,
          onChange: hydrateChildSnapshot,
        },
        { col: 'fullName', label: 'Full Name', type: 'text', disabled: true, show: false },
        { col: 'saintName', label: 'Saint Name', type: 'text', disabled: true },
        { col: 'dob', label: 'Age to Grade', type: 'select', selOpt: ageGroupOptionsForRow, disabled: true },
        {
          col: 'allergies',
          label: 'Allergies',
          type: 'text',
          disabled: true,
          transform: (v) => (Array.isArray(v) ? v.join(', ') : ''),
        },
      ],
      paymentsRow: [
        { col: 'code', label: 'Fee Type', type: 'select', selOpt: FEE_CODES, disabled: true },
        { col: 'unitAmount', label: 'Unit Price', disabled: true, show: true },
        { col: 'quantity', label: 'Quantity', disabled: true },
        { col: 'amount', label: 'Total Amount', disabled: true },
        { col: 'method', label: 'Method', type: 'select', selOpt: PAYMENT_METHOD_OPTIONS },
        { col: 'txnRef', label: 'Ref/Check #', type: 'text', show: ({ row }) => (row?.method || '') !== 'cash' },
        { col: 'receiptNo', label: 'Receipt #', type: 'text' },
        { col: 'receivedBy', label: 'Received By', type: 'select', selOpt: RECEIVED_BY_OPTIONS },
      ],
    };

    function editEventFromReg(r) {
      const ev = eventRows.value.find((e) => e.id === r.eventId);
      if (ev) {
        beginEditEvent(ev);
      } else {
        setStatus('Event not found for this registration.', 'warn', 1800);
      }
    }

    function editFamilyFromReg(r) {
      const fam = familyRows.value.find((f) => f.id === r.familyId);
      if (fam) {
        beginEditFamily(fam);
      } else {
        setStatus('Family not found for this registration.', 'warn', 1800);
      }
    }

    function quickCheckRegistration() {
      // Must have event + family
      if (!registrationForm.eventId) return false;
      if (!registrationForm.familyId) return false;

      // If this event is per-child, require at least one child selected
      if (selectedEventLevel.value === LEVEL.PER_CHILD) {
        if (!(registrationForm.children || []).some((c) => c.childId)) return false;
      }

      // In EDIT mode, you might want to be a bit looser. If so, uncomment:
      if (MODE.EDIT) return true;

      return true;
    }

    function validateRegistration() {
      const e = { main: {}, children: [], payments: [] };

      // --- main checks
      if (!registrationForm.eventId) e.main.eventId = 'required';
      if (!registrationForm.familyId) e.main.familyId = 'required';
      if (!registrationForm.acceptedBy) e.main.acceptedBy = 'required';
      if (!registrationForm.status || registrationForm.status === 'pending') e.main.status = 'Status must be paid or cancelled';

      // --- children checks (only for PC)
      if (selectedEventLevel.value === LEVEL.PER_CHILD) {
        const children = registrationForm.children || [];

        if (!children.some((c) => !!c.childId)) {
          e.main.childrenRoot = 'Select at least one child.';
        }

        // IMPORTANT: use {} for "no error" rows
        e.children = children.map((c) => (c.childId ? {} : { childId: 'required' }));
      } else {
        e.children = []; // clear any stale errors
        delete e.main.childrenRoot;
      }

      // payments
      if (registrationForm.payments) {
        e.payments = registrationForm.payments.map((p) => {
          const pe = {};
          if (!p.method?.trim()) pe.method = 'required';
          if (!p.txnRef?.trim() && p.method?.trim() !== 'cash') pe.txnRef = 'required';
          if (!p.receiptNo?.trim()) pe.receiptNo = 'required';
          if (!p.receivedBy?.trim()) pe.receivedBy = 'required';
          return pe;
        });
      }

      // sync UI error objects (OK to mutate here)
      registrationErrors.main = e.main;
      registrationErrors.children = e.children;
      registrationErrors.payments = e.payments;

      // final result (pure booleans)
      const noMainErrors = Object.keys(e.main).length === 0;
      const noChildRowErrors = (e.children || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const noPaymentRowErrors = (e.payments || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const noChildrenRootError = !e.main.childrenRoot;

      return noMainErrors && noChildrenRootError && noChildRowErrors && noPaymentRowErrors;
    }

    const canSaveRegistration = computed(() => quickCheckRegistration());

    function buildRegistrationPayload() {
      const nowIso = new Date().toISOString();
      const ev = selectedEvent.value;
      return {
        id: registrationForm.id,
        eventId: registrationForm.eventId,
        familyId: registrationForm.familyId,
        status: registrationForm.status,
        parishMember: registrationForm.parishMember ?? null,
        event: {
          title: ev?.title || registrationForm.event.title,
          year: ev?.year || registrationForm.event.year,
          programId: ev?.programId || registrationForm.event.programId,
          eventType: ev?.eventType || registrationForm.event.eventType,
        },
        contacts: registrationForm.contacts.map((c) => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
        })),
        children: (registrationForm.children || [])
          .filter((c) => c.childId)
          .map((c) => ({
            childId: c.childId,
            saintName: c.saintName,
            fullName: c.fullName,
            dob: c.dob,
            allergies: c.allergies,
            status: c.status || 'pending',
          })),
        payments: (registrationForm.payments || []).map((p) => ({
          code: p.code,
          unitAmount: Number(p.unitAmount || 0),
          amount: Number(p.amount || 0),
          quantity: Number(p.quantity || 0),
          method: p.method || null,
          txnRef: p.txnRef || null,
          receiptNo: p.receiptNo || null,
          receivedBy: p.receivedBy || null,
          paidAt: p.method ? nowIso : null,
        })),
        acceptedBy: registrationForm.acceptedBy || null,
        createdAt: MODE.CREATE ? nowIso : registrationForm.createdAt || nowIso,
        updatedAt: nowIso,
      };
    }
    async function submitRegistrationForm() {
      if (!validateRegistration()) {
        setStatus('Please fix errors before saving.', 'error', 2500);
        return;
      }
      const payload = buildRegistrationPayload();
      if (MODE.CREATE) {
        try {
          await api.post('/registrations', payload);
          await loadRegistrations();
          setStatus('Registration created.', 'success', 1500);
          goBackSection();
        } catch (e) {
          console.error(e);
          setStatus('Create failed.', 'error', 3000);
        }
      } else {
        try {
          const id = encodeURIComponent(editingRegistrationId.value);
          const patch = { ...payload };
          delete patch.id;
          await api.patch(`/registrations/${id}`, patch);
          await loadRegistrations();
          setStatus('Registration updated.', 'success', 1500);
          goBackSection();
        } catch (e) {
          console.error(e);
          setStatus('Update failed.', 'error', 3000);
        }
      }
    }

    // =========================================================
    // Roster TNTT
    // =========================================================

    const rosterSearch = ref('');
    const rosterFilter = reactive({ programId: '', eventType: '', eventId: '', year: '', age: '' });

    const hasActiveRosterFilter = computed(
      () => !!(rosterSearch.value || rosterFilter.programId || rosterFilter.eventType || rosterFilter.eventId || rosterFilter.year || rosterFilter.age),
    );

    function resetRosterFilters() {
      rosterFilter.programId = '';
      rosterFilter.eventType = '';
      rosterFilter.eventId = '';
      rosterFilter.year = '';
      rosterFilter.age = '';
      rosterSearch.value = '';
    }

    function goRosterList() {
      switchSection(SECTION_NAMES.ROSTERS, MODE_NAMES.LIST);
    }

    const eventOptionsForRoster = computed(() => {
      // Create base from eventRows
      return eventRows.value
        .filter((f) => {
          const byYear = !rosterFilter.year || Number(f.year) === Number(rosterFilter.year);
          const byType = !rosterFilter.eventType || f.eventType === rosterFilter.eventType;
          return byYear && byType;
        })
        .map((ev) => ({
          value: ev.id,
          label: ev.title,
        }));
    });

    const rosterRows = computed(() =>
      registrationRows.value
        .filter((r) => r.status === 'paid')
        .flatMap((r) =>
          (r.children || []).map((ch) => ({
            registrationId: r.id,
            eventId: r.eventId,
            eventType: r.event?.eventType,
            eventTitle: r.event?.title,
            programId: r.event?.programId,
            year: r.event?.year,
            familyId: r.familyId,
            childId: ch.childId,
            saintName: ch.saintName,
            fullName: ch.fullName,
            dob: ch.dob,
            age: computeAgeByYear(ch.dob),
            allergies: ch.allergies.join(', '),
          })),
        ),
    );

    const filteredRosterRows = computed(() => {
      const q = rosterSearch.value.toLowerCase();
      return rosterRows.value.filter((c) => {
        const hits = (c.fullName || '').toLowerCase().includes(q);
        const byProg = !rosterFilter.programId || c.programId === rosterFilter.programId;
        const byYear = !rosterFilter.year || Number(c.year) === Number(rosterFilter.year);
        const byType = !rosterFilter.eventType || c.eventType === rosterFilter.eventType;
        const byEvent = !rosterFilter.eventId || c.eventId === rosterFilter.eventId;
        const byAge = !rosterFilter.age || Number(c.age) === Number(rosterFilter.age);

        return hits && byProg && byYear && byType && byEvent && byAge;
      });
    });

    const ageOptions = computed(() => {
      const arr = [];
      for (let i = 7; i < 20; i++) {
        arr.push(i);
      }
      return arr.map((i) => ({
        value: i,
        label: i,
      }));
    });
    // =========================================================
    // INITIAL LOAD (quiet)
    // =========================================================
    onMounted(() => {
      loadFamilies({ showStatusIfActive: false });
      loadEvents({ showStatusIfActive: false });
      loadRegistrations({ showStatusIfActive: false });
    });

    // =========================================================
    // EXPOSE
    // =========================================================
    return {
      // layout
      currentSection,
      fromSection,
      currentMode,
      menuOpen,
      BURGER_MENU,
      breadcrumbs,
      status,
      statusIcon,
      SECTION_NAMES,
      SECTION,
      MODE_NAMES,
      MODE,
      switchSection,
      goBackSection,

      // options
      RELATIONSHIP_OPTIONS,
      YES_NO_OPTIONS,
      PROGRAM_OPTIONS,
      LEVEL_OPTIONS,
      EVENT_TYPES,
      FEE_CODES,
      YEAR_OPTIONS,
      EVENT,
      LEVEL,
      PROGRAM,
      getOptions,
      formatOptionLabel,

      // helpers
      codeToLabel,
      relativeDisplayValue,
      isVisible,
      getFieldDisabled,
      onFormFieldInput,
      onFormFieldChange,
      maskLast4,
      getCurrentSchoolYear,

      // families
      familyFields,
      familySearch,
      filteredFamilyRows,
      familyForm,
      familyErrors,
      familyContactsMode,
      familyContactsIndex,
      visibleFamilyContacts,
      resetFamilyFilters,
      hasActiveFamilyFilter,
      nextFamilyContact,
      prevFamilyContact,
      displayChildNameAndAge,
      parentLastNamesDisplay,
      familyChildrenMode,
      familyChildrenIndex,
      visibleFamilyChildren,
      nextFamilyChild,
      prevFamilyChild,
      beginCreateFamily,
      beginEditFamily,
      submitFamilyForm,
      resetFamilyForm,
      addFamilyContact,
      removeFamilyContact,
      addFamilyChild,
      removeFamilyChild,
      contactDisplay,
      buildFamilyPayload,

      // events
      eventSearch,
      eventFilter,
      hasActiveEventFilter,
      eventFields,
      eventForm,
      eventErrors,
      filteredEventRows,
      resetEventFilters,
      displayEventFees,
      addEventFee,
      removeEventFee,
      addEventPrerequisiteRow,
      removeEventPrerequisiteRow,
      availablePrerequisiteOptions,
      showPrerequisites,
      canSaveEvent,
      submitEventForm,
      beginCreateEvent,
      beginEditEvent,
      buildEventPayload,

      // registrations
      registrationRows,
      registrationSearch,
      registrationFilter,
      filteredRegistrationRows,
      selectedEventLevel,
      hasActiveRegFilter,
      resetRegFilters,
      editEventFromReg,
      editFamilyFromReg,
      beginCreateRegistration,
      registerAdminForFamily,
      registerTNTTForFamily,
      beginEditRegistration,
      alreadyRegistered,
      registrationForm,
      registrationFields,
      registrationErrors,
      canSaveRegistration,
      submitRegistrationForm,
      familyDatalistOptions,
      availableChildOptions,
      addRegChildRow,
      removeRegChildRow,

      // rosters
      rosterSearch,
      rosterFilter,
      filteredRosterRows,
      hasActiveRosterFilter,
      eventOptionsForRoster,
      ageOptions,
      ageGroupLabelTNTT,
      resetRosterFilters,
      goRosterList,
    };
  },
});

app.mount('#app');
