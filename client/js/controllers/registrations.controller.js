/* eslint-env browser, es2021 */
/* global Vue, API, Schema, Mappers, Util */
(function attachRegistrationsController(global) {
  'use strict';

  const Controllers = global.Controllers || (global.Controllers = {});
  const { ref, reactive, computed, watch, nextTick } = Vue;

  /**
   * Registrations controller (owns list + filters + pager + form)
   * - Validation & field meta come from schemas/forms.registrations.js
   * - Mapping comes from mappers/registrations.js
   * - Uses event + family data via callbacks to avoid circular init
   */
  function createRegistrationsController({
    setStatus,
    switchSection,
    goBackSection,
    MODE,
    MODE_NAMES,
    SECTION,
    SECTION_NAMES,
    isReadOnly,

    // call-ins from app.js (thin shims you already have)
    getEventRows, // () => eventRows.value
    getFamilyRows, // () => familyRows.value
    volunteersFor, // (programId) => [{value,label},...]
  }) {
    // -------------------------
    // LIST (table) STATE
    // -------------------------
    const registrationRows = ref([]);

    async function loadRegistrations({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Registrations.list();
        registrationRows.value = Array.isArray(list) ? list : [];
        if (showStatusIfActive && SECTION.REGISTRATIONS) {
          setStatus('Registrations loaded.', 'info', 1200);
        }
      } catch (e) {
        console.error('loadRegistrations failed:', e);
        registrationRows.value = [];
      }
    }

    // --- filter menu (match your HTML: Program / Event Type / Year / Status) ---
    const regFilterDefs = [
      {
        key: 'programId',
        label: 'Program',
        type: 'select',
        options: () => Schema.Options.PROGRAM_OPTIONS,
        emptyValue: '',
      },
      {
        key: 'eventType',
        label: 'Event Type',
        type: 'select',
        options: () => Schema.Options.EVENT_TYPES,
        emptyValue: '',
      },
      { key: 'year', label: 'School Year', type: 'select', options: () => Schema.Options.YEAR_OPTIONS, emptyValue: '' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: () => Schema.Options.REG_STATUS_OPTIONS,
        emptyValue: '',
      },
    ];
    const registrationsFilterMenu = Util.Helpers.createFilterMenu(regFilterDefs);

    // --- text filter: Reg ID, event title, family id, contact names ---
    const registrationsTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const eventTitle = row?.event?.title;
      const familyId = row?.familyId;
      const childrenCt = Array.isArray(row?.children) ? row.children.length : 0;
      const parts = [row?.id, eventTitle, familyId, String(childrenCt)];
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    // debounce search a bit (same as Events/Families)
    let _searchTimer = null;
    const debouncedQuery = ref('');
    debouncedQuery.value = registrationsTextFilter.querySearch ?? '';
    watch(
      () => registrationsTextFilter.querySearch,
      (q) => {
        if (_searchTimer) clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => (debouncedQuery.value = String(q ?? '')), 200);
      },
      { immediate: true },
    );

    const filteredRegistrationRows = computed(() => {
      const byMenu = registrationsFilterMenu.applyTo(registrationRows.value);
      return registrationsTextFilter.applyTo(byMenu, debouncedQuery.value);
    });

    // Your HTML calls this "registrationPager" (singular)
    const registrationPager = Util.Helpers.createPager({ source: filteredRegistrationRows });

    // -------------------------
    // FORM STATE
    // -------------------------
    const registrationErrors = ref({});
    const registrationForm = reactive(Schema.Forms.Registrations.new());
    const editingRegistrationId = ref(null);

    // --- helpers from your app logic ---
    const isOpenEventFilter = (ev) => {
      const todayPST = new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 10);
      return (!ev?.openDate || ev?.openDate <= todayPST) && (!ev?.endDate || todayPST <= ev?.endDate);
    };
    const isCurrentSchoolYear = (ev) => Number(ev?.year) === Number(Util.Helpers.getCurrentSchoolYear());

    // Already registered check (year defaults to current)
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

    // Prereq check for an event vs a family (same year)
    function familyMetPrereqs(ev, familyId) {
      const prereqIds = Array.isArray(ev?.prerequisites)
        ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean)
        : [];
      if (prereqIds.length === 0) return true;
      if (!familyId) return false;
      const regs = registrationRows.value.filter((r) => r.familyId === familyId);
      const done = new Set(regs.map((r) => r.eventId));
      return prereqIds.every((id) => done.has(id));
    }

    // --- schema ctx hooks (exactly what the schema expects) ---
    // event options depend on family selection + prereqs
    const eventOptionsForRegistration = computed(() => {
      const familyId = (registrationForm.familyId || '').trim();
      const events = (typeof getEventRows === 'function' ? getEventRows() : []) || [];
      const base = events
        .filter(isOpenEventFilter)
        .filter(isCurrentSchoolYear)
        .filter((ev) => !alreadyRegistered({ familyId, year: ev.year, eventId: ev.id }))
        .filter((ev) => familyMetPrereqs(ev, familyId));

      // In EDIT mode, show all events to reflect the snapshot
      const list = MODE.CREATE ? base : events;
      return list.map((ev) => ({ value: ev.id, label: ev.title }));
    });

    function onRegFamilyChange(ctx) {
      // When family changes, sync parishMember (display-only) + clear dependent arrays
      const fam = (typeof getFamilyRows === 'function' ? getFamilyRows() : []).find(
        (f) => f.id === registrationForm.familyId,
      );
      registrationForm.parishMember = fam ? fam.parishMember ?? null : null;
      // You may also want to reset children/payments/notes here in CREATE
      if (MODE.CREATE) {
        registrationForm.children = [];
        registrationForm.payments = [];
        registrationForm.notes = [];
      }
    }

    function onRegEventChange(ctx) {
      const events = (typeof getEventRows === 'function' ? getEventRows() : []) || [];
      const ev = events.find((e) => e.id === registrationForm.eventId);
      const snap = ev
        ? {
            title: ev.title,
            year: ev.year,
            programId: ev.programId,
            eventType: ev.eventType,
          }
        : { title: '', year: '', programId: '', eventType: '' };
      Object.assign(registrationForm.event, snap);
    }

    function signedRegistrationOptions(ctx) {
      // Who accepted/signed — reuse your volunteers helper if provided
      const programId = registrationForm?.event?.programId || '';
      return typeof volunteersFor === 'function' ? volunteersFor(programId) : [];
    }

    function receivedByOptions(ctx) {
      const programId = registrationForm?.event?.programId || '';
      return typeof volunteersFor === 'function' ? volunteersFor(programId) : [];
    }

    function childRegistrationOptions(fieldMeta, ctx) {
      const fam = (typeof getFamilyRows === 'function' ? getFamilyRows() : []).find(
        (f) => f.id === registrationForm.familyId,
      );
      const children = Array.isArray(fam?.children) ? fam.children : [];
      return children.map((ch) => ({
        value: ch.childId || ch.id, // tolerate either fieldname
        label: Util.Format.displayChildNameAndAge(ch),
        _raw: ch, // for hydrateChildSnapshot
      }));
    }

    function hydrateChildSnapshot(fieldMeta, ctx) {
      const row = ctx?.row || {};
      const opt = (childRegistrationOptions(fieldMeta, ctx) || []).find((o) => String(o.value) === String(row.childId));
      if (!opt) return;
      const ch = opt._raw || {};
      // snapshot common fields into row (all are disabled fields in the schema)
      row.fullName = [ch.firstName, ch.middle, ch.lastName].filter(Boolean).join(' ');
      row.saintName = ch.saintName || '';
      row.dob = ch.dob || '';
      row.allergies = Array.isArray(ch.allergies) ? ch.allergies.join(', ') : ch.allergies || '';
      row.status = row.status || 'pending';
    }

    function ageGroupOptionsForRow(fieldMeta, ctx) {
      const dob = ctx?.row?.dob || '';
      const age = Util.Helpers.computeAgeByYear(dob);
      // Display-only select; we provide one option for readability
      return [{ value: String(age), label: String(age) }];
    }

    const registrationFields = Schema.Forms.Registrations({
      onRegFamilyChange,
      onRegEventChange,
      eventOptionsForRegistration: () => eventOptionsForRegistration.value,
      signedRegistrationOptions,
      childRegistrationOptions,
      hydrateChildSnapshot,
      ageGroupOptionsForRow,
      receivedByOptions,
      MODE,
    }); // schema ctx, per your definitions. :contentReference[oaicite:2]{index=2}

    // Validate interactively
    function hydrateRegistrationErrors() {
      return Schema.Forms.Registrations.validate(registrationForm, registrationErrors);
    }
    watch(() => registrationForm, hydrateRegistrationErrors, { deep: true, immediate: true });

    // Dirty tracking based on API projection
    const _apiSnapshot = ref(null);
    function snapshotRegistration() {
      try {
        _apiSnapshot.value = Mappers.Registrations.toApi(registrationForm);
      } catch {
        _apiSnapshot.value = null;
      }
    }
    const isRegistrationDirty = computed(() => {
      try {
        const now = Mappers.Registrations.toApi(registrationForm);
        return JSON.stringify(now) !== JSON.stringify(_apiSnapshot.value || {});
      } catch {
        return true;
      }
    });

    // -------------------------
    // UI ACTIONS
    // -------------------------
    function beginCreateRegistration() {
      Object.assign(registrationForm, Schema.Forms.Registrations.new());
      editingRegistrationId.value = null;
      hydrateRegistrationErrors();
      snapshotRegistration();
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.CREATE);
      setStatus('Creating new registration…', 'info', 1200);
    }

    function beginEditRegistration(apiReg) {
      if (!apiReg || !apiReg.id) {
        setStatus('Nothing to edit.', 'warn', 1500);
        return;
      }
      editingRegistrationId.value = apiReg.id;
      Object.assign(registrationForm, Schema.Forms.Registrations.new(), Mappers.Registrations.toUi(apiReg || {}));
      hydrateRegistrationErrors();
      snapshotRegistration();
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiReg.id}`, 'info', 1200);
    }

    async function submitRegistrationForm() {
      if (isReadOnly?.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }
      if (!hydrateRegistrationErrors()) {
        setStatus('Please fix errors before saving.', 'error', 2500);
        return;
      }
      if (!isRegistrationDirty.value) {
        setStatus('No changes to save.', 'warn', 1500);
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
        await loadRegistrations(); // refresh list we own
        await nextTick();
        goBackSection();
      } catch (e) {
        console.error(e);
        setStatus('Failed to save Registration.', 'error', 3000);
      }
    }

    // Row helpers (children / payments / notes)
    function ensureArray(target, key) {
      if (!Array.isArray(target[key])) target[key] = [];
      return target[key];
    }
    function addRegChild() {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'children').push(
        Schema.Forms.Registrations.newChild({ ctx: { form: registrationForm } }),
      );
      ensureArray(registrationErrors.value, 'children').push({});
    }
    function removeRegChild(i) {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'children').splice(i, 1);
      ensureArray(registrationErrors.value, 'children').splice(i, 1);
    }
    function addRegPayment() {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'payments').push(
        Schema.Forms.Registrations.newPayment({ ctx: { form: registrationForm } }),
      );
      ensureArray(registrationErrors.value, 'payments').push({});
    }
    function removeRegPayment(i) {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'payments').splice(i, 1);
      ensureArray(registrationErrors.value, 'payments').splice(i, 1);
    }
    function addRegNote() {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'notes').push(
        Schema.Forms.Registrations.newNote({ ctx: { form: registrationForm } }),
      );
      ensureArray(registrationErrors.value, 'notes').push({});
    }
    function removeRegNote(i) {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'notes').splice(i, 1);
      ensureArray(registrationErrors.value, 'notes').splice(i, 1);
    }

    // Expose everything your templates will need
    return {
      // list
      registrationRows,
      registrationsFilterMenu,
      registrationsTextFilter,
      filteredRegistrationRows,
      registrationPager,
      loadRegistrations,

      // form
      registrationForm,
      registrationErrors,
      registrationFields,
      isRegistrationDirty,
      beginCreateRegistration,
      beginEditRegistration,
      submitRegistrationForm,
      saveRegistration, // ok to expose if your UI calls it directly

      // helpers needed elsewhere (e.g. Families buttons)
      alreadyRegistered,

      // row helpers
      addRegChild,
      removeRegChild,
      addRegPayment,
      removeRegPayment,
      addRegNote,
      removeRegNote,
    };
  }

  Controllers.Registrations = { create: createRegistrationsController };
})(typeof window !== 'undefined' ? window : globalThis);
