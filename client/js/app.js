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
  eventView: 'ui.eventView',
};

const app = createApp({
  setup() {
    // =========================================================
    // GLOBAL UI / STATUS
    // =========================================================
    const currentSection = ref(sessionStorage.getItem(STORAGE_KEYS.section) || 'families');
    function switchSection(s) {
      currentSection.value = s;
    }
    watch(currentSection, (v) => sessionStorage.setItem(STORAGE_KEYS.section, v));

    const menuOpen = ref(false);

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
    // OPTIONS ({ value, label }) — NEW CODES ONLY
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
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ];

    const PROGRAM_OPTIONS = [
      { value: 'BPH', label: 'Ban Phu Huynh' },
      { value: 'TNTT', label: 'Thieu Nhi' },
    ];
    const LEVEL_OPTIONS = [
      { value: 'PF', label: 'Per Family' },
      { value: 'PC', label: 'Per Child' },
    ];
    const EVENT_TYPES = [
      { value: 'ADM', label: 'Security' },
      { value: 'REG', label: 'Registration' },
      { value: 'EVT', label: 'Event' },
    ];
    const FEE_CODES = [
      { value: 'REGF', label: 'Registration Fee' },
      { value: 'EVTF', label: 'Event Fee' },
      { value: 'SECF', label: 'Security Fee' },
      { value: 'NPMF', label: 'NonParish Fee' },
    ];

    const YEAR_OPTIONS = computed(() => {
      const y = new Date().getFullYear();
      return [y - 1, y, y + 1].map((n) => ({ value: n, label: `School Year ${String(n)}-${String(n + 1).slice(2)}` }));
    });

    // Helpers for option rendering
    function getOptions(field, ctx = {}) {
      if (Array.isArray(field.selOpt)) return field.selOpt;
      if (typeof field.selOptFn === 'function') return field.selOptFn(ctx) || [];
      return [];
    }
    function formatOptionLabel(opt, withValue = false) {
      if (opt == null) return '';
      if (opt.label == null || opt.label === '' || opt.label === opt.value) return String(opt.value);
      if (typeof opt.value === 'boolean' || !withValue) return opt.label;
      return `${opt.value} - ${opt.label}`;
    }

    // --- Relative Display: source registry ------------------------------------
    const RD_SOURCES = {
      eventRows: () => eventRows.value, // add more sources here in the future
    };

    // =========================================================
    // COMMON HELPERS
    // =========================================================

    // ---- Numeric, grouped ID helper (no state) ----
    // Example:
    //   makeId('F')           -> "F:1234-5678-9012"
    //   makeId('E', 12, 4)    -> "E:6482-0017-5920"
    //   makeId('R', 12, 4, false) -> "R:0835-1492-0173" (allows leading zero)

    /** Uniform 0..bound-1 using crypto when available (rejection sampling). */
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

    /** Make a numeric string of given length. Optionally forbid leading zero. */
    function randomNumericString(len = 12, forbidLeadingZero = true) {
      if (len <= 0) return '';
      let out = '';
      // First digit
      out += String(forbidLeadingZero ? 1 + randInt(9) : randInt(10));
      // Remaining digits
      for (let i = 1; i < len; i++) out += String(randInt(10));
      return out;
    }

    /** Group digits with hyphens every `groupSize` digits. */
    function groupDigits(s, groupSize = 4) {
      if (!groupSize || groupSize <= 0) return s;
      return s.match(new RegExp(`\\d{1,${groupSize}}`, 'g')).join('-');
    }

    /**
     * Make an ID like "F:1234-5678-9012"
     * @param {string} prefix - 'F' (Family), 'E' (Event), 'R' (Registration), etc.
     * @param {number} length - total digit count (default 12)
     * @param {number} groupSize - digits per group for hyphens (default 4)
     * @param {boolean} forbidLeadingZero - ensure first digit ≠ 0 (default true)
     */
    function makeId(prefix, length = 12, groupSize = 4, forbidLeadingZero = true) {
      const digits = randomNumericString(length, forbidLeadingZero);
      const formatted = groupDigits(digits, groupSize);
      return `${prefix}:${formatted}`;
    }

    // Safe shallow path getter (supports a.b.c – keep it simple)
    function getByPath(obj, path) {
      if (!obj || !path) return undefined;
      return String(path)
        .split('.')
        .reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
    }

    /**
     * Resolve a relative-display value for a control field.
     * @param {Object} row   The current row object (e.g., one prerequisite item)
     * @param {Object} fld   The control field meta (contains .col and .relativeDisplay[])
     * @param {Object} rd    One item from fld.relativeDisplay
     *                        { rdSource, rdKey='id', rdCol, map? }
     */
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

      // Optional mapping for code -> label display
      if (rd.map) return codeToLabel(raw, rd.map);
      return String(raw);
    }

    /**
     * Convert a stored code/value into its display label.
     * @param {*} value                The stored value (e.g., "REGF")
     * @param {Array|Function} source  Options array [{value,label}] OR a function (ctx)=>array
     * @param {Object} [ctx]           Optional context to pass if source is a function
     * @param {Object} [opts]
     * @param {boolean} [opts.withCode=false]  If true, returns "CODE - Label"
     * @param {string}  [opts.fallback=""]     Fallback when value not found (defaults to the raw value)
     */
    function codeToLabel(value, source, ctx = undefined, { withCode = false, fallback = '' } = {}) {
      const options = typeof source === 'function' ? source(ctx) || [] : source || [];
      const found = options.find((o) => o && o.value === value);
      if (!found) return fallback || (value ?? '');
      const label = found.label ?? found.value;
      return withCode ? `${found.value} - ${label}` : label;
    }

    function uid(prefix = 'S') {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}:${crypto.randomUUID()}`;
      return `${prefix}:${Math.random().toString(36).slice(2)}`;
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
      if ('default' in field) return typeof field.default === 'function' ? field.default(ctx) : field.default;
      return field.type === 'checkbox' ? false : '';
    }
    function buildFromFields(fields, { ctx = {}, overrides = {} } = {}) {
      const out = {};
      for (const f of fields) setDefault(out, f.col, getDefaultValue(f, ctx));
      for (const [path, value] of Object.entries(overrides)) setDefault(out, path, value);
      return out;
    }
    function isVisible(field, ctx = {}) {
      if (!Object.prototype.hasOwnProperty.call(field, 'show')) return true;
      return !!evalMaybe(field.show, ctx);
    }

    function isNonNegativeNumber(val) {
      // treat null/undefined/'' as invalid (required)
      if (val === null || val === undefined || val === '') return false;
      // ensure it's a finite number (v-model.number gives numbers or null)
      if (typeof val !== 'number' || !Number.isFinite(val)) return false;
      return val > 0;
    }

    function displayEventFees(evt) {
      return evt.fees?.length > 0 ? evt.fees.map((item) => item.code + '-$' + String(item.amount)).join(' / ') : '—';
    }

    // =========================================================
    // FAMILIES
    // =========================================================
    const FAMILY_TABS = [
      { key: 'household', label: 'Household' },
      { key: 'contacts', label: 'Contacts' },
      { key: 'children', label: 'Children' },
    ];

    const familyView = ref('list');
    const familyMode = ref('create');
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
        if (showStatusIfActive && currentSection.value === 'families') setStatus('Families loaded.', 'info', 1200);
      } catch {
        familyRows.value = [];
      }
    }

    // Generic input updater that uses field meta
    /**
     *
     * @param {*} targetObj The row object
     * @param {*} fieldMeta The fieldMeta (not the field.col itself)
     * @param {*} evt  The event object
     */
    function onFormFieldInput(targetObj, fieldMeta, evt) {
      const raw = evt?.target?.value ?? '';
      const next = typeof fieldMeta.onInput === 'function' ? fieldMeta.onInput(raw) : raw;
      // Writes to the right place using fieldMeta.col (supports dotted paths)
      setDefault(targetObj, fieldMeta.col, next);
    }

    // Optional: generic change handler (useful for selects if you don't use v-model)
    function onFormFieldChange(targetObj, fieldMeta, evt) {
      const val = fieldMeta.type === 'checkbox' ? !!evt?.target?.checked : evt?.target?.value;
      setDefault(targetObj, fieldMeta.col, val);
    }

    const maskLast4 = (s = '') => {
      const d = normPhone(s);
      return d ? `•${d.slice(-4)}` : '';
    };
    const contactDisplay = (f) => {
      const arr = Array.isArray(f.contacts) ? f.contacts : [];
      if (!arr.length) return '—';
      const withPhone = arr.find((c) => normPhone(c.phone).length > 0 && c.isEmergency);
      const p = withPhone || arr[0];
      const name = p.lastName + ', ' + p.firstName + (p.middle ? ' ' + p.middle : '') || 'Contact';
      const last4 = maskLast4(p.phone);
      return last4 ? `${name} · ${last4}` : name;
    };

    const familyFields = {
      household: {
        main: [
          {
            col: 'id',
            label: 'Family ID',
            type: 'text',
            placeholder: '',
            default: makeId('F'),
            disabled: () => true,
            show: () => true,
          },
          { col: 'parishMember', label: 'Parish Member', type: 'select', selOpt: YES_NO_OPTIONS, default: () => true },
          {
            col: 'parishNumber',
            label: 'Parish Number',
            type: 'text',
            default: '',
            show: () => familyForm.parishMember === true,
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
          onInput: formatUSPhone,
          placeholder: '(714) 123-4567',
          default: '',
        },
        { col: 'email', label: 'Email Address', type: 'text', default: '' },
        { col: 'isEmergency', label: 'Emergency Contact', type: 'checkbox', default: false },
      ],
      children: [
        { col: 'childId', label: 'Child ID', type: 'text', show: false, default: () => makeId('S') },
        { col: 'lastName', label: 'Last Name', type: 'text', default: '' },
        { col: 'firstName', label: 'First Name', type: 'text', default: '' },
        { col: 'middle', label: 'Middle', type: 'text', default: '' },
        { col: 'saintName', label: 'Saint Name', type: 'text', default: '' },
        { col: 'dob', label: 'Date of Birth', type: 'date', default: '' },
        { col: 'allergiesStr', label: 'Allergies', type: 'text', default: '' },
        { col: 'is_name_exception', label: 'Name Exception', type: 'checkbox', default: false },
        { col: 'exception_notes', label: 'Exception Notes', type: 'text', default: '' },
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

    const familyTab = ref(FAMILY_TABS[0].key);

    function validateFamilyTab(tabName = familyTab.value) {
      const s = familyForm;
      let e = null;
      if (tabName === 'household') {
        e = {};
        if (!s.id?.trim()) e.id = 'required';
        if (!s.parishNumber?.trim() && s.parishMember) e.parishNumber = 'required';
        if (!s.address.street?.trim()) e.street = 'required';
        if (!s.address.city?.trim()) e.city = 'required';
        if (!/^\d{5}(-\d{4})?$/.test(s.address.zip || '')) e.zip = 'must be 5 digits.';
        familyErrors.household = e;
        return Object.keys(e).length === 0;
      }
      if (tabName === 'contacts') {
        e = s.contacts.map((c) => {
          const ce = {};
          if (!c.lastName?.trim()) ce.lastName = 'required';
          if (!c.firstName?.trim()) ce.firstName = 'required';
          if (!c.relationship?.trim()) ce.relationship = 'required';
          if (!c.phone?.trim() || normPhone(c.phone).length !== 10) ce.phone = 'required and must be 10 digit';
          if ((c.email || '').trim() && !/^\S+@\S+\.\S+$/.test(c.email)) ce.email = 'blank or valid email';
          return ce;
        });
        familyErrors.contacts = e;
        return e.every((obj) => Object.keys(obj).length === 0);
      }
      if (tabName === 'children') {
        //const parentLasts = s.contacts
        //  .filter((c) => ["Mother", "Father"].includes((c.relationship || "").trim()))
        //  .map((c) => c.lastName?.trim())
        //  .filter(Boolean);
        e = s.children.map((c) => {
          const ce = {};
          if (!c.lastName?.trim()) ce.lastName = 'required';
          if (!c.firstName?.trim()) ce.firstName = 'required';
          if (!c.dob?.trim()) ce.dob = 'required.';
          const matchesParent = parentLastNameList.value.some(
            (p) => p.toLowerCase() === (c.lastName || '').toLowerCase(),
          );
          if (!matchesParent) {
            if (!c.is_name_exception) ce.is_name_exception = 'Check here if name exception';
            if (!c.exception_notes?.trim()) ce.exception_notes = 'required';
            if (!(c.is_name_exception && c.exception_notes?.trim())) ce.lastName = ce.lastName || 'mismatch w/ parents';
          }
          return ce;
        });
        familyErrors.children = e;
        return e.every((obj) => Object.keys(obj).length === 0);
      }
      return true;
    }

    function goFamilyTab(tKey) {
      if (familyTab.value === tKey) return;
      if (!validateFamilyTab()) {
        const label = FAMILY_TABS.find((t) => t.key === familyTab.value)?.label || '';
        setStatus(`Please fix errors in ${label}.`, 'error', 2500);
        if (familyTab.value === 'contacts' && familyContactsMode.value !== 'all') familyContactsMode.value = 'all';
        if (familyTab.value === 'children' && familyChildrenMode.value !== 'all') familyChildrenMode.value = 'all';
        return;
      }
      familyTab.value = tKey;
    }

    // paging
    const familyContactsMode = ref('all');
    const familyChildrenMode = ref('all');
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

    // dirty tracking
    const familyOriginalSnapshot = ref('');
    const isFamilyDirty = computed(() => JSON.stringify(familyForm) !== familyOriginalSnapshot.value);
    function snapshotFamilyForm() {
      familyOriginalSnapshot.value = JSON.stringify(familyForm);
    }

    // nav
    function goFamilyList() {
      familyView.value = 'list';
      familySearch.value = '';
    }
    function beginCreateFamily() {
      familyMode.value = 'create';
      Object.assign(familyForm, newFamilyForm());
      hydrateFamilyErrors();
      familyTab.value = FAMILY_TABS[0].key;
      familyView.value = 'form';
      snapshotFamilyForm();
      setStatus('Creating new family…', 'info', 1200);
    }
    function beginEditFamily(f) {
      familyMode.value = 'edit';
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
      familyTab.value = FAMILY_TABS[0].key;
      familyView.value = 'form';
      snapshotFamilyForm();
      setStatus(`Editing ${f.id}`, 'info', 1200);
    }

    // Array of unique parent last names (preserves first-seen casing/order)
    const parentLastNameList = computed(() => {
      const seen = new Set();
      const out = [];
      for (const c of familyForm.contacts || []) {
        const rel = (c?.relationship || '').trim();
        if (!PARENT_RELATIONSHIPS.has(rel)) continue;
        const ln = (c?.lastName || '').trim();
        if (!ln) continue;
        const key = ln.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(ln);
        }
      }
      return out;
    });

    // Display-friendly string, e.g. "Tran / Vuong"
    const parentLastNamesDisplay = computed(() => parentLastNameList.value.join(' / '));

    const filteredFamilyRows = computed(() => {
      if (!familySearch.value) return familyRows.value;
      const q = familySearch.value.toLowerCase();
      const qDigits = normPhone(familySearch.value);
      return familyRows.value.filter((f) => {
        const hitsTop =
          (f.id || '').toLowerCase().includes(q) ||
          (f.parishNumber || '').toLowerCase().includes(q) ||
          (f.address?.city || '').toLowerCase().includes(q);
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

    // --- Age by year (no month/day) --------------------------------------------
    const CURRENT_YEAR = new Date().getFullYear();

    function getYearPart(input) {
      if (!input) return null;
      if (typeof input === 'number') return input;
      if (typeof input === 'string') {
        // fast path for "YYYY-..." or "YYYY"
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
      const age = CURRENT_YEAR - birthYear;
      return age < 0 ? 0 : age; // clamp future dates
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
      for (const t of FAMILY_TABS) {
        if (!validateFamilyTab(t.key)) {
          familyTab.value = t.key;
          setStatus(`Please fix errors in ${t.label}.`, 'error', 2500);
          return;
        }
      }
      if (JSON.stringify(familyForm) === familyOriginalSnapshot.value) {
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
      if (familyMode.value === 'create') {
        try {
          await api.post('/families', payload);
          await loadFamilies();
          setStatus('Family created.', 'success', 1500);
          await nextTick();
          goFamilyList();
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
        goFamilyList();
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
      if (showStatusIfActive && currentSection.value === 'events') setStatus('Events loaded.', 'info', 1200);
    }

    const eventView = ref(sessionStorage.getItem(STORAGE_KEYS.eventView) || 'list');
    watch(eventView, (v) => sessionStorage.setItem(STORAGE_KEYS.eventView, v));

    const eventMode = ref('create');
    const eventSearch = ref('');
    const eventFilter = reactive({ programId: '', level: '', year: '' });
    const eventErrors = reactive({});
    const editingEventId = ref(null);

    function clearEventErrors() {
      for (const k of Object.keys(eventErrors)) delete eventErrors[k];
    }

    // Meta definition
    const eventFields = {
      main: [
        {
          col: 'id',
          label: 'Event ID',
          type: 'text',
          placeholder: 'Self Generated',
          default: () => makeId('E'),
          disabled: () => true,
        },
        {
          col: 'programId',
          label: 'Program',
          type: 'select',
          selOpt: PROGRAM_OPTIONS,
          default: () => PROGRAM_OPTIONS[0].value,
        },
        { col: 'eventType', label: 'Type', type: 'select', selOpt: EVENT_TYPES, default: 'REG' },
        { col: 'title', label: 'Title', type: 'text', default: '', placeholder: 'TNTT Roster 2025-26' },
        {
          col: 'year',
          label: 'Year',
          type: 'select',
          selOptFn: () => YEAR_OPTIONS.value,
          default: () => new Date().getFullYear(),
        },
        { col: 'level', label: 'Level', type: 'select', selOpt: LEVEL_OPTIONS, default: () => LEVEL_OPTIONS[0].value },
        { col: 'openDate', label: 'Open Date', type: 'date', default: '' },
        { col: 'endDate', label: 'End Date', type: 'date', default: '' },
      ],
      feeRow: [
        { col: 'code', label: 'Code', type: 'select', selOpt: FEE_CODES, default: 'REGF' },
        { col: 'amount', label: 'Amount', type: 'number', default: 0, attrs: { min: 0, step: 1 } },
      ],
      prerequisiteRow: [
        {
          col: 'eventId',
          label: 'Prerequisite Event ID',
          type: 'select',
          selOptFn: ({ index }) =>
            availablePrerequisiteOptions(index).map((e) => ({
              value: e.id,
              label: `${e.programId}_${e.eventType}_${e.year} - ${e.title}`,
            })),
          default: '',
          relativeDisplay: [
            // rdSource = which list to search; rdKey = property used to match the select value
            // rdCol = which property to display from the matched record
            // (optional) map = [{value,label}] to convert codes to labels (e.g., eventType -> "Registration")
            { label: 'Type', rdSource: 'eventRows', rdKey: 'id', rdCol: 'eventType', map: EVENT_TYPES },
            { label: 'Title', rdSource: 'eventRows', rdKey: 'id', rdCol: 'title' },
          ],
        },
      ],
    };

    function isMetaFieldVisible(field, ctx = {}) {
      if (!Object.prototype.hasOwnProperty.call(field, 'show')) return true;
      return !!evalMaybe(field.show, ctx);
    }
    function getFieldDisabled(field, ctx = {}) {
      return !!evalMaybe(field.disabled, ctx);
    }

    function newEventForm() {
      const main = buildFromFields(eventFields.main);
      return { ...main, prerequisites: [], fees: [] };
    }
    const eventForm = reactive(newEventForm());

    const showPrerequisites = computed(() => eventForm.eventType !== 'ADM');

    function requiredPrereqType() {
      if (eventForm.eventType === 'REG') return 'ADM';
      if (eventForm.eventType === 'EVT') return 'REG';
      return null; // ADM => none
    }

    function availablePrerequisiteOptions(rowIndex) {
      const reqType = requiredPrereqType();
      if (!reqType) return [];
      const selectedElsewhere = new Set(
        (eventForm.prerequisites || []).map((p, i) => (i === rowIndex ? null : p.eventId)).filter(Boolean),
      );
      return eventRows.value.filter(
        (ev) =>
          Number(ev.year) === Number(eventForm.year) &&
          ev.id !== eventForm.id &&
          (ev.eventType || '') === reqType &&
          !selectedElsewhere.has(ev.id),
      );
    }

    // Keep prerequisites valid + ensure presence for REG/EVT
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
      eventForm.prerequisites.push(
        buildFromFields(eventFields.prerequisiteRow, { ctx: { index: 0, form: eventForm } }),
      );
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
      currentSection.value = 'events';
      eventView.value = 'list';
    }

    function beginCreateEvent() {
      Object.assign(eventForm, newEventForm());
      clearEventErrors();
      eventMode.value = 'create';
      editingEventId.value = null;

      // Always 1 fee row
      if (eventForm.fees.length === 0) addEventFee();

      // Ensure at least 1 prerequisite row for non-ADM default ("REG")
      if (showPrerequisites.value && eventForm.prerequisites.length === 0) addEventPrerequisiteRow();

      currentSection.value = 'events';
      eventView.value = 'form';
      setStatus('Creating new event…', 'info', 1200);
    }

    function beginEditEvent(e) {
      const snap = JSON.parse(JSON.stringify(e));

      // Normalize prerequisites to array of {eventId}
      const prerequisites = (Array.isArray(snap.prerequisites) ? snap.prerequisites : []).map((p) =>
        typeof p === 'string' ? { eventId: p } : { eventId: p?.eventId || '' },
      );

      const fees = (snap.fees || []).map((f) => ({ code: f.code, amount: f.amount }));

      Object.assign(eventForm, newEventForm(), snap, { prerequisites, fees });

      // If eventType missing, default to REG
      if (!EVENT_TYPES.some((t) => t.value === eventForm.eventType)) eventForm.eventType = 'REG';

      // Enforce type rule: ADM => no prereq, otherwise ensure at least one row
      if (eventForm.eventType === 'ADM') {
        eventForm.prerequisites = [];
      } else if (!Array.isArray(eventForm.prerequisites) || eventForm.prerequisites.length === 0) {
        addEventPrerequisiteRow();
      }

      // If editing and no fees, ensure at least 1 row for UX
      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) addEventFee();

      clearEventErrors();
      eventMode.value = 'edit';
      editingEventId.value = e.id;
      currentSection.value = 'events';
      eventView.value = 'form';
      setStatus(`Editing ${e.id}`, 'info', 1200);
    }

    function validateEventForm() {
      clearEventErrors();
      const e = {};
      if (eventMode.value === 'create' && !eventForm.id?.trim()) e.id = 'required';

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
            e.fees = 'fee amount > 0';
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
      if (eventMode.value === 'create' && !eventForm.id?.trim()) return false;
      if (!PROGRAM_OPTIONS.some((o) => o.value === eventForm.programId)) return false;
      if (!EVENT_TYPES.some((o) => o.value === eventForm.eventType)) return false;
      if (!eventForm.title?.trim()) return false;
      if (!YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year))) return false;
      if (!LEVEL_OPTIONS.some((o) => o.value === eventForm.level)) return false;
      if (!eventForm.openDate || !eventForm.endDate) return false;
      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) return false;
      if (!eventForm.fees.every((f) => FEE_CODES.some((o) => o.value === f.code) && Number(f.amount) >= 0))
        return false;

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

      if (eventMode.value === 'create') {
        try {
          await api.post('/events', payload);
          await loadEvents();
          setStatus('Event created.', 'success', 1500);
          currentSection.value = 'events';
          eventView.value = 'list';
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
          currentSection.value = 'events';
          eventView.value = 'list';
        } catch (err) {
          console.error(err);
          setStatus('Update failed.', 'error', 3000);
        }
      }
    }

    // =========================================================
    // INITIAL LOAD (quiet)
    // =========================================================
    onMounted(() => {
      loadFamilies({ showStatusIfActive: false });
      loadEvents({ showStatusIfActive: false });
    });

    // =========================================================
    // EXPOSE
    // =========================================================
    return {
      // layout
      currentSection,
      switchSection,
      menuOpen,
      status,
      statusIcon,

      // options
      RELATIONSHIP_OPTIONS,
      YES_NO_OPTIONS,
      PROGRAM_OPTIONS,
      LEVEL_OPTIONS,
      EVENT_TYPES,
      FEE_CODES,
      YEAR_OPTIONS,
      getOptions,
      formatOptionLabel,

      // helpers
      codeToLabel,
      relativeDisplayValue,
      onFormFieldInput,
      onFormFieldChange,

      // families
      FAMILY_TABS,
      familyFields,
      familyView,
      familyMode,
      familySearch,
      editingFamilyId,
      familyRows,
      filteredFamilyRows,
      familyForm,
      familyErrors,
      familyTab,
      isVisible,
      familyContactsMode,
      familyContactsIndex,
      visibleFamilyContacts,
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
      goFamilyList,
      goFamilyTab,
      resetFamilyForm,
      addFamilyContact,
      removeFamilyContact,
      addFamilyChild,
      removeFamilyChild,
      contactDisplay,
      buildFamilyPayload,

      // events
      eventRows,
      eventView,
      eventMode,
      eventSearch,
      eventFilter,
      eventFields,
      eventForm,
      eventErrors,
      filteredEventRows,
      displayEventFees,
      isMetaFieldVisible,
      getFieldDisabled,
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
      goEventList,
      buildEventPayload,
    };
  },
});

app.mount('#app');
