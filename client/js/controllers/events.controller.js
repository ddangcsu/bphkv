/* eslint-env browser, es2021 */
/* global Vue, API, Schema, Mappers, Util */
(function attachEventsController(global) {
  'use strict';

  const Controllers = global.Controllers || (global.Controllers = {});
  const Domain = global.Domain || {};
  const Eligibility = Domain.Eligibility || {};

  const { ref, reactive, computed, watch, nextTick } = Vue;

  // timer holder for debounce (module-scoped inside controller factory call)
  let _eventsSearchTimer = null;

  /**
   * Create an Events slice (state + actions).
   * Pass in UI helpers so we don't hard-couple to app.js.
   */
  function createEventsController({
    setStatus, // (msg, level?, ms?)
    switchSection, // (sectionName, modeName)
    goBackSection, // ()
    MODE, // reactive { CREATE:boolean, EDIT:boolean } or enum-like
    MODE_NAMES, // { CREATE:'create', EDIT:'edit' }
    SECTION, // current section enum (for "loaded" toast)
    SECTION_NAMES, // { EVENTS:'events', ... }
    isReadOnly, // ref/computed<boolean>
  }) {
    // -------------------------
    // State
    // -------------------------
    const eventRows = ref([]); // full list from API (UI-shaped via mapper in API layer)
    const editingEventId = ref(null); // current editing id
    const eventErrors = ref({}); // validation errors for form
    const originalApiEvent = ref(null); // snapshot for diff/dirty checks

    // Forms metadata + context
    function availablePrerequisiteOptions(ctx) {
      const index = Number.isInteger(ctx?.index) ? ctx.index : -1;
      const form = ctx?.form || eventForm;
      return Eligibility.filterAvailablePrereqEvents(eventRows.value, form, index);
    }

    const eventFields = Schema.Forms.Events({ availablePrerequisiteOptions });

    const eventForm = reactive(Schema.Forms.Events.new());

    const showPrerequisites = computed(() => Eligibility.canHavePrereqs(eventForm.eventType));

    // -------------------------
    // Filters + Pager
    // -------------------------
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
    const eventsTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const haystack = utils.normalize(`${row.id} ${row.title} ${eventOpenStatus(row)}`);
      return utils.includesAllTerms(haystack, terms);
    });
    // Debounced query: only re-filter after the user pauses typing
    const debouncedQuery = ref('');
    // initialize once
    debouncedQuery.value = eventsTextFilter.querySearch ?? '';

    watch(
      () => eventsTextFilter.querySearch,
      (q) => {
        const next = String(q ?? '');
        if (_eventsSearchTimer) clearTimeout(_eventsSearchTimer);
        _eventsSearchTimer = setTimeout(() => {
          debouncedQuery.value = next;
        }, 200); // 200ms debounce — snappy but not chatty
      },
      { immediate: true },
    );
    const filteredEventRows = computed(() => {
      const byMenu = eventsFilterMenu.applyTo(eventRows.value);
      // IMPORTANT: pass the debounced query override
      return eventsTextFilter.applyTo(byMenu, debouncedQuery.value);
    });
    const eventPager = Util.Helpers.createPager({ source: filteredEventRows });

    // -------------------------
    // Load
    // -------------------------
    async function loadEvents({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Events.list(); // API already maps to UI via Mappers.Events in /api/events.js
        eventRows.value = list;
        if (showStatusIfActive && SECTION.EVENTS) setStatus('Events loaded.', 'info', 1200);
      } catch (e) {
        console.error('loadEvents failed:', e);
        eventRows.value = [];
      }
    }

    // -------------------------
    // Form helpers
    // -------------------------
    function hydrateEventErrors() {
      Schema.Forms.Events.validate(eventForm, eventErrors);
    }
    watch(() => eventForm, hydrateEventErrors, { deep: true, immediate: true });

    // keep prereqs in sync when year/id/type changes
    watch(
      () => [eventForm.year, eventForm.id, eventForm.eventType],
      () => {
        if (!Eligibility.canHavePrereqs(eventForm.eventType)) {
          eventForm.prerequisites = [];
          return;
        }
        eventForm.prerequisites = (eventForm.prerequisites || []).filter((p) => {
          const chosenId = (p?.eventId || '').trim();
          if (!chosenId) return true; // keep empty row
          const candidate = eventRows.value.find((e) => e.id === chosenId);
          return Eligibility.isValidPrereqSelection(candidate, eventForm);
        });
        if (eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
      },
    );

    // Array row mutators
    function addEventFee() {
      if (isReadOnly?.value) return;
      eventForm.fees.push(Schema.Forms.Events.newFee());
      eventErrors.value.fees.push({});
    }
    function removeEventFee(index) {
      if (isReadOnly?.value) return;
      eventForm.fees.splice(index, 1);
      eventErrors.value.fees.splice(index, 1);
    }
    function addEventPrerequisiteRow() {
      if (isReadOnly?.value) return;
      eventForm.prerequisites.push(Schema.Forms.Events.newPreq({ ctx: { index: 0, form: eventForm } }));
      eventErrors.value.prerequisites.push({});
    }
    function removeEventPrerequisiteRow(index) {
      if (isReadOnly?.value) return;
      eventForm.prerequisites.splice(index, 1);
      eventErrors.value.prerequisites.splice(index, 1);
      if (showPrerequisites.value && eventForm.prerequisites.length === 0) addEventPrerequisiteRow();
    }

    function displayEventFees(evt) {
      return evt.fees?.length > 0 ? evt.fees.map((item) => item.code + '-$' + String(item.amount)).join(' / ') : '—';
    }

    function eventOpenStatus(evt) {
      const start = Util.Date.dateStringToIso(evt.openDate);
      const end = Util.Date.dateStringToIso(evt.endDate);
      const now = Util.Date.isoNowLocal().slice(0, 10);
      if (now > end) return 'Closed';
      if (now < start) return 'Future';
      return 'Open';
    }

    // Dirty / patch (uses your schema-driven patch factory)
    const eventPatch = computed(
      () => Util.Helpers.makeEventPatchFromSchema(eventFields, originalApiEvent.value || {}, eventForm) || {},
    );
    const isEventDirty = computed(() => Object.keys(eventPatch.value).length > 0);
    function snapshotEventForm() {
      // for CREATE, snapshot the initial toApi of the empty form; for EDIT, snapshot the api object we started with
      originalApiEvent.value = Mappers.Events.toApi(eventForm);
    }

    // -------------------------
    // UI actions
    // -------------------------
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
        setStatus('Nothing to edit.', 'warn', 1500);
        return;
      }
      editingEventId.value = apiEvent.id;
      const ui = Mappers.Events.toUi(apiEvent || {});
      Object.assign(eventForm, Schema.Forms.Events.new(), ui);
      hydrateEventErrors();
      snapshotEventForm();
      switchSection(SECTION_NAMES.EVENTS, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiEvent.id}`, 'info', 1200);
    }

    async function submitEventForm() {
      if (isReadOnly?.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }
      if (!isEventDirty.value) {
        setStatus('No changes to save.', 'warn', 1800);
        return;
      }
      if (!Schema.Forms.Events.validate(eventForm, eventErrors)) {
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
        await nextTick();
        goBackSection();
      } catch (err) {
        console.error(err);
        setStatus('Failed to save Event.', 'error', 3000);
      }
    }

    // expose options constants used in templates today
    const EVENT_TYPES = Schema.Options.EVENT_TYPES;
    const YEAR_OPTIONS = Schema.Options.YEAR_OPTIONS;
    const LEVEL_OPTIONS = Schema.Options.LEVEL_OPTIONS;

    return {
      // state
      eventRows,
      filteredEventRows,
      eventPager,
      eventForm,
      eventErrors,
      editingEventId,
      eventFields,
      showPrerequisites,
      // filters
      eventsFilterMenu,
      eventsTextFilter,
      // actions
      loadEvents,
      beginCreateEvent,
      beginEditEvent,
      submitEventForm,
      //saveEvent,
      addEventFee,
      removeEventFee,
      addEventPrerequisiteRow,
      removeEventPrerequisiteRow,
      // meta
      EVENT_TYPES,
      YEAR_OPTIONS,
      LEVEL_OPTIONS,
      isEventDirty,
      //eventPatch,

      // Others
      displayEventFees,
      eventOpenStatus,
    };
  }

  Controllers.Events = { create: createEventsController };
})(typeof window !== 'undefined' ? window : globalThis);
