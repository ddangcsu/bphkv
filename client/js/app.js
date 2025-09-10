/* eslint-env browser, es2021 */
/* global Vue, API, Util */
/* eslint no-unused-vars: ["warn", {
  "vars": "all",
  "args": "after-used",
  "argsIgnorePattern": "^_",
  "varsIgnorePattern": "^_",
  "ignoreRestSiblings": true
}] */

// Vue 3 Composition API
const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

const STORAGE_KEYS = {
  section: 'ui.currentSection',
  mode: 'ui.currentMode',
  fromSection: 'ui.fromSection',
};

const app = createApp({
  setup() {
    //
    // Core setup settings (mostly lookup options)
    //
    const setup = reactive({
      programs: [],
      relationships: [],
      feeCodes: [],
      eventTypes: [],
      levels: [],
      paymentMethods: [],
      volunteers: [],
    });

    Schema.Options.setLiveSetupRef(setup);

    async function loadSetup({ showStatusIfActive = false } = {}) {
      try {
        const data = await API.Setup.getOrSeed();
        Object.assign(setup, data);
        if (showStatusIfActive) setStatus('Setup loaded.', 'info', 1200);
      } catch (e) {
        console.error('Failed to load setup:', e);
        // As a last resort, use fallback in-memory so app still works
        Object.assign(setup, Schema.Setup.FALLBACK_SETUP);
        setStatus('Using default setup (load failed).', 'warn', 1500);
      }
    }

    async function saveSetup() {
      const payload = { ...JSON.parse(JSON.stringify(setup)) };
      try {
        await API.Setup.update(payload);
        setStatus('Settings saved.', 'success', 1200);
        await loadSetup({ showStatusIfActive: false });
      } catch (e) {
        console.error('saveSetup failed:', e);
        setStatus('Save failed.', 'error', 2000);
      }
    }

    /**
     * Define OPTIONS
     */
    const YES_NO_OPTIONS = computed(() => Schema.Options.YES_NO_OPTIONS);
    const PROGRAM_OPTIONS = computed(() => Schema.Options.PROGRAM_OPTIONS);
    const RELATIONSHIP_OPTIONS = computed(() => Schema.Options.RELATIONSHIP_OPTIONS);
    const FEE_CODES = computed(() => Schema.Options.FEE_CODES);
    const EVENT_TYPES = computed(() => Schema.Options.EVENT_TYPES);
    const LEVEL_OPTIONS = computed(() => Schema.Options.LEVEL_OPTIONS);
    const PAYMENT_METHOD_OPTIONS = computed(() => Schema.Options.PAYMENT_METHOD_OPTIONS);
    const VOLUNTEERS_OPTIONS = computed(() => Schema.Options.VOLUNTEERS_OPTIONS);
    const YEAR_OPTIONS = computed(() => Schema.Options.YEAR_OPTIONS);

    /**
     * Define ENUMS
     */
    const PROGRAM = Schema.Options.ENUMS.PROGRAM;
    const EVENT = Schema.Options.ENUMS.EVENT;
    const LEVEL = Schema.Options.ENUMS.LEVEL;
    const METHOD = Schema.Options.ENUMS.METHOD;

    /**
     * De-reference utilities helper
     */
    const { normPhone, formatUSPhone, formatMoney } = Util.Format;
    const { getByPath, setDefault, getCurrentSchoolYear } = Util.Helpers;

    // =========================================================
    // GLOBAL UI / STATUS
    // =========================================================

    // === Enum Modes / Sections ===
    const MODE_NAMES = Object.freeze({
      LIST: 'list',
      CREATE: 'create',
      EDIT: 'edit',
    });

    const SECTION_NAMES = Object.freeze({
      FAMILIES: 'families',
      EVENTS: 'events',
      REGISTRATIONS: 'registrations',
      ROSTERS: 'rosters',
      SETTINGS: 'settings',
    });

    const currentSection = ref(sessionStorage.getItem(STORAGE_KEYS.section) || SECTION_NAMES.FAMILIES);
    watch(currentSection, (v) => sessionStorage.setItem(STORAGE_KEYS.section, v));

    const currentMode = ref(sessionStorage.getItem(STORAGE_KEYS.mode) || MODE_NAMES.LIST);
    watch(currentMode, (v) => sessionStorage.setItem(STORAGE_KEYS.mode, v));

    const fromSection = ref(sessionStorage.getItem(STORAGE_KEYS.fromSection) || SECTION_NAMES.FAMILIES);
    watch(fromSection, (v) => sessionStorage.setItem(STORAGE_KEYS.fromSection, v));

    const READONLY = ref(JSON.parse(sessionStorage.getItem('ui.readonly') || 'false'));
    watch(READONLY, (v) => sessionStorage.setItem('ui.readonly', JSON.stringify(!!v)));

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

    // Only applies in EDIT mode (as requested)
    const isReadOnly = computed(() => READONLY.value && currentMode.value === MODE_NAMES.EDIT);

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
      READONLY.value = MODE.EDIT ? true : false;
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
      { id: SECTION_NAMES.EVENTS, label: 'Events Setup', icon: 'fa-regular fa-calendar-days', onClick: switchSection },
      {
        id: SECTION_NAMES.REGISTRATIONS,
        label: 'Registrations',
        icon: 'fa-solid fa-address-card',
        onClick: switchSection,
      },
      {
        id: SECTION_NAMES.ROSTERS,
        label: 'Enrollment Rosters',
        icon: 'fa-solid fa-clipboard-list',
        onClick: switchSection,
      },
      {
        id: SECTION_NAMES.SETTINGS,
        label: 'Settings',
        icon: 'fa-solid fa-sliders',
        onClick: () => switchSection(SECTION_NAMES.SETTINGS, MODE_NAMES.EDIT),
      },
    ];

    const breadcrumbs = computed(() => {
      if (SECTION.FAMILIES) {
        return [
          { label: 'Families', onClick: () => switchSection(SECTION_NAMES.FAMILIES) },
          { label: MODE.LIST ? 'Browse Families' : MODE.CREATE ? 'Create Family' : 'Edit Family' },
        ];
      }
      if (SECTION.EVENTS) {
        return [
          { label: 'Events', onClick: () => switchSection(SECTION_NAMES.EVENTS) },
          { label: MODE.LIST ? 'Browse Events' : MODE.CREATE ? 'Create Event' : 'Edit Event' },
        ];
      }
      if (SECTION.REGISTRATIONS) {
        return [
          { label: 'Registrations', onClick: () => switchSection(SECTION_NAMES.REGISTRATIONS) },
          {
            label: MODE.LIST ? 'Browse Registrations' : MODE.CREATE ? 'Create Registration' : 'Edit Registration',
          },
        ];
      }
      if (SECTION.ROSTERS) {
        return [
          { label: 'Rosters', onClick: switchSection(SECTION_NAMES.ROSTERS) },
          {
            label: MODE.LIST ? 'Enrollment Rosters' : '',
          },
        ];
      }
      if (SECTION.SETTINGS) {
        return [
          { label: 'Settings', onClick: () => switchSection(SECTION_NAMES.SETTINGS, MODE_NAMES.EDIT) },
          { label: 'Edit Options' },
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

    const PARENT_RELATIONSHIPS = new Set(); // first 3 relationships

    function syncEnum(target, options = []) {
      // reset and refill
      for (const k of Object.keys(target)) delete target[k];
      for (const o of options) if (o && o.key != null) target[o.key] = o.value;
    }

    // One watcher to rebuild everything whenever setup changes
    watch(
      setup,
      () => {
        // first 3 entries in relationships are parents
        PARENT_RELATIONSHIPS.clear();
        for (const r of (RELATIONSHIP_OPTIONS.value || []).slice(0, 3)) {
          if (r?.value) PARENT_RELATIONSHIPS.add(String(r.value).trim());
        }
        syncEnum(PROGRAM, PROGRAM_OPTIONS.value || []);
        syncEnum(EVENT, EVENT_TYPES.value || []);
        syncEnum(LEVEL, LEVEL_OPTIONS.value || []);
        syncEnum(METHOD, PAYMENT_METHOD_OPTIONS.value || []);
      },
      { deep: true, immediate: true },
    );

    // Build program-aware options from VOLUNTEERS_OPTIONS
    function volunteersFor(programId = '') {
      const all = VOLUNTEERS_OPTIONS.value || [];
      const pid = String(programId || '').trim();

      // Merge GLOBAL (no programId) + program-specific; dedupe by value
      const merged = new Map();
      for (const r of all) {
        if (!r) continue;
        const rpid = String(r.program || '').trim(); // "" means global
        if (rpid === '' || rpid === pid) {
          const value = r.value;
          const label = r.label ?? String(value);
          merged.set(String(value), { value, label });
        }
      }
      return [...merged.values()];
    }

    // --- Relative Display: source registry ------------------------------------
    const RD_SOURCES = {
      eventRows: () => eventRows.value,
    };

    // =========================================================
    // COMMON HELPERS (refactored & only what's used)
    // =========================================================

    const codeToLabel = Util.Format.codeToLabel;

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

    // Unified meta-driven handlers
    const onFormFieldChange = Util.Helpers.onFormFieldChange;
    const onFormFieldInput = Util.Helpers.onFormFieldInput;
    const getOptions = Util.Helpers.getOptions;
    const formatOptionLabel = Util.Helpers.formatOptionLabel;
    const buildFromFields = Util.Helpers.buildFromFields;

    // === Unified meta switches ===
    const isVisible = Util.Helpers.isVisible;
    const fieldClass = Util.Helpers.fieldClass;
    const getFieldDisabled = Util.Helpers.getFieldDisabled;
    const isNonNegativeNumber = Util.Helpers.isNonNegativeNumber;
    const maskLast4 = Util.Format.maskLast4;
    const computeAgeByYear = Util.Helpers.computeAgeByYear;
    const displayChildNameAndAge = Util.Format.displayChildNameAndAge;

    function displayEventFees(evt) {
      return evt.fees?.length > 0 ? evt.fees.map((item) => item.code + '-$' + String(item.amount)).join(' / ') : '—';
    }

    // =========================================================
    // FAMILIES
    // =========================================================
    const familySearch = ref('');
    const editingFamilyId = ref(null);
    const familyRows = ref([]);

    async function loadFamilies({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Families.list();
        familyRows.value = list;
        if (showStatusIfActive && SECTION.FAMILIES) setStatus('Families loaded.', 'info', 1200);
      } catch {
        setStatus('Error encountered loading Families list', 'error', 3000);
        familyRows.value = [];
      }
    }

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
            [c.lastName, [c.firstName, c.middle].join(' ')].join(', ').toLowerCase().includes(q) ||
            [c.lastName, c.firstName, c.middle].join(' ').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (qDigits && normPhone(c.phone).includes(qDigits)),
        );
        return hitsTop || hitsContacts;
      });
    });

    /**
     * FAMILIES LIST PAGINATION
     */
    // ---- Families pagination state
    const familyPageSizeOptions = [5, 10, 15, 0]; // 0 = All
    const familyPageSize = ref(10);
    const familyPage = ref(1);

    const familyTotalRows = computed(() => filteredFamilyRows.value.length);
    const familyIsAll = computed(() => familyPageSize.value === 0);
    const familyTotalPages = computed(() =>
      familyIsAll.value ? 1 : Math.max(1, Math.ceil(familyTotalRows.value / familyPageSize.value)),
    );

    const familyPageStart = computed(() => (familyIsAll.value ? 0 : (familyPage.value - 1) * familyPageSize.value));
    const familyPageEnd = computed(() =>
      familyIsAll.value ? familyTotalRows.value : familyPageStart.value + familyPageSize.value,
    );

    const pagedFamilies = computed(() =>
      familyIsAll.value
        ? filteredFamilyRows.value
        : filteredFamilyRows.value.slice(familyPageStart.value, familyPageEnd.value),
    );

    // Reset to page 1 whenever the dataset or page size changes
    watch([filteredFamilyRows, familyPageSize], () => {
      familyPage.value = 1;
    });

    // Simple pager actions
    function goFamilyFirst() {
      familyPage.value = 1;
    }
    function goFamilyPrev() {
      familyPage.value = Math.max(1, familyPage.value - 1);
    }
    function goFamilyNext() {
      familyPage.value = Math.min(familyTotalPages.value, familyPage.value + 1);
    }
    function goFamilyLast() {
      familyPage.value = familyTotalPages.value;
    }

    const contactDisplay = (f, one = false) => {
      const contacts = Array.isArray(f.contacts) ? f.contacts : [];
      if (!contacts.length) return '—';

      // Prioritize the first 2 among Father / Mother / Guardian
      const prioritized = contacts.filter((c) => PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const pick = [...prioritized, ...others].slice(0, 2);
      const result = pick.map((c) => {
        if ('lastName' in c) {
          return `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''} ${maskLast4(c.phone)}`;
        } else {
          return `${c.name} ${maskLast4(c.phone)}`;
        }
      });
      return one ? result[0] : result.join(' / ');
    };

    function onContactPhoneInput(fieldMeta, ctx, event) {
      const raw = event?.target?.value ?? '';
      const formatted = formatUSPhone(raw);
      const target = ctx?.row || ctx?.form;
      // write-back here (meta function owns mutation)
      if (target && fieldMeta?.col) {
        // setDefault supports deep paths if you ever use nested cols
        setDefault(target, fieldMeta.col, formatted);
      }
    }

    const hasActiveFamilyFilter = computed(() => !!familySearch.value);

    function resetFamilyFilters() {
      familySearch.value = '';
    }

    function needsNameException(ctx) {
      const target = ctx?.row || ctx?.form;
      const last = String(target?.lastName ?? '')
        .trim()
        .toLowerCase();
      return !!last && !parentLastNameSet.value.has(last);
    }

    // FAMILIES_META
    const familyCtx = {
      onContactPhoneInput,
      needsNameException,
    };
    const familyFields = Schema.Forms.Families(familyCtx);

    const newFamilyContact = Schema.Forms.Families.newContact;
    const newFamilyChild = Schema.Forms.Families.newChild;
    const newFamilyNote = Schema.Forms.Families.newNote;
    const newFamilyForm = Schema.Forms.Families.new;

    const familyForm = reactive(newFamilyForm());
    const familyErrors = reactive({ household: {}, contacts: [{}], children: [{}], notes: [{}] });

    function hydrateFamilyErrors() {
      familyErrors.household = {};
      familyErrors.contacts = familyForm.contacts.map(() => ({}));
      familyErrors.children = familyForm.children.map(() => ({}));
      familyErrors.notes = familyForm.notes.map(() => ({}));
    }

    function validateFamily() {
      const s = familyForm;
      let e = { household: {}, contacts: [], children: [], notes: [], contactErrors: '' };

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

      if (!s.contacts.some((c) => PARENT_RELATIONSHIPS.has(c.relationship)))
        e.contactErrors = 'Contacts must have at least one with Father/Mother/Guardian relationship';

      e.children = s.children.map((c) => {
        const ce = {};
        if (!c.lastName?.trim()) ce.lastName = 'required';
        if (!c.firstName?.trim()) ce.firstName = 'required';
        if (!c.dob?.trim()) ce.dob = 'required.';
        const matchesParent = parentLastNameSet.value.has((c.lastName || '').toLowerCase());
        if (!matchesParent) {
          if (!c.isNameException) ce.isNameException = 'Check here if name exception';
          if (!c.exceptionNotes?.trim()) ce.exceptionNotes = 'required';
          if (!(c.isNameException && c.exceptionNotes?.trim())) ce.lastName = ce.lastName || 'mismatch w/ parents';
        }
        return ce;
      });

      e.notes =
        s.notes?.length > 0
          ? s.notes.map((n) => {
              const ce = {};
              if (!n.note?.trim()) ce.note = 'required';
              if (!n.updatedBy?.trim()) ce.updatedBy = 'required';
              return ce;
            })
          : [];

      familyErrors.household = e.household;
      familyErrors.contacts = e.contacts;
      familyErrors.children = e.children;
      familyErrors.notes = e.notes;
      familyErrors.contactErrors = e.contactErrors;

      // final result (pure booleans)
      const noHouseHoldErrors = Object.keys(e.household).length === 0;
      const noContactsErrors =
        (e.contacts || []).every((obj) => !obj || Object.keys(obj).length === 0) || e.contactErrors.length === 0;
      const noChildrenErrors = (e.children || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const noNotesErrors = (e.notes || []).every((obj) => !obj || Object.keys(obj).length === 0);

      return noHouseHoldErrors && noContactsErrors && noChildrenErrors && noNotesErrors;
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

    watch(
      () => familyForm.children,
      () => {
        for (const ch of familyForm.children || []) {
          if (!needsNameException({ form: familyForm, row: ch })) {
            ch.isNameException = false;
            ch.exceptionNotes = '';
          }
        }
      },
      { deep: true, immediate: true },
    );

    // dirty tracking
    const eventOriginalSnapshot = ref('');
    const isEventDirty = computed(() => JSON.stringify(eventForm) !== eventOriginalSnapshot.value);
    function snapshotEventForm() {
      eventOriginalSnapshot.value = JSON.stringify(eventForm);
    }

    const registrationOriginalSnapshot = ref('');
    const isRegistrationDirty = computed(() => JSON.stringify(registrationForm) !== registrationOriginalSnapshot.value);
    function snapshotRegistrationForm() {
      registrationOriginalSnapshot.value = JSON.stringify(registrationForm);
    }

    const familyOriginalSnapshot = ref('');
    const isFamilyDirty = computed(() => JSON.stringify(familyForm) !== familyOriginalSnapshot.value);
    function snapshotFamilyForm() {
      familyOriginalSnapshot.value = JSON.stringify(familyForm);
    }

    // nav

    function beginCreateFamily() {
      Object.assign(familyForm, newFamilyForm());
      hydrateFamilyErrors();
      snapshotFamilyForm();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.CREATE);
      setStatus('Creating new family…', 'info', 1200);
    }

    function beginEditFamily(apiFamily) {
      if (!apiFamily || !apiFamily.id) {
        setStatus('Nothing to edit', 'warn', 1500);
        return;
      }
      editingFamilyId.value = apiFamily.id;
      const ui = Mappers.Families.toUi(apiFamily || {});
      Object.assign(familyForm, newFamilyForm(), ui);
      hydrateFamilyErrors();
      snapshotFamilyForm();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiFamily.id}`, 'info', 1200);
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
    const parentLastNamesDisplay = computed(() =>
      [...parentLastNameSet.value].map((e) => Util.Format.capitalize(e)).join(' / '),
    );

    async function addFamilyContact() {
      if (isReadOnly.value) return;
      familyForm.contacts.push(newFamilyContact());
      familyErrors.contacts.push({});
      if (familyContactsMode.value === 'single') familyContactsIndex.value = familyForm.contacts.length - 1;
      await nextTick();
    }
    function removeFamilyContact(i) {
      if (isReadOnly.value) return;
      familyForm.contacts.splice(i, 1);
      familyErrors.contacts.splice(i, 1);
    }
    async function addFamilyChild() {
      if (isReadOnly.value) return;
      familyForm.children.push(newFamilyChild());
      familyErrors.children.push({});
      if (familyChildrenMode.value === 'single') familyChildrenIndex.value = familyForm.children.length - 1;
      await nextTick();
    }
    function removeFamilyChild(i) {
      if (isReadOnly.value) return;
      familyForm.children.splice(i, 1);
      familyErrors.children.splice(i, 1);
    }

    async function addFamilyNote() {
      if (isReadOnly.value) return;
      familyForm.notes.push(newFamilyNote());
      familyErrors.notes.push({});
      await nextTick();
    }

    function removeFamilyNote(i) {
      if (isReadOnly.value) return;
      familyForm.notes.splice(i, 1);
      familyErrors.notes.splice(i, 1);
    }

    function resetFamilyForm() {
      Object.assign(familyForm, newFamilyForm());
      hydrateFamilyErrors();
      snapshotFamilyForm();
      setStatus('Form reset.', 'info', 1200);
    }

    async function submitFamilyForm() {
      if (isReadOnly.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }

      if (!validateFamily()) {
        setStatus('Error found. Please fix errors before trying to save', 'error', 3500);
        return;
      }

      if (!familyForm.id?.trim()) {
        setStatus('Family ID is missing from form.', 'error', 2000);
        return;
      }

      if (!isFamilyDirty.value) {
        setStatus('No changes to save.', 'warn', 1500);
        return;
      }
      await saveFamily();
    }

    async function saveFamily() {
      setStatus('Saving Family data...');
      const payload = Mappers.Families.toApi(familyForm);

      try {
        if (MODE.CREATE) {
          await API.Families.create(payload);
          setStatus('Family created.', 'success', 1500);
        } else {
          const patch = { ...payload };
          delete patch.id;
          await API.Families.update(editingFamilyId.value, patch);
          setStatus('Family updated.', 'success', 1500);
        }
        await loadFamilies();
        await nextTick();
        goBackSection();
      } catch (e) {
        setStatus('Create failed.', 'error', 3000);
        console.error(e);
      }
    }

    // =========================================================
    // EVENTS
    // =========================================================
    const eventRows = ref([]);

    async function loadEvents({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Events.list();
        eventRows.value = list;
        if (showStatusIfActive && SECTION.EVENTS) setStatus('Events loaded.', 'info', 1200);
      } catch (e) {
        console.error('loadEvents failed:', e);
        eventRows.value = [];
      }
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
    const eventCtx = { availablePrerequisiteOptions };
    const eventFields = Schema.Forms.Events(eventCtx);

    function availablePrerequisiteOptions(ctx) {
      const index = Number.isInteger(ctx?.index) ? ctx.index : -1;
      const form = ctx?.form || {};

      const reqType = requiredPrereqType();
      if (!reqType) return [];
      const selectedElsewhere = new Set(
        (form?.prerequisites || []).map((p, i) => (i === index ? null : p.eventId)).filter(Boolean),
      );
      return eventRows.value.filter(
        (ev) =>
          Number(ev.year) === Number(form?.year) &&
          ev.id !== eventForm.id &&
          (ev.eventType || '') === reqType &&
          !selectedElsewhere.has(ev.id),
      );
    }

    const newEventForm = Schema.Forms.Events.new;

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
      if (isReadOnly.value) return;
      eventForm.fees.push(buildFromFields(eventFields.feeRow));
    }
    function removeEventFee(i) {
      if (isReadOnly.value) return;
      eventForm.fees.splice(i, 1);
    }

    function addEventPrerequisiteRow() {
      if (isReadOnly.value) return;
      eventForm.prerequisites.push(
        buildFromFields(eventFields.prerequisiteRow, { ctx: { index: 0, form: eventForm } }),
      );
    }
    function removeEventPrerequisiteRow(i) {
      if (isReadOnly.value) return;
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

    function beginCreateEvent() {
      Object.assign(eventForm, newEventForm());
      clearEventErrors();
      editingEventId.value = null;

      if (eventForm.fees.length === 0) addEventFee();
      if (showPrerequisites.value && eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
      snapshotEventForm();
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.CREATE);
      setStatus('Creating new event…', 'info', 1200);
    }

    function beginEditEvent(apiEvent) {
      if (!apiEvent || !apiEvent.id) {
        setStatus('Nothing to edit', 'warn', 1500);
        return;
      }
      editingEventId.value = apiEvent.id;
      const ui = Mappers.Events.toUi(apiEvent || {});
      Object.assign(eventForm, newEventForm(), ui);

      clearEventErrors();
      snapshotEventForm();
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.EDIT);
      setStatus(`Editing ${e.id}`, 'info', 1200);
    }

    function validateEventForm() {
      clearEventErrors();
      const e = {};
      if (MODE.CREATE && !eventForm.id?.trim()) e.id = 'required';

      if (!PROGRAM_OPTIONS.value.some((o) => o.value === eventForm.programId)) e.programId = 'required';
      if (!EVENT_TYPES.value.some((o) => o.value === eventForm.eventType)) e.eventType = 'required';
      if (!eventForm.title?.trim()) e.title = 'required';
      if (!YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year))) e.year = 'year required';
      if (!LEVEL_OPTIONS.value.some((o) => o.value === eventForm.level)) e.level = 'invalid';
      if (!eventForm.openDate) e.openDate = 'required';
      if (!eventForm.endDate) e.endDate = 'required';

      if (
        YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year)) &&
        eventForm.openDate &&
        eventForm.endDate
      ) {
        const boundStart = new Date(Number(eventForm.year), 6, 1); // July = month 6 (0-based)
        const boundEnd = new Date(Number(eventForm.year) + 1, 6, 0, 23, 59, 59, 999); // June 30 end-of-day
        const start = new Date(eventForm.openDate);
        const end = new Date(eventForm.endDate);

        if (start > end) e.openDate = 'Must <= End Date';
        if (start < boundStart) e.openDate = 'Not in School Year';
        if (end > boundEnd) e.endDate = 'Not in School Year';
      }

      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) {
        e.fees = 'at least one fee';
      } else {
        for (const f of eventForm.fees) {
          if (!FEE_CODES.value.some((o) => o.value === f.code)) {
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
      if (!PROGRAM_OPTIONS.value.some((o) => o.value === eventForm.programId)) return false;
      if (!EVENT_TYPES.value.some((o) => o.value === eventForm.eventType)) return false;
      if (!eventForm.title?.trim()) return false;
      if (!YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year))) return false;
      if (!LEVEL_OPTIONS.value.some((o) => o.value === eventForm.level)) return false;
      if (!eventForm.openDate || !eventForm.endDate) return false;
      if (!Array.isArray(eventForm.fees) || eventForm.fees.length === 0) return false;
      if (!eventForm.fees.every((f) => FEE_CODES.value.some((o) => o.value === f.code) && Number(f.amount) >= 0))
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

    async function submitEventForm() {
      if (isReadOnly.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }

      if (!isEventDirty.value) {
        setStatus('No changes to save.', 'warn', 1800);
        return;
      }

      if (!validateEventForm()) {
        setStatus('Please fix errors before saving.', 'error', 2500);
        return;
      }

      await saveEvent();
    }

    async function saveEvent() {
      setStatus('Saving Event...');
      const payload = Mappers.Events.toApi(eventForm);
      try {
        if (MODE.CREATE) {
          await API.Events.create(payload);
          setStatus('Event created.', 'success', 1500);
        } else {
          const patch = { ...payload };
          delete patch.id;
          await API.Events.update(editingEventId.value, patch);
          setStatus('Event updated.', 'success', 1500);
        }
        await loadEvents();
        goBackSection();
      } catch (err) {
        console.error(err);
        setStatus('Failed to save Event.', 'error', 3000);
      }
    }

    // =========================================================
    // REGISTRATION — fields-metadata renderer
    // =========================================================
    const registrationRows = ref([]);

    async function loadRegistrations({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Registrations.list();
        registrationRows.value = list;
        if (showStatusIfActive && SECTION.REGISTRATIONS) setStatus('Registrations loaded.', 'info', 1200);
      } catch {
        console.error('loadRegistrations failed:', e);
        registrationRows.value = [];
      }
    }

    const registrationSearch = ref('');
    const registrationFilter = reactive({ year: '', programId: '', eventType: '' });

    const editingRegistrationId = ref(null);

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

    // REG_META
    const registrationFormCtx = {
      onRegFamilyChange,
      onRegEventChange,
      eventOptionsForRegistration,
      signedRegistrationOptions,
      childRegistrationOptions,
      hydrateChildSnapshot,
      ageGroupOptionsForRow,
      receivedByOptions,
      MODE,
    };

    const registrationFields = Schema.Forms.Registrations(registrationFormCtx);
    const newRegistrationForm = Schema.Forms.Registrations.new;

    const registrationForm = reactive(newRegistrationForm());
    const registrationErrors = reactive({ main: {}, children: [], payments: [] });

    const hasActiveRegFilter = computed(
      () => !!(registrationFilter.programId || registrationFilter.eventType || registrationFilter.year),
    );

    function resetRegFilters() {
      registrationFilter.year = '';
      registrationFilter.programId = '';
      registrationFilter.eventType = '';
      registrationSearch.value = '';
    }

    // --- Helpers --------------------------------------------------------------

    const isOpenEventFilter = (ev) => {
      const todayPST = new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 10);
      return (!ev?.openDate || ev?.openDate <= todayPST) && (!ev?.endDate || todayPST <= ev?.endDate);
    };

    function isCurrentSchoolYear(ev) {
      return Number(ev?.year) === Number(getCurrentSchoolYear());
    }

    // Check whether a given family has registered for the year
    function alreadyRegistered({
      familyId,
      year = getCurrentSchoolYear(),
      eventId = null,
      programId = null,
      eventType = null,
    }) {
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
      const prereqIds = Array.isArray(ev?.prerequisites)
        ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean)
        : [];

      // No prereqs → automatically OK
      if (prereqIds.length === 0) return true;

      // If no family yet, we can’t assert prereqs. Treat as not met so the UI nudges user to pick family first.
      if (!familyId) return false;

      const yr = Number(ev.year);
      return prereqIds.every((pid) =>
        registrationRows.value.some(
          (r) => r.familyId === familyId && r.eventId === pid && Number(r.event?.year) === yr,
        ),
      );
    }

    watch(
      () => registrationForm.children.map((c) => c.childId).join(','),
      () => {
        recomputePayments({ form: registrationForm });
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
        label: `${f.parishMember ? 'Member' : 'NonMember'} — ${f.contacts?.[0]?.lastName || ''}, ${
          f.contacts?.[0]?.firstName || ''
        }
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
        const hitContacts = (r.contacts || []).some(
          (c) => (c.name || '').toLowerCase().includes(q) || (qDigits && normPhone(c.phone).includes(qDigits)),
        );
        const hitReceipts = (r.payments || []).some((p) => (p.receiptNo || '').toLowerCase().includes(q));

        const byYear = !registrationFilter.year || Number(r.event?.year) === Number(registrationFilter.year);
        const byProg = !registrationFilter.programId || r.event?.programId === registrationFilter.programId;
        const byType = !registrationFilter.eventType || r.event?.eventType === registrationFilter.eventType;

        return (hitTop || hitContacts || hitReceipts) && byYear && byProg && byType;
      });
    });

    function beginCreateRegistration() {
      Object.assign(registrationForm, newRegistrationForm());
      registrationErrors.main = {};
      registrationErrors.children = [];
      registrationErrors.payments = [];
      editingRegistrationId.value = null;
      snapshotRegistrationForm();
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.CREATE);
      setStatus('Creating new registration…', 'info', 1200);
    }

    const adminRegistration = computed(
      () =>
        eventRows.value.find(
          (e) => e.programId === PROGRAM.BPH && e.eventType === EVENT.ADMIN && isOpenEventFilter(e),
        ) || null,
    );

    const tnttRegistration = computed(
      () =>
        eventRows.value.find(
          (e) => e.programId === PROGRAM.TNTT && e.eventType === EVENT.REGISTRATION && isOpenEventFilter(e),
        ) || null,
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

    function beginEditRegistration(apiReg) {
      editingRegistrationId.value = apiReg.id;
      Object.assign(registrationForm, newRegistrationForm(), Mappers.Registrations.toUi(apiReg || {}));
      snapshotRegistrationForm();
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiReg.id}`, 'info', 1200);
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
      const form = ctx?.form || {};

      // 1) no family selected → no options
      const famId = (form?.familyId || '').trim();
      if (!famId) return [];

      // 2) event not selected or not PC → no options
      const ev = selectedEvent.value;
      if (!ev || ev.level !== LEVEL.PER_CHILD) return [];

      // Family + anti-duplication set
      const fam = familyById(famId);
      if (!fam) return [];
      const chosenElsewhere = new Set(
        (form?.children || []).map((c, i) => (i === idx ? null : c.childId)).filter(Boolean),
      );

      // Collect prerequisite ids
      const prereqIds = Array.isArray(ev?.prerequisites)
        ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean)
        : [];

      // 3) PC event:
      //    - No prereq OR only PF prereqs → full children for selected family
      const prereqEvents = prereqIds.map((id) => eventRows.value.find((e) => e.id === id)).filter(Boolean);

      const hasPCPrereq = prereqEvents.some((p) => p.level === LEVEL.PER_CHILD);

      if (!hasPCPrereq) {
        return (fam.children || [])
          .filter((c) => !chosenElsewhere.has(c.childId))
          .map((c) => ({ value: c.childId, label: displayChildNameAndAge(c) }));
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
      const form = ctx?.form;
      const row = ctx?.row;
      if (!row) return;

      const fam = familyById(form?.familyId);
      const ch = (fam?.children || []).find((c) => c.childId === row.childId);
      if (!ch) return;

      row.fullName = `${ch.lastName}, ${ch.firstName}${ch.middle ? ' ' + ch.middle : ''}`;
      row.saintName = ch.saintName;
      row.dob = ch.dob;
      row.allergies = Array.isArray(ch.allergies) ? ch.allergies.slice() : [];
      row.status = row.status || 'pending';

      // keep payments in sync with selected children
      recomputePayments(ctx);
    }

    function addRegChildRow() {
      if (isReadOnly.value) return;
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
      if (isReadOnly.value) return;
      registrationForm.children.splice(i, 1);
      registrationErrors.children.splice(i, 1);
      recomputePayments({ form: registrationForm });
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
        registrationRows.value.some(
          (r) => r.familyId === famId && r.eventId === reqId && Number(r.event?.year) === year,
        ),
      );
      return hasAll ? { ok: true } : { ok: false, message: 'Prerequisite not met for this family/year.' };
    }

    // Snapshots & payments prefills
    function hydrateRegistrationEvent(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const ev = selectedEvent.value;
      form.event = ev
        ? { title: ev.title, year: ev.year, programId: ev.programId, eventType: ev.eventType }
        : { title: '', year: '', programId: '', eventType: '' };
    }

    function hydrateRegistrationContacts(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const fam = familyById(form.familyId);
      if (!fam) {
        form.contacts = [];
        form.parishMember = null;
        return;
      }
      const contacts = Array.isArray(fam.contacts) ? fam.contacts : [];

      // Prioritize the first 2 among Father / Mother / Guardian
      const prioritized = contacts.filter((c) => PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const pick = [...prioritized, ...others].slice(0, 2);

      form.contacts = pick.map((c) => ({
        name: `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`,
        relationship: c.relationship || '',
        phone: formatUSPhone(c.phone || ''),
      }));

      form.parishMember = !!fam.parishMember;
    }

    function computeQuantity(ev) {
      return ev?.level === LEVEL.PER_CHILD
        ? Math.max(1, (registrationForm.children || []).filter((c) => c.childId).length)
        : 1;
    }

    function hydrateRegistrationPayments(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const ev = selectedEvent.value;
      if (!ev) {
        form.payments = [];
        return;
      }

      const fam = familyById(form.familyId);
      if (!fam) {
        form.payments = [];
        return;
      }

      const qty = computeQuantity(ev);

      const fees = Array.isArray(ev.fees) ? ev.fees : [];

      form.payments = fees
        .filter((f) => {
          if (form.parishMember === true) {
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
    function recomputePayments(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const qty = computeQuantity(selectedEvent.value);
      (form.payments || []).forEach((p) => {
        p.quantity = qty;
        const unit = Number(p.unitAmount || 0);
        p.amount = Math.round(unit * qty * 100) / 100;
      });
    }

    function onRegEventChange(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      // (a) Snapshot event data
      hydrateRegistrationEvent(ctx);

      // (b) Hydrate payments from event fees (user fills method/refs later)
      hydrateRegistrationPayments(ctx);

      // (c) If per-child event, ensure one empty row exists at start
      const ev = selectedEvent.value;
      if (ev?.level === LEVEL.PER_CHILD && form.children.length === 0) {
        addRegChildRow();
      }
    }

    function onRegFamilyChange(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      // Snapshot (two) contacts, prioritized Father/Mother/Guardian
      hydrateRegistrationContacts(ctx);

      // Remove any already-chosen children that don't belong to this family
      const fam = familyById(form.familyId);
      form.children = (form.children || []).filter((row) => fam.children?.some((c) => c.childId === row.childId));
      registrationErrors.children = form.children.map(() => ({}));

      // Recompute total amounts in case quantity depends on children
      hydrateRegistrationPayments(ctx);
    }

    const ageGroupLabelTNTT = Util.Format.ageGroupLabelTNTT;

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
      const row = ctx?.row || ctx?.form;
      const dob = row?.dob;
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

    watch(
      () => selectedEvent?.value?.programId,
      (pid) => {
        const allowed = new Set(volunteersFor(pid).map((o) => o.value));
        (registrationForm.payments || []).forEach((p) => {
          if (p.receivedBy && !allowed.has(p.receivedBy)) p.receivedBy = '';
        });
      },
    );

    function signedRegistrationOptions(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const fam = familyById(form.familyId);
      return (fam?.contacts || []).map((c) => {
        const name = `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`;
        return { value: name, label: `${name} (${c.relationship || 'Contact'})` };
      });
    }

    function receivedByOptions(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      return volunteersFor(selectedEvent.value?.programId || form?.event?.programId || '');
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
      if (!registrationForm.status || registrationForm.status === 'pending')
        e.main.status = 'Status must be paid or cancelled';

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
          if (!p.txnRef?.trim() && p.method?.trim() !== METHOD?.CASH) pe.txnRef = 'required';
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

    async function submitRegistrationForm() {
      if (isReadOnly.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }

      if (!isRegistrationDirty.value) {
        setStatus('No changes to save.', 'warn', 1800);
        return;
      }

      if (!validateRegistration()) {
        setStatus('Please fix errors before saving.', 'error', 2500);
        return;
      }

      await saveRegistration();
    }

    async function saveRegistration() {
      setStatus('Saving Registration...');
      const payload = Mappers.Registrations.toApi(registrationForm);
      try {
        if (MODE.CREATE) {
          await API.Registrations.create(payload);
          setStatus('Registration created.', 'success', 1500);
        } else {
          const patch = { ...payload };
          delete patch.id;
          await API.Registrations.update(editingRegistrationId.value, patch);
          setStatus('Registration updated.', 'success', 1500);
        }
        await loadRegistrations();
        goBackSection();
      } catch (e) {
        console.error(e);
        setStatus('Failed to save Registration.', 'error', 3000);
      }
    }

    // =========================================================
    // Roster TNTT
    // =========================================================

    const rosterSearch = ref('');
    const rosterFilter = reactive({ programId: '', eventType: '', eventId: '', year: '', age: '' });

    const hasActiveRosterFilter = computed(
      () =>
        !!(
          rosterSearch.value ||
          rosterFilter.programId ||
          rosterFilter.eventType ||
          rosterFilter.eventId ||
          rosterFilter.year ||
          rosterFilter.age
        ),
    );

    function resetRosterFilters() {
      rosterFilter.programId = '';
      rosterFilter.eventType = '';
      rosterFilter.eventId = '';
      rosterFilter.year = '';
      rosterFilter.age = '';
      rosterSearch.value = '';
    }

    const eventOptionsForRoster = computed(() => {
      // Create base from eventRows
      return eventRows.value
        .filter((f) => {
          const byYear = !rosterFilter.year || Number(f.year) === Number(rosterFilter.year);
          const byType = !rosterFilter.eventType || f.eventType === rosterFilter.eventType;
          const childEvent = f.level === LEVEL.PER_CHILD;
          return byYear && byType && childEvent;
        })
        .map((ev) => ({
          value: ev.id,
          label: ev.title,
        }));
    });

    const programOptionsForRoster = computed(() => {
      return PROGRAM_OPTIONS.value?.filter((p) => p.value !== PROGRAM.BPH);
    });

    const eventTypeOptionsForRoster = computed(() => {
      return EVENT_TYPES.value?.filter((t) => t.value !== EVENT.ADMIN);
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
            grade: r.event?.programId === PROGRAM.TNTT ? ageGroupLabelTNTT(computeAgeByYear(ch.dob)) : '-',
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
      for (let i = 7; i < 18; i++) {
        arr.push(i);
      }
      return arr.map((i) => ({
        value: i,
        label: i,
      }));
    });

    // ======================= RECEIPT (view/print/email) =======================
    const showReceiptModal = ref(false);
    const receiptView = reactive({
      id: '',
      eventTitle: '',
      eventTypeLabel: '',
      programId: '',
      year: '',
      familyId: '',
      parishMember: null,
      parishNumber: '',
      contacts: [], // [{ name, relationship, phone, email }]
      children: [], // [{ fullName, saintName, dob }]
      payments: [], // [{ code, codeLabel, unitAmount, qty, amount, method, receiptNo, receivedBy }]
      total: 0,
      acceptedBy: '',
      updatedAt: '',
    });

    function buildReceiptView(r) {
      const fam = familyById(r.familyId);
      const typeLabel = codeToLabel(r.event?.eventType, EVENT_TYPES.value, undefined, {
        fallback: r.event?.eventType || '',
      });
      const parishNumber = fam.parishMember ? fam.parishNumber : 'Non-Parish';

      const pays = (r.payments || []).map((p) => ({
        code: p.code,
        codeLabel: codeToLabel(p.code, FEE_CODES.value, undefined, { fallback: p.code }),
        unitAmount: Number(p.unitAmount || p.amount || 0),
        qty: Number(p.quantity || 1),
        amount: Number(p.amount || 0),
        method: p.method || '',
        txnRef: p.txnRef || '',
        receiptNo: p.receiptNo || '',
        receivedBy: p.receivedBy || '',
      }));

      Object.assign(receiptView, {
        id: r.id,
        eventTitle: r.event?.title || '',
        eventTypeLabel: typeLabel,
        programId: r.event?.programId,
        year: r.event?.year,
        familyId: r.familyId,
        parishMember: r.parishMember ?? null,
        parishNumber: parishNumber,
        status: r.status,
        contacts: getPrimaryContactsForFamily(fam),
        children: (r.children || []).map((c) => ({
          fullName: c.fullName || '',
          saintName: c.saintName || '',
          age: computeAgeByYear(c.dob),
          grade: r.event?.programId === PROGRAM.TNTT ? ageGroupLabelTNTT(computeAgeByYear(c.dob)) : ' - ',
        })),
        payments: pays,
        total: pays.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        acceptedBy: r.acceptedBy || '',
        updatedAt: (r.updatedAt || r.createdAt || '').slice(0, 10),
      });
    }

    function openReceipt(r) {
      buildReceiptView(r);
      showReceiptModal.value = true;
    }

    function openReceiptById(regId) {
      const r = registrationRows.value.find((x) => x.id === regId);
      if (!r) return setStatus('Registration not found.', 'warn', 1800);
      openReceipt(r);
    }

    function closeReceipt() {
      showReceiptModal.value = false;
    }

    function printReceipt(selector = '#receipt-sheet') {
      const src = document.querySelector(selector);
      const dest = document.getElementById('print-root');
      if (!src || !dest) {
        setStatus('Receipt not ready to print.', 'warn', 1500);
        return;
      }
      // Clone the current rendered HTML into the print root
      dest.innerHTML = src.outerHTML;

      // Optional: strip any screen-only controls in the clone
      dest.querySelectorAll('[data-no-print]').forEach((el) => el.remove());

      // Fire print
      window.print();

      // Cleanup after a moment so the DOM stays light
      setTimeout(() => {
        dest.innerHTML = '';
      }, 500);
    }

    // ---- Roster "Contacts" modal ----
    const showContactsModal = ref(false);
    const contactsModal = reactive({
      familyId: '',
      childName: '',
      age: '',
      allergies: '',
      contacts: [], // [{ name, relationship, phone }]
    });

    function getPrimaryContactsForFamily(f) {
      const contacts = Array.isArray(f?.contacts) ? f.contacts : [];
      const prioritized = contacts.filter((c) => PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !PARENT_RELATIONSHIPS.has((c.relationship || '').trim()));
      const pick = [...prioritized, ...others].slice(0, 3); // show up to 3
      return pick.map((c) => ({
        name: `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`,
        relationship: c.relationship || '',
        phone: formatUSPhone(c.phone || ''),
      }));
    }

    function openChildContactsModal(row) {
      const fam = familyById(row.familyId);
      contactsModal.familyId = row.familyId || '';
      contactsModal.childName = row.fullName || '';
      contactsModal.allergies = row.allergies || '';
      contactsModal.age = row.age || '';
      contactsModal.contacts = fam ? getPrimaryContactsForFamily(fam) : [];
      showContactsModal.value = true;
    }

    function closeChildContactsModal() {
      showContactsModal.value = false;
    }

    // =========================================================
    // INITIAL LOAD (quiet)
    // =========================================================
    onMounted(async () => {
      await loadSetup({ showStatusIfActive: false });
      loadFamilies({ showStatusIfActive: false });
      loadEvents({ showStatusIfActive: false });
      loadRegistrations({ showStatusIfActive: false });
    });

    // =========================================================
    // EXPOSE
    // =========================================================
    return {
      // layout
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
      PAYMENT_METHOD_OPTIONS,
      EVENT,
      LEVEL,
      PROGRAM,
      getOptions,
      formatOptionLabel,

      // helpers
      codeToLabel,
      relativeDisplayValue,
      isVisible,
      fieldClass,
      getFieldDisabled,
      onFormFieldInput,
      onFormFieldChange,

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
      isFamilyDirty,
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
      addFamilyNote,
      removeFamilyNote,
      contactDisplay,
      // pagination list

      familyPageSizeOptions,
      familyPageSize,
      familyPage,
      familyTotalRows,
      familyTotalPages,
      familyPageStart,
      familyPageEnd,
      pagedFamilies,
      goFamilyFirst,
      goFamilyPrev,
      goFamilyNext,
      goFamilyLast,

      // events
      eventSearch,
      eventFilter,
      hasActiveEventFilter,
      eventFields,
      eventForm,
      eventErrors,
      filteredEventRows,
      isEventDirty,
      resetEventFilters,
      displayEventFees,
      addEventFee,
      removeEventFee,
      addEventPrerequisiteRow,
      removeEventPrerequisiteRow,
      showPrerequisites,
      canSaveEvent,
      submitEventForm,
      beginCreateEvent,
      beginEditEvent,

      // registrations
      registrationRows,
      registrationSearch,
      registrationFilter,
      filteredRegistrationRows,
      selectedEventLevel,
      hasActiveRegFilter,
      isRegistrationDirty,
      resetRegFilters,
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

      // receipt
      showReceiptModal,
      receiptView,
      openReceipt,
      openReceiptById,
      closeReceipt,
      printReceipt,
      formatMoney,

      // rosters
      rosterSearch,
      rosterFilter,
      filteredRosterRows,
      hasActiveRosterFilter,
      eventOptionsForRoster,
      programOptionsForRoster,
      eventTypeOptionsForRoster,
      ageOptions,
      ageGroupLabelTNTT,
      resetRosterFilters,

      showContactsModal,
      contactsModal,
      openChildContactsModal,
      closeChildContactsModal,

      // settings
      setup,
      loadSetup,
      saveSetup,
      READONLY,
      isReadOnly,
    };
  },
});

app.mount('#app');
