(() => {
  function initTileCalculator(root) {
    const scope = root || document;
    const qtyInput = scope.querySelector('.quantity__input');
    const coverageInput = scope.querySelector('.coverage__input');
    const totalEl = scope.querySelector('#TotalPrice');

    if (!qtyInput || !coverageInput || !totalEl) return;
    if (qtyInput.dataset.tcalcInit === 'true') return;
    qtyInput.dataset.tcalcInit = 'true';
    console.log('[tile_calc] init', { qtyInput, coverageInput, totalEl });

    const cfg = window.tileCalculator || {};
    const tileWidth = Number(cfg.tileWidth) || 0;
    const tileLength = Number(cfg.tileLength) || 0;
    const unitAreaM2 = Number(cfg.unitAreaM2) || 0;
    const unitAreaSet = cfg.unitAreaSet !== null && cfg.unitAreaSet !== undefined;
    const tilesPerM2 = Number(cfg.tilesPerM2) || 0;
    const packSize = Number(cfg.packSize) || 1;
    const tileBundle = String(cfg.tileBundle || '').toLowerCase();
    const priceCents = Number(cfg.price) || 0;
    const moneyFormat = cfg.moneyFormat || "${{amount}}";
    const hasType = tileBundle.length > 0;

  let tileAreaM2;
  let needsFt2Conversion = false;
  if (unitAreaSet && unitAreaM2 > 0) {
    // unit_area_m2 explicitly set in admin — use it as the authoritative coverage value
    tileAreaM2 = unitAreaM2; // already in ft² from Liquid
  } else if (tileWidth && tileLength) {
    tileAreaM2 = (tileWidth * tileLength) / 1000000;
    needsFt2Conversion = true;
  } else {
    tileAreaM2 = unitAreaM2; // already in ft² from Liquid
  }
  if ((!tileAreaM2 || tileAreaM2 <= 0) && tilesPerM2 > 0) {
    tileAreaM2 = 1 / tilesPerM2;
    needsFt2Conversion = true;
  }
  if (!tileAreaM2 || tileAreaM2 <= 0) {
    tileAreaM2 = 0.1076;
  }
  if (needsFt2Conversion) {
    tileAreaM2 = tileAreaM2 * 10.7639;
  }

  function roundUpToStep(value, step) {
    return Math.ceil(value / step) * step;
  }

  function formatCoverage(value) {
    let v = Number(value);
    if (!isFinite(v) || isNaN(v)) v = 0;
    return v.toFixed(2);
  }

  function formatPrice(priceCents, moneyFormat) {
    let amount = Number(priceCents) / 100;
    if (!isFinite(amount) || isNaN(amount)) amount = 0;
    const amountFixed = amount.toFixed(2);
    return (moneyFormat || '$')
      .replace(/\{\{amount_no_decimals_with_comma_separator\}\}/g, Math.round(amount))
      .replace(/\{\{amount_no_decimals\}\}/g, Math.round(amount))
      .replace(/\{\{amount_with_comma_separator\}\}/g, amountFixed)
      .replace(/\{\{amount\}\}/g, amountFixed);
  }

  const isFixedTileOrPack = tileBundle === 'fixed pack' || tileBundle === 'fixed tile';
  const isLinear = tileBundle === 'linear';
  const minCoverage = 1;
  let allowBelowCoverageMin = false;
  let qtyStep = tileBundle === 'fixed pack' ? packSize : (Number(qtyInput.step) || 1);
  let minQtyFromCoverage = roundUpToStep(Math.ceil(minCoverage / tileAreaM2), qtyStep);
  let minQty = Math.max(1, Number(qtyInput.min) || 1, minQtyFromCoverage);
  let minQtyFloor = Math.max(1, Number(qtyInput.min) || 1);

  function refreshLimits() {
    qtyStep = tileBundle === 'fixed pack' ? packSize : (Number(qtyInput.step) || 1);
    minQtyFromCoverage = roundUpToStep(Math.ceil(minCoverage / tileAreaM2), qtyStep);
    minQty = Math.max(1, Number(qtyInput.min) || 1, minQtyFromCoverage);
    minQtyFloor = Math.max(1, Number(qtyInput.min) || 1);
  }

  function enableBelowMinCoverage() {
    if (!hasType) allowBelowCoverageMin = true;
  }

  function getMinCoverage() {
    return allowBelowCoverageMin ? 0 : minCoverage;
  }

  function updateCoverage() {
    const qty = Number(qtyInput.value) || minQty;
    if (!hasType) {
      if (allowBelowCoverageMin) {
        const coverageInt = Math.round(qty * tileAreaM2);
        coverageInput.value = coverageInt;
        console.log('[tile_calc] updateCoverage no-type', { qty, coverage: coverageInput.value });
        return;
      }
      const coverageInt = Math.round(qty * tileAreaM2);
      coverageInput.value = coverageInt;
      const adjustedQty = Math.round(coverageInt / tileAreaM2);
      if (adjustedQty !== qty) qtyInput.value = adjustedQty;
      console.log('[tile_calc] updateCoverage no-type', { qty, coverageInt, adjustedQty });
      return;
    }
    const rawCov = qty * tileAreaM2;
    coverageInput.value = isLinear ? Math.round(rawCov) : formatCoverage(rawCov);
    console.log('[tile_calc] updateCoverage', { qty, coverage: coverageInput.value });
  }

  function updateQuantityFromCoverage(roundUp = true) {
    const minCov = isLinear ? 1 : getMinCoverage();
    let coverage = Math.max(minCov, Number(coverageInput.value) || 0);
    if (isLinear) coverage = Math.round(coverage);
    // For non-typed tiles use Math.round; Math.ceil overshoots when coverage/area has a
    // fractional part (e.g. 10/0.414 = 24.15 → ceil gives 25 instead of 24).
    let qty = !hasType ? Math.round(coverage / tileAreaM2) : coverage / tileAreaM2;
    const floor = allowBelowCoverageMin ? minQtyFloor : minQty;
    // When decreasing (roundUp=false) use Math.floor so that toFixed(2) display-rounding
    // (e.g. 17.4375 → '17.44' → 17.44/5.8125 = 3.0017) doesn't incorrectly ceil to 4.
    const rounded = roundUp
      ? roundUpToStep(Math.ceil(qty - 1e-9), qtyStep)
      : roundUpToStep(Math.floor(qty + 1e-9), qtyStep);
    qtyInput.value = Math.max(floor, rounded);
    console.log('[tile_calc] updateQuantityFromCoverage', { coverage, qty: qtyInput.value });
  }

  function updateTotal() {
    const coverage = Number(coverageInput.value) || 0;
    totalEl.textContent = formatPrice(priceCents * coverage, moneyFormat);
    console.log('[tile_calc] updateTotal', { coverage, total: totalEl.textContent });
  }

    const qtyMinusBtn = scope.querySelector('.tcalc-btn--qty-minus') || qtyInput.closest('.quantity')?.querySelector('button[name="minus"]');
    const qtyPlusBtn = scope.querySelector('.tcalc-btn--qty-plus') || qtyInput.closest('.quantity')?.querySelector('button[name="plus"]');
    const covMinusBtn = scope.querySelector('.tcalc-btn--cov-minus');
    const covPlusBtn = scope.querySelector('.tcalc-btn--cov-plus');

  function increaseQty() {
    enableBelowMinCoverage();
    let val = Number(qtyInput.value) || minQty;
    qtyInput.value = val + qtyStep;
    updateCoverage();
    updateTotal();
  }

  function decreaseQty() {
    enableBelowMinCoverage();
    const floor = isFixedTileOrPack ? minQtyFloor : (allowBelowCoverageMin ? minQtyFloor : minQty);
    let val = Number(qtyInput.value) || floor;
    val = val - qtyStep;
    if (val < floor) val = floor;
    qtyInput.value = val;
    updateCoverage();
    updateTotal();
  }

  function increaseCoverage() {
    enableBelowMinCoverage();
    if (isLinear) {
      // Linear: step coverage by 1 ft², then derive qty.
      let val = Number(coverageInput.value) || 1;
      coverageInput.value = Math.round(val + 1);
      updateQuantityFromCoverage();
      updateCoverage();
    } else {
      // Step qty directly to avoid toFixed(2) accumulation causing double-steps.
      // (e.g. 6 tiles → '34.88' + 5.8125 = 40.6925 → 40.69 / 5.8125 = 7.0004 → ceil = 8)
      const floor = allowBelowCoverageMin ? minQtyFloor : minQty;
      const currentQty = Math.max(floor, Number(qtyInput.value) || floor);
      qtyInput.value = currentQty + qtyStep;
      updateCoverage();
    }
    updateTotal();
  }

  function decreaseCoverage() {
    enableBelowMinCoverage();
    if (isLinear) {
      // Linear: step coverage by 1 ft², then derive qty.
      let val = Number(coverageInput.value) || 1;
      val = Math.max(1, Math.round(val - 1));
      coverageInput.value = val;
      updateQuantityFromCoverage(false);
      updateCoverage();
    } else {
      // Step qty directly to avoid toFixed(2) accumulation causing double-steps.
      const floor = allowBelowCoverageMin ? minQtyFloor : minQty;
      const currentQty = Math.max(floor, Number(qtyInput.value) || floor);
      const newQty = Math.max(floor, currentQty - qtyStep);
      qtyInput.value = newQty;
      updateCoverage();
    }
    updateTotal();
  }

  function bindButton(btn, handler) {
    if (!btn) return;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    });
  }

    const isNativeQuantityBtn = btn => btn && btn.closest('quantity-input') !== null;
    if (!isNativeQuantityBtn(qtyPlusBtn)) bindButton(qtyPlusBtn, increaseQty);
    if (!isNativeQuantityBtn(qtyMinusBtn)) bindButton(qtyMinusBtn, decreaseQty);
    // Free-length tiles: ft² buttons are exclusively managed by the inline script
    // in product-quantity-coverage.liquid — binding here would cause double-step on m².
    if (tileBundle !== 'free length') {
      bindButton(covPlusBtn, increaseCoverage);
      bindButton(covMinusBtn, decreaseCoverage);
    }

    qtyInput.addEventListener('change', () => {
    enableBelowMinCoverage();
    let val = Number(qtyInput.value) || 0;
    console.log('[tile_calc] qty change start', { val });
    const floor = isFixedTileOrPack ? minQtyFloor : (allowBelowCoverageMin ? minQtyFloor : minQty);
    if (val < floor) val = floor;
    if (qtyStep > 1) {
      val = roundUpToStep(Math.ceil(val), qtyStep);
    }
    qtyInput.value = val;
    updateCoverage();
    updateTotal();
    console.log('[tile_calc] qty change end', { val: qtyInput.value, coverage: coverageInput.value });
  });

    coverageInput.addEventListener('change', () => {
    enableBelowMinCoverage();
    const minCov = getMinCoverage();
    let val = Number(coverageInput.value) || 0;
    console.log('[tile_calc] coverage change start', { val });
    if (val < minCov) val = minCov;
    if (!hasType) {
      if (allowBelowCoverageMin) {
        const coverageInt = Math.round(val);
        coverageInput.value = coverageInt;
        qtyInput.value = Math.max(minQtyFloor, Math.round(coverageInt / tileAreaM2));
      } else {
        const coverageInt = Math.max(minCoverage, Math.round(val));
        coverageInput.value = coverageInt;
        qtyInput.value = Math.round(coverageInt / tileAreaM2);
      }
      updateTotal();
      console.log('[tile_calc] coverage change end no-type', { coverage: coverageInput.value, qty: qtyInput.value });
      return;
    }
    if (isLinear) {
      val = Math.max(1, Math.round(val));
      coverageInput.value = val;
    } else {
      coverageInput.value = formatCoverage(val);
    }
    updateQuantityFromCoverage();
    updateCoverage();
    updateTotal();
    console.log('[tile_calc] coverage change end', { coverage: coverageInput.value, qty: qtyInput.value });
  });

    updateQuantityFromCoverage();
    // For non-free-length tiles: enforce minimum 10 ft² and keep qty consistent.
    // e.g. a 5.81 ft²/tile product loads with coverage=5.81, qty=1 → bumped to
    // coverage=11.63, qty=2 so both fields are always in sync on page load.
    // Free-length tiles skip this block — their ft² display is managed by the
    // inline script in product-quantity-coverage.liquid and must not be overridden.
    if (tileBundle !== 'free length') {
      if ((Number(coverageInput.value) || 0) < 10) {
        coverageInput.value = 10;
        updateQuantityFromCoverage();
      }
      updateCoverage();
    }
    updateTotal();

    if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS?.variantChange) {
      subscribe(PUB_SUB_EVENTS.variantChange, () => {
        refreshLimits();
        updateCoverage();
        updateTotal();
        console.log('[tile_calc] variant change sync', { qty: qtyInput.value, coverage: coverageInput.value });
      });
    }
  }

  window.initTileCalculator = initTileCalculator;

  document.addEventListener('DOMContentLoaded', () => {
    initTileCalculator(document);
  });
})();
