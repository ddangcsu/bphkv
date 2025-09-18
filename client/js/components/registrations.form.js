/* eslint-env browser, es2021 */
/* global Vue */
(() => {
  const Components = (window.Components ||= {});

  Components.RegistrationsForm = {
    name: 'RegistrationsForm',
    props: {
      // state
      mode: { type: Object, required: true }, // pass MODE
      currentMode: { type: String, default: '' },
      readonly: { type: Boolean, required: true }, // pass READONLY
      isRegistrationDirty: { type: Boolean, required: true },

      // data/errors/meta
      registrationForm: { type: Object, required: true },
      registrationErrors: { type: Object, required: true },
      registrationFields: { type: Object, required: true },

      // enums / lookups
      level: { type: Object, required: true },
      selectedEventLevel: { type: String, required: true },

      // helpers (same signatures as your app.js)
      isVisible: { type: Function, required: true },
      getFieldDisabled: { type: Function, required: true },
      onFormFieldInput: { type: Function, required: true },
      onFormFieldChange: { type: Function, required: true },
      getOptions: { type: Function, required: true },
      formatOptionLabel: { type: Function, required: true },
      fieldClass: { type: Function, required: false, default: () => '' },

      // row actions
      addRegChild: { type: Function, required: true },
      removeRegChild: { type: Function, required: true },
      addRegNote: { type: Function, required: true },
      removeRegNote: { type: Function, required: true },

      // form actions
      submitRegistrationForm: { type: Function, required: true },
      goBackSection: { type: Function, required: true },

      // receipt
      openReceipt: { type: Function, required: true },

      // children options gating
      availableChildOptions: { type: Array, required: true },

      // datalist for Family autocomplete
      familyDatalistOptions: { type: Array, required: true }, // [{ value, label }]
    },
    emits: ['toggle-readonly'],
    setup(props, { emit }) {
      const { computed } = Vue;
      const isReadOnly = computed(() => !!props.readonly);
      const canAddChild = computed(() => (props.availableChildOptions || []).length > 0);

      function onToggleReadonly() {
        emit('toggle-readonly');
      }

      return {
        isReadOnly,
        canAddChild,
        onToggleReadonly,
      };
    },
    template: `
<form class="card form" @submit.prevent.stop="submitRegistrationForm" novalidate autocomplete="off">
  <div class="formtabs-bar">
    <nav class="formtabs" role="tablist" aria-label="Registration form sections">
      <button tabindex="-1" type="button" class="active" role="tab" :aria-controls="'panel-registration'">Manage Registration</button>
    </nav>
    <div class="formtabs-actions">
      <button tabindex="-1" v-show="mode.EDIT && registrationForm.status === 'paid' " type="button" class="btn" @click="openReceipt(registrationForm)">
        <i class="fa-solid fa-receipt"></i><span> Receipt</span>
      </button>

      <button v-show="mode.EDIT" type="button" class="btn" @click="onToggleReadonly">
        <i :class="isReadOnly ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open'"></i>
      </button>
      <button tabindex="-1" type="button" class="btn primary" :disabled="isReadOnly || !isRegistrationDirty" @click="submitRegistrationForm">
        <i class="fa-solid fa-floppy-disk"></i><span> Save</span>
      </button>
      <button tabindex="-1" type="button" class="btn" @click="goBackSection"><i class="fa-solid fa-xmark"></i><span> Cancel</span></button>
    </div>
  </div>

  <!-- Event and Family data -->
  <section id="panel-reg-main" role="tabpanel" class="subpanel">
    <div class="item-header compact bordered">
      <h4 class="title">Event & Family</h4>
    </div>

    <div class="grid">
      <label v-for="fld in registrationFields.main" :key="fld.col" v-show="isVisible(fld, {mode: currentMode, form: registrationForm})" :for="\`reg-\${fld.col}\`">
        {{ fld.label }}
        <small class="error" v-if="registrationErrors?.[fld.col]">{{ registrationErrors[fld.col] }}</small>

        <template v-if="fld.type === 'select'">
          <select
            class="input"
            v-model="registrationForm[fld.col]"
            :id="\`reg-\${fld.col}\`"
            :name="\`registration.\${fld.col}\`"
            :disabled="getFieldDisabled(fld, {mode: currentMode, form: registrationForm, isReadOnly})"
            @input="onFormFieldInput(fld, {mode: currentMode, form: registrationForm}, $event)"
            @change="onFormFieldChange(fld, {mode: currentMode, form: registrationForm}, $event)">
            <option disabled value="">-- choose --</option>
            <option v-for="opt in getOptions(fld, {mode: currentMode, form: registrationForm})" :key="String(opt.value)" :value="opt.value">
              {{ formatOptionLabel(opt) }}
            </option>
          </select>
        </template>

        <template v-else-if="fld.type === 'datalist'">
          <input
            class="input"
            list="family-datalist"
            v-model="registrationForm[fld.col]"
            :id="\`reg-\${fld.col}\`"
            :name="\`registration.\${fld.col}\`"
            :placeholder="fld.placeholder || 'Start typing…'"
            :disabled="getFieldDisabled(fld, {mode: currentMode, form: registrationForm, isReadOnly})"
            @input="onFormFieldInput(fld, {mode: currentMode, form: registrationForm}, $event)"
            @change="onFormFieldChange(fld, {mode: currentMode, form: registrationForm}, $event)" />
        </template>

        <template v-else>
          <input
            class="input"
            :type="fld.type || 'text'"
            v-model.trim="registrationForm[fld.col]"
            :id="\`reg-\${fld.col}\`"
            :name="\`registration.\${fld.col}\`"
            :placeholder="fld.placeholder"
            :disabled="getFieldDisabled(fld, {mode: currentMode, form: registrationForm, isReadOnly})"
            @input="onFormFieldInput(fld, {mode: currentMode, form: registrationForm}, $event)"
            @change="onFormFieldChange(fld, {mode: currentMode, form: registrationForm}, $event)" />
        </template>
      </label>
    </div>

    <!-- datalist source for Family autocomplete -->
    <datalist id="family-datalist">
      <option v-for="opt in familyDatalistOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </datalist>

    <!-- Event snapshot (disabled via meta) -->
    <div class="subpanel">
      <div class="item-header compact bordered">
        <h4 class="title">Event Snapshot</h4>
      </div>
      <div class="grid">
        <label
          v-for="f in registrationFields.eventSnapshot"
          :key="f.col"
          :for="\`reg-event-\${f.col}\`"
          v-show="isVisible(f, {mode: currentMode, form: registrationForm})">
          {{ f.label }}
          <input
            class="input"
            :id="\`reg-event-\${f.col}\`"
            :name="\`registration.event.\${f.col}\`"
            :disabled="getFieldDisabled(f, {mode: currentMode, form: registrationForm, isReadOnly})"
            :value="f.transform ? f.transform(registrationForm.event[f.col]) : registrationForm.event[f.col]" />
        </label>
      </div>
    </div>

    <!-- Contacts snapshot (disabled via meta) -->
    <div class="subpanel">
      <div class="item-header compact bordered">
        <h4 class="title">Contacts Snapshot</h4>
      </div>
      <div class="grid col3">
        <template v-for="(c, i) in registrationForm.contacts" :key="'rc'+i">
          <label
            v-for="cf in registrationFields.contactSnapshot"
            :key="cf.col + i"
            :for="\`reg-contact-\${i}-\${cf.col}\`"
            v-show="isVisible(cf, {mode: currentMode, form: registrationForm, row: c, index: i})">
            {{ cf.label }}
            <input
              class="input"
              :id="\`reg-contact-\${i}-\${cf.col}\`"
              :name="\`registration.contacts[\${i}].\${cf.col}\`"
              :disabled="getFieldDisabled(cf, {mode: currentMode, form: registrationForm, row: c, index: i, isReadOnly })"
              :value="c[cf.col]" />
          </label>
        </template>
      </div>
    </div>
  </section>

  <!-- Children selection for PC events -->
  <section class="subpanel" v-if="selectedEventLevel === level.PER_CHILD">
    <div class="item-header compact bordered">
      <h4 class="title">Children Enrollment</h4>
      <div class="spacer"></div>
      <div class="actions">
        <button tabindex="-1" class="btn small accent" type="button" @click="addRegChild" :disabled="isReadOnly || availableChildOptions.length===0">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>

    <div class="row" v-for="(row,i) in registrationForm.children" :key="'ch'+i">
      <div class="row-actions">
        <button
          tabindex="-1"
          class="btn small danger"
          type="button"
          :disabled="isReadOnly"
          @click="removeRegChild(i)"
          v-if="registrationForm.children.length>1">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div class="grid">
        <template v-for="cf in registrationFields.childrenRow" :key="cf.col">
          <label :for="\`reg-child-\${i}-\${cf.col}\`" v-show="isVisible(cf, {mode: currentMode, form: registrationForm, row, index: i})">
            {{ cf.label }}
            <small class="error" v-if="registrationErrors?.children?.[i]?.[cf.col]">{{ registrationErrors.children[i][cf.col] }}</small>
            <template v-if="cf.type === 'select'">
              <select
                class="input"
                v-model="row[cf.col]"
                :id="\`reg-child-\${i}-\${cf.col}\`"
                :name="\`registration.children[\${i}].\${cf.col}\`"
                :disabled="getFieldDisabled(cf, {mode: currentMode, form: registrationForm, row, index: i, isReadOnly})"
                @input="onFormFieldInput(cf, {mode: currentMode, form: registrationForm, row, index: i}, $event)"
                @change="onFormFieldChange(cf, {mode: currentMode, form: registrationForm, row, index: i}, $event)">
                <option disabled value="">-- choose --</option>
                <option v-for="opt in getOptions(cf, {mode: currentMode, form: registrationForm, row, index: i})" :key="String(opt.value)" :value="opt.value">
                  {{ formatOptionLabel(opt)}}
                </option>
              </select>
            </template>
            <template v-else>
              <input
                :type="cf.type || 'text'"
                class="input"
                :id="\`reg-child-\${i}-\${cf.col}\`"
                :name="\`registration.children[\${i}].\${cf.col}\`"
                :disabled="getFieldDisabled(cf, {mode: currentMode, form: registrationForm, row, index: i, isReadOnly})"
                :value="cf.transform ? cf.transform(row[cf.col]) : row[cf.col]" />
            </template>
          </label>
        </template>
      </div>
    </div>
  </section>

  <!-- Payments (prefilled, fixed rows) -->
  <section class="subpanel">
    <div class="item-header compact bordered">
      <h4 class="title">Payments</h4>
    </div>

    <div class="row" v-for="(p,i) in registrationForm.payments" :key="'pay'+i">
      <div class="grid col8">
        <template v-for="pf in registrationFields.paymentsRow" :key="pf.col">
          <label :for="\`reg-pay-\${i}-\${pf.col}\`" v-show="isVisible(pf, {mode: currentMode, form: registrationForm, row: p, index: i})">
            {{ pf.label }}
            <small class="error" v-if="registrationErrors?.payments[i]?.[pf.col]">{{ registrationErrors.payments[i][pf.col] }}</small>
            <template v-if="pf.type==='select'">
              <select
                class="input"
                v-model="p[pf.col]"
                :id="\`reg-pay-\${i}-\${pf.col}\`"
                :name="\`registration.payments[\${i}].\${pf.col}\`"
                :disabled="getFieldDisabled(pf, {mode: currentMode, form: registrationForm, row: p, index: i, isReadOnly})"
                @input="onFormFieldInput(pf, {mode: currentMode, form: registrationForm, row: p, index: i}, $event)"
                @change="onFormFieldChange(pf, {mode: currentMode, form: registrationForm, row: p, index: i}, $event)">
                <option disabled value="">-- choose --</option>
                <option
                  v-for="opt in getOptions(pf, {mode: currentMode, form: registrationForm, row: p, index: i})"
                  :key="String(opt.value)"
                  :value="opt.value">
                  {{ formatOptionLabel(opt) }}
                </option>
              </select>
            </template>

            <template v-else>
              <input
                class="input"
                :id="\`reg-pay-\${i}-\${pf.col}\`"
                :name="\`registration.payments[\${i}].\${pf.col}\`"
                :disabled="getFieldDisabled(pf, {mode: currentMode, form: registrationForm, row: p, index: i, isReadOnly})"
                v-model.trim="p[pf.col]"
                @input="onFormFieldInput(pf, {mode: currentMode, form: registrationForm, row: p, index: i}, $event)"
                @change="onFormFieldChange(pf, {mode: currentMode, form: registrationForm, row: p, index: i}, $event)" />
            </template>
          </label>
        </template>
      </div>
    </div>
  </section>

  <!-- Notes -->
  <section id="panel-notes" role="tabpanel" class="subpanel">
    <div class="item-header compact bordered">
      <h4 class="title">Notes/Logs</h4>
      <div class="spacer"></div>
      <div class="actions">
        <button tabindex="-1" type="button" class="btn small accent" :disabled="isReadOnly" @click="addRegNote">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>

    <div class="row" v-for="(n,i) in registrationForm.notes" :key="'note'+i">
      <div class="row-actions">
        <button tabindex="-1" type="button" class="btn small danger" :disabled="isReadOnly" @click="removeRegNote(i)">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>

      <div class="grid">
        <label
          v-for="f in registrationFields.notes"
          :key="f.col"
          :for="\`note-\${i}-\${f.col}\`"
          :class="fieldClass(f, { form: n, index: i })"
          v-show="isVisible(f, {mode: currentMode, form: registrationForm, row: n, index: i })">
          {{ f.label }}
          <small class="error" v-if="registrationErrors?.notes?.[i]?.[f.col]">{{ registrationErrors.notes[i][f.col] }}</small>
          <template v-if="f.type === 'select'">
            <select
              class="input"
              :id="\`note-\${i}-\${f.col}\`"
              :name="\`registration.note[\${i}].\${f.col}\`"
              :disabled="getFieldDisabled(f, {mode: currentMode, form: registrationForm, row: n, index: i, isReadOnly })"
              v-model="n[f.col]"
              @input="onFormFieldInput(f, {mode: currentMode, form: registrationForm, row: n, index: i }, $event)"
              @change="onFormFieldChange(f, {mode: currentMode, form: registrationForm, row: n, index: i }, $event)">
              <option disabled value="">-- choose --</option>
              <option v-for="opt in getOptions(f, {mode: currentMode, form: registrationForm, row: n, index: i })" :key="String(opt.value)" :value="opt.value">
                {{ formatOptionLabel(opt) }}
              </option>
            </select>
          </template>

          <template v-else>
            <input
              :class="f.type === 'checkbox' ? 'check-lg':'input'"
              :type="f.type || 'text'"
              :id="\`note-\${i}-\${f.col}\`"
              :name="\`registration.note[\${i}].\${f.col}\`"
              :disabled="getFieldDisabled(f, {mode: currentMode, form: registrationForm, row: n, index: i, isReadOnly })"
              v-model.trim="n[f.col]"
              :placeholder="f.placeholder"
              @input="onFormFieldInput(f, {mode: currentMode, form: registrationForm, row: n, index: i }, $event)"
              @change="onFormFieldChange(f, {mode: currentMode, form: registrationForm, row: n, index: i }, $event)" />
          </template>
        </label>
      </div>
    </div>
  </section>

  <!-- Status and parent acceptance -->
  <section class="subpanel">
    <div class="item-header compact bordered">
      <h4 class="title">Status and Acceptance</h4>
    </div>
    <div class="grid">
      <label
        v-for="mf in registrationFields.meta"
        :key="mf.col"
        :for="\`reg-meta-\${mf.col}\`"
        v-show="isVisible(mf, {mode: currentMode, form: registrationForm})">
        {{ mf.label }}
        <small class="error" v-if="registrationErrors?.[mf.col]">{{ registrationErrors[mf.col] }}</small>
        <template v-if="mf.type==='select'">
          <select
            class="input"
            v-model="registrationForm[mf.col]"
            :id="\`reg-meta-\${mf.col}\`"
            :name="\`registration.\${mf.col}\`"
            :disabled="getFieldDisabled(mf, {mode: currentMode, form: registrationForm , isReadOnly})"
            @input="onFormFieldInput(mf, {mode: currentMode, form: registrationForm}, $event)"
            @change="onFormFieldChange(mf, {mode: currentMode, form: registrationForm}, $event)">
            <option v-for="opt in getOptions(mf, {mode: currentMode, form: registrationForm})" :key="String(opt.value)" :value="opt.value">
              {{ formatOptionLabel(opt) }}
            </option>
          </select>
        </template>

        <template v-else>
          <input
            class="input"
            v-model.trim="registrationForm[mf.col]"
            :id="\`reg-meta-\${mf.col}\`"
            :name="\`registration.\${mf.col}\`"
            :disabled="getFieldDisabled(mf, {mode: currentMode, form: registrationForm, isReadOnly})"
            @input="onFormFieldInput(mf, {mode: currentMode, form: registrationForm}, $event)"
            @change="onFormFieldChange(mf, {mode: currentMode, form: registrationForm}, $event)" />
        </template>
      </label>
    </div>
  </section>
</form>
    `,
  };
})();
