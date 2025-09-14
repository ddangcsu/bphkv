/* eslint-env browser, es2021 */
/* global Vue */
(() => {
  const { ref, watch, h, onMounted, onBeforeUnmount, Teleport } = Vue;

  function getFocusable(root) {
    if (!root) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea',
      'input',
      'select',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    return Array.from(root.querySelectorAll(selectors)).filter(
      (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
    );
  }

  function trapTab(event, firstEl, lastEl) {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  }

  function sizeClass(size) {
    switch (size) {
      case 'sm':
        return 'ui-modal--sm';
      case 'lg':
        return 'ui-modal--lg';
      case 'xl':
        return 'ui-modal--xl';
      case 'full':
        return 'ui-modal--full';
      default:
        return 'ui-modal--md';
    }
  }

  const UiModal = {
    name: 'UiModal',
    props: {
      open: { type: Boolean, default: false },
      title: { type: String, default: '' }, // still supported
      size: { type: String, default: 'md' },
      placement: { type: String, default: 'center' }, // 'center' | 'top'
      topOffset: { type: [Number, String], default: 48 }, // px or CSS value
      closeOnBackdrop: { type: Boolean, default: true },
      closeOnEsc: { type: Boolean, default: true },
      ariaDescription: { type: String, default: '' },
      teleportTarget: { type: String, default: 'body' },
      backgroundInertSelector: { type: String, default: '#app' },
    },
    emits: ['update:open', 'after-open', 'after-close'],
    setup(props, { emit, slots, attrs }) {
      const overlayRef = ref(null);
      const dialogRef = ref(null);

      const headingId = `ui-modal-title-${Math.random().toString(36).slice(2)}`;
      const hasTitle = computed(() => {
        const slotNode = typeof slots.title === 'function' ? slots.title() : null;
        return Boolean(props.title || (slotNode && slotNode.length));
      });

      function setOpen(next) {
        emit('update:open', next);
      }
      function close() {
        setOpen(false);
      }

      function onBackdropClick(event) {
        if (!props.closeOnBackdrop) return;
        if (event.target === overlayRef.value) close();
      }

      function getFocusable(root) {
        if (!root) return [];
        const selectors = [
          'a[href]',
          'button:not([disabled])',
          'textarea',
          'input',
          'select',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',');
        return Array.from(root.querySelectorAll(selectors)).filter(
          (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
        );
      }

      function trapTab(event, firstEl, lastEl) {
        if (event.key !== 'Tab') return;
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }

      function onKeydown(event) {
        if (props.closeOnEsc && event.key === 'Escape') {
          event.stopPropagation();
          close();
          return;
        }
        const focusables = getFocusable(dialogRef.value);
        if (focusables.length >= 2) trapTab(event, focusables[0], focusables[focusables.length - 1]);
      }

      function focusFirst() {
        const focusables = getFocusable(dialogRef.value);
        (focusables[0] || dialogRef.value)?.focus({ preventScroll: true });
      }

      function applyBodyLock(lock) {
        const body = document.body;
        if (!body) return;
        if (lock) body.classList.add('ui-modal-open');
        else body.classList.remove('ui-modal-open');
      }

      // inside setup, reuse your open watcher:
      function toggleInert(enable) {
        const host = document.querySelector(props.backgroundInertSelector);
        if (!host) return;
        if (enable) host.setAttribute('inert', '');
        else host.removeAttribute('inert');
      }

      watch(
        () => props.open,
        (isOpen) => {
          if (isOpen) {
            document.addEventListener('keydown', onKeydown, true);
            applyBodyLock(true);
            toggleInert(true);
            requestAnimationFrame(() => {
              focusFirst();
              emit('after-open');
            });
          } else {
            document.removeEventListener('keydown', onKeydown, true);
            applyBodyLock(false);
            toggleInert(false);
            emit('after-close');
          }
        },
        { immediate: true },
      );

      onMounted(() => {
        if (props.open) {
          document.addEventListener('keydown', onKeydown, true);
          applyBodyLock(true);
          requestAnimationFrame(focusFirst);
        }
      });

      onBeforeUnmount(() => {
        document.removeEventListener('keydown', onKeydown, true);
        applyBodyLock(false);
        toggleInert(false);
      });

      // Build overlay classes and inline vars for full-height calculation
      const overlayClasses = computed(() =>
        ['ui-modal-overlay', sizeClass(props.size), props.placement === 'top' ? 'ui-modal--top' : '', attrs.class || '']
          .join(' ')
          .trim(),
      );

      const overlayStyle = computed(() => {
        const topPx = typeof props.topOffset === 'number' ? `${props.topOffset}px` : String(props.topOffset);
        // space below: 24px; vertical gap = top offset + bottom gap (top placement)
        const verticalGap = props.placement === 'top' ? `calc(${topPx} + 24px)` : '64px';
        return {
          ...(attrs.style || null),
          '--ui-top-offset': topPx,
          '--ui-vertical-gap': verticalGap,
        };
      });

      // ARIA: only set aria-labelledby if we actually render a title
      const dialogAria = computed(() =>
        hasTitle.value ? { 'aria-labelledby': headingId } : { 'aria-label': props.ariaDescription || 'Dialog' },
      );

      return () =>
        props.open
          ? h(Teleport, { to: props.teleportTarget }, [
              h(
                'div',
                {
                  ref: overlayRef,
                  class: overlayClasses.value,
                  style: overlayStyle.value,
                  onClick: onBackdropClick,
                },
                [
                  h(
                    'div',
                    {
                      ref: dialogRef,
                      role: 'dialog',
                      'aria-modal': 'true',
                      ...dialogAria.value,
                      class: 'ui-modal-dialog',
                      tabindex: '-1',
                    },
                    [
                      // header (compact when there is no title)
                      h('div', { class: `ui-modal-header${hasTitle.value ? '' : ' ui-modal-header--compact'}` }, [
                        // title area (left)
                        h(
                          'h2',
                          { id: headingId, class: 'ui-modal-title' },
                          hasTitle.value ? props.title || (typeof slots.title === 'function' ? slots.title() : '') : '',
                        ),
                        // actions + close (right)
                        h(
                          'div',
                          { class: 'ui-modal-header-actions' },
                          [
                            // new header-actions slot
                            typeof slots['header-actions'] === 'function' ? slots['header-actions']() : null,
                            // close button
                            h(
                              'button',
                              { type: 'button', class: 'ui-modal-close', 'aria-label': 'Close dialog', onClick: close },
                              [h('i', { class: 'fa-solid fa-xmark', 'aria-hidden': 'true' })],
                            ),
                          ].filter(Boolean),
                        ),
                      ]),

                      // body (flex:1; only this area scrolls)
                      h(
                        'div',
                        { class: 'ui-modal-body' },
                        [
                          props.ariaDescription ? h('p', { class: 'sr-only' }, props.ariaDescription) : null,
                          typeof slots.default === 'function' ? slots.default() : null,
                        ].filter(Boolean),
                      ),

                      // footer (optional)
                      typeof slots.footer === 'function'
                        ? h('div', { class: 'ui-modal-footer' }, slots.footer())
                        : null,
                    ],
                  ),
                ],
              ),
            ])
          : null;
    },
  };

  window.UiModal = UiModal;
})();
