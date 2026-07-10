/*********************************************************
 *  cart-notification.js  –  Simplified + Bubble Refresh *
 *********************************************************/

class CartNotification extends HTMLElement {
  constructor() {
    super();

    /* --- Element refs --- */
    this.notification = document.getElementById('cart-notification');

    /* --- Close shortcuts --- */
    this.notification.addEventListener('keyup', (evt) => {
      if (evt.code === 'Escape') this.close();
    });
  }

  /* ---------- Public API ---------- */

  /** Sections Shopify should return so we can refresh them */
  getSectionsToRender() {
    return [{ 
      id: 'cart-icon-bubble',
      selector: '.cart-count-bubble' // Only target the count portion
    }];
  }

  /**
   * Called from product‑form.js after a successful add‑to‑cart
   * @param {Object} parsedState – JSON response from /cart/add.js
   */
  renderContents(parsedState) {
    /* 1. Update popup message */
    const item = parsedState?.items?.[0] || parsedState;
    const title = item?.title || parsedState?.product_title || 'Product';
    const messageEl = this.notification.querySelector('.added-message');
    if (messageEl) messageEl.textContent = `${title} has been added to your basket.`;
  
    /* 2. Refresh ONLY the cart count (not the whole bubble) */
    this.getSectionsToRender().forEach((section) => {
      const container = document.getElementById(section.id);
      if (container && parsedState.sections && parsedState.sections[section.id]) {
        const newHtml = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        const targetElement = section.selector ? container.querySelector(section.selector) : container;
        
        if (targetElement) {
          targetElement.innerHTML = newHtml;
        }
      }
    });
  
    /* 3. Show popup */
    this.updateBackorderMessage(item);
    this.open();
  }

  updateBackorderMessage(item) {
    if (!item) return;

    const dataEl = document.getElementById('lead-time-calc-data');
    if (!dataEl) return;

    const title = item?.title || parsedState?.product_title || 'Product';
    const available = parseInt(dataEl.getAttribute('data-available'), 10) || 0;
    const inventoryPolicy = dataEl.getAttribute('data-inventory-policy');
    const inventoryManagement = dataEl.getAttribute('data-inventory-management');
    const secondaryText = dataEl.getAttribute('data-secondary-text');
    const quantity = parseInt(
      document.querySelector('[name="quantity"]')?.value || '1',
      10
    );

    const isBackorder =
      inventoryManagement === 'shopify' &&
      inventoryPolicy === 'continue' &&
      (available - item.quantity) < 0 &&
      secondaryText;

    if (!isBackorder) return;

    // Only show the partial-stock message when there's still some stock left.
    // If available is 0 or less, the default "added to basket" message stands.
    if (available <= 0) return;

    const messageEl = document.querySelector('.added-message');
    const test = document.querySelector('.cart-notification')

    messageEl.textContent = '';
    test.classList.add("secondary-message");

    const line1 = document.createElement('p');
    line1.textContent = `${title} has been added to your basket.`;

    const line2 = document.createElement('p');
    line2.textContent = `We currently have ${available} in stock. Your order of ${quantity} will be on a lead time of ${secondaryText}.`;

    const line3 = document.createElement('p');
    line3.textContent = 'Please head to your ';

    const link = document.createElement('a');
    link.href = '/cart';
    link.textContent = 'basket';

    line3.appendChild(link);
    line3.append(' to review and adjust if needed.');

    messageEl.append(line1, line2, line3);
  }

  /**
   * Show an error message in the notification (used for stock limits, etc.)
   * @param {string} message
   */
  showError(message) {
    const messageEl = this.notification.querySelector('.added-message');
    if (messageEl) messageEl.textContent = message;
    this.notification.setAttribute('aria-label', message || 'Error');
    this.open();
  }

  /* ---------- Private helpers ---------- */

  open() {
    const wrapper = document.getElementById('cart-popup-container');
    if (wrapper) {
      wrapper.classList.add('show');
  
      // Scroll into view after short delay
      // setTimeout(() => {
      //   wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // }, 100); // wait for class to apply before scrolling
    }
  
    this.notification.classList.add('animate', 'active');
  
    this.notification.addEventListener(
      'transitionend',
      () => {
        this.notification.focus();
        trapFocus(this.notification);
      },
      { once: true }
    );
  
  }

  close() {
    const wrapper = document.getElementById('cart-popup-container');
    if (wrapper) wrapper.classList.remove('show');

    this.notification.classList.remove('active');
    removeTrapFocus(this.activeElement);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  /**
   * Extract innerHTML from a Shopify section fragment
   * @param {string} html – raw HTML string for a section
   * @param {string} selector – CSS selector to isolate the node
   */
  getSectionInnerHTML(html, selector = '.shopify-section') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(selector);
    return el ? el.innerHTML : html;
  }
}

/* --- Register the custom element --- */
customElements.define('cart-notification', CartNotification);
