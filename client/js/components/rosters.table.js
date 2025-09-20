/* eslint-env browser, es2021 */
(() => {
  const Components = (window.Components ||= {});

  Components.RostersTable = {
    name: 'rosters-table',
    props: {
      rows: { type: Array, required: true }, // rosterPager.items
      codeToLabel: { type: Function, required: true }, // app.js -> codeToLabel
      yearOptions: { type: Array, required: true }, // yearOptions
      eventTypes: { type: Array, required: true }, // eventTypes
    },
    emits: ['contacts'],
    setup(_props, { emit }) {
      function onContacts(row) {
        emit('contacts', row);
      }
      return { onContacts };
    },
    template: `
<table class="table roster-table">
  <thead>
    <tr>
      <th class="col-year">Year</th>
      <th class="col-type">Type</th>
      <th class="col-event">Event</th>
      <th class="col-saint">Saint Name</th>
      <th class="col-fullname">Full Name</th>
      <th class="col-grade">Grade/Group</th>
      <th class="col-allergies">Allergies</th>
      <th class="col-actions">Action</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="r in rows" :key="r.registrationId + ':' + (r.familyId||'') + ':' + (r.fullName||'')">
      <td class="col-year">{{ codeToLabel(r.year, yearOptions) }}</td>
      <td class="col-type">{{ codeToLabel(r.eventType, eventTypes) }}</td>
      <td class="col-event">{{ r.eventTitle }}</td>
      <td class="col-saint">{{ r.saintName || '—' }}</td>
      <td class="col-fullname">{{ r.fullName || '—' }}</td>
      <td class="col-grade">{{ r.grade || '—' }}</td>
      <td class="col-allergies">{{ r.allergies }}</td>
      <td class="col-actions actions">
        <button tabindex="-1" class="btn" type="button" @click="onContacts(r)">
          <i class="fa-solid fa-address-book"></i> <span>Contacts</span>
        </button>
      </td>
    </tr>
  </tbody>
</table>
    `,
  };
})();
