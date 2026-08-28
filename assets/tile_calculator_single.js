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
    const linearUnitSizeM = Number(cfg.linearUnitSize) || 0;
    const isPerTile = String(cfg.templateSuffix || '').toLowerCase() === 'handmade-tiles';
    const hasType = tileBundle.length > 0;
    const isLinear = tileBundle === 'linear';
    const isFixedTileOrPack = tileBundle === 'fixed pack' || tileBundle === 'fixed tile';
    const isFreeLength = tileBundle === 'free length';

    const M_TO_FT = 3.28084;   // length: metres -> feet
    const M2_TO_FT2 = 10.7639; // area: m² -> ft²

  let tileAreaM2;
  let needsFt2Conversion = false;
  if (isLinear && linearUnitSizeM > 0) {
    // Linear/border tiles are sold by LENGTH, not area — the coverage unit is
    // the tile's own width, converted metres -> feet. Using the area factor
    // (10.7639) here would be wrong: it treats a length as if it were an area.
    tileAreaM2 = linearUnitSizeM * M_TO_FT;
  } else if (unitAreaSet && unitAreaM2 > 0) {
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
    tileAreaM2 = tileAreaM2 * M2_TO_FT2;
  }

  function roundUpToStep(value, step) {
    return Math.ceil(value / step) * step;
  }

  function formatCoverage(value) {
    let v = Number(value);
    if (!isFinite(v) || isNaN(v)) v = 0;
    // epsilon nudge fixes float drift (e.g. 0.804*3 = 2.4119999999999995
    // rounding down to 2.41 instead of the intended 2.41/2.42 boundary case)
    return (v + 1e-9).toFixed(2);
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
    coverageInput.value = formatCoverage(rawCov);
    console.log('[tile_calc] updateCoverage', { qty, coverage: coverageInput.value });
  }

  function updateQuantityFromCoverage(roundUp = true) {
    const minCov = isLinear ? 0 : getMinCoverage();
    let coverage = Math.max(minCov, Number(coverageInput.value) || 0);
    // For non-typed tiles use Math.round; Math.ceil overshoots when coverage/area has a
    // fractional part (e.g. 10/0.414 = 24.15 → ceil gives 25 instead of 24).
    let qty = !hasType ? Math.round(coverage / tileAreaM2) : coverage / tileAreaM2;
    const floor = isLinear ? minQtyFloor : (allowBelowCoverageMin ? minQtyFloor : minQty);
    // When decreasing (roundUp=false) use Math.floor so that toFixed(2) display-rounding
    // (e.g. 17.4375 → '17.44' → 17.44/5.8125 = 3.0017) doesn't incorrectly ceil to 4.
    const rounded = roundUp
      ? roundUpToStep(Math.ceil(qty - 1e-9), qtyStep)
      : roundUpToStep(Math.floor(qty + 1e-9), qtyStep);
    qtyInput.value = Math.max(floor, rounded);
    console.log('[tile_calc] updateQuantityFromCoverage', { coverage, qty: qtyInput.value });
  }

  function updateTotal() {
    // Fixed tile / fixed pack / linear / per-tile / free-length are all charged
    // as a Shopify line item = variant.price × quantity field value.
    const qty = Number(qtyInput.value) || 1;
    const amount = priceCents * qty;
    totalEl.textContent = formatPrice(amount, moneyFormat);
    console.log('[tile_calc] updateTotal', { isPerTile, isFreeLength, total: totalEl.textContent });
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
    const floor = (isFixedTileOrPack || isLinear) ? minQtyFloor : (allowBelowCoverageMin ? minQtyFloor : minQty);
    let val = Number(qtyInput.value) || floor;
    val = val - qtyStep;
    if (val < floor) val = floor;
    qtyInput.value = val;
    updateCoverage();
    updateTotal();
  }

  // ── Linear: always steps by exactly one tile's width (tileAreaM2, already in feet) ──
  function increaseLinearQty() {
    const qty = Math.max(1, Number(qtyInput.value) || 1) + 1;
    qtyInput.value = qty;
    coverageInput.value = formatCoverage(qty * tileAreaM2);
    updateTotal();
  }

  function decreaseLinearQty() {
    const qty = Math.max(1, (Number(qtyInput.value) || 1) - 1);
    qtyInput.value = qty;
    coverageInput.value = formatCoverage(qty * tileAreaM2);
    updateTotal();
  }

  function increaseCoverage() {
    enableBelowMinCoverage();
    if (isLinear) {
      increaseLinearQty();
      return;
    }
    // Step qty directly to avoid toFixed(2) accumulation causing double-steps.
    const floor = allowBelowCoverageMin ? minQtyFloor : minQty;
    const currentQty = Math.max(floor, Number(qtyInput.value) || floor);
    qtyInput.value = currentQty + qtyStep;
    updateCoverage();
    updateTotal();
  }

  function decreaseCoverage() {
    enableBelowMinCoverage();
    if (isLinear) {
      decreaseLinearQty();
      return;
    }
    const floor = allowBelowCoverageMin ? minQtyFloor : minQty;
    const currentQty = Math.max(floor, Number(qtyInput.value) || floor);
    const newQty = Math.max(floor, currentQty - qtyStep);
    qtyInput.value = newQty;
    updateCoverage();
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
  if (isLinear) {
    if (!isNativeQuantityBtn(qtyPlusBtn)) bindButton(qtyPlusBtn, increaseLinearQty);
    if (!isNativeQuantityBtn(qtyMinusBtn)) bindButton(qtyMinusBtn, decreaseLinearQty);
    bindButton(covPlusBtn, increaseCoverage);
    bindButton(covMinusBtn, decreaseCoverage);
  } else {
    if (!isNativeQuantityBtn(qtyPlusBtn)) bindButton(qtyPlusBtn, increaseQty);
    if (!isNativeQuantityBtn(qtyMinusBtn)) bindButton(qtyMinusBtn, decreaseQty);
    // Free-length tiles: ft² buttons are exclusively managed by the inline script
    // in product-quantity-coverage.liquid — binding here would cause double-step on m².
    if (tileBundle !== 'free length') {
      bindButton(covPlusBtn, increaseCoverage);
      bindButton(covMinusBtn, decreaseCoverage);
    }
  }

  qtyInput.addEventListener('change', () => {
    if (isLinear) {
      let val = Math.round(Number(qtyInput.value)) || 1;
      val = Math.max(1, val); // floor = 1 tile, no forced minimum coverage
      qtyInput.value = val;
      coverageInput.value = formatCoverage(val * tileAreaM2);
      updateTotal();
      console.log('[tile_calc] linear qty change', { qty: val, coverage: coverageInput.value });
      return;
    }
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
    if (isLinear) {
      let val = Number(coverageInput.value) || 0;
      if (val < 0) val = 0; // allowed to go below 1 ft — no forced minimum
      const qty = Math.max(1, Math.round(val / tileAreaM2)); // floor = 1 tile
      qtyInput.value = qty;
      coverageInput.value = formatCoverage(qty * tileAreaM2);
      updateTotal();
      console.log('[tile_calc] linear coverage change', { coverage: coverageInput.value, qty });
      return;
    }
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
    coverageInput.value = formatCoverage(val);
    updateQuantityFromCoverage();
    updateCoverage();
    updateTotal();
    console.log('[tile_calc] coverage change end', { coverage: coverageInput.value, qty: qtyInput.value });
  });

  if (isLinear) {
    // Default: smallest whole number of tiles that covers at least 1 linear
    // foot, coverage derived from that exact tile count, 2dp — mirrors the
    // metric/UK default logic, translated into feet.
    const defaultQty = Math.max(1, Math.ceil(1 / tileAreaM2));
    qtyInput.value = defaultQty;
    coverageInput.value = formatCoverage(defaultQty * tileAreaM2);
  } else {
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
