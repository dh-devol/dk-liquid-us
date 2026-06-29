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
    const title = parsedState?.items?.[0]?.title || parsedState?.product_title || 'Product';
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
    this.open();
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
