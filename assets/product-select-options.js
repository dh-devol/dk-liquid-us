(function () {
  if (window.addonAccordionInitialised) return; // only bind global listeners once
  window.addonAccordionInitialised = true;

  function initAccordions(root) {
    // Accordion
    root.querySelectorAll('.addon-accordion').forEach(function (wrapper) {
      if (wrapper.dataset.accordionInit) return; // avoid double-binding
      wrapper.dataset.accordionInit = 'true';

      var btn = wrapper.querySelector('.dropdown-accordion');
      var panel = wrapper.querySelector('.addon-select');
      if (!btn || !panel) return;

      btn.addEventListener('click', function () {
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        btn.toggleAttribute('open', !isOpen);
        panel.hidden = isOpen;
      });
    });

    // Single-select addons: click the selected one again to deselect
    root.querySelectorAll('.addon-list').forEach(function (list) {
      if (list.dataset.addonInit) return;
      list.dataset.addonInit = 'true';

      list.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;

        var label = e.target.closest('.addon-tick');
        if (!label) return;

        var input = label.querySelector('input[type="radio"]');
        if (!input || input.disabled) return;

        // Ignore the second click the browser forwards from the label to the input
        if (e.target === input) return;

        // Still the pre-click state here
        if (input.checked) {
          e.preventDefault(); // stop the browser re-selecting it
          input.checked = false;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAccordions(document); });
  } else {
    initAccordions(document);
  }

  // Re-run when a section is reloaded in the theme editor
  document.addEventListener('shopify:section:load', function (e) { initAccordions(e.target); });

  window.initAccordion = initAccordions; // keep your existing global for other bundles
})();

/* Add addons to cart alongside the main product */
(function () {
  if (window.addonCartInitialised) return; // only bind the submit listener once
  window.addonCartInitialised = true;

  const INJECTED_CLASS = 'addon-injected-prop';

  function setFormProperty(form, key, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'properties[' + key + ']';
    input.value = value;
    input.className = INJECTED_CLASS;
    form.appendChild(input);
  }

  function clearInjected(form) {
    form.querySelectorAll('.' + INJECTED_CLASS).forEach(function (el) { el.remove(); });
  }

  document.addEventListener('submit', async function (e) {
    const form = e.target;
    if (!form.matches('form[action*="/cart/add"]')) return;

    // Second pass: addons already added, let the theme add the main product
    if (form.dataset.addonsAdded === 'true') {
      delete form.dataset.addonsAdded;
      return;
    }

    // Remove properties left over from a previous add
    clearInjected(form);
    window.addonCartLastAdded = null;

    const scope = form.closest('.shopify-section') || document;
    const selected = Array.from(scope.querySelectorAll('[data-addon-input]')).filter(function (el) {
      if (el.disabled || !el.value) return false;
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
      return true; // <select>
    });

    if (!selected.length) return; // no addons: normal add-to-cart

    e.preventDefault();
    e.stopImmediatePropagation();

    const qtyInput = form.querySelector('[name="quantity"]') || scope.querySelector('[name="quantity"]');
    const quantity = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;

    // 13 characters: keeps cart.js on the addon path (not the >14 bundle path)
    const groupId = String(Date.now());

    let groupedCount = 0; // tickbox addons (existing convention, grouped in cart)
    let linkedCount = 0;  // image/dropdown addons (own line items)

    const items = selected.map(function (el) {
      const source = el.tagName === 'SELECT' ? el.options[el.selectedIndex] : el;
      const properties = {
        'Availability': source.dataset.availability || 'In Stock'
      };

      if (el.hasAttribute('data-addon-separate')) {
        // Image / dropdown: unique properties the existing cart logic ignores
        properties['_linked_addon'] = 'true';
        properties['_linked_group'] = groupId;
        linkedCount++;
      } else {
        // Tickbox: existing addon convention, grouped under the main product
        properties['_Added as add-on'] = 'true';
        properties['_group_id'] = groupId;
        properties['_addon_sort'] = String(groupedCount);
        groupedCount++;
      }

      return { id: Number(el.value), quantity: quantity, properties: properties };
    });

    const mainAvailabilityEl = scope.querySelector('[data-main-availability]');
    const mainAvailability = (mainAvailabilityEl && mainAvailabilityEl.dataset.mainAvailability) || 'In Stock';

    const submitBtn = e.submitter || form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.setAttribute('aria-disabled', 'true');

    try {
      const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      const res = await fetch(root + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items })
      });

      if (!res.ok) {
        const err = await res.json();
        if (submitBtn) submitBtn.removeAttribute('aria-disabled');
        alert(err.description || 'Sorry, one of the add-ons could not be added.');
        return;
      }

      const addonData = await res.json();
      window.addonCartLastAdded = addonData.items || [];

      // Main product properties, sent by the theme's own add-to-cart
      if (groupedCount > 0) setFormProperty(form, '_group_id', groupId);
      if (linkedCount > 0) setFormProperty(form, '_linked_group', groupId);
      setFormProperty(form, 'Availability', mainAvailability);

      // Re-enable BEFORE re-submitting, or the theme's handler bails out
      if (submitBtn) submitBtn.removeAttribute('aria-disabled');

      form.dataset.addonsAdded = 'true';
      form.requestSubmit(submitBtn || undefined);
    } catch (err) {
      console.error(err);
      if (submitBtn) submitBtn.removeAttribute('aria-disabled');
      alert('Sorry, something went wrong adding the add-ons.');
    }
  }, true);
})();