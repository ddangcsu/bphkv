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
<table class="table">
  <thead>
    <tr>
      <th>Program</th>
      <th>Year</th>
      <th>Type</th>
      <th>Event</th>
      <th>Saint Name</th>
      <th>Full Name</th>
      <th>Grade/Group</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="r in rows" :key="r.registrationId + ':' + (r.familyId||'') + ':' + (r.fullName||'')">
      <!-- Program column shows raw programId in your HTML today -->
      <td>{{ r.programId }}</td>
      <td>{{ codeToLabel(r.year, yearOptions) }}</td>
      <td>{{ codeToLabel(r.eventType, eventTypes) }}</td>
      <td>{{ r.eventTitle }}</td>
      <td>{{ r.saintName || '—' }}</td>
      <td>{{ r.fullName || '—' }}</td>
      <td>{{ r.grade || '—' }}</td>
      <td class="actions">
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
