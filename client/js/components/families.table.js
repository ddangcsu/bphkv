/* eslint-env browser, es2021 */
/* global Vue */
(function attachFamiliesTable(global) {
  'use strict';

  const Components = global.Components || (global.Components = {});
  const { computed } = Vue;

  Components.FamiliesTable = {
    name: 'families-table',
    props: {
      rows: { type: Array, required: true },
      codeToLabel: { type: Function, required: true },
      yesNoOptions: { type: Array, required: true },
      contactDisplay: { type: Function, required: true },

      // NEW: exact hooks your original table used
      alreadyRegistered: { type: Function, required: true },
      registerAdminForFamily: { type: Function, required: true },
      registerTnttForFamily: { type: Function, required: true },

      // enums (pass in kebab-case as :program="PROGRAM" :event="EVENT")
      program: { type: Object, required: true }, // PROGRAM
      event: { type: Object, required: true }, // EVENT
    },
    emits: ['edit'],
    setup(props, { emit }) {
      const safeRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));
      const onEdit = (row) => emit('edit', row);

      // small helpers to keep template readable
      function isRegisteredBPH(row) {
        return props.alreadyRegistered({ familyId: row.id, programId: props.program.BPH });
      }
      function isRegisteredTnttReg(row) {
        return props.alreadyRegistered({
          familyId: row.id,
          programId: props.program.TNTT,
          eventType: props.event.REGISTRATION,
        });
      }

      return { safeRows, onEdit, isRegisteredBPH, isRegisteredTnttReg };
    },
    template: `
      <div class="table-wrapper table-wrapper--families">
        <table class="table" role="table">
          <thead>
            <tr>
              <th scope="col">Family ID</th>
              <th scope="col">Member</th>
              <th scope="col">Parish#</th>
              <th scope="col">Contact Info</th>
              <th scope="col">City</th>
              <th scope="col"># Children</th>
              <th scope="col" class="col-actions">Actions</th>
              <th scope="col">BPH</th>
              <th scope="col">TNTT</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in safeRows" :key="f.id">
              <td>{{ f.id }}</td>
              <td>{{ codeToLabel(f.parishMember, yesNoOptions) }}</td>
              <td>{{ f.parishNumber || '-' }}</td>
              <td>{{ contactDisplay(f) }}</td>
              <td>{{ f.address?.city }}</td>
              <td>{{ Array.isArray(f.children) ? f.children.length : 0 }}</td>

              <td class="actions">
                <button tabindex="-1" class="btn secondary" type="button" @click="onEdit(f)">
                  <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
              </td>

              <!-- BPH column -->
              <td>
                <button tabindex="-1" class="btn" type="button" @click="registerAdminForFamily(f)">
                  <template v-if="isRegisteredBPH(f)">
                    <i class="fa-solid fa-dollar-sign"></i> <span> Paid </span>
                  </template>
                  <template v-else>
                    <i class="fa-solid fa-clipboard-list"></i><span> Enroll</span>
                  </template>
                </button>
              </td>

              <!-- TNTT column (only show button if already registered for BPH) -->
              <td>
                <button
                  tabindex="-1"
                  v-if="isRegisteredBPH(f)"
                  class="btn"
                  type="button"
                  @click="registerTnttForFamily(f)"
                >
                  <template v-if="isRegisteredTnttReg(f)">
                    <i class="fa-solid fa-dollar-sign"></i> <span> Paid </span>
                  </template>
                  <template v-else>
                    <i class="fa-solid fa-clipboard-list"></i><span> Enroll</span>
                  </template>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
