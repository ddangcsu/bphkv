/* eslint-env browser, es2021 */
/* global Vue */
(function (global) {
  'use strict';

  const U = global.Util || (global.Util = {});
  const Helpers = U.Helpers || (U.Helpers = {});

  /**
   * Reusable pager for any array-like ref/computed
   * PUBLIC API (matches your templates):
   *  props: page, pageSize, options, isAll, totalRows, totalPages, pageStart, pageEnd, items, allSentinel
   *  methods: goFirst, goPrev, goNext, goLast, setPage, setPageSize
   *  constant: allSentinel === 0  (0 means "All")
   */
  Helpers.createPager = function createPager({
    source,
    pageSizeOptions = [5, 10, 15, 0], // 0 === All
    initialPageSize = 10,
    allSentinel = 0,
  } = {}) {
    const { ref, computed, watch } = global.Vue;

    if (!source || typeof source !== 'object' || !('value' in source)) {
      throw new Error('createPager: "source" must be a ref/computed of an array');
    }

    const page = ref(1);
    const pageSize = ref(initialPageSize);
    const options = ref([...pageSizeOptions]);

    const list = computed(() => (Array.isArray(source.value) ? source.value : []));
    const totalRows = computed(() => list.value.length);
    const isAll = computed(() => Number(pageSize.value) === Number(allSentinel));

    const totalPages = computed(() =>
      isAll.value ? 1 : Math.max(1, Math.ceil(totalRows.value / Math.max(1, Number(pageSize.value)))),
    );

    const pageStart = computed(() => (isAll.value ? 0 : (page.value - 1) * Number(pageSize.value)));
    const pageEnd = computed(() => (isAll.value ? totalRows.value : pageStart.value + Number(pageSize.value)));
    const items = computed(() => (isAll.value ? list.value : list.value.slice(pageStart.value, pageEnd.value)));

    // Reset to first page when data or size changes
    watch([list, pageSize], () => {
      page.value = 1;
    });
    // Clamp page if total pages shrinks
    watch(totalPages, () => {
      if (page.value > totalPages.value) page.value = totalPages.value;
    });

    function goFirst() {
      page.value = 1;
    }
    function goPrev() {
      page.value = Math.max(1, page.value - 1);
    }
    function goNext() {
      page.value = Math.min(totalPages.value, page.value + 1);
    }
    function goLast() {
      page.value = totalPages.value;
    }

    function setPage(newPage) {
      const n = Number(newPage || 1);
      page.value = Math.min(Math.max(1, Number.isFinite(n) ? n : 1), totalPages.value);
    }

    function setPageSize(newSize) {
      const n = Number(newSize);
      pageSize.value = Number.isFinite(n) ? n : initialPageSize;
    }

    // Getter-based surface (so templates don’t use .value)
    return {
      get page() {
        return page.value;
      },
      set page(v) {
        setPage(v);
      },
      get pageSize() {
        return pageSize.value;
      },
      set pageSize(v) {
        setPageSize(v);
      },
      get options() {
        return options.value;
      },
      get isAll() {
        return isAll.value;
      },
      get totalRows() {
        return totalRows.value;
      },
      get totalPages() {
        return totalPages.value;
      },
      get pageStart() {
        return pageStart.value;
      },
      get pageEnd() {
        return pageEnd.value;
      },
      get items() {
        return items.value;
      },

      goFirst,
      goPrev,
      goNext,
      goLast,
      setPage,
      setPageSize,
      allSentinel,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
