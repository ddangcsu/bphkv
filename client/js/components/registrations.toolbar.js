/* eslint-env browser, es2021 */
/* global Vue */
(function attachRegistrationsToolbar(global) {
  'use strict';
  const Components = global.Components || (global.Components = {});
  const { computed } = Vue;

  Components.RegistrationsToolbar = {
    name: 'RegistrationsToolbar',
    props: {
      pager: { type: Object, required: true },
      menu: { type: Object, required: true },
      textFilter: { type: Object, required: true },
      title: { type: String, default: 'Registrations' },
    },
    emits: ['create', 'refresh'],
    setup(props, { emit }) {
      const rangeText = computed(() => {
        const p = props.pager;
        const total = p.totalRows || 0;
        if (!total) return '0–0';
        if (p.isAll) return `1–${total}`;
        const start = (p.pageStart ?? 0) + 1;
        const end = Math.min(p.pageEnd ?? 0, total);
        return `${start}–${end}`;
      });
      const totalPages = computed(() => props.pager.totalPages || 1);

      function clearAll() {
        props.menu.clear();
        props.textFilter.clear();
      }

      return {
        rangeText,
        totalPages,
        emit,
        clearAll,
      };
    },
    template: `
      <div class="toolbar">
        <!-- Page size + counts + nav -->
        <div class="pager">
          <label class="nowrap">
            Rows:
            <select class="pager-size" v-model.number="pager.pageSize">
              <option v-for="n in pager.options" :key="n" :value="n">
                {{ n === pager.allSentinel ? 'All' : n }}
              </option>
            </select>
          </label>

          <span>{{ rangeText }} of {{ pager.totalRows }}</span>

          <div class="pager-buttons">
            <button tabindex="-1" @click="pager.goFirst" :disabled="pager.page <= 1 || pager.isAll">
              <i class="fa fa-angle-double-left"></i>
            </button>
            <button tabindex="-1" @click="pager.goPrev" :disabled="pager.page <= 1 || pager.isAll">
              <i class="fa fa-angle-left"></i>
            </button>
          </div>

          <span>Page {{ pager.page }} / {{ totalPages }}</span>

          <div class="pager-buttons">
            <button tabindex="-1" @click="pager.goNext" :disabled="pager.page >= pager.totalPages || pager.isAll">
              <i class="fa fa-angle-right"></i>
            </button>
            <button tabindex="-1" @click="pager.goLast" :disabled="pager.page >= pager.totalPages || pager.isAll">
              <i class="fa fa-angle-double-right"></i>
            </button>
          </div>
        </div>

        <!-- Filter menu -->
        <div class="filter-trigger">
          <button tabindex="-1" class="btn" @click="menu.toggle()">
            <i class="fa-solid fa-filter"></i>
            <span v-if="menu.activeCount">({{ menu.activeCount }})</span>
          </button>
          <div v-if="menu.isOpen" class="clickout-overlay" @click="menu.close()"></div>
          <div v-if="menu.isOpen" class="filter-popover" @click.stop>
            <div class="item-header compact bordered">
              <h4 class="title">{{ title }} Filter</h4>
            </div>

            <div class="filter-row" v-for="def in menu.definitions" :key="def.key">
              <label class="text-sm">{{ def.label }}</label>
              <select class="input" v-if="def.type === 'select'" v-model="menu.state[def.key]">
                <option :value="def.emptyValue ?? ''">All</option>
                <option v-for="opt in menu.opt(def)" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="filter-actions">
              <button tabindex="-1" class="btn" @click="menu.clear()">Clear</button>
              <button tabindex="-1" class="btn" @click="menu.close()">Close</button>
            </div>
          </div>
        </div>

        <!-- Text search -->
        <input v-model.trim="textFilter.querySearch" class="input" placeholder="Search by Reg ID, Event, Phone, Receipt…" />

        <button tabindex="-1" class="btn" type="button" @click="clearAll" title="Clear filters">
          <i class="fa-solid fa-eraser"></i>
        </button>

        <div class="spacer"></div>

        <button tabindex="-1" class="btn" type="button" @click="emit('refresh', { showStatusIfActive: true })">
          <i class="fa-solid fa-rotate"></i>
        </button>
        <button tabindex="-1" class="btn primary" type="button" @click="emit('create')">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
