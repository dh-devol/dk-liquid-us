if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));

        // Works with either cart-notification or cart-drawer
        this.cart =
          document.querySelector('cart-notification') ||
          document.querySelector('cart-drawer');

        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer'))
          this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      async onSubmitHandler(evt) {
        evt.preventDefault();
        // Guard against a genuine in-flight request only. We deliberately do NOT gate on the
        // button's `aria-disabled` attribute: if a previous attempt ever left that attribute stuck
        // (a thrown error mid-handler, a rebuilt button after a variant switch, a blocked fetch),
        // gating on it would permanently dead-lock add-to-cart until a full page reload — which is
        // exactly the intermittent "nothing happens / had to refresh the page" behaviour reported.
        // A backstop timer clears the flag even if a synchronous throw skips the finally below, so
        // the button can never be stranded in memory.
        if (this.submitting) return;
        this.submitting = true;
        clearTimeout(this._submitGuardTimer);
        this._submitGuardTimer = setTimeout(() => { this.submitting = false; }, 10000);
        // Per-attempt reset: `this.error` is instance state that otherwise leaks across submits.
        // A stale `true` makes a later *successful* add skip the cartUpdate publish (so the header
        // count silently fails to refresh) and skip re-enabling the button in the finally.
        this.error = false;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.setSpinnerHidden(false);

        // Populate _Promise Date on any hidden inputs before collecting form data
        var maxLeadDays = 0;
        this.form.querySelectorAll('.js-promise-date-input').forEach(function (input) {
          var leadDays = parseInt(input.getAttribute('data-lead-days'), 10);
          if (leadDays > 0) {
            var date = new Date();
            date.setDate(date.getDate() + leadDays);
            var dd = date.getDate().toString().padStart(2, '0');
            var mm = (date.getMonth() + 1).toString().padStart(2, '0');
            var yy = date.getFullYear().toString().slice(-2);
            input.value = dd + '/' + mm + '/' + yy;
            if (leadDays > maxLeadDays) maxLeadDays = leadDays;
          }
        });

        // NOTE: the order-level `_Promise Date` cart attribute used to be written HERE, via an
        // un-awaited fetch('/cart/update.js') that ran CONCURRENTLY with the /cart/add.js below.
        // Two concurrent cart mutations race server-side: when the attribute write-back wins it
        // lands a cart snapshot taken *before* the add, silently dropping the just-added line —
        // the add still returns 200, so the UI says "added" but the item never persists. That was
        // the primary intermittent "adds nothing / says added but isn't" bug (reproduced live).
        // The attribute write is now DEFERRED until AFTER the add (+ any add-ons) via
        // updatePromiseDateAttribute(), called in the success handler below. The per-line
        // `properties[_Promise Date]` set on the hidden inputs above still ships WITH the add.

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        const quantityInput =
          this.form.querySelector('[name="quantity"]') ||
          document.querySelector(`[form="${this.form.id}"][name="quantity"]`);
        if (quantityInput && !formData.get('quantity')) {
          formData.set('quantity', quantityInput.value || '1');
        }

        const attemptedQty = parseInt(formData.get('quantity') || '1', 10);
        const variantId = formData.get('id');
        const stockData = this.getVariantStockData(variantId);
        if (stockData && stockData.management === 'shopify' && stockData.policy !== 'continue') {
          const inCart = parseInt(quantityInput?.dataset.cartQuantity || '0', 10) || 0;
          const available = Math.max(0, stockData.quantity - inCart);
          if (Number.isFinite(attemptedQty) && attemptedQty > available) {
            const message = window.cartStrings.quantityError
              .replace('[attempted]', attemptedQty)
              .replace('[available]', available);
            this.handleErrorMessage(message);
            if (this.cart && typeof this.cart.showError === 'function') {
              this.cart.showError(message);
            }
            this.error = true;
            this.submitButton.classList.remove('loading');
            this.setSpinnerHidden(true);
            this.submitButton.removeAttribute('aria-disabled');
            this.endSubmit();
            return;
          }
        }
        const perItemLimit = parseInt(this.dataset.perItemLimit || '0', 10);
        const cartQtyLimit = parseInt(this.dataset.cartQtyLimit || '0', 10);
        const cartQtyLimitTag = this.dataset.cartQtyLimitTag || '';

        let cartData = null;
        if (perItemLimit > 0 || (cartQtyLimit > 0 && cartQtyLimitTag)) {
          try {
            cartData = await fetch('/cart.js').then((r) => r.json());
          } catch (e) {
            console.warn('[product-form] cart fetch failed', e);
          }
        }

        if (perItemLimit > 0 && cartData) {
          const variantId = parseInt(this.querySelector('[name="id"]').value, 10);
          const inCartQty = cartData.items
            .filter((item) => item.id === variantId)
            .reduce((sum, item) => sum + item.quantity, 0);
          if (inCartQty + attemptedQty > perItemLimit) {
            const message = `You can only add ${perItemLimit} of this product to your cart.`;
            this.handleErrorMessage(message);
            if (this.cart && typeof this.cart.showError === 'function') this.cart.showError(message);
            this.submitButton.classList.remove('loading');
            this.setSpinnerHidden(true);
            this.submitButton.removeAttribute('aria-disabled');
            this.endSubmit();
            return;
          }
        }

        if (cartQtyLimit > 0 && cartQtyLimitTag && cartData) {
          const currentTotal = cartData.items.reduce((sum, item) => {
            return item.properties && item.properties['_cart_qty_tag'] === cartQtyLimitTag
              ? sum + item.quantity
              : sum;
          }, 0);
          if (currentTotal + attemptedQty > cartQtyLimit) {
            const displayTag = cartQtyLimit === 1 ? cartQtyLimitTag : cartQtyLimitTag + 's';
            const message = `Sorry, only ${cartQtyLimit} ${displayTag} can be added to your basket.`;
            this.handleErrorMessage(message);
            if (this.cart && typeof this.cart.showError === 'function') this.cart.showError(message);
            this.submitButton.classList.remove('loading');
            this.setSpinnerHidden(true);
            this.submitButton.removeAttribute('aria-disabled');
            this.endSubmit();
            return;
          }
        }

        // Bundle the selected add-ons with THIS parent line via a composite
        // group id (variant + sorted add-on variant ids), so two otherwise-
        // identical parent lines with DIFFERENT add-ons stay as separate cart
        // lines (Shopify only merges lines whose variant AND properties match),
        // while identical configurations still merge to one line. Mirrors the
        // composite _group_id the variable-price bundles already use.
        const _selectedExtras = this.getSelectedExtras();
        let addonGroupId = '';
        if (_selectedExtras.length) {
          const _addonIds = _selectedExtras.map((e) => e.variantId).sort((a, b) => a - b);
          addonGroupId = `${variantId}-${_addonIds.join('-')}`;
          formData.append('properties[_group_id]', addonGroupId);
        }

        try {
          const debug = {};
          formData.forEach((value, key) => {
            if (debug[key] === undefined) {
              debug[key] = value;
            } else if (Array.isArray(debug[key])) {
              debug[key].push(value);
            } else {
              debug[key] = [debug[key], value];
            }
          });
          console.log('[product-form] submit formData', debug);
        } catch (e) {
          console.log('[product-form] submit formData error', e);
        }

        /* ---------- NEW: guard the optional methods ---------- */
        if (this.cart) {
          if (typeof this.cart.getSectionsToRender === 'function') {
            formData.append(
              'sections',
              this.cart.getSectionsToRender().map((section) => section.id),
            );
          }
          formData.append('sections_url', window.location.pathname);

          if (typeof this.cart.setActiveElement === 'function') {
            this.cart.setActiveElement(document.activeElement);
          }
        }
        /* ----------------------------------------------------- */

        config.body = formData;

        const cartAddUrl = routes.cart_add_url.endsWith('.js')
          ? routes.cart_add_url
          : `${routes.cart_add_url}.js`;

        this.submitCartAdd(cartAddUrl, formData, config)
          .then(async (response) => {
            if (response.status) {
              const baseErrorMessage = response.errors || response.description || response.message;
              let availableQty = this.getAvailableQtyFromError(baseErrorMessage);
              // Shopify returns a numberless message when the cart already holds all available stock.
              // Fall back to the product's total stock quantity so we can still show our custom message.
              if (!Number.isFinite(availableQty) && stockData) {
                availableQty = stockData.quantity;
              }
              const resolvedMessage =
                Number.isFinite(attemptedQty) && Number.isFinite(availableQty)
                  ? window.cartStrings.quantityError
                      .replace('[attempted]', attemptedQty)
                      .replace('[available]', availableQty)
                  : baseErrorMessage;

              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: baseErrorMessage,
                message: response.message,
              });
              this.handleErrorMessage(resolvedMessage);
              if (this.cart && typeof this.cart.showError === 'function') {
                this.cart.showError(resolvedMessage);
              }

              const soldOutMessage =
                this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              });
            this.error = false;

            let renderResponse = response;
            const extras = this.getSelectedExtras();
            if (extras.length) {
              const sections = this.cart?.getSectionsToRender?.().map((section) => section.id) || [];
              const sectionsUrl = window.location.pathname;
              const mainQty = parseInt(formData.get('quantity') || '1', 10);
              const mainProductId = parseInt(formData.get('product-id') || '0', 10);
              const extrasResponse = await this.addExtrasToCart(
                cartAddUrl,
                extras,
                mainQty,
                mainProductId,
                sections,
                sectionsUrl,
                addonGroupId
              );
              if (extrasResponse) {
                // Use updated sections from last addon add, but keep main product info for notification
                renderResponse = Object.assign({}, extrasResponse, {
                  product_title: response.product_title,
                  title: response.title,
                  items: response.items || [response],
                });
              }
            }

            // Item (and any add-ons) are now in the cart — write the order-level _Promise Date
            // attribute SEQUENTIALLY here, never concurrently with an add, so it can no longer
            // clobber the line we just added. Awaited so the in-flight guard stays held and a fast
            // second add can't race it either. Non-fatal on failure.
            if (maxLeadDays > 0) {
              await this.updatePromiseDateAttribute(maxLeadDays);
            }

            if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            // The mini cart can only redraw from `sections`; the add response sometimes omits them.
            // Backfill from the GET Section Rendering API so the count/notification always update.
            renderResponse = await this.ensureCartSections(renderResponse);

            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(renderResponse);
                  });
                },
                { once: true },
              );
              quickAddModal.hide(true);
            } else {
              this.cart.renderContents(renderResponse);
            }
          })
          .catch((e) => console.error(e))
          .finally(() => {
            this.endSubmit();
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty'))
              this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.setSpinnerHidden(true);
          });
      }

      /* ---------- unchanged helper methods ---------- */

      // Clear the in-flight guard. Called on every exit path (early returns + finally) so a stuck
      // flag can never permanently block future add-to-cart clicks.
      endSubmit() {
        this.submitting = false;
        clearTimeout(this._submitGuardTimer);
      }

      // Null-safe spinner toggle. The spinner lives inside the submit button, which can be rebuilt
      // by the combined-listing variant switch; a raw `.classList` access on a missing node would
      // throw synchronously and strand the button mid-submit.
      setSpinnerHidden(hidden) {
        const spinner = this.querySelector('.loading__spinner');
        if (spinner) spinner.classList.toggle('hidden', hidden);
      }

      // Write the order-level `_Promise Date` cart attribute (greatest lead time across all cart
      // items). MUST be called AFTER the add so it never races /cart/add.js — concurrent cart
      // mutations can drop the just-added line. Non-fatal on failure (attribute is non-critical).
      updatePromiseDateAttribute(maxLeadDays) {
        return fetch('/cart.js')
          .then(function (r) { return r.json(); })
          .then(function (cart) {
            var greatest = maxLeadDays;
            (cart.items || []).forEach(function (item) {
              var lt = parseInt((item.properties || {})['_lead_time_days'], 10);
              if (lt > greatest) greatest = lt;
            });
            var d = new Date();
            d.setDate(d.getDate() + greatest);
            var dd = d.getDate().toString().padStart(2, '0');
            var mm = (d.getMonth() + 1).toString().padStart(2, '0');
            var yy = d.getFullYear().toString().slice(-2);
            return fetch('/cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attributes: { '_Promise Date': dd + '/' + mm + '/' + yy } }),
            });
          })
          .catch(function () { /* silent — attribute is non-critical */ });
      }

      // The cart AJAX endpoints sometimes return `sections: null` (notably while the store is
      // password-protected / pre-launch), leaving the mini cart with nothing to redraw. The GET
      // Section Rendering API is unaffected, so when the add response is missing the section(s)
      // the cart needs, fetch them via GET and merge them in — keyed by BOTH `id` and `section`
      // so it works whichever key the cart component reads. No-op once Shopify returns sections.
      async ensureCartSections(response) {
        try {
          if (!this.cart || typeof this.cart.getSectionsToRender !== 'function') return response;
          const list = this.cart.getSectionsToRender();
          const have = response && response.sections;
          const need = list.filter((s) => {
            const key = s.id || s.section;
            return key && (!have || have[key] == null);
          });
          if (!need.length) return response;
          const apiIds = [...new Set(need.map((s) => s.section || s.id).filter(Boolean))];
          const base = typeof routes !== 'undefined' && routes.cart_url ? routes.cart_url : '/cart';
          const fetched = await fetch(`${base}?sections=${encodeURIComponent(apiIds.join(','))}`).then((r) => r.json());
          response = response || {};
          response.sections = Object.assign({}, response.sections);
          need.forEach((s) => {
            const html = fetched[s.section || s.id];
            if (html != null) {
              if (s.id) response.sections[s.id] = html;
              if (s.section) response.sections[s.section] = html;
            }
          });
        } catch (e) {
          /* silent — mini cart will catch up on next page load */
        }
        return response;
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper ||
          this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) {
          this.errorMessageWrapper = document.createElement('div');
          this.errorMessageWrapper.className =
            'product-form__error-message-wrapper';
          this.errorMessageWrapper.setAttribute('role', 'alert');
          const icon = document.createElement('span');
          icon.className = 'svg-wrapper';
          const message = document.createElement('span');
          message.className = 'product-form__error-message';
          this.errorMessageWrapper.appendChild(icon);
          this.errorMessageWrapper.appendChild(message);
          this.prepend(this.errorMessageWrapper);
        }
        if (!this.errorMessageWrapper) return;
        this.errorMessage =
          this.errorMessage ||
          this.errorMessageWrapper.querySelector(
            '.product-form__error-message',
          );

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }

      getAvailableQtyFromError(errorMessage) {
        if (!errorMessage || typeof errorMessage !== 'string') return NaN;
        const match = errorMessage.match(/(\d+)/);
        if (!match) return NaN;
        return parseInt(match[1], 10);
      }

      getSelectedExtras() {
        if (!this.form) return [];
        const allCheckboxes = Array.from(this.form.querySelectorAll('.brass-checkbox'));
        return Array.from(this.form.querySelectorAll('.brass-checkbox:checked'))
          .filter((input) => input.dataset.available !== 'false')
          .map((input) => ({
            variantId: parseInt(input.value, 10),
            sort: allCheckboxes.indexOf(input),
          }))
          .filter((item) => Number.isFinite(item.variantId));
      }

      async addExtrasToCart(cartAddUrl, extras, mainQty, mainProductId, sections, sectionsUrl, groupId) {
        let lastResponse = null;
        for (let index = 0; index < extras.length; index += 1) {
          const extra = extras[index];

          // Get lead time from checkbox data attributes
          const addonCheckbox = document.querySelector(`.brass-checkbox[value="${extra.variantId}"]`);
          const addonLeadTime = addonCheckbox ? addonCheckbox.getAttribute('data-lead-time') : null;
          const addonLeadTimeDays = addonCheckbox ? addonCheckbox.getAttribute('data-lead-time-days') : null;

          const body = {
            id: extra.variantId,
            quantity: mainQty,
            properties: {
              '_Added as add-on': 'true',
              '_group_id': groupId || String(mainProductId),
              '_addon_sort': String(extra.sort),
              'Availability': addonLeadTime,
            },
          };

          if (sections?.length && index === extras.length - 1) {
            body.sections = sections;
            body.sections_url = sectionsUrl;
          }

          const extraConfig = fetchConfig('javascript');
          extraConfig.headers['X-Requested-With'] = 'XMLHttpRequest';
          extraConfig.headers['Content-Type'] = 'application/json';
          extraConfig.body = JSON.stringify(body);

          try {
            lastResponse = await this.submitCartAdd(cartAddUrl, body, extraConfig);
          } catch (error) {
            console.warn('[product-form] failed to add extra product', variantId, error);
          }
        }

        return lastResponse;
      }

      getVariantStockData(variantId) {
        if (!variantId) return null;
        const sectionId = this.dataset.sectionId;
        if (!sectionId) return null;
        const inventoryScript = document.getElementById(`ProductInventory-${sectionId}`);
        if (!inventoryScript) return null;
        if (!this.inventoryMap) {
          try {
            this.inventoryMap = JSON.parse(inventoryScript.textContent.trim());
          } catch (error) {
            console.warn('[product-form] invalid inventory JSON', error);
            this.inventoryMap = {};
          }
        }
        return this.inventoryMap[variantId] || null;
      }

      submitCartAdd(cartAddUrl, formData, config) {
        return fetch(cartAddUrl, config)
          .then(async (response) => {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return response.json();
            }

            const text = await response.text();
            try {
              return JSON.parse(text);
            } catch (error) {
              console.warn('[product-form] non-JSON response, retrying with XHR', {
                status: response.status,
                url: response.url,
                textPreview: text.slice(0, 200),
              });
              return this.submitCartAddViaXhr(cartAddUrl, formData);
            }
          })
          .catch((error) => {
            console.warn('[product-form] fetch failed, retrying with XHR', error);
            return this.submitCartAddViaXhr(cartAddUrl, formData);
          });
      }

      submitCartAddViaXhr(cartAddUrl, formData) {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', cartAddUrl, true);
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          xhr.setRequestHeader('Accept', 'application/json');
          xhr.responseType = 'json';

          xhr.onload = () => {
            const response = xhr.response || {};
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
              return;
            }

            if (response.status == null) response.status = xhr.status;
            if (!response.message) response.message = xhr.statusText || 'Add to cart failed.';
            resolve(response);
          };

          xhr.onerror = () => {
            reject(new Error('Cart add request failed.'));
          };

          xhr.send(formData);
        });
      }
    },
  );
}
