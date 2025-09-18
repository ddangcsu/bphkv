/* eslint-env browser, es2021 */
/* global Vue, API, Schema, Mappers, Util */
(function attachRegistrationsController(global) {
  'use strict';

  const Controllers = global.Controllers || (global.Controllers = {});
  const { ref, reactive, computed, watch, nextTick } = Vue;

  /**
   * Registrations controller (R1)
   * Owns form state + hydrations; ready to own list/filters too.
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

    // lightweight deps to avoid circular init (pass these in R2)
    getEventRows = () => [],
    getFamilyRows = () => [],
    volunteersFor, // optional: (programId) => [{value,label}, ...]
    openReceiptById, // optional: (id) => void
  }) {
    // -------------------------
    // LIST (full: rows + filters + pager)
    // -------------------------
    const registrationRows = ref([]);
    async function loadRegistrations({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Registrations.list();
        registrationRows.value = Array.isArray(list) ? list : [];
        if (showStatusIfActive && SECTION?.REGISTRATIONS) {
          setStatus('Registrations loaded.', 'info', 1200);
        }
      } catch (e) {
        console.error('loadRegistrations failed:', e);
        registrationRows.value = [];
      }
    }

    // Filters (Program / Event Type / Year) — matches your app.js
    const registrationsFilterMenu = Util.Helpers.createFilterMenu([
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
    ]);

    // Text filter (id, familyId, event.title, contacts, payments.receiptNo, children.fullName)
    const registrationsTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const parts = [row?.id, row?.familyId, row?.event?.title];
      (row?.contacts || []).forEach((c) => parts.push(c?.name, Util.Format.getDigitOnly(c?.phone)));
      (row?.payments || []).forEach((p) => parts.push(p?.receiptNo));
      (row?.children || []).forEach((c) => parts.push(c?.fullName));
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    // Debounce search for snappier typing
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

    // Pager — your template expects "registrationPager"
    const registrationPager = Util.Helpers.createPager({ source: filteredRegistrationRows });

    // -------------------------
    // FORM
    // -------------------------
    const registrationErrors = ref({});
    const registrationForm = reactive(Schema.Forms.Registrations.new());
    const editingRegistrationId = ref(null);
    const _hydrating = ref(false);

    // ---- helpers from your current logic (ported) ----
    const LEVEL = ENUMS.LEVEL;
    const METHOD = ENUMS.METHOD || {}; // for WAIVED/CASH, etc.
    const FEE = ENUMS.FEE || {};

    // Treat Y/YES/true/1 as "yes"
    function isYes(v) {
      if (v === true || v === 1) return true;
      const s = String(v ?? '')
        .trim()
        .toLowerCase();
      return s === 'y' || s === 'yes' || s === 'true' || s === '1';
    }

    // (a) Event snapshot (title/year/programId/eventType)
    function hydrateRegistrationEvent(ctx = { form: registrationForm }) {
      const form = ctx.form;
      const ev = (getEventRows() || []).find((e) => e.id === form.eventId);
      const snap = ev
        ? { title: ev.title, year: ev.year, programId: ev.programId, eventType: ev.eventType }
        : { title: '', year: '', programId: '', eventType: '' };
      Object.assign(form.event, snap);
    }

    // (b) Contacts snapshot: take two parents (Father → Mother → Guardian)
    function hydrateRegistrationContacts(ctx = { form: registrationForm }) {
      const form = ctx.form;
      const fam = familyById(form.familyId);
      const parents = pickTwoParents(fam); // you already have this prioritized sorter
      form.contacts = [];
      for (const c of parents) {
        form.contacts.push(
          Schema.Forms.Registrations.newContact({
            overrides: {
              name: [c.lastName, [c.firstName, c.middle].filter(Boolean).join(' ')].filter(Boolean).join(', '),
              relationship: c.relationship || '',
              phone: Util.Format.formatPhone(c.phone || ''),
            },
          }),
        );
      }
    }

    // (c) Payments: merge from event fees (skip NPM_FEE for parish members), preserve user fields
    function hydrateRegistrationPayments(ctx = { form: registrationForm }) {
      const form = ctx.form;
      const ev = (getEventRows() || []).find((e) => e.id === form.eventId);
      if (!ev) return;

      const fam = familyById(form.familyId);
      const parishMember = isYes(fam?.parishMember);
      const fees = Array.isArray(ev?.fees) ? ev.fees : [];

      // Build a map of current payments by fee code (stringified)
      const byCode = new Map();
      (form.payments || (form.payments = [])).forEach((p) => byCode.set(String(p.code ?? ''), p));

      // Quantity rule: PER_CHILD ⇒ number of selected children; else 1
      const childCount = Array.isArray(form.children) ? form.children.filter((r) => !!r?.childId).length : 0;
      const qty = ev.level === LEVEL.PER_CHILD ? childCount : 1;

      for (const fee of fees) {
        const code = String(fee?.code ?? '');
        // Parish member rule: skip non-parish-member fee for members
        if (parishMember && FEE?.NPM_FEE && code === String(FEE.NPM_FEE)) continue;

        const unit = Number(fee?.amount) || 0;
        const existing = byCode.get(code);

        if (existing) {
          // Update only computed fields; DO NOT reset user-entered fields
          existing.unitAmount = unit;
          existing.quantity = qty;
          existing.amount = Math.round(unit * qty * 100) / 100;
        } else {
          // Add a new payment row for this fee
          const overrides = {
            code,
            unitAmount: unit,
            quantity: qty,
            amount: Math.round(unit * qty * 100) / 100,
            method: '',
            txnRef: '',
            receiptNo: '',
            receivedBy: '',
          };
          const row = Schema.Forms.Registrations.newPayment({ overrides });
          form.payments.push(row);
        }
      }
    }

    // tiny helper: ensure at least one blank child row for PER_CHILD
    function ensureOneChildRow(form) {
      if (!Array.isArray(form.children)) form.children = [];
      if (form.children.length === 0) {
        form.children.push(Schema.Forms.Registrations.newChild({}));
        if (!Array.isArray(registrationErrors.value.children)) {
          registrationErrors.value.children = [];
        }
        registrationErrors.value.children.push({});
      }
    }

    const isOpenEventFilter = (ev) => {
      if (Util.Helpers.isEmpty(ev)) return false;
      const now = Util.Date.isoNowLocal().slice(0, 10);
      const start = Util.Date.dateStringToIso(ev.openDate);
      const end = Util.Date.dateStringToIso(ev.endDate);
      return now >= start && now <= end;
    };

    const isCurrentSchoolYear = (ev) => Number(ev?.year) === Number(Util.Helpers.getCurrentSchoolYear());

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

    function familyMetPrereqs(ev, familyId) {
      const prereqIds = Array.isArray(ev?.prerequisites)
        ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean)
        : [];
      if (prereqIds.length === 0) return true;
      if (!familyId) return false;
      const done = new Set(registrationRows.value.filter((r) => r.familyId === familyId).map((r) => r.eventId));
      return prereqIds.every((id) => done.has(id));
    }

    // Common finds used across helpers
    const selectedEvent = computed(() => (getEventRows() || []).find((e) => e.id === registrationForm.eventId) || null);
    const selectedEventLevel = computed(() => selectedEvent.value?.level || '');
    const familyById = (id) => (getFamilyRows() || []).find((f) => f.id === id) || null;

    // Quick-register helpers (admin / tntt)
    const PROGRAM = ENUMS.PROGRAM;
    const EVENT = ENUMS.EVENT;
    const adminRegistration = computed(
      () =>
        (getEventRows() || []).find(
          (e) => e.programId === PROGRAM.BPH && e.eventType === EVENT.ADMIN && isOpenEventFilter(e),
        ) || null,
    );
    const tnttRegistration = computed(
      () =>
        (getEventRows() || []).find(
          (e) => e.programId === PROGRAM.TNTT && e.eventType === EVENT.REGISTRATION && isOpenEventFilter(e),
        ) || null,
    );
    function getRegistrationFor(familyId, eventId) {
      return registrationRows.value.find((r) => r.familyId === familyId && r.eventId === eventId) || null;
    }
    function registerAdminForFamily(f) {
      if (!f?.id || !adminRegistration.value) return;
      if (alreadyRegistered({ familyId: f.id, programId: PROGRAM.BPH, eventType: EVENT.ADMIN })) {
        const reg = getRegistrationFor(f.id, adminRegistration.value.id);
        if (reg) beginEditRegistration(reg);
      } else {
        beginCreateRegistration();
        registrationForm.familyId = f.id;
        registrationForm.eventId = adminRegistration.value.id;
        onRegFamilyChange({ form: registrationForm });
        onRegEventChange({ form: registrationForm });
      }
    }
    function registerTNTTForFamily(f) {
      if (!f?.id || !tnttRegistration.value) return;
      if (alreadyRegistered({ familyId: f.id, programId: PROGRAM.TNTT, eventType: EVENT.REGISTRATION })) {
        const reg = getRegistrationFor(f.id, tnttRegistration.value.id);
        if (reg) beginEditRegistration(reg);
      } else if (alreadyRegistered({ familyId: f.id, programId: PROGRAM.BPH, eventType: EVENT.ADMIN })) {
        beginCreateRegistration();
        registrationForm.familyId = f.id;
        registrationForm.eventId = tnttRegistration.value.id;
        onRegFamilyChange({ form: registrationForm });
        onRegEventChange({ form: registrationForm });
      } else {
        setStatus('Must already register for ADMIN event first', 'error', 3000);
      }
    }

    // Public: get a single { value: dob, label } option for the given DOB + program
    function ageGroupOptionsByProgram(dob, programId) {
      const age = Util.Helpers.computeAgeByYear(dob);
      if (age == null) return [];
      // If you created PROGRAM_STABLE or similar, prefer that constant. Fallback 'TNTT'.
      if (programId === PROGRAM?.TNTT) {
        const label = Util.Format.ageGroupLabelTNTT(age);
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

    // ---- schema ctx: options & hooks (what your schema expects) ----
    const eventOptionsForRegistration = computed(() => {
      const familyId = (registrationForm.familyId || '').trim();
      if (!familyId && MODE.CREATE) return [];
      const events = getEventRows() || [];
      const base = events
        .filter(isOpenEventFilter)
        .filter(isCurrentSchoolYear)
        .filter((ev) => !alreadyRegistered({ familyId, year: ev.year, eventId: ev.id }))
        .filter((ev) => familyMetPrereqs(ev, familyId));
      const list = MODE.CREATE ? base : events;
      return list.map((ev) => ({ value: ev.id, label: ev.title }));
    });

    function receivedByOptions(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const programId = selectedEvent.value?.programId || form?.event?.programId || '';
      if (typeof volunteersFor === 'function') return volunteersFor(programId) || [];
      // fallback to all volunteers from options
      const list = Schema.Options.VOLUNTEERS_OPTIONS || [];
      return list.filter((v) => !v.program || String(v.program) === String(programId));
    }

    function signedRegistrationOptions(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const fam = familyById(form.familyId);
      const list = (fam?.contacts || []).map((c) => {
        const name = [c.lastName, [c.firstName, c.middle].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        return { value: name, label: `${name} (${c.relationship})` };
      });
      return list;
    }

    // selOpt for childId (understands { form, index })
    function childRegistrationOptions(_fieldMeta, ctx = {}) {
      const idx = Number.isInteger(ctx.index) ? ctx.index : -1;
      const form = ctx?.form || registrationForm;

      // 1) no family selected → no options
      const famId = String(form?.familyId || '').trim();
      if (!famId) return [];

      // 2) event not selected or not PER_CHILD → no options
      const ev = selectedEvent.value;
      if (!ev || ev.level !== LEVEL.PER_CHILD) return [];

      // family & anti-duplication set
      const fam = familyById(famId);
      if (!fam) return [];
      const chosenElsewhere = new Set(
        (form?.children || [])
          .map((c, i) => (i === idx ? null : c?.childId))
          .filter(Boolean)
          .map(String),
      );

      // collect prereq ids for this event
      const allEvents = getEventRows() || [];
      const prereqIds = Array.isArray(ev?.prerequisites)
        ? ev.prerequisites.map((p) => (typeof p === 'string' ? p : p?.eventId)).filter(Boolean)
        : [];
      const prereqEvents = prereqIds.map((id) => allEvents.find((e) => e.id === id)).filter(Boolean);
      const hasPCPrereq = prereqEvents.some((p) => p.level === LEVEL.PER_CHILD);

      // 3a) PER_CHILD event with no PC prereq (or only PF prereqs) → all children for family
      if (!hasPCPrereq) {
        return (fam.children || [])
          .filter((c) => !chosenElsewhere.has(String(c.childId)))
          .map((c) => ({ value: String(c.childId), label: Util.Format.displayChildNameAndAge(c) }));
      }

      // 3b) Any PC prereq → only children that registered that PC prereq this year
      const pcPrereqIds = new Set(prereqEvents.filter((p) => p.level === LEVEL.PER_CHILD).map((p) => p.id));
      const eligibleChildIds = new Set(
        registrationRows.value
          .filter((r) => r.familyId === famId && pcPrereqIds.has(r.eventId) && isCurrentSchoolYear(r.event))
          .flatMap((r) => (r.children || []).map((ch) => String(ch.childId)).filter(Boolean)),
      );

      return (fam.children || [])
        .filter((c) => eligibleChildIds.has(String(c.childId)) && !chosenElsewhere.has(String(c.childId)))
        .map((c) => ({ value: String(c.childId), label: Util.Format.displayChildNameAndAge(c) }));
    }

    // Available children for the whole form (exclude all currently picked children)
    const availableChildOptions = Vue.computed(() =>
      childRegistrationOptions(null, { form: registrationForm, index: -1 }),
    );

    function computeQuantity(ev) {
      return ev?.level === LEVEL.PER_CHILD
        ? Math.max(1, (registrationForm.children || []).filter((c) => c.childId).length)
        : 1;
    }

    // Recalculate the quantity and the total amount.
    function recomputePayments(ctx = { form: registrationForm }) {
      const form = ctx?.form || {};
      const qty = computeQuantity(selectedEvent.value);
      (form.payments || []).forEach((p) => {
        p.quantity = qty;
        const unit = Number(p.unitAmount || 0);
        p.amount = p.method === ENUMS.METHOD.WAIVED ? 0 : Math.round(unit * qty * 100) / 100;
      });
    }

    function hydrateChildSnapshot(_fieldMeta, ctx = {}) {
      const form = ctx?.form || registrationForm;
      const row = ctx?.row;
      if (!row) return;

      const fam = familyById(form?.familyId);
      const ch = (fam?.children || []).find((c) => c.childId === row.childId);
      if (!ch) return;

      // Match original display + data shapes
      row.fullName = [ch.lastName, [ch.firstName, ch.middle].join(' ')].join(', ');
      row.saintName = ch.saintName;
      row.dob = ch.dob;
      row.allergies = Array.isArray(ch.allergies) ? ch.allergies.slice() : [];
      row.status = row.status || 'pending';

      // Keep payments in sync with selected children
      recomputePayments(ctx);
    }

    // Rank relationships so we can sort parent contacts predictably
    function relationshipRank(relationshipRaw) {
      const rel = String(relationshipRaw || '')
        .trim()
        .toLowerCase();
      // tweak this order anytime; lower number = higher priority
      switch (rel) {
        case 'father':
          return 1;
        case 'mother':
          return 2;
        case 'guardian':
          return 3;
        default:
          return 99; // everything else
      }
    }

    function compareContactsByPriority(a, b) {
      const ar = relationshipRank(a?.relationship);
      const br = relationshipRank(b?.relationship);
      if (ar !== br) return ar - br;
    }

    function pickTwoParents(family) {
      const allContacts = Array.isArray(family?.contacts) ? family.contacts.slice() : [];
      if (!allContacts.length) return [];

      const isParentish = (rel) => Schema.Options.PARENTS.has(String(rel || '').trim());
      const parentContacts = allContacts.filter((c) => isParentish(c?.relationship)).sort(compareContactsByPriority);

      // If we have two+ parent contacts, take the top two and return
      if (parentContacts.length >= 2) {
        return parentContacts.slice(0, 2);
      }

      // Otherwise, include the best non-parent contacts as fallback (also sorted)
      const nonParentContacts = allContacts
        .filter((c) => !isParentish(c?.relationship))
        .sort(compareContactsByPriority);

      return [...parentContacts, ...nonParentContacts].slice(0, 2);
    }

    function hydratePrimaryContactsIntoForm(family, ctx) {
      const form = ctx?.form || registrationForm;
      form.contacts = [];
      const two = pickTwoParents(family);
      for (const c of two) {
        const overrides = {
          name: [c.lastName, [c.firstName, c.middle].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          relationship: c.relationship || '',
          phone: Util.Format.formatPhone(c.phone || ''),
        };
        form.contacts.push(Schema.Forms.Registrations.newContact({ overrides }));
      }
    }

    // ---- hooks wired to schema (family & event changes) ----
    function onRegFamilyChange(ctx = { form: registrationForm }) {
      const form = ctx.form;
      // Snapshot (two) contacts, prioritized Father/Mother/Guardian
      hydrateRegistrationContacts(ctx);

      // Remove any already-chosen children that don't belong to this family
      const fam = familyById(form.familyId);

      // Snapshot parishMember status
      form.parishMember = !!fam?.parishMember;

      // Remove all children if any selected child doesn't belong to the family
      const famChildIds = new Set((fam?.children || []).map((c) => String(c.childId)));
      const currentRows = Array.isArray(form.children) ? form.children : [];

      const hasForeignChild = currentRows.some((row) => {
        const id = row?.childId;
        return id && !famChildIds.has(String(id));
      });

      if (hasForeignChild) {
        // Clear everything (your requested behavior)
        form.children = [Schema.Forms.Registrations.newChild()];
      } else {
        // Keep existing rows (no foreign child found)
        form.children = currentRows;
      }
      // keep errors array aligned
      registrationErrors.value.children = (form.children || []).map(() => ({}));

      // Recompute/merge payments in case quantity depends on children
      hydrateRegistrationPayments(ctx);
    }

    function onRegEventChange(ctx = { form: registrationForm }) {
      const form = ctx.form;
      // (a) Snapshot event data
      hydrateRegistrationEvent(ctx);
      const ev = (getEventRows() || []).find((e) => e.id === form.eventId);

      // (c) If per-child event, ensure one empty row exists at start
      if (ev?.level === LEVEL.PER_CHILD) {
        ensureOneChildRow(form);
      }

      // (b) Hydrate/merge payments from event fees (preserve user fields)
      hydrateRegistrationPayments(ctx);
    }

    // ---- install schema with our ctx ----
    const registrationFields = Schema.Forms.Registrations({
      onRegFamilyChange,
      onRegEventChange,
      eventOptionsForRegistration,
      signedRegistrationOptions,
      childRegistrationOptions,
      hydrateChildSnapshot,
      ageGroupOptionsForRow,
      receivedByOptions,
      MODE,
    }); // field meta + ctx as your schema expects. :contentReference[oaicite:2]{index=2}

    // ---- validation + dirtiness ----
    function validateRegistration() {
      return Schema.Forms.Registrations.validate(registrationForm, registrationErrors);
    }
    watch(() => registrationForm, validateRegistration, { deep: true, immediate: true });

    const _apiSnapshot = ref(null);
    function snapshotRegistration() {
      try {
        _apiSnapshot.value = Mappers.Registrations.toApi(registrationForm);
      } catch {
        _apiSnapshot.value = null;
      }
    }
    const isRegistrationDirty = computed(() => {
      if (_hydrating.value) return false;
      try {
        const now = Mappers.Registrations.toApi(registrationForm);
        return JSON.stringify(now) !== JSON.stringify(_apiSnapshot.value || {});
      } catch {
        return true;
      }
    });

    // ---- UI actions ----
    async function beginCreateRegistration() {
      _hydrating.value = true;
      Object.assign(registrationForm, Schema.Forms.Registrations.new());
      editingRegistrationId.value = null;
      validateRegistration();
      await nextTick();
      snapshotRegistration();
      _hydrating.value = false;
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.CREATE);
      setStatus('Creating new registration…', 'info', 1200);
    }

    async function beginEditRegistration(apiReg) {
      if (!apiReg || !apiReg.id) {
        setStatus('Nothing to edit.', 'warn', 1500);
        return;
      }
      _hydrating.value = true;
      editingRegistrationId.value = apiReg.id;
      Object.assign(registrationForm, Schema.Forms.Registrations.new(), Mappers.Registrations.toUi(apiReg || {}));
      onRegFamilyChange({ form: registrationForm });
      onRegEventChange({ form: registrationForm });
      validateRegistration();
      await nextTick();
      snapshotRegistration();
      _hydrating.value = false;
      switchSection(SECTION_NAMES.REGISTRATIONS, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiReg.id}`, 'info', 1200);
    }

    async function submitRegistrationForm({ openReceiptAfter = false } = {}) {
      if (isReadOnly?.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }
      if (!validateRegistration()) {
        setStatus('Please fix errors before saving.', 'error', 2500);
        return;
      }
      if (!isRegistrationDirty.value) {
        setStatus('No changes to save.', 'warn', 1500);
        return;
      }
      setStatus('Saving Registration...');
      const payload = Mappers.Registrations.toApi(registrationForm);
      const nowLocal = Util.Date.isoNowLocal();
      let result;
      try {
        if (MODE.CREATE) {
          payload.createdAt = registrationForm.createdAt ? registrationForm.createdAt : nowLocal;
          payload.updatedAt = nowLocal;
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
        // Switch to Edit mode only if we got a valid id back
        if (result && result.id) {
          beginEditRegistration(Mappers.Registrations.toUi(result));
          if (openReceiptAfter && typeof openReceiptById === 'function') {
            nextTick(() => openReceiptById(result.id));
          }
        }
      } catch (e) {
        console.error(e);
        setStatus('Failed to save Registration.', 'error', 3000);
      }
    }

    // row helpers
    function ensureArray(target, key) {
      if (!Array.isArray(target[key])) target[key] = [];
      return target[key];
    }
    function addRegChild() {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'children').push(Schema.Forms.Registrations.newChild({}));
      ensureArray(registrationErrors.value, 'children').push({});
    }
    function removeRegChild(i) {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'children').splice(i, 1);
      ensureArray(registrationErrors.value, 'children').splice(i, 1);
    }
    function addRegPayment() {
      if (isReadOnly?.value) return;
      const row = Schema.Forms.Registrations.newPayment({});
      ensureArray(registrationForm, 'payments').push(row);
      ensureArray(registrationErrors.value, 'payments').push({});
    }
    function removeRegPayment(i) {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'payments').splice(i, 1);
      ensureArray(registrationErrors.value, 'payments').splice(i, 1);
    }
    function addRegNote() {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'notes').push(Schema.Forms.Registrations.newNote({}));
      ensureArray(registrationErrors.value, 'notes').push({});
    }
    function removeRegNote(i) {
      if (isReadOnly?.value) return;
      ensureArray(registrationForm, 'notes').splice(i, 1);
      ensureArray(registrationErrors.value, 'notes').splice(i, 1);
    }

    // keep familyId/eventId triggers consistent even if set programmatically
    watch(
      () => registrationForm.familyId,
      (nv, ov) => {
        if (_hydrating.value) return;
        if (String(nv ?? '') === String(ov ?? '')) return;
        onRegFamilyChange({ form: registrationForm });
      },
    );

    watch(
      () => registrationForm.children.map((c) => c.childId).join(','),
      () => {
        recomputePayments({ form: registrationForm });
      },
    );

    // expose what we need
    return {
      // list
      selectedEvent,
      selectedEventLevel,
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

      // row helpers
      addRegChild,
      removeRegChild,
      addRegPayment,
      removeRegPayment,
      addRegNote,
      removeRegNote,

      // quick-register helpers + lookups used by Families table
      alreadyRegistered,
      adminRegistration,
      tnttRegistration,
      registerAdminForFamily,
      registerTNTTForFamily,

      // others
      familyById,
      availableChildOptions,
    };
  }

  Controllers.Registrations = { create: createRegistrationsController };
})(typeof window !== 'undefined' ? window : globalThis);
