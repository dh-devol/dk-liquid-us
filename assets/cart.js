class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      const groupId = this.querySelector('a').dataset.groupId;
      if (groupId) {
        const qty = document.querySelector(
          `.quantity__input[data-group-id="${groupId}"]`
        ).value;
        const qtyDiff = 0 - qty;
        cartItems.updateBundleQuantity(groupId, qty, qtyDiff, this.dataset.index);
      } else {
        const addonKeysStr = this.dataset.addonKeys || '';
        const mainKey = this.dataset.mainKey;
        console.log('[CartRemoveButton]', this.id, '| addonKeys:', addonKeysStr || '(empty)', '| mainKey:', mainKey || '(missing)');
        if (addonKeysStr && mainKey) {
          const addonKeys = addonKeysStr.split(',').filter(Boolean);
          cartItems.removeWithAddons(this.dataset.index, mainKey, addonKeys);
        } else {
          cartItems.updateQuantity(this.dataset.index, 0);
        }
      }
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    const debouncedOnInput = debounce((event) => {
      if (!event.target.classList.contains('quantity__input')) return;
      event.target._pendingAutoUpdate = event.target.value;
      this.onChange(event);
    }, 1000);

    this.addEventListener('change', (event) => {
      if (
        event.target._pendingAutoUpdate !== undefined &&
        event.target._pendingAutoUpdate === event.target.value
      ) {
        event.target._pendingAutoUpdate = undefined;
        return;
      }
      debouncedOnChange(event);
    });

    this.addEventListener('input', debouncedOnInput.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;

    let message = '';

    const stockMessage = this.getStockLimitMessage(event.target, inputValue);
    if (stockMessage) {
      this.updateLiveRegions(index, stockMessage, { showNotification: true });
      this.resetQuantityInput(index);
      event.target.select();
      return;
    }

    const perItemLimitMessage = this.getPerItemLimitMessage(event.target, inputValue);
    if (perItemLimitMessage) {
      this.updateLiveRegions(index, perItemLimitMessage, { showNotification: true });
      this.resetQuantityInput(index);
      event.target.select();
      return;
    }

    const cartQtyLimitMessage = this.getCartQtyLimitMessage(event.target, inputValue);
    if (cartQtyLimitMessage) {
      this.updateLiveRegions(index, cartQtyLimitMessage, { showNotification: true });
      this.resetQuantityInput(index);
      event.target.select();
      return;
    }

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else {
      const step = parseInt(event.target.step, 10);
      if (Number.isFinite(step) && step > 1 && inputValue % step !== 0) {
        message = window.quickOrderListStrings.step_error.replace('[step]', step);
      }
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  getStockLimitMessage(input, attemptedQty) {
    if (!input || !Number.isFinite(attemptedQty)) return '';
    const management = input.dataset.inventoryManagement;
    const policy = input.dataset.inventoryPolicy;
    const inventoryQty = parseInt(input.dataset.inventoryQuantity, 10);

    if (management !== 'shopify' || policy === 'continue' || !Number.isFinite(inventoryQty)) {
      return '';
    }

    const cartQty = parseInt(input.dataset.cartQuantity || '0', 10) || 0;
    const currentLineQty = parseInt(input.getAttribute('value') || input.value || '0', 10) || 0;
    const available = Math.max(0, inventoryQty - (cartQty - currentLineQty));

    if (attemptedQty > available) {
      console.log('[stockLimit] triggered — inventoryQty:', inventoryQty, 'cartQty:', cartQty, 'currentLineQty:', currentLineQty, 'available:', available, 'attemptedQty:', attemptedQty);
      return window.cartStrings.quantityError
        .replace('[attempted]', attemptedQty)
        .replace('[available]', available);
    }

    return '';
  }

  getPerItemLimitMessage(input, attemptedQty) {
    const perItemLimit = parseInt(input.dataset.perItemLimit || '0', 10);
    if (!perItemLimit) return '';
    if (attemptedQty > perItemLimit) {
      const productName = input.dataset.productTitle || 'this product';
      return `You can only have ${perItemLimit} of ${productName} in your cart.`;
    }
    return '';
  }

  getCartQtyLimitMessage(input, attemptedQty) {
    const limit = parseInt(input.dataset.cartQtyLimit || '0', 10);
    if (!limit) return '';

    const limitTag = input.dataset.cartQtyLimitTag || '';
    const currentIndex = input.dataset.index;
    const productName = input.dataset.productTitle || limitTag || 'this product';

    // Sum server-confirmed quantities for other line items with the same limit tag,
    // deduplicating by data-index to avoid counting desktop + mobile inputs twice.
    let otherTotal = 0;
    const counted = new Set();
    this.querySelectorAll(`.quantity__input[data-cart-qty-limit-tag]`).forEach((other) => {
      if (other.dataset.cartQtyLimitTag !== limitTag) return;
      const otherIndex = other.dataset.index;
      if (otherIndex === currentIndex) return;
      if (counted.has(otherIndex)) return;
      counted.add(otherIndex);
      otherTotal += parseInt(other.getAttribute('value') || '0', 10) || 0;
    });

    if (otherTotal + attemptedQty > limit) {
      const label = input.dataset.cartQtyLimitTag || productName;
      const displayLabel = limit === 1 ? label : label + 's';
      return `Sorry, only ${limit} ${displayLabel} can be added to your basket.`;
    }
    return '';
  }

  async onChange(event) {
    // Find the changed input and its line/index
    const input = event.target;
    const line = input.dataset.index;
    const newQty = parseInt(input.value);
    const oldQty = parseInt(input.getAttribute('value'));
    const diff = newQty - oldQty;
    // Find the cart item row
    const cartItemRow = input.closest('.cart-item');
    if (!cartItemRow) {
      this.validateQuantity(event);
      return;
    }
    // Check if this is a main product (not an add-on)
    const allSubInputs = this.querySelectorAll('[data-addon-lines]');

    if (!allSubInputs.length) {
      this.validateQuantity(event);
      return;
    }

    const groupId = input.dataset.groupId;

    if (groupId.length > 0) {
      await this.updateBundleQuantity(groupId, newQty, diff, line);
    } else {
      const isAddon = input.hasAttribute('data-addon-lines');
      console.log(isAddon);

      if (!isAddon) {
        const updates = [];

        allSubInputs.forEach((subInput) => {
          const variantId = subInput.getAttribute('data-addon-lines');
          const currentQty = Number(subInput.value);

          if (currentQty !== newQty && variantId && newQty >= 1) {
            updates.push(
              fetch('/cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: variantId,
                  quantity: newQty
                })
              })
            );
          }
        });

        if (updates.length) {
          Promise.all(updates)
            .then(() => {
              console.log('All add-on quantities updated successfully');
            })
            .catch((e) => {
              console.error('Error updating add-on quantities:', e);
            });
        }
      }
      this.validateQuantity(event);
    }
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.cart-count-bubble',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, name, variantId, bundle) {
    this.enableLoading(line);

    // Save focused quantity input state before DOM re-render so we can restore
    // focus and cursor position without moving the element off-screen.
    const activeEl = document.activeElement;
    const savedInputState =
      activeEl &&
      activeEl.tagName === 'INPUT' &&
      activeEl.classList.contains('quantity__input') &&
      activeEl.closest('cart-items')
        ? {
            id: activeEl.id,
            value: activeEl.value,
            selectionStart: activeEl.selectionStart,
            selectionEnd: activeEl.selectionEnd,
            selectionDirection: activeEl.selectionDirection,
          }
        : null;

    let body = "";

    if (bundle) {
      body = JSON.stringify({
        updates: bundle,
        sections: this.getSectionsToRender().map((section) => section.section),
        sections_url: window.location.pathname
      });
    } else {
      body = JSON.stringify({
        line,
        quantity,
        sections: this.getSectionsToRender().map((section) => section.section),
        sections_url: window.location.pathname
      });
    }

    fetch(bundle ? routes.cart_update_url : routes.cart_change_url, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          console.log('[cartError] parsedState.errors:', parsedState.errors);
          if (quantityElement) quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors, { showNotification: true });
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');
        const mainContent = document.getElementById('MainContent');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);
        if (mainContent) mainContent.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
        });

        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        let showNotification = false;
        if (quantity !== 0 && items.length === parsedState.items.length && updatedValue !== quantity) {
          console.log('[updatedValueMismatch] attempted:', quantity, 'updatedValue:', updatedValue, 'items.length:', items.length, 'parsedState.items.length:', parsedState.items.length);
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError
              .replace('[attempted]', quantity)
              .replace('[available]', updatedValue);
            showNotification = true;
          }
        }
        this.updateLiveRegions(line, message, { showNotification });

        const lineItem =
          document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          const newInput = lineItem.querySelector(`[name="${name}"]`);
          if (cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, newInput);
          } else if (document.activeElement !== newInput) {
            newInput.focus();
          }
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
        }

        // Restore focus and cursor last, deferred to the next frame so it wins
        // over any synchronous focus calls above (which reset cursor to position 0).
        if (savedInputState) {
          const { id, selectionStart, selectionEnd, selectionDirection } = savedInputState;
          requestAnimationFrame(() => {
            const el = id ? document.getElementById(id) : null;
            if (el) {
              el.focus();
              // type="number" inputs return null for selectionStart (not supported by spec).
              // Calling setSelectionRange(null, null) coerces to (0,0) = caret at start.
              // Only restore selection when we have a real position (type="text" inputs).
              if (selectionStart !== null) {
                try {
                  el.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
                } catch (e) {}
              }
            }
          });
        }

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });

  }

  async updateBundleQuantity(group, qty, qtyDiff, line) {
    const cart = await fetch('/cart.js').then(r => r.json());

    const updates = {};
    let parent = {};
    let difference = 0;

    cart.items.forEach(item => {
      if (item.properties?._group_id !== group) return;

      const difference = item.properties?._bundle_base_qty
        ? qtyDiff * Number(item.properties._bundle_base_qty)
        : qtyDiff;
      
      if (item.properties._bundle_parent) {
        parent["id"] = item.id;
        parent["name"] = item.title;
      } 
      updates[item.id] = Math.max(0, item.quantity + difference);
    });

    this.updateQuantity(
      line, 
      qty,
      parent["name"],
      parent["id"],
      updates
    );
  }

  removeWithAddons(line, mainKey, addonKeys) {
    this.enableLoading(line);
    const updates = {};
    addonKeys.forEach((key) => { updates[key] = 0; });
    updates[mainKey] = 0;

    fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates,
        sections: this.getSectionsToRender().map((s) => s.section),
        sections_url: window.location.pathname,
      }),
    })
      .then((r) => r.json())
      .then((parsedState) => {
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');
        const mainContent = document.getElementById('MainContent');
        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);
        if (mainContent) mainContent.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState });
      })
      .catch(() => {
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  removeWithAddons(line, mainKey, addonKeys) {
    this.enableLoading(line);
    const updates = {};
    addonKeys.forEach((key) => { updates[key] = 0; });
    updates[mainKey] = 0;

    fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates,
        sections: this.getSectionsToRender().map((s) => s.section),
        sections_url: window.location.pathname,
      }),
    })
      .then((r) => r.json())
      .then((parsedState) => {
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');
        const mainContent = document.getElementById('MainContent');
        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);
        if (mainContent) mainContent.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState });
      })
      .catch(() => {
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message, options = {}) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) {
      const isDrawerError = lineItemError.id.includes('CartDrawer-');
      const shouldShowInline = !(options.showNotification && !isDrawerError) && message;
      const errorText = lineItemError.querySelector('.cart-item__error-text');
      if (errorText) errorText.textContent = shouldShowInline ? message : '';
      lineItemError.toggleAttribute('hidden', !shouldShowInline);
    }

    if (options.showNotification && message) {
      const notification = document.querySelector('cart-notification');
      if (notification && typeof notification.showError === 'function') {
        notification.showError(message);
      }
    }

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
