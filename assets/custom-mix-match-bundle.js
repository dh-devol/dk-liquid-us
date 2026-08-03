window.initMixMatchBundle = function(root) {
    if (!root) return;

    const LIMIT = Number(root.dataset.limit || 4);
    const FAST_BUNDLE_ID = root.dataset.fastBundleId || '';
    const PREFIX = root.dataset.prefix || 'Bundle item';
    const OPTIONS = (() => {
    try { return JSON.parse(root.dataset.options || '[]'); } catch(_) { return []; }
    })();

    const bundleVariantId = Number(root.dataset.bundleVariant);
    const bundleProductId = Number(root.dataset.bundleProduct);
    const bundleLeadTime = String(root.dataset.bundleLeadTime);
    const bundleLeadTimeDays = String(root.dataset.bundleLeadTimeDays);
    const bundleProductTitle = String(root.dataset.bundleTitle);
    const parentPrice = Number(root.dataset.parentPrice);

    const bundlePriceType = root.dataset.bundlePriceType;

    const addonId = root.querySelector('input.product-add-on.product-variant-id');
    const addonTitle = root.querySelector('input.product-add-on.product-variant-title');
    const addonPrice = root.querySelector('input.product-add-on.product-variant-price');

    const addBtn = root.querySelector('[data-add]');
    const hintEl = root.querySelector('[data-hint]');
    const errEl = document.getElementById('cart-popup-container');
    const errElDiv = errEl.querySelector('#cart-notification');
    const errElText = errEl.querySelector('.added-message');
    const choiceEls = Array.from(root.querySelectorAll('.mm-choice'));
    const choiceStyling = root.querySelector('[data-styling]');
    const accordianBtn = root.querySelector('.dropdown-accordion');
    const selectDiv = root.querySelector('.mm-grid');
    const qtyWrapper = root.querySelector('.quantity__input');

    const normalizeTitle = (raw) => {
    const str = String(raw || '');
    const parts = str.split('-');
    return parts[parts.length - 1].trim();
    };

    // Populate dropdowns
    function renderOptions(select) {
    select.innerHTML = '<option value="">— Choose —</option>';
    if (choiceStyling.dataset?.styling != 'choose') {
        select.innerHTML = '';
    }
    if (choiceStyling.dataset?.styling == 'none') {
        const none = document.createElement('option');
        none.value = 'none';
        none.textContent = 'None';
        none.dataset.price = 0;
        select.insertBefore(none, select.children[0]);
    }
    OPTIONS.forEach(opt => {
        const o = document.createElement('option');
        o.value = String(opt.variant_id);
        const title = opt.title;
        const fullTitle = normalizeTitle(opt.product_title);
        const price = Number(opt.price);
        o.textContent = title;
        if (!opt.available) {
        o.disabled = true;
        o.textContent += ' — Sold out';
        }
        o.dataset.url = opt.url || '';
        o.dataset.image = opt.image || '';
        o.dataset.title = fullTitle || '';
        o.dataset.price = price;
        select.appendChild(o);
    });
    }
    choiceEls.forEach(renderOptions);

    function showError(msg){
    if (!errEl) return;
    errElText.textContent = msg;
    errEl.classList.add("show");
    errElDiv.classList.add("active", "animate")
    setTimeout(() => { errEl.classList.remove("show"); }, 5000);
    console.error('[Mix&Match]', msg);
    }

    function updateState() {
    const filled = choiceEls.filter(s => s.value).length;
    addBtn.disabled = (filled !== LIMIT);
    hintEl.textContent = filled === LIMIT
        ? 'Looks good — ' + LIMIT + ' selected.'
        : `Pick exactly ${LIMIT} (you’ve picked ${filled}).`;
    updatePrice();
    }
    choiceEls.forEach(s => s.addEventListener('change', updateState));
    updateState();

    function collectSelections() {
    const byId = new Map();
    choiceEls.forEach(s => {
        let vid = Number(s.value || 0);
        if (isNaN(vid)) {
        vid = s.value;
        } 
        const opt = s.selectedOptions[0];
        const meta = {
        variant_id: vid,
        title: normalizeTitle(opt?.textContent || opt?.dataset?.title || ''),
        url: opt?.dataset?.url || '',
        image: opt?.dataset?.image || '',
        price: Number(opt?.dataset?.price || '')
        };
        if (!byId.has(vid)) byId.set(vid, { ...meta, qty: 1 });
        else if (vid == "none") byId.get(vid).qty += 1;
        else byId.get(vid).qty += 1;
    });
    return Array.from(byId.values());
    }

    function collectAddons() {
    const vid = Number(addonId.value || 0);

    if (!vid) return [];

    return [{
        variant_id: vid,
        title: addonTitle.value,
        qty: 1,
        price: Number(addonPrice.value),
    }];
    }

    // dropdown accordian logic used on some bundles - check template for
    function accordianAnimation () {
        accordianBtn.toggleAttribute("open");
        if (selectDiv.style.display === "block") {
            selectDiv.style.display = "none";
            selectDiv.setAttribute("aria-expanded", "false");
        } else {
            selectDiv.style.display = "block";
            selectDiv.setAttribute("aria-expanded", "true");
        }
    }
    if (accordianBtn) {
        accordianBtn.addEventListener("click", accordianAnimation);
    }

    function updatePrice() {
    if (!selectDiv.classList.contains("mm-bundle-price")) return;

    const priceDiv = document.querySelector(".price__container");
    const priceSpan = priceDiv.querySelector(".price-item--regular");
    const selections = collectSelections();
    const addon = collectAddons();


    let sBundlePrice = parentPrice;
    selections.forEach(s => {
        if (s.qty > 1) {
        s.price *= s.qty;
        }
        sBundlePrice += s.price;
    })
    if (addon.length > 0) {
        sBundlePrice += addon[0].price;
    }

    bundlePrice = sBundlePrice / 100;

    priceSpan.innerHTML = Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(bundlePrice);
    return bundlePrice;
    }

    function createGroupId(selections, addon) {
    if (bundlePriceType == "fixed") {
        return bundleVariantId;
    }

    const selectionIds = [
        ...selections.map(s => s.variant_id)
    ].sort((a, b) => a - b).join("-");
    const addonIds = [
        ...addon.map(a => a.variant_id)
    ].sort((a, b) => a - b).join("-");

    let groupId = `${bundleProductId}`;
    if (selectionIds) {
        groupId = groupId.concat("-", selectionIds);
    }
    if (addonIds) {
        groupId = groupId.concat("-", addonIds);
    }

    return groupId;
    }

    async function addToCart() {
    if (!bundleVariantId) {
        showError('Bundle container variant ID is missing.');
        return;
    }

    const quantity = Number(qtyWrapper?.value || 1);

    const compressed = collectSelections();
    const addon = collectAddons();

    const sum = compressed.reduce((s, x) => s + x.qty, 0);
    if (sum !== LIMIT) {
        showError(`Please pick exactly ${LIMIT}. You picked ${sum}.`);
        return;
    }       

    let product_cart_text;
    if (bundleProductTitle.includes("Jelly") || bundleProductTitle.includes("Dolly")) {
        product_cart_text = bundleProductTitle.split(" - ")[1];
    } else {
        product_cart_text = bundleProductTitle;
    }

    const group_id = createGroupId(compressed, addon);

    let items = [];

    if (bundlePriceType == "variable") {
        console.log("variable");

        items.push({
        id: bundleVariantId,
        quantity,
        properties: {
            _group_id: group_id,
            _bundle_parent: "true",
            _cart_text: product_cart_text,
            lead_time: bundleLeadTime,
            _lead_time_days: bundleLeadTimeDays
        }
        });

        let i = 0;
        compressed.forEach(c => {
        i += 1;
        if(c.variant_id != "none") {
            items.push({
            id: c.variant_id,
            quantity: c.qty,
            properties: {
                _group_id: group_id,
                _bundle_child: "true",
                _bundle_sort: `${i}`,
                _bundle_summary: `${c.title} (× ${c.qty})`,
                _bundle_base_qty: String(c.qty)
            }
            });
        }
        });
    } else if (bundlePriceType == "fixed") {
        console.log("fixed");

        const props = {
        _bundle_items: JSON.stringify(compressed),
        _bundle_summary: compressed.map(x => `${x.title} (× ${x.qty})`).join(' • '),
        __cartBundleId: FAST_BUNDLE_ID || undefined
        };

        compressed.forEach((x, i) => {
        props[`${PREFIX} ${i + 1}`] = `${x.title} (× ${x.qty})`;
        });
        if (bundleLeadTime && bundleLeadTime !== 'undefined' && bundleLeadTime !== '') {
            props['Lead time'] = bundleLeadTime;
        }
        if (bundleLeadTimeDays && bundleLeadTimeDays !== 'undefined' && bundleLeadTimeDays !== '') {
            props['_lead_time_days'] = bundleLeadTimeDays;
        }

        items.push(
        {
            id: bundleVariantId,
            quantity,
            properties: props
        }
        );
    } else {
        console.error("Assign a bundlePriceType on the product");
        showError(e.message || 'Sorry, something went wrong adding the bundle.');
    }

    if (addon.length) {
        const addon_title = addon[0].title;
        let addon_cart_text;
        if (addon_title.includes("Gang")) {
        addon_cart_text = addon_title.split(" - ")[0];
        } else {
        addon_cart_text = addon_title;
        }

        const addonCheckbox = document.querySelector(`.brass-checkbox[value="${addon[0].variant_id}"]`);
        const addonLeadTime = addonCheckbox ? addonCheckbox.getAttribute('data-lead-time') : null;
        const addonLeadTimeDays = addonCheckbox ? addonCheckbox.getAttribute('data-lead-time-days') : null;
        
        items.push({
        id: addon[0].variant_id,
        quantity,
        properties: {
            "_Added as add-on": "true",
            "_group_id": group_id,
            "_addon_sort": "0",
            "_addon_summary": addon_cart_text,
            "Lead time": bundleLeadTime || undefined,
            "_lead_time_days": bundleLeadTimeDays || undefined
        }
        });
    }

    try {
        const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            items
        })
        });

        let data = {};

        try {
        data = await res.json();
        } catch (err) {
        console.error('JSON parse failed:', err);
        }
        if (!res.ok) {
        const msg = data.description || data.message || JSON.stringify(data.errors) || 'Add to cart failed.';
        throw new Error(msg);
        }

        // ✅ Refresh minicart/popup
        await refreshMiniCart();

        // ✅ Update the popup’s “added-message” span
        updateCartPopupTitle(data);
        openCartUI();

        document.documentElement.dispatchEvent(new CustomEvent('cart:refresh'));
        document.documentElement.dispatchEvent(new CustomEvent('cart:open'));

    } catch (e) {
        showError(e.message || 'Sorry, something went wrong adding the bundle.');
    }
    }

    addBtn.addEventListener('click', addToCart);

    /* ---------- HELPERS ---------- */

    function updateCartPopupTitle(items) {
    if (!items) return;

    const item = items.items[0];
    const title = item.product_title || item.title || '';
    const msg = document.querySelector('#cart-notification .added-message');
    if (!msg) return;

    const esc = s => String(s).replace(/[&<>"']/g, m => (
        {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
    ));

    const suffix = msg.textContent.match(/has been added.*$/)?.[0] || 'has been added.';

    msg.innerHTML = `${esc(title)} has been added`;
    }

    async function refreshMiniCart() {
    const sectionIds = ['cart-drawer', 'cart-icon-bubble', 'cart-notification'];
    const params = new URLSearchParams();
    params.set('sections', sectionIds.join(','));
    const res = await fetch(`${window.location.pathname}?${params.toString()}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`Sections request failed: ${res.status}`);
    const json = await res.json();

    sectionIds.forEach((id) => {
        const html = json[id];
        if (!html) return;

        const container = document.getElementById('cart-icon-bubble');
        if (container) {
        const tmp = document.createElement('a');
        tmp.innerHTML = html;

        const newBubble = tmp.querySelector('.cart-count-bubble');
        const currentBubble = document.querySelector('.cart-count-bubble');

        if ( newBubble && currentBubble) {
            currentBubble.replaceWith(newBubble);
        }
        }

        if (id === 'cart-drawer') {
        const drawer = document.querySelector('#CartDrawer, cart-drawer');
        if (drawer) {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            const fresh = tmp.querySelector('#CartDrawer') || tmp.firstElementChild;
            if (fresh) drawer.innerHTML = fresh.innerHTML || html;
        }
        }
    });
    }

    function openCartUI() {
    const elDrawer = document.querySelector('cart-drawer, #CartDrawer');
    if (elDrawer) {
        if (typeof elDrawer.open === 'function') { elDrawer.open(); return; }
        elDrawer.setAttribute('open', '');
        elDrawer.classList.add('is-open', 'active', 'open');
    }

    const notif = document.querySelector('cart-notification, #CartNotification, #cart-popup-container');
    if (notif) {
        notif.style.display = 'block';
        notif.classList.add('show', 'active', 'open');
        const inner = notif.querySelector('.cart-notification');
        if (inner) inner.classList.add('active');
        return;
    }

    if (window.CartDrawer?.open) { window.CartDrawer.open(); return; }
    if (window.theme?.CartDrawer?.open) { window.theme.CartDrawer.open(); return; }

    const triggers = document.querySelectorAll(
        '[data-cart-drawer-toggle],[data-drawer-open="cart"],[data-action="open-cart"],.js-open-cart'
    );
    for (const t of triggers) { t.click(); return; }
    }
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".mm-bundle").forEach(initMixMatchBundle);
});