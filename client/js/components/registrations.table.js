/* eslint-env browser, es2021 */
/* global Vue */
(function attachRegistrationsTable(global) {
  'use strict';
  const Components = global.Components || (global.Components = {});

  Components.RegistrationsTable = {
    name: 'RegistrationsTable',
    props: {
      rows: { type: Array, required: true },
      codeToLabel: { type: Function, required: true },
      yearOptions: { type: Array, required: true },
      programOptions: { type: Array, required: true },
      contactDisplay: { type: Function, required: true },
      openReceipt: { type: Function, required: true },
    },
    emits: ['edit'],
    methods: {
      paymentSummary(r) {
        const arr = Array.isArray(r?.payments) ? r.payments : [];
        if (!arr.length) return '—';
        return arr
          .map((p) => {
            const code = p?.code ?? '';
            const amt = Number(p?.amount) || 0;
            return `${code}:$${amt}`;
          })
          .join(' / ');
      },
      updatedDate(r) {
        const d = r?.updatedAt || r?.createdAt || '';
        return String(d).slice(0, 10);
      },
      programLabel(pid) {
        const lbl = this.codeToLabel(pid, this.programOptions);
        return lbl || pid || '—';
      },
    },
    template: `
      <table class="table">
        <thead>
          <tr>
            <th>Reg ID</th>
            <th>Event</th>
            <th>School Year</th>
            <th>Program</th>
            <th>Family</th>
            <th># Children</th>
            <th>Receipt</th>
            <th>Payments</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>{{ r.id }}</td>
            <td>{{ r.event?.title || '—' }}</td>
            <td>{{ codeToLabel(r.event?.year, yearOptions) }}</td>
            <td>{{ programLabel(r.event?.programId) }}</td>
            <td v-html="contactDisplay(r, true)"></td>
            <td>{{ Array.isArray(r.children) && r.children.length ? r.children.length : '' }}</td>
            <td><button tabindex="-1" class="btn" type="button" v-if="r.status === 'paid'" @click="openReceipt(r)"><i class="fa-solid fa-receipt"></i></button>
                      <span v-else>'—'</span></td>
            <td>{{ paymentSummary(r) }}</td>
            <td>{{ updatedDate(r) }}</td>
            <td class="actions">
              <button tabindex="-1" class="btn" type="button" @click="$emit('edit', r)">
                <i class="fa-solid fa-pen-to-square"></i> <span>Edit</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
