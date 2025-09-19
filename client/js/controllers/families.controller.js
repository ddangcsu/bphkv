/* eslint-env browser, es2021 */
/* global Vue, API, Schema, Mappers, Util */
(function attachFamiliesController(global) {
  'use strict';

  const Controllers = global.Controllers || (global.Controllers = {});
  const { ref, reactive, computed, watch, nextTick } = Vue;

  function createFamiliesController({
    setStatus,
    switchSection,
    goBackSection,
    MODE,
    MODE_NAMES,
    SECTION,
    SECTION_NAMES,
    isReadOnly,
    getRegistrationRows, // () => registrationRows.value (provided by app.js)
  }) {
    // -------------------------
    // LIST STATE (owned here)
    // -------------------------
    const familyRows = ref([]);

    function familyHasRegistrationForState(familyId, state) {
      const list = (typeof getRegistrationRows === 'function' ? getRegistrationRows() : []) || [];
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
        matches: (familyRow, selectedMode, state) => {
          if (!selectedMode) return true;
          const has = familyHasRegistrationForState(familyRow.id, state);
          return selectedMode === 'registered' ? has : !has;
        },
      },
    ];
    const familiesFilterMenu = Util.Helpers.createFilterMenu(familyFilterDefs);

    const familiesTextFilter = Util.Helpers.createTextFilter((row, raw, terms, utils) => {
      const parts = [row.id, row.parishNumber, row.address?.city];
      (row.contacts || []).forEach((c) => {
        parts.push(c.lastName, c.firstName, c.middle, c.email, Util.Format.getDigitOnly(c.phone));
      });
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    // --- debounce the querySearch like we did for Events ---
    let _familiesSearchTimer = null;
    const debouncedQuery = ref('');

    // initialize
    debouncedQuery.value = familiesTextFilter.querySearch ?? '';
    watch(
      () => familiesTextFilter.querySearch,
      (q) => {
        const next = String(q ?? '');
        if (_familiesSearchTimer) clearTimeout(_familiesSearchTimer);
        _familiesSearchTimer = setTimeout(() => {
          debouncedQuery.value = next;
        }, 200); // snappy, matches Events
      },
      { immediate: true },
    );

    const filteredFamilyRows = computed(() => {
      const byMenu = familiesFilterMenu.applyTo(familyRows.value);
      // IMPORTANT: pass the debounced query override
      return familiesTextFilter.applyTo(byMenu, debouncedQuery.value);
    });
    const familiesPager = Util.Helpers.createPager({ source: filteredFamilyRows }); // plural

    const contactDisplay = (f, one = false) => {
      const contacts = Array.isArray(f?.contacts) ? f.contacts : [];
      if (!contacts.length) return '—';
      const isParentish = (c) => Schema.Options.PARENTS.has((c.relationship || '').trim());
      const prioritized = contacts.filter(isParentish);
      const others = contacts.filter((c) => !isParentish(c));
      const pick = [...prioritized, ...others].slice(0, 2);
      const result = pick.map((c) =>
        'lastName' in c
          ? `${c.lastName}, ${c.firstName}${c.middle ? ' ' + c.middle : ''} ${Util.Format.maskLast4(c.phone)}`
          : `${c.name} ${Util.Format.maskLast4(c.phone)}`,
      );
      return one ? result[0] : result.join(' / ');
    };

    async function loadFamilies({ showStatusIfActive = false } = {}) {
      try {
        const list = await API.Families.list();
        familyRows.value = Array.isArray(list) ? list : [];
        if (showStatusIfActive && SECTION.FAMILIES) setStatus('Families loaded.', 'info', 1200);
      } catch {
        setStatus('Error encountered loading Families list', 'error', 3000);
        familyRows.value = [];
      }
    }

    const familyDatalistOptions = Vue.computed(() =>
      (familyRows.value || []).map((f) => {
        const label = [contactDisplay ? contactDisplay(f, false) : '', f.address?.city].filter(Boolean).join(' — ');
        return { value: f.id, label };
      }),
    );

    // -------------------------
    // FORM STATE (unchanged from earlier F1)
    // -------------------------
    const familyErrors = ref({});
    const familyForm = reactive(Schema.Forms.Families.new());
    const editingFamilyId = ref(null);

    // Schema ctx
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
      return s;
    });
    function needsNameException({ row }) {
      const value = String(row?.lastName || '')
        .trim()
        .toLowerCase();
      return !parentLastNameSet.value.has(value);
    }
    const familyFields = Schema.Forms.Families({ needsNameException, parentLastNameSet });

    function hydrateFamilyErrors() {
      return Schema.Forms.Families.validate(familyForm, familyErrors);
    }
    function normalizeNameExceptions() {
      for (const child of familyForm.children || []) {
        if (!needsNameException({ form: familyForm, row: child })) {
          if (child.isNameException) child.isNameException = false;
          if (child.exceptionNotes) child.exceptionNotes = '';
        }
      }
    }
    watch(
      () => familyForm,
      () => {
        normalizeNameExceptions();
        hydrateFamilyErrors();
      },
      { deep: true, immediate: true },
    );

    // Dirty (API-projected snapshot)
    const _apiSnapshot = ref(null);
    function snapshotFamily() {
      try {
        _apiSnapshot.value = Mappers.Families.toApi(familyForm);
      } catch {
        _apiSnapshot.value = null;
      }
    }
    const isFamilyDirty = computed(() => {
      try {
        return JSON.stringify(Mappers.Families.toApi(familyForm)) !== JSON.stringify(_apiSnapshot.value || {});
      } catch {
        return true;
      }
    });

    // Begin create/edit
    function beginCreateFamily() {
      Object.assign(familyForm, Schema.Forms.Families.new());
      editingFamilyId.value = null;
      hydrateFamilyErrors();
      snapshotFamily();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.CREATE);
      setStatus('Creating new family…', 'info', 1200);
    }
    function beginEditFamily(apiFamily) {
      if (!apiFamily || !apiFamily.id) {
        setStatus('Nothing to edit.', 'warn', 1500);
        return;
      }
      editingFamilyId.value = apiFamily.id;
      Object.assign(familyForm, Schema.Forms.Families.new(), Mappers.Families.toUi(apiFamily || {}));
      hydrateFamilyErrors();
      snapshotFamily();
      switchSection(SECTION_NAMES.FAMILIES, MODE_NAMES.EDIT);
      setStatus(`Editing ${apiFamily.id}`, 'info', 1200);
    }

    // Save
    async function submitFamilyForm() {
      if (isReadOnly?.value) {
        setStatus('Read-only mode: cannot save.', 'warn', 1800);
        return;
      }
      if (!hydrateFamilyErrors()) {
        setStatus('Please fix errors before trying to save', 'error', 3500);
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
      const nowLocal = Util.Date.isoNowLocal();
      payload.updatedAt = nowLocal;
      payload.createdAt = familyForm.createdAt ? familyForm.createdAt : nowLocal;
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
        await loadFamilies(); // refresh the list we own
        await nextTick();
        goBackSection();
      } catch (e) {
        setStatus('Create failed.', 'error', 3000);
        console.error(e);
      }
    }

    // Row helpers
    function ensureArray(target, key) {
      if (!Array.isArray(target[key])) target[key] = [];
      return target[key];
    }
    function addFamilyContact() {
      if (isReadOnly?.value) return;
      ensureArray(familyForm, 'contacts').push(Schema.Forms.Families.newContact());
      ensureArray(familyErrors.value, 'contacts').push({});
    }
    function removeFamilyContact(i) {
      if (isReadOnly?.value) return;
      ensureArray(familyForm, 'contacts').splice(i, 1);
      ensureArray(familyErrors.value, 'contacts').splice(i, 1);
    }
    function addFamilyChild() {
      if (isReadOnly?.value) return;
      ensureArray(familyForm, 'children').push(Schema.Forms.Families.newChild());
      ensureArray(familyErrors.value, 'children').push({});
    }
    function removeFamilyChild(i) {
      if (isReadOnly?.value) return;
      ensureArray(familyForm, 'children').splice(i, 1);
      ensureArray(familyErrors.value, 'children').splice(i, 1);
    }
    function addFamilyNote() {
      if (isReadOnly?.value) return;
      ensureArray(familyForm, 'notes').push(Schema.Forms.Families.newNote());
      ensureArray(familyErrors.value, 'notes').push({});
    }
    function removeFamilyNote(i) {
      if (isReadOnly?.value) return;
      ensureArray(familyForm, 'notes').splice(i, 1);
      ensureArray(familyErrors.value, 'notes').splice(i, 1);
    }

    return {
      // list
      familyRows,
      familiesFilterMenu,
      familiesTextFilter,
      filteredFamilyRows,
      familiesPager,
      contactDisplay,
      familyDatalistOptions,
      loadFamilies,

      // form
      familyForm,
      familyErrors,
      familyFields,
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

      // others
      parentLastNameSet,
    };
  }

  Controllers.Families = { create: createFamiliesController };
})(typeof window !== 'undefined' ? window : globalThis);
