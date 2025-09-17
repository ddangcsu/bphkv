/* eslint-env browser, es2021 */
/* global Vue */
(function attachFamiliesForm(global) {
  const Components = (window.Components ||= {});

  Components.FamiliesForm = {
    name: 'FamiliesForm',
    props: {
      // state
      mode: { type: Object, required: true }, // pass MODE from parent
      readonly: { type: Boolean, required: true }, // pass READONLY from parent
      isFamilyDirty: { type: Boolean, required: true },

      // data/errors/meta
      familyForm: { type: Object, required: true },
      familyErrors: { type: Object, required: true },
      familyFields: { type: Object, required: true },

      // helpers (use your existing signatures)
      isVisible: { type: Function, required: true },
      getFieldDisabled: { type: Function, required: true },
      onFormFieldInput: { type: Function, required: true },
      onFormFieldChange: { type: Function, required: true },
      getOptions: { type: Function, required: true },
      formatOptionLabel: { type: Function, required: true },
      fieldClass: { type: Function, required: false },
      displayChildNameAndAge: { type: Function, required: false },

      // row actions
      addFamilyContact: { type: Function, required: true },
      removeFamilyContact: { type: Function, required: true },
      addFamilyChild: { type: Function, required: true },
      removeFamilyChild: { type: Function, required: true },
      addFamilyNote: { type: Function, required: true },
      removeFamilyNote: { type: Function, required: true },

      // form actions
      submitFamilyForm: { type: Function, required: true },
      goBackSection: { type: Function, required: true },
    },
    emits: ['toggle-readonly'],
    setup(props, { emit }) {
      const { computed } = Vue;

      // Match your helper contexts
      const currentMode = computed(() => props.mode);
      const isReadOnly = computed(() => !!props.readonly);

      function toggleReadonly() {
        emit('toggle-readonly');
      }

      return {
        currentMode,
        isReadOnly,
        toggleReadonly,
      };
    },
    template: `
      <form class="card form" @submit.prevent.stop="submitFamilyForm" novalidate autocomplete="off">
        <div class="formtabs-bar">
          <nav class="formtabs" role="tablist" aria-label="Family form sections">
            <button tabindex="-1" type="button" class="active" role="tab" aria-controls="panel-family">Family Information</button>
          </nav>

          <div class="formtabs-actions">
            <button v-show="mode.EDIT" type="button" class="btn" @click="toggleReadonly">
              <i :class="isReadOnly ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open'"></i>
            </button>
            <button tabindex="-1" type="button" class="btn primary" :disabled="isReadOnly || !isFamilyDirty" @click="submitFamilyForm">
              <i class="fa-solid fa-floppy-disk"></i><span> Save</span>
            </button>
            <button tabindex="-1" type="button" class="btn" @click="goBackSection">
              <i class="fa-solid fa-xmark"></i><span> Cancel</span>
            </button>
          </div>
        </div>

        <!-- Household -->
        <section id="panel-household" role="tabpanel" class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Household Information</h4>
          </div>

          <div>
            <div class="grid">
              <label
                v-for="f in familyFields.household.main"
                :key="f.col"
                :for="\`household-\${f.col}\`"
                v-show="isVisible(f, {mode: currentMode, form: familyForm})">
                {{ f.label }}
                <small class="error" v-if="familyErrors?.[f.col]">{{ familyErrors[f.col] }}</small>

                <template v-if="f.type === 'select'">
                  <select
                    class="input"
                    :id="\`household-\${f.col}\`"
                    :name="\`family.\${f.col}\`"
                    v-model="familyForm[f.col]"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, isReadOnly})"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option v-for="opt in getOptions(f, {mode: currentMode, form: familyForm})" :key="String(opt.value)" :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    :class="f.type === 'checkbox' ? 'check-lg': 'input'"
                    :type="f.type || 'text'"
                    :id="\`household-\${f.col}\`"
                    :name="\`family.\${f.col}\`"
                    v-model.trim="familyForm[f.col]"
                    :placeholder="f.placeholder"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, isReadOnly})"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm }, $event)" />
                </template>
              </label>
            </div>

            <div class="grid">
              <label
                v-for="f in familyFields.household.address"
                :key="f.col"
                :for="\`household-address-\${f.col}\`"
                v-show="isVisible(f, {mode: currentMode, form: familyForm})">
                {{ f.label }}
                <small class="error" v-if="familyErrors?.address?.[f.col]">{{ familyErrors.address[f.col] }}</small>

                <template v-if="f.type === 'select'">
                  <select
                    class="input"
                    :id="\`household-address-\${f.col}\`"
                    :name="\`family.address.\${f.col}\`"
                    v-model="familyForm.address[f.col]"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, isReadOnly})"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option v-for="opt in getOptions(f, {mode: currentMode, form: familyForm})" :key="String(opt.value)" :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else-if="f.type === 'checkbox'">
                  <input
                    class="check-lg"
                    type="checkbox"
                    :id="\`household-address-\${f.col}\`"
                    :name="\`family.address.\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, isReadOnly})"
                    v-model="familyForm.address[f.col]"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm }, $event)" />
                </template>

                <template v-else>
                  <input
                    class="input"
                    :type="f.type || 'text'"
                    :id="\`household-address-\${f.col}\`"
                    :name="\`family.address.\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, isReadOnly})"
                    v-model.trim="familyForm.address[f.col]"
                    :placeholder="f.placeholder"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm }, $event)" />
                </template>
              </label>
            </div>
          </div>
        </section>

        <!-- Contacts -->
        <section id="panel-contacts" role="tabpanel" class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Contacts Information</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" type="button" class="btn small accent" :disabled="isReadOnly" @click="addFamilyContact">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div v-for="(row, i) in familyForm.contacts" :key="'c'+i" class="row">
            <div class="row-actions">
              <button
                tabindex="-1"
                type="button"
                class="btn small danger"
                :disabled="isReadOnly"
                @click="removeFamilyContact(i)"
                v-if="familyForm.contacts.length>1">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="grid">
              <label
                v-for="f in familyFields.contacts"
                :key="f.col"
                :for="\`contact-\${i}-\${f.col}\`"
                v-show="isVisible(f, {mode: currentMode, form: familyForm, row, index: i})">
                {{ f.label }}
                <small class="error" v-if="familyErrors?.contacts?.[i]?.[f.col]">{{ familyErrors.contacts[i][f.col] }}</small>

                <template v-if="f.type === 'select'">
                  <select
                    class="input"
                    :id="\`contact-\${i}-\${f.col}\`"
                    :name="\`family.contacts[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, row, index: i, isReadOnly})"
                    v-model="row[f.col]"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm, row, index: i }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm, row, index: i }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(f, {mode: currentMode, form: familyForm, row, index: i })"
                      :key="String(opt.value)"
                      :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    :class="f.type === 'checkbox' ? 'check-lg': 'input'"
                    :type="f.type || 'text'"
                    :id="\`contact-\${i}-\${f.col}\`"
                    :name="\`family.contacts[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, row, index: i, isReadOnly})"
                    v-model.trim="row[f.col]"
                    :placeholder="f.placeholder"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm, row, index: i }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm, row, index: i }, $event)" />
                </template>
              </label>
            </div>
          </div>
          <small class="error" v-if="familyErrors?.contactErrors">{{ familyErrors?.contactErrors }}</small>
        </section>

        <!-- Children -->
        <section id="panel-children" role="tabpanel" class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Children Information</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" type="button" class="btn small accent" :disabled="isReadOnly" @click="addFamilyChild">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="row" v-for="(row, i) in familyForm.children" :key="'ck'+i">
            <div class="item-header compact">
              <div class="title">
                <span>ID: {{row.childId}} - {{displayChildNameAndAge ? displayChildNameAndAge(row) : ''}}</span>
              </div>
              <div class="row-actions">
                <button
                  tabindex="-1"
                  type="button"
                  class="btn small danger"
                  :disabled="isReadOnly"
                  @click="removeFamilyChild(i)"
                  v-if="familyForm.children.length>1">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="grid">
              <label
                v-for="f in familyFields.children"
                :key="f.col"
                :for="\`child-\${i}-\${f.col}\`"
                v-show="isVisible(f, {mode: currentMode, form: familyForm, row, index: i })">
                {{ f.label }}
                <small class="error" v-if="familyErrors?.children?.[i]?.[f.col]">{{ familyErrors.children[i][f.col] }}</small>

                <template v-if="f.type === 'select'">
                  <select
                    class="input"
                    :id="\`child-\${i}-\${f.col}\`"
                    :name="\`family.children[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, row, index: i, isReadOnly})"
                    v-model="row[f.col]"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm, row, index: i }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm, row, index: i }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(f, {mode: currentMode, form: familyForm, row, index: i })"
                      :key="String(opt.value)"
                      :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    :class="f.type === 'checkbox' ? 'check-lg' : 'input'"
                    :type="f.type || 'text'"
                    :id="\`child-\${i}-\${f.col}\`"
                    :name="\`family.children[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, row, index: i, isReadOnly })"
                    v-model.trim="row[f.col]"
                    :placeholder="f.placeholder"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm, row, index: i }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm, row, index: i }, $event)" />
                </template>
              </label>
            </div>
          </div>
        </section>

        <!-- Notes -->
        <section id="panel-notes" role="tabpanel" class="subpanel">
          <div class="item-header compact bordered">
            <h4 class="title">Notes/Logs</h4>
            <div class="spacer"></div>
            <div class="actions">
              <button tabindex="-1" type="button" class="btn small accent" :disabled="isReadOnly" @click="addFamilyNote">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="row" v-for="(n,i) in familyForm.notes" :key="'note'+i">
            <div class="row-actions">
              <button tabindex="-1" type="button" class="btn small danger" :disabled="isReadOnly" @click="removeFamilyNote(i)">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>

            <div class="grid">
              <label
                v-for="f in familyFields.notes"
                :key="f.col"
                :for="\`note-\${i}-\${f.col}\`"
                :class="fieldClass ? fieldClass(f, { form: n, index: i }) : ''"
                v-show="isVisible(f, {mode: currentMode, form: familyForm, row: n, index: i })">
                {{ f.label }}
                <small class="error" v-if="familyErrors?.notes?.[i]?.[f.col]">{{ familyErrors.notes[i][f.col] }}</small>

                <template v-if="f.type === 'select'">
                  <select
                    class="input"
                    :id="\`note-\${i}-\${f.col}\`"
                    :name="\`family.note[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, row: n, index: i, isReadOnly })"
                    v-model="n[f.col]"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm, row: n, index: i }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm, row: n, index: i }, $event)">
                    <option disabled value="">-- choose --</option>
                    <option
                      v-for="opt in getOptions(f, {mode: currentMode, form: familyForm, row: n, index: i })"
                      :key="String(opt.value)"
                      :value="opt.value">
                      {{ formatOptionLabel(opt) }}
                    </option>
                  </select>
                </template>

                <template v-else>
                  <input
                    :class="f.type === 'checkbox' ? 'check-lg':'input'"
                    :type="f.type || 'text'"
                    :id="\`note-\${i}-\${f.col}\`"
                    :name="\`family.note[\${i}].\${f.col}\`"
                    :disabled="getFieldDisabled(f, {mode: currentMode, form: familyForm, row: n, index: i, isReadOnly })"
                    v-model.trim="n[f.col]"
                    :placeholder="f.placeholder"
                    @input="onFormFieldInput(f, {mode: currentMode, form: familyForm, row: n, index: i }, $event)"
                    @change="onFormFieldChange(f, {mode: currentMode, form: familyForm, row: n, index: i }, $event)" />
                </template>
              </label>
            </div>
          </div>
        </section>
      </form>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
