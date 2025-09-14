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
    Schema.Options.initializeEnums();

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
    const FEE = Schema.Options.ENUMS.FEE;

    /**
     * De-reference utilities helper
     */
    const formatMoney = Util.Format.formatMoney;

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

      const raw = Util.Helpers.getByPath(match, rd.rdCol);
      if (raw == null) return '';

      if (rd.map) return codeToLabel(raw, rd.map);
      return String(raw);
    }

    // Unified meta-driven handlers
    const onFormFieldChange = Util.Helpers.onFormFieldChange;
    const onFormFieldInput = Util.Helpers.onFormFieldInput;
    const getOptions = Util.Helpers.getOptions;
    const formatOptionLabel = Util.Helpers.formatOptionLabel;

    // === Unified meta switches ===
    const isVisible = Util.Helpers.isVisible;
    const fieldClass = Util.Helpers.fieldClass;
    const getFieldDisabled = Util.Helpers.getFieldDisabled;
    const maskLast4 = Util.Format.maskLast4;
    const computeAgeByYear = Util.Helpers.computeAgeByYear;
    const displayChildNameAndAge = Util.Format.displayChildNameAndAge;

    function displayEventFees(evt) {
      return evt.fees?.length > 0 ? evt.fees.map((item) => item.code + '-$' + String(item.amount)).join(' / ') : '—';
    }

    // =========================================================
    // FAMILIES
    // =========================================================
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

    // --- Family filter helpers ---
    function familyHasRegistrationForState(familyId, state) {
      // Fallback: scan registrationRows with optional program/type/year constraints
      const list = registrationRows.value || [];
      for (const reg of list) {
        if (reg.familyId !== familyId) continue;
        const ev = reg.event || {};
        if (state.programId && ev.programId !== state.programId) continue;
        if (state.eventType && ev.eventType !== state.eventType) continue;
        if (state.year && Number(ev.year) !== Number(state.year)) continue;
        return true;
      }
      return false;
    }

    // --- Families — filter menu defs (now with programId, eventType, year, and regMode) ---
    const familyFilterDefs = [
      {
        key: 'parishMember',
        label: 'Parish Member',
        type: 'select',
        options: () => Schema.Options.YES_NO_OPTIONS,
        emptyValue: '',
      },
      {
        key: 'programId',
        label: 'Program',
        type: 'select',
        options: () => Schema.Options.PROGRAM_OPTIONS,
        emptyValue: '',
        bypass: true,
      },
      {
        key: 'eventType',
        label: 'Event Type',
        type: 'select',
        options: () => Schema.Options.EVENT_TYPES,
        emptyValue: '',
        bypass: true,
      },
      {
        key: 'year',
        label: 'School Year',
        type: 'select',
        options: () => Schema.Options.YEAR_OPTIONS,
        emptyValue: '',
        bypass: true,
      },
      {
        key: 'regMode',
        label: 'Registration',
        type: 'select',
        options: () => [
          { value: 'registered', label: 'Registered (matches filters)' },
          { value: 'not-registered', label: 'Not registered (matches filters)' },
        ],
        emptyValue: '',
        // Use programId/eventType/year from the current menu state to scope the check
        matches: (familyRow, selectedMode, state) => {
          if (!selectedMode) return true; // no special reg filter
          const has = familyHasRegistrationForState(familyRow.id, state);
          return selectedMode === 'registered' ? has : !has;
        },
      },
    ];

    const familiesFilterMenu = Util.Helpers.createFilterMenu(familyFilterDefs);

    // Define text filter for family
    const familiesTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const parts = [row.id, row.parishNumber, row.address?.city];
      (row.contacts || []).forEach((c) => {
        parts.push(c.lastName, c.firstName, c.middle, c.email, Util.Format.normPhone(c.phone));
      });
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    const filteredFamilyRows = Vue.computed(() => {
      const byMenu = familiesFilterMenu.applyTo(familyRows.value);
      return familiesTextFilter.applyTo(byMenu);
    });

    // Create a family list pagination instance
    const familiesPager = Util.Helpers.createPager({ source: filteredFamilyRows });

    const contactDisplay = (f, one = false) => {
      const contacts = Array.isArray(f.contacts) ? f.contacts : [];
      if (!contacts.length) return '—';

      // Prioritize the first 2 among Father / Mother / Guardian
      const prioritized = contacts.filter((c) => Schema.Options.PARENTS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !Schema.Options.PARENTS.has((c.relationship || '').trim()));
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
      const formatted = Util.Format.formatPhone(raw);
      const target = ctx?.row || ctx?.form;
      // write-back here (meta function owns mutation)
      if (target && fieldMeta?.col) {
        // setDefault supports deep paths if you ever use nested cols
        Util.Helpers.setDefault(target, fieldMeta.col, formatted);
      }
    }

    function needsNameException(ctx) {
      const target = ctx?.row || ctx?.form;
      const last = String(target?.lastName ?? '')
        .trim()
        .toLowerCase();
      return !!last && !parentLastNameSet.value.has(last);
    }

    const parentLastNameSet = computed(() => {
      const s = new Set();
      for (const c of familyForm.contacts ?? []) {
        const rel = String(c?.relationship ?? '').trim();
        if (!Schema.Options.PARENTS.has(rel)) continue;

        const ln = String(c?.lastName ?? '')
          .trim()
          .toLowerCase();
        if (ln) s.add(ln);
      }
      return s; // Set<string> of lowercase names
    });

    // FAMILIES_META
    const familyCtx = {
      onContactPhoneInput,
      needsNameException,
      parentLastNameSet,
    };
    const familyFields = Schema.Forms.Families(familyCtx);

    const familyForm = reactive(Schema.Forms.Families.new());
    const familyErrors = ref({});

    const validateFamily = () => {
      const errors = {};

      // household
      errors.main = Util.Helpers.validateFields(familyFields.household.main, familyForm, { form: familyForm });
      errors.address = Util.Helpers.validateFields(familyFields.household.address, familyForm.address || {}, {
        form: familyForm,
      });
      // arrays
      errors.contacts = Util.Helpers.validateRowArray(familyFields.contacts, familyForm.contacts, { form: familyForm });
      errors.children = Util.Helpers.validateRowArray(familyFields.children, familyForm.children, { form: familyForm });
      errors.notes = Util.Helpers.validateRowArray(familyFields.notes, familyForm.notes, { form: familyForm });
      // Custom item
      if (!familyForm.contacts.some((c) => Schema.Options.PARENTS.has(c.relationship)))
        errors.contactErrors = 'Contacts must have at least one with Father/Mother/Guardian relationship';

      familyErrors.value = {
        ...errors.main,
        address: errors.address,
        contacts: errors.contacts || [],
        children: errors.children || [],
        notes: errors.notes || [],
        contactErrors: errors.contactErrors,
      };

      const noHouseHoldErrors = Object.keys(errors.main).length === 0 && Object.keys(errors.address).length === 0;
      const noContactsErrors =
        (errors.contacts || []).every((obj) => !obj || Object.keys(obj).length === 0) && !errors.contactErrors;
      const noChildrenErrors = (errors.children || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const noNotesErrors = (errors.notes || []).every((obj) => !obj || Object.keys(obj).length === 0);

      return noHouseHoldErrors && noContactsErrors && noChildrenErrors && noNotesErrors;
    };

    function hydrateFamilyErrors() {
      validateFamily();
    }

    function normalizeNameExceptions() {
      for (const child of familyForm.children || []) {
        // Only write if we actually need to change something to avoid extra re-renders
        if (!needsNameException({ form: familyForm, row: child })) {
          if (child.isNameException) child.isNameException = false;
          if (child.exceptionNotes) child.exceptionNotes = '';
        }
      }
    }

    Vue.watch(
      () => familyForm,
      () => {
        normalizeNameExceptions(); // keep the form normalized
        hydrateFamilyErrors(); // then recompute interactive errors
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
      Object.assign(familyForm, Schema.Forms.Families.new());
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
      Object.assign(familyForm, Schema.Forms.Families.new(), ui);
      hydrateFamilyErrors();
      snapshotFamilyForm();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiFamily.id}`, 'info', 1200);
    }

    // Display-friendly string
    const parentLastNamesDisplay = computed(() =>
      [...parentLastNameSet.value].map((e) => Util.Format.capitalize(e)).join(' / '),
    );

    async function addFamilyContact() {
      if (isReadOnly.value) return;
      familyForm.contacts.push(Schema.Forms.Families.newContact());
      familyErrors.value.contacts.push({});
      await nextTick();
    }
    function removeFamilyContact(i) {
      if (isReadOnly.value) return;
      familyForm.contacts.splice(i, 1);
      familyErrors.value.contacts.splice(i, 1);
    }
    async function addFamilyChild() {
      if (isReadOnly.value) return;
      familyForm.children.push(Schema.Forms.Families.newChild());
      familyErrors.value.children.push({});
      await nextTick();
    }
    function removeFamilyChild(i) {
      if (isReadOnly.value) return;
      familyForm.children.splice(i, 1);
      familyErrors.value.children.splice(i, 1);
    }

    async function addFamilyNote() {
      if (isReadOnly.value) return;
      familyForm.notes.push(Schema.Forms.Families.newNote());
      familyErrors.value.notes.push({});
      await nextTick();
    }

    function removeFamilyNote(i) {
      if (isReadOnly.value) return;
      familyForm.notes.splice(i, 1);
      familyErrors.value.notes.splice(i, 1);
    }

    function resetFamilyForm() {
      Object.assign(familyForm, Schema.Forms.Families.new());
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

    const eventErrors = ref({});
    const editingEventId = ref(null);

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

    const eventForm = reactive(Schema.Forms.Events.new());

    const showPrerequisites = computed(() => eventForm.eventType !== EVENT.ADMIN);

    function requiredPrereqType() {
      if (eventForm.eventType === EVENT.REGISTRATION) return EVENT.ADMIN;
      if (eventForm.eventType === EVENT.EVENT) return EVENT.REGISTRATION;
      return null; // ADM => none
    }

    // Watch the year/id/eventType to determine if we need prerequisite or not
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
      eventForm.fees.push(Schema.Forms.Events.newFee());
      eventErrors.value.fees.push({});
    }
    function removeEventFee(i) {
      if (isReadOnly.value) return;
      eventForm.fees.splice(i, 1);
      eventErrors.value.fees.splice(i, 1);
    }

    function addEventPrerequisiteRow() {
      if (isReadOnly.value) return;
      eventForm.prerequisites.push(Schema.Forms.Events.newPreq({ ctx: { index: 0, form: eventForm } }));
      eventErrors.value.prerequisites.push({});
    }
    function removeEventPrerequisiteRow(i) {
      if (isReadOnly.value) return;
      eventForm.prerequisites.splice(i, 1);
      eventErrors.value.prerequisites.splice(i, 1);
      if (showPrerequisites.value && eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
    }

    /**
     * Define eventFilters options to build the filter menu
     */

    const eventFilterDefs = [
      {
        key: 'programId',
        label: 'Program',
        type: 'select',
        options: () => Schema.Options.PROGRAM_OPTIONS,
        emptyValue: '',
      },
      { key: 'year', label: 'School Year', type: 'select', options: () => Schema.Options.YEAR_OPTIONS, emptyValue: '' },
      {
        key: 'level',
        label: 'Level Scope',
        type: 'select',
        options: () => Schema.Options.LEVEL_OPTIONS,
        emptyValue: '',
      },
      {
        key: 'eventType',
        label: 'Event Type',
        type: 'select',
        options: () => Schema.Options.EVENT_TYPES,
        emptyValue: '',
      },
    ];

    const eventsFilterMenu = Util.Helpers.createFilterMenu(eventFilterDefs);

    // Create the text filter with an event-specific matcher on id and title
    const eventsTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const haystack = utils.normalize(`${row.id} ${row.title}`);
      return utils.includesAllTerms(haystack, terms);
    });

    const filteredEventRows = computed(() => {
      const byMenu = eventsFilterMenu.applyTo(eventRows.value);
      return eventsTextFilter.applyTo(byMenu);
    });

    // Event List Pagination instance
    const eventPager = Util.Helpers.createPager({ source: filteredEventRows });

    function beginCreateEvent() {
      Object.assign(eventForm, Schema.Forms.Events.new());
      editingEventId.value = null;
      hydrateEventErrors();
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
      Object.assign(eventForm, Schema.Forms.Events.new(), ui);

      hydrateEventErrors();
      snapshotEventForm();
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.EDIT);
      setStatus(`Editing ${e.id}`, 'info', 1200);
    }

    const validateEvent = () => {
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
        YEAR_OPTIONS.value.some((o) => Number(o.value) === Number(eventForm.year)) &&
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

    function hydrateEventErrors() {
      validateEvent();
    }

    // Interactive error on the form as user input
    Vue.watch(() => eventForm, hydrateEventErrors, { deep: true, immediate: true });

    async function submitEventForm() {
      if (isReadOnly.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }

      if (!isEventDirty.value) {
        setStatus('No changes to save.', 'warn', 1800);
        return;
      }

      if (!validateEvent()) {
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

    const registrationForm = reactive(Schema.Forms.Registrations.new());
    const registrationErrors = ref({});

    // --- Helpers --------------------------------------------------------------

    const isOpenEventFilter = (ev) => {
      const todayPST = new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 10);
      return (!ev?.openDate || ev?.openDate <= todayPST) && (!ev?.endDate || todayPST <= ev?.endDate);
    };

    function isCurrentSchoolYear(ev) {
      return Number(ev?.year) === Number(Util.Helpers.getCurrentSchoolYear());
    }

    // Check whether a given family has registered for the year
    function alreadyRegistered({
      familyId,
      year = Util.Helpers.getCurrentSchoolYear(),
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

    /**
     * Define filter menu for registrations list
     */
    const registrationFilterDef = [
      {
        key: 'programId',
        field: 'event.programId',
        label: 'Program',
        type: 'select',
        options: () => Schema.Options.PROGRAM_OPTIONS,
        emptyValue: '',
      },
      {
        key: 'eventType',
        field: 'event.eventType',
        label: 'Event Type',
        type: 'select',
        options: () => Schema.Options.EVENT_TYPES,
        emptyValue: '',
      },
      {
        key: 'year',
        field: 'event.year',
        label: 'School Year',
        type: 'select',
        options: () => Schema.Options.YEAR_OPTIONS,
        emptyValue: '',
      },
    ];

    const registrationsFilterMenu = Util.Helpers.createFilterMenu(registrationFilterDef);

    const registrationsTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const parts = [row.id, row.familyId, row.event?.title];
      (row.contacts || []).forEach((c) => parts.push(c.name, Util.Format.normPhone(c.phone)));
      (row.payments || []).forEach((p) => parts.push(p.receiptNo));
      (row.children || []).forEach((c) => parts.push(c.fullName));
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    const filteredRegistrationRows = computed(() => {
      // Apply the filters selection first
      const byMenu = registrationsFilterMenu.applyTo(registrationRows.value);
      // Apply text search filter next
      return registrationsTextFilter.applyTo(byMenu);
    });

    // Registration Pager Instance
    const registrationPager = Util.Helpers.createPager({ source: filteredRegistrationRows });

    function beginCreateRegistration() {
      Object.assign(registrationForm, Schema.Forms.Registrations.new());
      editingRegistrationId.value = null;
      hydrateRegistrationErrors();
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
      Object.assign(registrationForm, Schema.Forms.Registrations.new(), Mappers.Registrations.toUi(apiReg || {}));
      hydrateRegistrationErrors();
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
      return childRegistrationOptions(null, { form: registrationForm, index: -1 });
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
      registrationForm.children.push(Schema.Forms.Registrations.newChild());
      registrationErrors.value.children.push({});
    }
    function removeRegChildRow(i) {
      if (isReadOnly.value) return;
      registrationForm.children.splice(i, 1);
      registrationErrors.value.children.splice(i, 1);
      recomputePayments({ form: registrationForm });
    }

    async function addRegistrationNote() {
      if (isReadOnly.value) return;
      registrationForm.notes.push(Schema.Forms.Registrations.newNote());
      registrationErrors.value.notes.push({});
      await nextTick();
    }

    function removeRegistrationNote(i) {
      if (isReadOnly.value) return;
      registrationForm.notes.splice(i, 1);
      registrationErrors.value.notes.splice(i, 1);
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
      form.event = Schema.Forms.Registrations.newEvent({
        ctx, // if any field in the snapshot needs ctx for defaults/transforms
        overrides: ev
          ? {
              title: ev.title ?? '',
              year: ev.year ?? '',
              programId: ev.programId ?? '',
              eventType: ev.eventType ?? '',
            }
          : {}, // no event selected → just schema defaults
      });
    }

    function hydrateRegistrationContacts(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const family = familyById(form.familyId);

      if (!family) {
        form.contacts = [];
        form.parishMember = null;
        return;
      }

      const contacts = Array.isArray(family.contacts) ? family.contacts : [];
      const isParentRel = (rel) => {
        const normalized = String(rel || '').trim();
        // If you expose only one Set, keep the one you actually use below.
        return Schema.Options.PARENTS?.has(normalized);
      };

      const prioritized = contacts.filter((c) => isParentRel(c.relationship));
      const others = contacts.filter((c) => !isParentRel(c.relationship));
      const picked = [...prioritized, ...others].slice(0, 2);

      form.contacts = picked.map((c) =>
        Schema.Forms.Registrations.newContact({
          ctx,
          overrides: {
            name: `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`,
            relationship: c.relationship || '',
            phone: Util.Format.formatPhone(c.phone || ''),
          },
        }),
      );

      form.parishMember = !!family.parishMember;
    }

    function computeQuantity(ev) {
      return ev?.level === LEVEL.PER_CHILD
        ? Math.max(1, (registrationForm.children || []).filter((c) => c.childId).length)
        : 1;
    }

    function hydrateRegistrationPayments(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const ev = selectedEvent.value;

      // No event or no family → no payments
      if (!ev || !form.familyId) {
        form.payments = [];
        return;
      }

      const quantity = computeQuantity(ev);
      const fees = Array.isArray(ev.fees) ? ev.fees : [];
      const isParishMember = form.parishMember === true;

      // Hide Non-Parish fee for parish members
      const applicableFees = fees.filter((fee) => (isParishMember ? fee.code !== FEE.NPM_FEE : true));

      form.payments = applicableFees.map((fee) =>
        Schema.Forms.Registrations.newPayment({
          ctx,
          overrides: {
            code: fee.code,
            unitAmount: Number(fee.amount ?? 0),
            quantity,
            amount: Number(fee.amount ?? 0) * quantity,
            method: '',
            txnRef: '',
            receiptNo: '',
            receivedBy: '',
          },
        }),
      );
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
      registrationErrors.value.children = form.children.map(() => ({}));

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

    // Reset form if familyId changed
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

    // Filter the receivedBy list of volunteer based on the programId of the event chosen
    watch(
      () => selectedEvent?.value?.programId,
      (pid) => {
        const allowed = new Set(volunteersFor(pid).map((o) => o.value));
        (registrationForm.payments || []).forEach((p) => {
          if (p.receivedBy && !allowed.has(p.receivedBy)) p.receivedBy = '';
        });
      },
    );

    // Option list of family contacts that will be sign the form
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

    const validateRegistration = () => {
      const errors = {};
      // main
      errors.main = Util.Helpers.validateFields(registrationFields.main, registrationForm, { form: registrationForm });
      errors.meta = Util.Helpers.validateFields(registrationFields.meta, registrationForm, { form: registrationForm });
      // arrays
      errors.children = Util.Helpers.validateRowArray(registrationFields.childrenRow, registrationForm.children, {
        form: registrationForm,
      });
      errors.payments = Util.Helpers.validateRowArray(registrationFields.paymentsRow, registrationForm.payments, {
        form: registrationForm,
      });
      errors.notes = Util.Helpers.validateRowArray(registrationFields.notes, registrationForm.notes, {
        form: registrationForm,
      });

      registrationErrors.value = {
        ...errors.main,
        ...errors.meta,
        children: errors.children || [],
        payments: errors.payments || [],
        notes: errors.notes || [],
      };

      const mainErrors = Object.keys(errors.main).length === 0 && Object.keys(errors.meta).length === 0;
      const childrenErrors = (errors.children || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const paymentsErrors = (errors.payments || []).every((obj) => !obj || Object.keys(obj).length === 0);
      const notesErrors = (errors.notes || []).every((obj) => !obj || Object.keys(obj).length === 0);
      return mainErrors && childrenErrors && paymentsErrors && notesErrors;
    };

    function hydrateRegistrationErrors() {
      validateRegistration();
    }

    // Interactive error on the form as user input
    Vue.watch(() => registrationForm, hydrateRegistrationErrors, { deep: true, immediate: true });

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

    async function saveRegistration({ openReceiptAfter = false } = {}) {
      setStatus('Saving Registration...');
      const payload = Mappers.Registrations.toApi(registrationForm);
      let result = {};
      try {
        if (MODE.CREATE) {
          result = await API.Registrations.create(payload);
          setStatus('Registration created.', 'success', 1500);
        } else {
          const patch = { ...payload };
          delete patch.id;
          result = await API.Registrations.update(editingRegistrationId.value, patch);
          setStatus('Registration updated.', 'success', 1500);
        }
        await loadRegistrations();
        // Switch it to Edit Mode
        beginEditRegistration(Mappers.Registrations.toUi(result || {}));
        if (openReceiptAfter && result.id) Vue.nextTick(() => openReceiptById(result.id));
      } catch (e) {
        console.error(e);
        setStatus('Failed to save Registration.', 'error', 3000);
      }
    }

    // =========================================================
    // Roster TNTT
    // =========================================================

    const programOptionsForRoster = computed(() => {
      return PROGRAM_OPTIONS.value?.filter((p) => p.value !== PROGRAM.BPH);
    });

    const eventTypeOptionsForRoster = computed(() => {
      return EVENT_TYPES.value?.filter((t) => t.value !== EVENT.ADMIN);
    });

    const ageOptions = function (program = '') {
      const arr = [];
      for (let i = 7; i < 18; i++) {
        arr.push(i);
      }
      return arr.map((i) => ({
        value: i,
        label: i,
      }));
    };

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

    /**
     * Define filter menu for registrations list
     */
    const rosterFilterDef = [
      {
        key: 'programId',
        label: 'Program',
        type: 'select',
        options: () => programOptionsForRoster.value,
        emptyValue: '',
      },
      {
        key: 'eventType',
        label: 'Event Type',
        type: 'select',
        options: () => eventTypeOptionsForRoster.value,
        emptyValue: '',
      },
      {
        key: 'year',
        label: 'School Year',
        type: 'select',
        options: () => Schema.Options.YEAR_OPTIONS,
        emptyValue: '',
      },
      {
        key: 'eventId',
        label: 'Event',
        type: 'select',
        options: (fMeta, ctx) => {
          const { programId, year, eventType } = ctx?.state || {};
          const childLevel = Schema.Options.ENUMS.LEVEL.PER_CHILD;

          return eventRows.value
            .filter(
              (ev) =>
                (!programId || ev.programId === programId) &&
                (!year || Number(ev.year) === Number(year)) &&
                (!eventType || ev.eventType === eventType) &&
                ev.level === childLevel,
            )
            .map((ev) => ({ value: ev.id, label: ev.title }));
        },
      },
      {
        key: 'age',
        label: 'Age',
        type: 'select',
        options: (fMeta, ctx) => {
          const { programId } = ctx?.state || {};
          return ageOptions(programId);
        },
      },
      {
        key: 'allergies',
        label: 'Allergies',
        type: 'select',
        options: () => {
          return [
            { value: 'yes', label: 'Has Food Allergies' },
            { value: 'no', label: 'No Allergies' },
          ];
        },
        matches: (row, selected) => {
          if (!selected) return true;
          const text = String(row?.allergies || '').trim();
          const has = text.length > 0;
          return selected === 'yes' ? has : !has;
        },
      },
    ];

    const rosterFilterMenu = Util.Helpers.createFilterMenu(rosterFilterDef);

    const rosterTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const parts = [row.fullName];
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    const filteredRosterRows = computed(() => {
      const byMenu = rosterFilterMenu.applyTo(rosterRows.value);
      return rosterTextFilter.applyTo(byMenu);
    });

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

    const rosterPager = Util.Helpers.createPager({ source: filteredRosterRows });

    // ======================= RECEIPT (view/print/email) =======================
    const showReceiptModal = ref(false);
    const receiptView = ref({});

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

      receiptView.value = {
        receiptName: `Receipt ${r.event.title}`,
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
      };
    }

    function openReceipt(r) {
      buildReceiptView(r);
      showReceiptModal.value = true;
    }

    function openReceiptById(id) {
      // Try to use what’s already in the list
      const row = (registrationRows.value || []).find((r) => r.id === id);
      if (row) {
        openReceipt(row); // your existing function from the list
        return;
      }
      // Fallback: fetch and map, then open
      API.Registrations.get(id).then((apiDoc) => {
        const ui = Mappers.Registrations.toUi(apiDoc || {});
        openReceipt(ui);
      });
    }

    async function printReceipt() {
      await nextTick(() => window.print());
    }

    // ---- Roster "Contacts" modal ----
    const showContactsModal = ref(false);
    const contactsView = ref({});

    function getPrimaryContactsForFamily(f) {
      const contacts = Array.isArray(f?.contacts) ? f.contacts : [];
      const prioritized = contacts.filter((c) => Schema.Options.PARENTS.has((c.relationship || '').trim()));
      const others = contacts.filter((c) => !Schema.Options.PARENTS.has((c.relationship || '').trim()));
      const pick = [...prioritized, ...others].slice(0, 3); // show up to 3
      return pick.map((c) => ({
        name: `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''}`,
        relationship: c.relationship || '',
        phone: Util.Format.formatPhone(c.phone || ''),
      }));
    }

    function openChildContactsModal(row) {
      const fam = familyById(row.familyId);
      contactsView.value = {
        familyId: row.familyId,
        childName: row.fullName,
        allergies: row.allergies || 'None',
        age: row.age,
        contacts: fam ? getPrimaryContactsForFamily(fam) : [],
      };
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
      filteredFamilyRows,
      familyForm,
      familyErrors,
      displayChildNameAndAge,
      parentLastNamesDisplay,
      isFamilyDirty,
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
      familiesPager,
      familiesFilterMenu,
      familiesTextFilter,

      // events
      eventFields,
      eventForm,
      eventErrors,
      filteredEventRows,
      isEventDirty,
      displayEventFees,
      addEventFee,
      removeEventFee,
      addEventPrerequisiteRow,
      removeEventPrerequisiteRow,
      showPrerequisites,
      submitEventForm,
      beginCreateEvent,
      beginEditEvent,
      // Event List
      eventPager,
      eventsFilterMenu,
      eventsTextFilter,

      // registrations
      registrationRows,
      filteredRegistrationRows,
      selectedEventLevel,
      isRegistrationDirty,
      beginCreateRegistration,
      registerAdminForFamily,
      registerTNTTForFamily,
      beginEditRegistration,
      alreadyRegistered,
      registrationForm,
      registrationFields,
      registrationErrors,
      submitRegistrationForm,
      familyDatalistOptions,
      availableChildOptions,
      addRegChildRow,
      removeRegChildRow,
      addRegistrationNote,
      removeRegistrationNote,
      // Registrations List
      registrationPager,
      registrationsFilterMenu,
      registrationsTextFilter,

      // receipt
      showReceiptModal,
      receiptView,
      openReceipt,
      printReceipt,
      formatMoney,

      // rosters
      showContactsModal,
      contactsView,
      openChildContactsModal,
      closeChildContactsModal,
      // List pager and filters
      rosterPager,
      rosterFilterMenu,
      rosterTextFilter,

      // settings
      setup,
      loadSetup,
      saveSetup,
      READONLY,
      isReadOnly,
    };
  },
});

app.component('ui-modal', window.UiModal);
app.mount('#app');
