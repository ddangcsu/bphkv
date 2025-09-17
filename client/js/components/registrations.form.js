/* eslint-env browser, es2021 */
/* global Vue */
(function attachRegistrationsForm(global) {
  const Components = (window.Components ||= {});

  Components.RegistrationsForm = {
    name: 'RegistrationsForm',
    props: {
      // state
      mode: { type: Object, required: true }, // pass MODE
      readonly: { type: Boolean, required: true }, // pass READONLY
      isRegistrationDirty: { type: Boolean, required: true },

      // data/errors/meta
      registrationForm: { type: Object, required: true },
      registrationErrors: { type: Object, required: true },
      registrationFields: { type: Object, required: true },

      // lookups/formatters you already expose in app.js
      codeToLabel: { type: Function, required: true },
      formatOptionLabel: { type: Function, required: true },
      formatMoney: { type: Function, required: false },

      // meta helpers (your existing signatures)
      isVisible: { type: Function, required: true },
      getFieldDisabled: { type: Function, required: true },
      onFormFieldInput: { type: Function, required: true },
      onFormFieldChange: { type: Function, required: true },
      getOptions: { type: Function, required: true },
      fieldClass: { type: Function, required: false },

      // row actions
      addRegChild: { type: Function, required: true },
      removeRegChild: { type: Function, required: true },
      addRegNote: { type: Function, required: true },
      removeRegNote: { type: Function, required: true },

      // form actions
      submitRegistrationForm: { type: Function, required: true },
      goBackSection: { type: Function, required: true },

      // receipt
      openReceiptById: { type: Function, required: false },

      // to disable “Add Child” when none available (use your existing computed)
      availableChildOptions: { type: Array, required: true },

      // datalist for Family ID field (array of {value,label})
      familyDatalist: { type: Array, required: true },
      familyDatalistId: { type: String, default: 'families-datalist' },
    },
    setup(props) {
      const { computed } = Vue;
      const currentMode = computed(() => props.mode);
      const isReadOnly = computed(() => !!props.readonly);

      function openReceipt() {
        const id = props.registrationForm?.id;
        if (!id || typeof props.openReceiptById !== 'function') return;
        props.openReceiptById(id);
      }

      const canAddChild = computed(() => (props.availableChildOptions || []).length > 0);

      return {
        currentMode,
        isReadOnly,
        openReceipt,
        canAddChild,
      };
    },
    template: `
      <form class="card form" @submit.prevent.stop="submitRegistrationForm" novalidate autocomplete="off">
        <div class="formtabs-bar">
          <nav class="formtabs" role="tablist" aria-label="Registration form sections">
            <button tabindex="-1" type="button" class="active" role="tab" aria-controls="panel-reg">Manage Registration</button>
          </nav>

          <div class="formtabs-actions">
            <button v-show="mode.EDIT" type="button" class="btn" @click="openReceipt" :disabled="!registrationForm?.id">
              <i class="fa-solid fa-receipt"></i><span> Receipt</span>
            </button>
            <button tabindex="-1" type="button" class="btn primary" :disabled="isReadOnly || !isRegistrationDirty" @click="submitRegistrationForm">
              <i class="fa-solid fa-floppy-disk"></i><span> Save</span>
            </button>
            <button tabindex="-1" type="button" class="btn" @click="goBackSection"><i class="fa-solid fa-xmark"></i><span> Cancel</span></button>
          </div>
        </div>

        <!-- Event & Family -->
        <section class="subpanel" id="panel-reg" role="tabpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Event & Family</h4>
          </div>

          <div class="grid">
            <label
              v-for="fld in registrationFields.main"
              :key="fld.col"
              :for="\`reg-\${fld.col}\`"
              v-show="isVisible(fld, { mode: currentMode, form: registrationForm })">
              {{ fld.label }}
              <small class="error" v-if="registrationErrors?.[fld.col]">{{ registrationErrors[fld.col] }}</small>

              <!-- datalist (Family ID) -->
              <template v-if="fld.type === 'datalist'">
                <input
                  class="input"
                  list="{{familyDatalistId}}"
                  :id="\`reg-\${fld.col}\`"
                  :name="\`registration.\${fld.col}\`"
                  v-model.trim="registrationForm[fld.col]"
                  :placeholder="fld.placeholder"
                  :disabled="getFieldDisabled(fld, { mode: currentMode, form: registrationForm, isReadOnly })"
                  @input="onFormFieldInput(fld, { mode: currentMode, form: registrationForm }, $event)"
                  @change="onFormFieldChange(fld, { mode: currentMode, form: registrationForm }, $event)" />
                <datalist :id="familyDatalistId">
                  <option v-for="opt in familyDatalist" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
                </datalist>
              </template>

              <!-- selects -->
              <template v-else-if="fld.type === 'select'">
                <select
                  class="input"
                  :id="\`reg-\${fld.col}\`"
                  :name="\`registration.\${fld.col}\`"
                  v-model="registrationForm[fld.col]"
                  :disabled="getFieldDisabled(fld, { mode: currentMode, form: registrationForm, isReadOnly })"
                  @input="onFormFieldInput(fld, { mode: currentMode, form: registrationForm }, $event)"
                  @change="onFormFieldChange(fld, { mode: currentMode, form: registrationForm }, $event)">
                  <option disabled value="">-- choose --</option>
                  <option v-for="opt in getOptions(fld, { mode: currentMode, form: registrationForm })" :key="String(opt.value)" :value="opt.value">
                    {{ formatOptionLabel(opt) }}
                  </option>
                </select>
              </template>

              <!-- text/other -->
              <template v-else>
                <input
                  class="input"
                  :type="fld.type || 'text'"
                  :id="\`reg-\${fld.col}\`"
                  :name="\`registration.\${fld.col}\`"
                  v-model.trim="registrationForm[fld.col]"
                  :placeholder="fld.placeholder"
                  :disabled="getFieldDisabled(fld, { mode: currentMode, form: registrationForm, isReadOnly })"
                  @input="onFormFieldInput(fld, { mode: currentMode, form: registrationForm }, $event)"
                  @change="onFormFieldChange(fld, { mode: currentMode, form: registrationForm }, $event)" />
              </template>
            </label>
          </div>
        </section>

        <!-- Event Snapshot -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Event Snapshot</h4>
          </div>

          <div class="grid">
            <label
              v-for="f in registrationFields.eventSnapshot"
              :key="f.col"
              :for="\`event-snap-\${f.col}\`"
              v-show="isVisible(f, { mode: currentMode, form: registrationForm })">
              {{ f.label }}
              <input
                class="input"
                :type="f.type || 'text'"
                :disabled="getFieldDisabled(f, { mode: currentMode, form: registrationForm, isReadOnly })"
                :id="\`event-snap-\${f.col}\`"
                :name="\`registration.event.\${f.col}\`"
                v-model.trim="registrationForm.event[f.col]" />
            </label>
          </div>
        </section>

        <!-- Contacts Snapshot -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Contacts Snapshot</h4>
          </div>

          <div class="row" v-for="(c, i) in registrationForm.contacts" :key="'rc'+i">
            <div class="grid">
              <label
                v-for="cf in registrationFields.contactSnapshot"
                :key="cf.col"
                :for="\`contact-snap-\${i}-\${cf.col}\`"
                v-show="isVisible(cf, { mode: currentMode, form: registrationForm, row: c, index: i })">
                {{ cf.label }}
                <input
                  class="input"
                  :type="cf.type || 'text'"
                  :disabled="getFieldDisabled(cf, { mode: currentMode, form: registrationForm, row: c, index: i, isReadOnly })"
                  :id="\`contact-snap-\${i}-\${cf.col}\`"
                  :name="\`registration.contacts[\${i}].\${cf.col}\`"
                  v-model.trim="c[cf.col]" />
              </label>
            </div>
          </div>
        </section>

        <!-- Children Enrollment -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Children Enrollment</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" class="btn small accent" type="button" :disabled="isReadOnly || !canAddChild" @click="addRegChild">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="row" v-for="(child, i) in registrationForm.children" :key="'rch'+i">
            <div class="row-actions">
              <button
                tabindex="-1"
                class="btn small danger"
                type="button"
                :disabled="isReadOnly"
                @click="removeRegChild(i)"
                v-if="registrationForm.children.length>0">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="grid">
              <label
                v-for="cf in registrationFields.childrenRow"
                :key="cf.col"
                :for="\`reg-child-\${i}-\${cf.col}\`"
                v-show="isVisible(cf, { mode: currentMode, form: registrationForm, row: child, index: i })">
                {{ cf.label }}
                <small class="error" v-if="registrationErrors?.children?.[i]?.[cf.col]">{{ registrationErrors.children[i][cf.col] }}</small>

                <template v-if="cf.type === 'select'">
                  <select
                    class="input"
                    :id="\`reg-child-\${i}-\${cf.col}\`"
                    :name="\`registration.children[\${i}].\${cf.col}\`"
                    :disabled="getFieldDisabled(cf, { mode: currentMode, form: registrationForm, row: child, index: i, isReadOnly })"
                    v-model="child[cf.col]"
                    @input="onFormFieldInput(cf, { mode: currentMode, form: registrationForm, row: child, index: i }, $event)"
                    @change="onFormFieldChange(cf, { mode: currentMode, form: registrationForm, row: child, index: i }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(cf, { mode: currentMode, form: registrationForm, row: child, index: i })"
                      :key="String(opt.value)"
                      :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    class="input"
                    :type="cf.type || 'text'"
                    :id="\`reg-child-\${i}-\${cf.col}\`"
                    :name="\`registration.children[\${i}].\${cf.col}\`"
                    :disabled="getFieldDisabled(cf, { mode: currentMode, form: registrationForm, row: child, index: i, isReadOnly })"
                    v-model.trim="child[cf.col]"
                    @input="onFormFieldInput(cf, { mode: currentMode, form: registrationForm, row: child, index: i }, $event)"
                    @change="onFormFieldChange(cf, { mode: currentMode, form: registrationForm, row: child, index: i }, $event)" />
                </template>
              </label>
            </div>
          </div>
        </section>

        <!-- Payments -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Payments</h4>
          </div>

          <div class="row" v-for="(p, i) in registrationForm.payments" :key="'pay'+i">
            <div class="grid">
              <label
                v-for="pf in registrationFields.paymentsRow"
                :key="pf.col"
                :for="\`reg-pay-\${i}-\${pf.col}\`"
                v-show="isVisible(pf, { mode: currentMode, form: registrationForm, row: p, index: i })">
                {{ pf.label }}
                <small class="error" v-if="registrationErrors?.payments?.[i]?.[pf.col]">{{ registrationErrors.payments[i][pf.col] }}</small>

                <template v-if="pf.type === 'select'">
                  <select
                    class="input"
                    :id="\`reg-pay-\${i}-\${pf.col}\`"
                    :name="\`registration.payments[\${i}].\${pf.col}\`"
                    :disabled="getFieldDisabled(pf, { mode: currentMode, form: registrationForm, row: p, index: i, isReadOnly })"
                    v-model="p[pf.col]"
                    @input="onFormFieldInput(pf, { mode: currentMode, form: registrationForm, row: p, index: i }, $event)"
                    @change="onFormFieldChange(pf, { mode: currentMode, form: registrationForm, row: p, index: i }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(pf, { mode: currentMode, form: registrationForm, row: p, index: i })"
                      :key="String(opt.value)"
                      :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    class="input"
                    :type="pf.type || 'text'"
                    :id="\`reg-pay-\${i}-\${pf.col}\`"
                    :name="\`registration.payments[\${i}].\${pf.col}\`"
                    :disabled="getFieldDisabled(pf, { mode: currentMode, form: registrationForm, row: p, index: i, isReadOnly })"
                    v-model.trim="p[pf.col]"
                    @input="onFormFieldInput(pf, { mode: currentMode, form: registrationForm, row: p, index: i }, $event)"
                    @change="onFormFieldChange(pf, { mode: currentMode, form: registrationForm, row: p, index: i }, $event)" />
                </template>
              </label>
            </div>
          </div>
        </section>

        <!-- Notes/Logs -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Notes/Logs</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" class="btn small accent" type="button" :disabled="isReadOnly" @click="addRegNote">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="row" v-for="(n, i) in registrationForm.notes" :key="'rn'+i">
            <div class="row-actions">
              <button tabindex="-1" class="btn small danger" type="button" :disabled="isReadOnly" @click="removeRegNote(i)">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="grid">
              <label
                v-for="f in registrationFields.notes"
                :key="f.col"
                :for="\`reg-note-\${i}-\${f.col}\`"
                :class="fieldClass ? fieldClass(f, { form: n, index: i }) : ''"
                v-show="isVisible(f, { mode: currentMode, form: registrationForm, row: n, index: i })">
                {{ f.label }}
                <small class="error" v-if="registrationErrors?.notes?.[i]?.[f.col]">{{ registrationErrors.notes[i][f.col] }}</small>

                <template v-if="f.type === 'select'">
                  <select
                    class="input"
                    :id="\`reg-note-\${i}-\${f.col}\`"
                    :name="\`registration.notes[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, { mode: currentMode, form: registrationForm, row: n, index: i, isReadOnly })"
                    v-model="n[f.col]"
                    @input="onFormFieldInput(f, { mode: currentMode, form: registrationForm, row: n, index: i }, $event)"
                    @change="onFormFieldChange(f, { mode: currentMode, form: registrationForm, row: n, index: i }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option v-for="opt in getOptions(f, { mode: currentMode, form: registrationForm, row: n, index: i })" :key="String(opt.value)" :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    class="input"
                    :type="f.type || 'text'"
                    :id="\`reg-note-\${i}-\${f.col}\`"
                    :name="\`registration.notes[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, { mode: currentMode, form: registrationForm, row: n, index: i, isReadOnly })"
                    v-model.trim="n[f.col]"
                    :placeholder="f.placeholder"
                    @input="onFormFieldInput(f, { mode: currentMode, form: registrationForm, row: n, index: i }, $event)"
                    @change="onFormFieldChange(f, { mode: currentMode, form: registrationForm, row: n, index: i }, $event)" />
                </template>
              </label>
            </div>
          </div>
        </section>

        <!-- Status and Acceptance -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Status and Acceptance</h4>
          </div>

          <div class="grid">
            <label
              v-for="mf in registrationFields.meta"
              :key="mf.col"
              :for="\`reg-meta-\${mf.col}\`"
              v-show="isVisible(mf, { mode: currentMode, form: registrationForm })">
              {{ mf.label }}
              <small class="error" v-if="registrationErrors?.[mf.col]">{{ registrationErrors[mf.col] }}</small>

              <template v-if="mf.type === 'select'">
                <select
                  class="input"
                  :id="\`reg-meta-\${mf.col}\`"
                  :name="\`registration.\${mf.col}\`"
                  v-model="registrationForm[mf.col]"
                  :disabled="getFieldDisabled(mf, { mode: currentMode, form: registrationForm, isReadOnly })"
                  @input="onFormFieldInput(mf, { mode: currentMode, form: registrationForm }, $event)"
                  @change="onFormFieldChange(mf, { mode: currentMode, form: registrationForm }, $event)">
                  <option disabled value="">-- choose --</option>
                  <option v-for="opt in getOptions(mf, { mode: currentMode, form: registrationForm })" :key="String(opt.value)" :value="opt.value">
                    {{ formatOptionLabel(opt) }}
                  </option>
                </select>
              </template>

              <template v-else>
                <input
                  class="input"
                  :type="mf.type || 'text'"
                  :id="\`reg-meta-\${mf.col}\`"
                  :name="\`registration.\${mf.col}\`"
                  v-model.trim="registrationForm[mf.col]"
                  :placeholder="mf.placeholder"
                  :disabled="getFieldDisabled(mf, { mode: currentMode, form: registrationForm, isReadOnly })"
                  @input="onFormFieldInput(mf, { mode: currentMode, form: registrationForm }, $event)"
                  @change="onFormFieldChange(mf, { mode: currentMode, form: registrationForm }, $event)" />
              </template>
            </label>
          </div>
        </section>
      </form>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
