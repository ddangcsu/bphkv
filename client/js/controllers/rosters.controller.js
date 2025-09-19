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
      const html = document.documentElement;

      // cleanup helper
      const cleanup = () => {
        html.classList.remove('printing-roster');
        window.removeEventListener('afterprint', cleanup);
        if (mm) mm.removeEventListener?.('change', onMediaChange);
      };

      // some browsers don’t fire 'afterprint' reliably; use matchMedia as well
      const mm = window.matchMedia ? window.matchMedia('print') : null;
      const onMediaChange = (e) => {
        if (!e.matches) cleanup();
      };
      if (mm && mm.addEventListener) mm.addEventListener('change', onMediaChange);
      window.addEventListener('afterprint', cleanup, { once: true });

      html.classList.add('printing-roster');

      // Let styles apply before printing (2 x rAF is the safest simple trick)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            window.print();
          } catch (e) {
            cleanup();
          }
          // Fallback: ensure cleanup even if no events fire
          setTimeout(cleanup, 4000);
        });
      });

      setStatus('Preparing roster for print…', 'info', 1000);
    }

    async function printRosterTableOnly() {
      rosterPager.pageSize = 0;
      await nextTick();

      const table = document.querySelector('.roster-table');
      if (!table) {
        setStatus('Roster table not found.', 'error', 2000);
        return;
      }

      // --- Build a header: Event + filters + timestamp ---
      const st = rosterFilterMenu?.state || {};
      const labelFrom = (opts, v) => (opts || []).find((o) => String(o.value) === String(v))?.label || (v ?? '');
      const programLabel = st.programId ? labelFrom(Schema.Options.PROGRAM_OPTIONS, st.programId) : 'All Programs';
      const yearLabel = st.year ? labelFrom(Schema.Options.YEAR_OPTIONS, st.year) : 'All Years';
      const typeLabel = st.eventType ? labelFrom(Schema.Options.EVENT_TYPES, st.eventType) : 'All Types';

      let eventTitle = '';
      if (st.eventId) {
        const ev = (getEventRows() || []).find((e) => e.id === st.eventId);
        eventTitle = ev?.title || '';
      }

      const timestamp = new Date().toLocaleString();

      // --- Minimal print CSS: include your theme + repeat header each page ---
      const css = `
    @page { margin: 12mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }

    header.print-header { margin-bottom: 10px; }
    header.print-header h2 { margin: 0 0 6px 0; font-size: 18px; }
    header.print-header .meta { font-size: 12px; color: #555; }

    .table { border-collapse: collapse; width: 100%; }
    .table th, .table td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
    .table thead th { background: #f5f5f5; }

    /* Repeat thead on each printed page */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }

    /* Hide everything except: Saint Name, Full Name, Grade/Group */
    .roster-table th.col-program, .roster-table td.col-program,
    .roster-table th.col-year,    .roster-table td.col-year,
    .roster-table th.col-type,    .roster-table td.col-type,
    .roster-table th.col-event,   .roster-table td.col-event,
    .roster-table th.col-actions, .roster-table td.col-actions {
      display: none !important;
    }
  `;

      const headerHtml = `
    <header class="print-header">
      <h2>Enrollment Roster${eventTitle ? ` — ${Util.Format.escapeHtml?.(eventTitle) || eventTitle}` : ''}</h2>
      <div class="meta">
        Program: ${programLabel} &nbsp;•&nbsp;
        Year: ${yearLabel} &nbsp;•&nbsp;
        Type: ${typeLabel}
        ${
          st.age
            ? st.programId && st.programId === ENUMS.PROGRAM.TNTT
              ? `Group: ${ageGroupLabelTNTT(st.age)}`
              : ` &nbsp;•&nbsp; Age: ${st.age}`
            : ''
        }
        ${st.allergies ? ` &nbsp;•&nbsp; Allergies: ${st.allergies === 'yes' ? 'Yes' : 'No'}` : ''}
        <br/>
        Printed: ${timestamp}
      </div>
    </header>
  `;

      const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Roster</title>
        <link rel="stylesheet" href="./css/light.css">
        <style>${css}</style>
      </head>
      <body>
        ${headerHtml}
        ${table.outerHTML}
      </body>
    </html>
  `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      const doc = win.document;
      const cleanup = () => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      };

      win.onafterprint = cleanup;
      if (win.matchMedia) {
        const mq = win.matchMedia('print');
        mq.addEventListener?.('change', (e) => {
          if (!e.matches) cleanup();
        });
      }

      doc.open();
      doc.write(html);
      doc.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch (e) {
          cleanup();
        }
      }, 100);
      setTimeout(cleanup, 5000);

      setStatus('Preparing roster for print…', 'info', 1000);
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
      printRosterTableOnly,
    };
  }

  Controllers.Rosters = { create: createRostersController };
})(window);
