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
    const PROGRAM = ENUMS.PROGRAM;
    const EVENT = ENUMS.EVENT;
    const LEVEL = ENUMS.LEVEL;

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
    const computeAgeByYear = Util.Helpers.computeAgeByYear;
    const displayChildNameAndAge = Util.Format.displayChildNameAndAge;

    // =========================================================
    // FAMILIES — all owned by controller
    // =========================================================
    const Families = Controllers.Families.create({
      setStatus,
      switchSection,
      goBackSection,
      MODE,
      MODE_NAMES,
      SECTION,
      SECTION_NAMES,
      isReadOnly,
      getRegistrationRows: () => registrationRows.value, // used for regMode filter
    });

    // LIST (same names as your template)
    const familyRows = Families.familyRows;
    const familiesFilterMenu = Families.familiesFilterMenu;
    const familiesTextFilter = Families.familiesTextFilter;
    const filteredFamilyRows = Families.filteredFamilyRows;
    const familiesPager = Families.familiesPager;
    const contactDisplay = Families.contactDisplay;
    const loadFamilies = Families.loadFamilies;

    // FORM (same names as your template)
    const familyForm = Families.familyForm;
    const familyErrors = Families.familyErrors;
    const familyFields = Families.familyFields;
    const isFamilyDirty = Families.isFamilyDirty;
    const beginCreateFamily = Families.beginCreateFamily;
    const beginEditFamily = Families.beginEditFamily;
    const submitFamilyForm = Families.submitFamilyForm;
    const addFamilyContact = Families.addFamilyContact;
    const removeFamilyContact = Families.removeFamilyContact;
    const addFamilyChild = Families.addFamilyChild;
    const removeFamilyChild = Families.removeFamilyChild;
    const addFamilyNote = Families.addFamilyNote;
    const removeFamilyNote = Families.removeFamilyNote;

    // Others
    const familyDatalistOptions = Families.familyDatalistOptions;

    // =========================================================
    // EVENTS (delegated to Controllers.Events)
    // =========================================================
    const Events = Controllers.Events.create({
      setStatus, // (msg, level?, ms?)
      switchSection, // (sectionName, modeName)
      goBackSection, // ()
      MODE, // reactive flags or enum-like
      MODE_NAMES, // { CREATE:'create', EDIT:'edit' }
      SECTION, // current section enum
      SECTION_NAMES, // { EVENTS:'events', ... }
      isReadOnly, // ref/computed<boolean>
    });

    // --- Re-expose fields with the same names your template expects ---
    const eventRows = Events.eventRows;
    const filteredEventRows = Events.filteredEventRows;
    const eventPager = Events.eventPager;

    const eventForm = Events.eventForm;
    const eventErrors = Events.eventErrors;
    const eventFields = Events.eventFields;
    const showPrerequisites = Events.showPrerequisites;

    const eventsFilterMenu = Events.eventsFilterMenu;
    const eventsTextFilter = Events.eventsTextFilter;

    // Keep action names identical
    const loadEvents = Events.loadEvents;
    const beginCreateEvent = Events.beginCreateEvent;
    const beginEditEvent = Events.beginEditEvent;
    const submitEventForm = Events.submitEventForm;

    const addEventFee = Events.addEventFee;
    const removeEventFee = Events.removeEventFee;
    const addEventPrerequisiteRow = Events.addEventPrerequisiteRow;
    const removeEventPrerequisiteRow = Events.removeEventPrerequisiteRow;

    // Useful meta/derived
    const isEventDirty = Events.isEventDirty;
    const displayEventFees = Events.displayEventFees;
    const eventOpenStatus = Events.eventOpenStatus;

    // =========================================================
    // REGISTRATIONS — all owned by controller
    // =========================================================
    const Registrations = Controllers.Registrations.create({
      setStatus,
      switchSection,
      goBackSection,
      MODE,
      MODE_NAMES,
      SECTION,
      SECTION_NAMES,
      isReadOnly,
      getEventRows: () => eventRows.value,
      getFamilyRows: () => familyRows.value,
      volunteersFor,
    });

    // LIST (same names as your template)
    const registrationRows = Registrations.registrationRows;
    const registrationsFilterMenu = Registrations.registrationsFilterMenu;
    const registrationsTextFilter = Registrations.registrationsTextFilter;
    const filteredRegistrationRows = Registrations.filteredRegistrationRows;
    const registrationPager = Registrations.registrationPager;
    const loadRegistrations = Registrations.loadRegistrations;

    // Quick-register (used by Families table buttons)
    const alreadyRegistered = Registrations.alreadyRegistered;
    const adminRegistration = Registrations.adminRegistration;
    const tnttRegistration = Registrations.tnttRegistration;
    const registerAdminForFamily = Registrations.registerAdminForFamily;
    const registerTNTTForFamily = Registrations.registerTNTTForFamily;

    // FORM
    const registrationForm = Registrations.registrationForm;
    const registrationErrors = Registrations.registrationErrors;
    const registrationFields = Registrations.registrationFields;
    const isRegistrationDirty = Registrations.isRegistrationDirty;
    const beginCreateRegistration = Registrations.beginCreateRegistration;
    const beginEditRegistration = Registrations.beginEditRegistration;
    const submitRegistrationForm = Registrations.submitRegistrationForm;
    const addRegChild = Registrations.addRegChild;
    const removeRegChild = Registrations.removeRegChild;
    const addRegPayment = Registrations.addRegPayment;
    const removeRegPayment = Registrations.removeRegPayment;
    const addRegNote = Registrations.addRegNote;
    const removeRegNote = Registrations.removeRegNote;

    // Others
    const selectedEventLevel = Registrations.selectedEventLevel;
    const familyById = Registrations.familyById;
    const availableChildOptions = Registrations.availableChildOptions;

    // Derived helpers
    const ageGroupLabelTNTT = Util.Format.ageGroupLabelTNTT;

    // Receipt
    const showReceiptModal = Registrations.showReceiptModal;
    const receiptView = Registrations.receiptView;
    const openReceipt = Registrations.openReceipt;
    const printReceipt = Registrations.printReceipt;

    // =========================================================
    // Roster TNTT
    // =========================================================
    // ---- Rosters (extracted 1:1) ----
    const Rosters = Controllers.Rosters.create({
      getEventRows: () => eventRows.value,
      getRegistrationRows: () => registrationRows.value,
      familyById: (id) => familyById(id), // from Registrations controller you already expose
      ageGroupLabelTNTT: Util.Format.ageGroupLabelTNTT, // same helper you use
      setStatus, // for print status toast
    });

    // expose exactly what index.html uses today
    const rosterFilterMenu = Rosters.rosterFilterMenu;
    const rosterTextFilter = Rosters.rosterTextFilter;
    const rosterPager = Rosters.rosterPager;

    // contacts modal API used in the roster section
    const showContactsModal = Rosters.showContactsModal;
    const contactsView = Rosters.contactsView;
    const openChildContactsModal = Rosters.openChildContactsModal;
    const closeChildContactsModal = Rosters.closeChildContactsModal;

    // optional: print
    const printRoster = Rosters.printRoster;
    const printRosterTableOnly = Rosters.printRosterTableOnly;

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
      isFamilyDirty,
      beginCreateFamily,
      beginEditFamily,
      submitFamilyForm,
      addFamilyContact,
      removeFamilyContact,
      addFamilyChild,
      removeFamilyChild,
      addFamilyNote,
      removeFamilyNote,
      contactDisplay,
      loadFamilies,
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
      eventOpenStatus,
      addEventFee,
      removeEventFee,
      addEventPrerequisiteRow,
      removeEventPrerequisiteRow,
      showPrerequisites,
      submitEventForm,
      loadEvents,
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
      addRegChild,
      removeRegChild,
      addRegNote,
      removeRegNote,
      loadRegistrations,
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
      printRoster,
      printRosterTableOnly,

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

app.component('events-toolbar', window.Components && window.Components.EventsToolbar);
app.component('events-table', window.Components && window.Components.EventsTable);
app.component('events-form', window.Components && window.Components.EventsForm);

app.component('families-toolbar', window.Components && window.Components.FamiliesToolbar);
app.component('families-table', window.Components && window.Components.FamiliesTable);
app.component('families-form', window.Components && window.Components.FamiliesForm);

app.component('registrations-toolbar', window.Components && window.Components.RegistrationsToolbar);
app.component('registrations-table', window.Components && window.Components.RegistrationsTable);
app.component('registrations-form', window.Components && window.Components.RegistrationsForm);
app.component('registration-receipt', Components.RegistrationReceipt);
// components
app.component('rosters-toolbar', Components.RostersToolbar);
app.component('rosters-table', Components.RostersTable);

app.mount('#app');
