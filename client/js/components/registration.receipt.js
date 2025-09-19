/* eslint-env browser, es2021 */
/* global Vue */
(function attachRegistrationReceiptModal(global) {
  const Components = (window.Components ||= {});

  Components.RegistrationReceipt = {
    name: 'RegistrationReceipt',
    props: {
      // v-model
      open: { type: Boolean, default: false },

      // data
      receiptView: { type: Object, required: true },

      // formatters/lookups/constants from your app
      formatMoney: { type: Function, required: true },
      codeToLabel: { type: Function, required: true },
      programOptions: { type: Array, required: true },
      yearOptions: { type: Array, required: true },
      paymentMethodOptions: { type: Array, required: true },
      yesNoOptions: { type: Array, required: true },

      // modal visuals (defaults match your index.html usage)
      title: { type: String, default: 'View and Print Receipt' },
      placement: { type: String, default: 'top' },
      topOffset: { type: [Number, String], default: 5 },
      size: { type: String, default: 'xl' },
      closeOnBackdrop: { type: Boolean, default: true },
      closeOnEsc: { type: Boolean, default: true },
      ariaDescription: { type: String, default: 'Registration receipt details and totals.' },
    },
    emits: ['update:open', 'print'],
    setup(props, { emit }) {
      const modelOpen = Vue.computed({
        get: () => !!props.open,
        set: (v) => emit('update:open', !!v),
      });
      function printReceipt() {
        emit('print');
      }
      return { modelOpen, printReceipt };
    },
    template: `
<ui-modal
  v-model:open="modelOpen"
  class="ui-modal--printable"
  :title="title"
  :placement="placement"
  :top-offset="topOffset"
  :size="size"
  :close-on-backdrop="closeOnBackdrop"
  :close-on-esc="closeOnEsc"
  :aria-description="ariaDescription">
  <template #header-actions>
    <button type="button" class="btn primary" @click="printReceipt">
      <i class="fa-solid fa-print"></i>
    </button>
  </template>

  <div class="printable-content">
    <div class="print-page" :data-watermark="receiptView.status === 'paid' ? \`PAID \${receiptView.programId} \${receiptView.year}\` : ''">
      <div class="subpanel">
        <h4 class="title" style="text-align: center" v-text="receiptView.receiptName"></h4>

        <!-- Main Info -->
        <table class="table">
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Family ID</th>
              <th>Parish Member</th>
              <th>Parish Number</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{{ receiptView.id }}</td>
              <td>{{ receiptView.familyId }}</td>
              <td>{{ codeToLabel(receiptView.parishMember, yesNoOptions) }}</td>
              <td>{{ receiptView.parishNumber }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Event -->
        <div class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Registration Event</h4>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Program</th>
                <th>Event Type</th>
                <th>School Year</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ receiptView.eventTitle }}</td>
                <td>{{ codeToLabel(receiptView.programId, programOptions) }}</td>
                <td>{{ receiptView.eventTypeLabel }}</td>
                <td>{{ codeToLabel(receiptView.year, yearOptions) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Family Contacts -->
        <div class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Contacts</h4>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Relationship</th>
                <th>Name</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c,i) in receiptView.contacts" :key="'ct'+i">
                <td>{{ c.relationship }}</td>
                <td>{{ c.name }}</td>
                <td>{{ c.phone }}</td>
              </tr>
              <tr v-if="!receiptView.contacts || !receiptView.contacts.length">
                <td colspan="4" class="muted">No contacts found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Children Enrolled -->
        <div class="subpanel" v-if="receiptView.children && receiptView.children.length > 0">
          <div class="item-header compact bordered">
            <h4 class="title">Children Enrolled</h4>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Saint Name</th>
                <th>Full Name</th>
                <th>Age</th>
                <th>Grade/Group</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c,i) in receiptView.children" :key="'rc'+i">
                <td>{{ c.saintName }}</td>
                <td>{{ c.fullName }}</td>
                <td>{{ c.age }}</td>
                <td>{{ c.grade }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Payments Data -->
        <div class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Payments</h4>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Receipt #</th>
                <th>Received By</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p,i) in receiptView.payments" :key="'payv'+i">
                <td>{{ p.codeLabel }}</td>
                <td>{{ formatMoney(p.unitAmount) }}</td>
                <td>{{ p.qty }}</td>
                <td>{{ formatMoney(p.amount) }}</td>
                <td>{{ codeToLabel(p.method, paymentMethodOptions) }}</td>
                <td>{{ p.receiptNo }}</td>
                <td>{{ p.receivedBy }}</td>
              </tr>
              <tr>
                <td colspan="3" class="right"><strong>Total Paid</strong></td>
                <td><strong>{{ formatMoney(receiptView.total) }}</strong></td>
                <td colspan="3"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Registration Notes -->
        <div class="subpanel" v-if="receiptView.notes && receiptView.notes.length > 0">
          <div class="item-header compact bordered">
            <h4 class="title">Registration Notes</h4>
          </div>
          <table class="table">
            <tr v-for="(n,i) in receiptView.notes" :key="'rn'+i">
              <td>{{ n.note }}</td>
            </tr>
          </table>
        </div>

        <!-- Signed / Date -->
        <table class="table">
          <thead>
            <tr><th></th><th></th><th></th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Accepted & Signed By:</td>
              <td>{{ receiptView.acceptedBy }}</td>
              <td>Date:</td>
              <td>{{ receiptView.updatedAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</ui-modal>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
