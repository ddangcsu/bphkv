/* eslint-env browser, es2021 */
/* global Vue */
(function attachEventsToolbar(global) {
  'use strict';

  const Components = global.Components || (global.Components = {});
  const { computed } = Vue;

  // Drop-in toolbar that mirrors your original index.html markup/behavior 1:1
  Components.EventsToolbar = {
    name: 'events-toolbar',
    props: {
      pager: { type: Object, required: true }, // eventPager
      menu: { type: Object, required: true }, // eventsFilterMenu
      textFilter: { type: Object, required: true }, // eventsTextFilter
    },
    setup(props) {
      // formatting helpers identical to your template
      const startRow = computed(() =>
        props.pager.totalRows ? (props.pager.isAll ? 1 : props.pager.pageStart + 1) : 0,
      );
      const endRow = computed(() =>
        props.pager.isAll ? props.pager.totalRows : Math.min(props.pager.pageEnd, props.pager.totalRows),
      );

      function clearAll() {
        // same as your button: eventsFilterMenu.clear() && eventsTextFilter.clear()
        if (props.menu?.clear) props.menu.clear();
        if (props.textFilter?.clear) props.textFilter.clear();
      }

      return { startRow, endRow, clearAll };
    },
    template: `
      <div class="toolbar">
        <!-- Page size selector -->
        <div class="pager">
          <label class="nowrap">
            Rows:
            <select class="pager-size" v-model.number="pager.pageSize">
              <option v-for="n in pager.options" :key="n" :value="n">
                {{ n === pager.allSentinel ? "All" : n }}
              </option>
            </select>
          </label>

          <span>{{ startRow }}–{{ endRow }} of {{ pager.totalRows }}</span>

          <div class="pager-buttons">
            <button tabindex="-1" @click="pager.goFirst" :disabled="pager.page <= 1 || pager.isAll">
              <i class="fa fa-angle-double-left"></i>
            </button>
            <button tabindex="-1" @click="pager.goPrev" :disabled="pager.page <= 1 || pager.isAll">
              <i class="fa fa-angle-left"></i>
            </button>
          </div>

          <span>Page {{ pager.page }} / {{ pager.totalPages }}</span>

          <div class="pager-buttons">
            <button tabindex="-1" @click="pager.goNext" :disabled="pager.page >= pager.totalPages || pager.isAll">
              <i class="fa fa-angle-right"></i>
            </button>
            <button tabindex="-1" @click="pager.goLast" :disabled="pager.page >= pager.totalPages || pager.isAll">
              <i class="fa fa-angle-double-right"></i>
            </button>
          </div>
        </div>

        <!-- Filter menu button + popover -->
        <div class="filter-trigger">
          <button tabindex="-1" class="btn" @click="menu.toggle()">
            <i class="fa-solid fa-filter"></i>
            <span v-if="menu.activeCount">({{ menu.activeCount }})</span>
          </button>

          <div v-if="menu.isOpen" class="clickout-overlay" @click="menu.close()"></div>

          <div v-if="menu.isOpen" class="filter-popover" @click.stop>
            <div class="item-header compact bordered">
              <h4 class="title">Event Filter</h4>
            </div>
            <div class="filter-row" v-for="def in menu.definitions" :key="def.key">
              <label class="text-sm">{{ def.label }}</label>
              <select class="input" v-if="def.type==='select'" v-model="menu.state[def.key]">
                <option :value="def.emptyValue ?? ''">All</option>
                <option v-for="opt in menu.opt(def)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="filter-actions">
              <button tabindex="-1" class="btn" @click="menu.clear()">Clear</button>
              <button tabindex="-1" class="btn" @click="menu.close()">Close</button>
            </div>
          </div>
        </div>

        <!-- Filter text search (uses your existing querySearch field) -->
        <input
          v-model.trim="textFilter.querySearch"
          class="input"
          placeholder="Search events by ID or Description..."
        />

        <button
          tabindex="-1"
          class="btn small"
          type="button"
          @click="clearAll"
          title="Clear Program/Level/Year filters">
          Clear
        </button>
      </div>
    `,
  };
})(typeof window !== 'undefined' ? window : globalThis);
