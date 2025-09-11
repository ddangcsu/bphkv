// Reusable pager for any array-like ref/computed
(function (global) {
  const U = global.Util || (global.Util = {});
  const Helpers = U.Helpers || (U.Helpers = {});

  Helpers.createPager = function createPager({
    source,
    pageSizeOptions = [5, 10, 15, 0], // 0 - All
    initialPageSize = 10,
    allSentinel = 0,
  } = {}) {
    const { ref, computed, watch } = global.Vue;

    if (!source || typeof source !== "object" || !("value" in source)) {
      throw new Error('createPager: "source" must be a ref/computed of an array');
    }

    const page = ref(1);
    const pageSize = ref(initialPageSize);
    const options = ref(pageSizeOptions.slice());

    const list = computed(() => (Array.isArray(source.value) ? source.value : []));
    const totalRows = computed(() => list.value.length);
    const isAll = computed(() => pageSize.value === allSentinel);
    const totalPages = computed(() => (isAll.value ? 1 : Math.max(1, Math.ceil(totalRows.value / pageSize.value))));
    const pageStart = computed(() => (isAll.value ? 0 : (page.value - 1) * pageSize.value));
    const pageEnd = computed(() => (isAll.value ? totalRows.value : pageStart.value + pageSize.value));
    const items = computed(() => (isAll.value ? list.value : list.value.slice(pageStart.value, pageEnd.value)));

    watch([list, pageSize], () => {
      page.value = 1;
    });
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
      page.value = Math.min(Math.max(1, Number(newPage || 1)), totalPages.value);
    }
    function setPageSize(newSize) {
      pageSize.value = Number(newSize);
    }

    // At the end of Helpers.createPager(...)
    function asNumber(v) {
      return Number(v);
    }

    const pager = {
      // readable / writable so v-model works without .value
      get page() {
        return page.value;
      },
      set page(newPage) {
        setPage(asNumber(newPage));
      },

      get pageSize() {
        return pageSize.value;
      },
      set pageSize(newSize) {
        setPageSize(asNumber(newSize));
      },

      // read-only projections (no .value needed in templates)
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

      // methods
      goFirst,
      goPrev,
      goNext,
      goLast,
      setPage,
      setPageSize,
      allSentinel,
    };

    return pager;
  };
})(typeof window !== "undefined" ? window : globalThis);
