// Mobile-only accordion for delivery text (this template only)
(function () {
  const mq = window.matchMedia('(max-width: 749px)');

  function init(root) {
    root.querySelectorAll('[data-delivery-accordion]').forEach((wrapper) => {
      if (wrapper.dataset.accordionReady) return;
      const btn = wrapper.querySelector('[aria-controls]');
      if (!btn) return;
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      wrapper.dataset.accordionReady = 'true';

      function setOpen(open) {
        btn.setAttribute('aria-expanded', String(open));
        panel.hidden = !open;
      }

      function applyMode() {
        if (mq.matches) {
          wrapper.classList.add('is-open');
          setOpen(false);
        } else {
          wrapper.classList.remove('is-open');
          btn.removeAttribute('aria-expanded');
          panel.hidden = false;
        }
      }

      btn.addEventListener('click', () => {
        if (!mq.matches) return;
        setOpen(btn.getAttribute('aria-expanded') !== 'true');
      });

      mq.addEventListener('change', applyMode);
      applyMode();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(document));
  } else {
    init(document);
  }
  document.addEventListener('shopify:section:load', (e) => init(e.target));
})();