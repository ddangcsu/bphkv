/* eslint-env browser, es2021 */
/* global Vue */
(function attachEventsForm(global) {
  'use strict';

  const Components = global.Components || (global.Components = {});
  const { computed } = Vue;

  // Drop-in: mirrors your index.html form exactly.
  Components.EventsForm = {
    name: 'events-form',
    props: {
      // data
      eventForm: { type: Object, required: true },
      eventErrors: { type: Object, required: true },
      eventFields: { type: Object, required: true },

      // ui state
      // accept both uppercase and lowercase from the DOM
      mode: { type: Object, default: null },
      readonly: { type: Boolean, default: null },
      isReadOnly: { type: Boolean, required: true },
      isEventDirty: { type: Boolean, default: true }, // optional; defaults to true so Save isn’t disabled
      currentMode: { type: String, default: '' },
      showPrerequisites: { type: Boolean, default: false },

      // helpers (pass existing ones from app.js)
      getOptions: { type: Function, required: true },
      formatOptionLabel: { type: Function, required: true },
      onFormFieldChange: { type: Function, required: true },
      onFormFieldInput: { type: Function, required: true },
      relativeDisplayValue: { type: Function, required: true },
      fieldClass: { type: Function, required: true },
      isVisible: { type: Function, required: true },
      getFieldDisabled: { type: Function, required: true },

      // actions wiring (names match your existing methods)
      addEventFee: { type: Function, required: true },
      removeEventFee: { type: Function, required: true },
      addEventPrerequisiteRow: { type: Function, required: true },
      removeEventPrerequisiteRow: { type: Function, required: true },
    },
    emits: ['save', 'cancel', 'toggle-readonly'],

    setup(props, { emit }) {
      const fees = computed(() => props.eventForm.fees || []);
      const prerequisites = computed(() => props.eventForm.prerequisites || []);
      const readonlyFlag = computed(() => props.readonly || false);
      const lockIcon = computed(() => (readonlyFlag.value ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open'));

      return {
        fees,
        prerequisites,
        lockIcon,
        save: () => emit('save'),
        cancel: () => emit('cancel'),
        toggleReadonly: () => emit('toggle-readonly'),
      };
    },
    template: `
      <form class="card form" @submit.prevent.stop="save" novalidate autocomplete="off">
        <div class="formtabs-bar">
          <nav class="formtabs" role="tablist" aria-label="Event Form Section">
            <button tabindex="-1" type="button" class="active" role="tab" aria-selected="true" aria-controls="panel-event">
              Event Information
            </button>
          </nav>

          <div class="formtabs-actions">
              <button v-show="mode.EDIT" type="button" class="btn" @click="toggleReadonly">
              <i :class="lockIcon"></i>
            </button>
            <button tabindex="-1" type="button" class="btn primary" :disabled="isReadOnly || !isEventDirty" @click="save">
              <i class="fa-solid fa-floppy-disk"></i><span> Save</span>
            </button>
            <button tabindex="-1" type="button" class="btn secondary" @click="cancel">
              <i class="fa-solid fa-xmark"></i><span> Cancel</span>
            </button>
          </div>
        </div>

        <!-- Meta-driven main fields -->
        <section class="subpanel" id="panel-event" role="tabpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Event Information</h4>
          </div>

          <div class="grid">
            <label
              v-for="fld in eventFields.main"
              :key="fld.col"
              v-show="isVisible(fld, {mode: currentMode, form: eventForm})"
              :for="\`event-\${fld.col}\`"
              :class="fieldClass(fld, {mode: currentMode, form: eventForm})"
            >
              {{ fld.label }}
              <small class="error" v-if="eventErrors[fld.col]">{{ eventErrors[fld.col] }}</small>

              <template v-if="fld.type === 'select'">
                <select
                  class="input"
                  v-model="eventForm[fld.col]"
                  :id="\`event-\${fld.col}\`"
                  :name="\`event.\${fld.col}\`"
                  :disabled="getFieldDisabled(fld, {mode: currentMode, form: eventForm, isReadOnly})"
                  @input="onFormFieldInput(fld, {mode: currentMode, form: eventForm }, $event)"
                  @change="onFormFieldChange(fld, {mode: currentMode, form: eventForm }, $event)"
                >
                  <option disabled value="">-- choose --</option>
                  <option
                    v-for="opt in getOptions(fld, {mode: currentMode, form: eventForm })"
                    :key="String(opt.value)"
                    :value="opt.value"
                  >
                    {{ formatOptionLabel(opt) }}
                  </option>
                </select>
              </template>

              <template v-else>
                <input
                  :class="fld.type === 'checkbox' ? 'check-lg' : 'input'"
                  :type="fld.type || 'text'"
                  v-model.trim="eventForm[fld.col]"
                  :id="\`event-\${fld.col}\`"
                  :name="\`event.\${fld.col}\`"
                  :placeholder="fld.placeholder"
                  v-bind="fld.attrs || {}"
                  :disabled="getFieldDisabled(fld, {mode: currentMode, form: eventForm, isReadOnly})"
                  @input="onFormFieldInput(fld, {mode: currentMode, form: eventForm }, $event)"
                  @change="onFormFieldChange(fld, {mode: currentMode, form: eventForm }, $event)"
                />
              </template>
            </label>
          </div>
        </section>

        <!-- Fees -->
        <section class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Event Fees</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" class="btn small accent" type="button" :disabled="isReadOnly" @click="addEventFee">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="row" v-for="(row,i) in fees" :key="'fee'+i">
            <div tabindex="-1" class="row-actions" style="align-self: end">
              <button
                class="btn small danger"
                type="button"
                :disabled="isReadOnly"
                @click="removeEventFee(i)"
                v-if="fees.length > 1"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="grid">
              <label
                v-for="rf in eventFields.feeRow"
                :key="rf.col"
                :for="\`event-fee-\${i}-\${rf.col}\`"
                v-show="isVisible(rf, {mode: currentMode, form: eventForm, row, index: i})"
              >
                {{ rf.label }}
                <small class="error" v-if="eventErrors?.fees?.[i]?.[rf.col]">{{ eventErrors.fees[i][rf.col] }}</small>

                <template v-if="rf.type === 'select'">
                  <select
                    class="input"
                    v-model="row[rf.col]"
                    :id="\`event-fee-\${i}-\${rf.col}\`"
                    :name="\`event.fees[\${i}].\${rf.col}\`"
                    :disabled="getFieldDisabled(rf, {mode: currentMode, form: eventForm, row, index: i, isReadOnly})"
                    @input="onFormFieldInput(rf, {mode: currentMode, form: eventForm, row, index: i}, $event)"
                    @change="onFormFieldChange(rf, {mode: currentMode, form: eventForm, row, index: i}, $event)"
                  >
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(rf, {mode: currentMode, form: eventForm, row, index: i})"
                      :key="String(opt.value)"
                      :value="opt.value"
                    >
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    class="input"
                    :type="rf.type || 'text'"
                    v-model.number="row[rf.col]"
                    :disabled="getFieldDisabled(rf, {mode: currentMode, form: eventForm, row, index: i, isReadOnly})"
                    :id="\`event-fee-\${i}-\${rf.col}\`"
                    :name="\`event.fees[\${i}].\${rf.col}\`"
                    v-bind="rf.attrs || {}"
                    @input="onFormFieldInput(rf, {mode: currentMode, form: eventForm, row, index: i}, $event)"
                    @change="onFormFieldChange(rf, {mode: currentMode, form: eventForm, row, index: i}, $event)"
                  />
                </template>
              </label>
            </div>
          </div>
          <small class="error" v-if="eventErrors?.feeErrors">{{ eventErrors.feeErrors }}</small>
        </section>

        <!-- Prerequisites (non-ADM only) -->
        <section class="subpanel" v-if="showPrerequisites">
          <div class="item-header compact bordered">
            <h4 class="title">Event Prerequisites</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" class="btn small accent" type="button" :disabled="isReadOnly" @click="addEventPrerequisiteRow">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="row" v-for="(p, i) in prerequisites" :key="'pre'+i">
            <div class="row-actions" style="align-self: end">
              <button
                tabindex="-1"
                class="btn small danger"
                type="button"
                :disabled="isReadOnly"
                @click="removeEventPrerequisiteRow(i)"
                v-if="prerequisites.length > 1"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="grid">
              <template v-for="pf in eventFields.prerequisiteRow" :key="pf.col">
                <label
                  :for="\`event-prereq-\${i}-\${pf.col}\`"
                  v-show="isVisible(pf, {mode: currentMode, form: eventForm, row: p, index: i})"
                >
                  {{ pf.label }}
                  <small class="error" v-if="eventErrors?.prerequisites?.[i]?.[pf.col]">{{ eventErrors.prerequisites[i][pf.col] }}</small>
                  <select
                    class="input"
                    v-model="p[pf.col]"
                    :id="\`event-prereq-\${i}-\${pf.col}\`"
                    :name="\`event.prerequisites[\${i}].\${pf.col}\`"
                    :disabled="getFieldDisabled(pf, {mode: currentMode, form: eventForm, row: p, index: i, isReadOnly})"
                    @input="onFormFieldInput(pf, {mode: currentMode, form: eventForm, row: p, index: i}, $event)"
                    @change="onFormFieldChange(pf, {mode: currentMode, form: eventForm, row: p, index: i}, $event)"
                  >
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(pf, {mode: currentMode, form: eventForm, row: p, index: i})"
                      :key="String(opt.value)"
                      :value="opt.value"
                    >
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </label>

                <!-- Relative display columns -->
                <label v-for="rd in (pf.relativeDisplay || [])" :key="pf.col + '::' + rd.label">
                  {{ rd.label }}
                  <input
                    class="input"
                    :id="\`event-prereq-\${i}-\${pf.col}-\${rd.label}\`"
                    :name="\`event.prerequisites[\${i}].rd.\${rd.label}\`"
                    disabled
                    :value="relativeDisplayValue(p, pf, rd)"
                  />
                </label>
              </template>
            </div>
          </div>
          <small class="error" v-if="eventErrors?.preqErrors">{{ eventErrors.preqErrors }}</small>
        </section>
      </form>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
