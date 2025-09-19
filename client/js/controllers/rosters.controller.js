/* eslint-env browser, es2021 */
/* global Vue, Util, Schema, ENUMS */
(function attachRostersController(global) {
  'use strict';
  const Controllers = (global.Controllers ||= {});
  const { ref, computed, nextTick } = Vue;

  function createRostersController({
    // required hooks from app
    getEventRows = () => [],
    getRegistrationRows = () => [],
    familyById = () => null,
    ageGroupLabelTNTT = (n) => n,
    setStatus = () => {},
  } = {}) {
    const PROGRAM = ENUMS.PROGRAM;
    const EVENT = ENUMS.EVENT;
    const LEVEL = ENUMS.LEVEL;

    // ---- Options for filters (mirror app.js)
    const programOptionsForRoster = computed(() =>
      (Schema.Options.PROGRAM_OPTIONS || []).filter((p) => p.value !== PROGRAM.BPH),
    );
    const eventTypeOptionsForRoster = computed(() =>
      (Schema.Options.EVENT_TYPES || []).filter((t) => t.value !== EVENT.ADMIN),
    );
    const ageOptions = function (/* program */) {
      const arr = [];
      for (let i = 7; i < 18; i++) arr.push(i);
      return arr.map((i) => ({ value: i, label: i }));
    };

    // ---- Rows (paid-only; explode per child for PC events)
    const rosterRows = computed(() =>
      (getRegistrationRows() || [])
        .filter((r) => r.status === 'paid')
        .flatMap((r) =>
          (r.children || []).map((ch) => {
            const ev = r.event || {};
            const age = Util.Helpers.computeAgeByYear(ch.dob);
            return {
              registrationId: r.id,
              eventId: r.eventId,
              eventType: ev.eventType,
              eventTitle: ev.title,
              programId: ev.programId,
              year: ev.year,
              familyId: r.familyId,
              childId: ch.childId,
              saintName: ch.saintName,
              fullName: ch.fullName,
              dob: ch.dob,
              age,
              grade: ev.programId === PROGRAM.TNTT ? ageGroupLabelTNTT(age) : '-',
              allergies: (Array.isArray(ch.allergies) ? ch.allergies : []).join(', '),
            };
          }),
        ),
    );

    // ---- Filters (exact def from app.js, but fixing the small "rosterFilter" reference bug)
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
        options: (_fMeta, ctx) => {
          const { programId, year, eventType } = ctx?.state || {};
          return (getEventRows() || [])
            .filter(
              (ev) =>
                (!programId || ev.programId === programId) &&
                (!year || Number(ev.year) === Number(year)) &&
                (!eventType || ev.eventType === eventType) &&
                ev.level === LEVEL.PER_CHILD,
            )
            .map((ev) => ({ value: ev.id, label: ev.title }));
        },
      },
      {
        key: 'age',
        label: 'Age',
        type: 'select',
        options: (_fMeta, ctx) => {
          const { programId } = ctx?.state || {};
          return ageOptions(programId);
        },
        matches: (row, selected) => (!selected ? true : Number(row?.age) === Number(selected)),
      },
      {
        key: 'allergies',
        label: 'Allergies',
        type: 'select',
        options: () => [
          { value: 'yes', label: 'Has Food Allergies' },
          { value: 'no', label: 'No Allergies' },
        ],
        matches: (row, selected) => {
          if (!selected) return true;
          const text = String(row?.allergies || '').trim();
          const has = text.length > 0;
          return selected === 'yes' ? has : !has;
        },
      },
    ];

    const rosterFilterMenu = Util.Helpers.createFilterMenu(rosterFilterDef);

    // ---- Text filter (like your app: search fullName)
    const rosterTextFilter = Util.Helpers.createTextFilter((row, _raw, terms, utils) => {
      const parts = [row.fullName, row.saintName];
      return utils.includesAllTerms(utils.normalize(parts.filter(Boolean).join(' ')), terms);
    });

    // ---- Apply filters + pager
    const filteredRosterRows = computed(() => {
      const byMenu = rosterFilterMenu.applyTo(rosterRows.value);
      return rosterTextFilter.applyTo(byMenu);
    });

    const rosterPager = Util.Helpers.createPager({ source: filteredRosterRows });

    // ---- Contacts modal (exact behavior)
    const showContactsModal = ref(false);
    const contactsView = ref({});

    function getPrimaryContactsForFamily(f) {
      const contacts = Array.isArray(f?.contacts) ? f.contacts : [];
      const isParentish = (rel) => Schema.Options.PARENTS.has(String(rel || '').trim());
      const prioritized = contacts.filter((c) => isParentish(c.relationship));
      const others = contacts.filter((c) => !isParentish(c.relationship));
      const pick = [...prioritized, ...others].slice(0, 3);
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
        age: row.grade === '-' ? row.age : [row.age, row.grade].join(' - '),
        contacts: fam ? getPrimaryContactsForFamily(fam) : [],
      };
      showContactsModal.value = true;
    }

    function closeChildContactsModal() {
      showContactsModal.value = false;
    }

    function printRoster() {
      document.documentElement.classList.add('printing-roster');
      window.print?.();
      setTimeout(() => document.documentElement.classList.remove('printing-roster'), 0);
      setStatus('Sent roster to printer.', 'info', 1200);
    }

    return {
      // data & filters
      rosterRows,
      rosterFilterMenu,
      rosterTextFilter,
      filteredRosterRows,
      rosterPager,

      // modals
      showContactsModal,
      contactsView,
      openChildContactsModal,
      closeChildContactsModal,

      // optional util
      programOptionsForRoster,
      eventTypeOptionsForRoster,
      printRoster,
    };
  }

  Controllers.Rosters = { create: createRostersController };
})(window);
