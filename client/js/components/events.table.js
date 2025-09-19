/* eslint-env browser, es2021 */
/* global Vue */
(function attachEventsTable(global) {
  'use strict';

  const Components = global.Components || (global.Components = {});
  const { computed } = Vue;

  /**
   * Presentational Events table that matches index.html structure exactly:
   * Columns:
   *  Event ID | Program | Type | Description | School Year | Scope | Open Window | Schedule Fees | Actions
   *
   * Props:
   *  - rows:              Array of event rows (usually pager.items)
   *  - codeToLabel:       Function(code, optionsArray) -> string
   *  - eventTypes:        Options array for event type
   *  - yearOptions:       Options array for school year
   *  - levelOptions:      Options array for level/scope
   *  - displayEventFees:  Function(row) -> string
   *
   * Emits:
   *  - edit(row)
   */
  Components.EventsTable = {
    name: 'events-table',
    props: {
      rows: { type: Array, required: true },
      codeToLabel: { type: Function, required: true },
      eventTypes: { type: Array, required: true },
      yearOptions: { type: Array, required: true },
      levelOptions: { type: Array, required: true },
      displayEventFees: { type: Function, required: true },
      eventOpenStatus: { type: Function, reequired: true },
    },
    emits: ['edit'],
    setup(props, { emit }) {
      const safeRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));
      const onEdit = (row) => emit('edit', row);
      return { safeRows, onEdit };
    },
    template: `
      <div class="table-wrapper table-wrapper--events">
        <table class="table" role="table">
          <thead>
            <tr>
              <th scope="col">Event ID</th>
              <th scope="col">Program</th>
              <th scope="col">Type</th>
              <th scope="col">Description</th>
              <th scope="col">School Year</th>
              <th scope="col">Scope</th>
              <th scope="col">Status</th>
              <th scope="col">Open Window</th>
              <th scope="col">Schedule Fees</th>
              <th scope="col" class="col-actions">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ev in safeRows" :key="ev.id">
              <td>{{ ev.id }}</td>
              <td>{{ ev.programId }}</td>
              <td>{{ codeToLabel(ev.eventType, eventTypes) || '—' }}</td>
              <td>{{ ev.title }}</td>
              <td>{{ codeToLabel(ev.year, yearOptions) }}</td>
              <td>{{ codeToLabel(ev.level, levelOptions) }}</td>
              <td class="badge" :data-variant="eventOpenStatus(ev)">{{ eventOpenStatus(ev) }}</td>
              <td>{{ ev.openDate }} → {{ ev.endDate }}</td>
              <td>{{ displayEventFees(ev) }}</td>
              <td class="actions">
                <button tabindex="-1" class="btn secondary" type="button" @click="onEdit(ev)">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
