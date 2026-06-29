(() => {
  function initFlooringCalculator(root) {
    const calc = window.tileCalculator || {};

    const tile_width = Number(calc.tileWidth) || 0;
    const tile_length = Number(calc.tileLength) || 0;
    const pack_size = Number(calc.packSize) || 1;
    const priceCents = Number(calc.price) || 0;
    const unitAreaM2 = Number(calc.unitAreaM2) || 0;
    const unitAreaSet = calc.unitAreaSet !== null && calc.unitAreaSet !== undefined;
    const tilesPerM2 = Number(calc.tilesPerM2) || 0;
    const tileBundle = String(calc.tileBundle || '').toLowerCase();
    const moneyFormat = calc.moneyFormat || "${{amount}}";

  let tile_area_m2;
  let needsFt2Conversion = false;
  if (unitAreaSet && unitAreaM2 > 0) {
    tile_area_m2 = unitAreaM2; // unit_area_m2 explicitly set — use as authoritative coverage value
  } else if (tile_width && tile_length) {
    tile_area_m2 = (tile_width * tile_length) / 1000000;
    needsFt2Conversion = true;
  } else {
    tile_area_m2 = unitAreaM2; // already in ft² from Liquid
  }
  if ((!tile_area_m2 || tile_area_m2 <= 0) && tilesPerM2 > 0) {
    tile_area_m2 = 1 / tilesPerM2;
    needsFt2Conversion = true;
  }
  if (!tile_area_m2 || tile_area_m2 <= 0) {
    tile_area_m2 = 0.1076;
  }
  if (needsFt2Conversion) {
    tile_area_m2 = tile_area_m2 * 10.7639;
  }

  function roundUpToStep(value, step) {
    return Math.ceil(value / step) * step;
  }

  function addStep(value, step) {
    return Number((value + step).toFixed(5));
  }

  function subtractStep(value, step) {
    return Number((value - step).toFixed(5));
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

  const isLinear = tileBundle === 'linear';
  const qtyStep = tileBundle === 'fixed pack' ? pack_size : 1;

    const scope = root || document;
    scope.querySelectorAll('.quantity_coverage-wrapper').forEach(wrapper => {
      if (wrapper.dataset.flooringCalcInit === 'true') return;
      wrapper.dataset.flooringCalcInit = 'true';
      const qtyInput = wrapper.querySelector('.quantity__input');
      const coverageInput = wrapper.querySelector('.coverage__input');
      const totalPriceEl = wrapper.querySelector('#TotalPrice');

    if (!qtyInput || !coverageInput || !totalPriceEl) return;

    const qtyBtnWrapper = document.createElement('div');
    qtyBtnWrapper.style.display = 'flex';
    qtyBtnWrapper.style.gap = '4px';
    const qtyMinusBtn = document.createElement('button');
    qtyMinusBtn.type = 'button';
    qtyMinusBtn.textContent = '-';
    const qtyPlusBtn = document.createElement('button');
    qtyPlusBtn.type = 'button';
    qtyPlusBtn.textContent = '+';
    qtyBtnWrapper.appendChild(qtyMinusBtn);
    qtyBtnWrapper.appendChild(qtyPlusBtn);
    qtyInput.parentNode.insertBefore(qtyBtnWrapper, qtyInput.nextSibling);

    const covBtnWrapper = document.createElement('div');
    covBtnWrapper.style.display = 'flex';
    covBtnWrapper.style.gap = '4px';
    const covMinusBtn = document.createElement('button');
    covMinusBtn.type = 'button';
    covMinusBtn.textContent = '-';
    const covPlusBtn = document.createElement('button');
    covPlusBtn.type = 'button';
    covPlusBtn.textContent = '+';
    covBtnWrapper.appendChild(covMinusBtn);
    covBtnWrapper.appendChild(covPlusBtn);
    coverageInput.parentNode.insertBefore(covBtnWrapper, coverageInput.nextSibling);

    const minQty = Math.max(1, Number(qtyInput.min) || qtyStep);
    const minCoverage = tile_area_m2 * minQty;

    function updateCoverage() {
      const qty = Number(qtyInput.value) || minQty;
      const raw = qty * tile_area_m2;
      coverageInput.value = isLinear ? Math.round(raw) : formatCoverage(raw);
    }

    function updateQuantityFromCoverage() {
      let coverage = Number(coverageInput.value) || 0;
      if (isLinear) coverage = Math.round(coverage);
      let qty = coverage / tile_area_m2;
      qtyInput.value = Math.max(minQty, roundUpToStep(Math.ceil(qty - 1e-9), qtyStep));
    }

    function updateTotal() {
      const qty = Number(qtyInput.value) || 0;
      const subtotalCents = priceCents * qty;
      totalPriceEl.textContent = formatPrice(subtotalCents, moneyFormat);
    }

    function increaseQty() {
      let val = Number(qtyInput.value) || minQty;
      qtyInput.value = val + qtyStep;

      updateCoverage();
      updateTotal();
    }

    function decreaseQty() {
      let val = Number(qtyInput.value) || minQty;
      val = val - qtyStep;
      if (val < minQty) val = minQty;
      qtyInput.value = val;
      updateCoverage();
      updateTotal();
    }

    function increaseCoverage() {
      let val = Number(coverageInput.value) || minCoverage;
      const covStep = isLinear ? 1 : tile_area_m2 * qtyStep;
      val = addStep(val, covStep);
      coverageInput.value = isLinear ? Math.round(val) : formatCoverage(val);
      updateQuantityFromCoverage();
      updateTotal();
    }

    function decreaseCoverage() {
      let val = Number(coverageInput.value) || minCoverage;
      const covStep = isLinear ? 1 : minCoverage;
      val = subtractStep(val, covStep);

      const covMin = isLinear ? 1 : minCoverage;
      if (val < covMin) val = covMin;

      coverageInput.value = isLinear ? Math.round(val) : formatCoverage(val);
      updateQuantityFromCoverage();
      updateTotal();
    }


    qtyPlusBtn.addEventListener('click', increaseQty);
    qtyMinusBtn.addEventListener('click', decreaseQty);
    covPlusBtn.addEventListener('click', increaseCoverage);
    covMinusBtn.addEventListener('click', decreaseCoverage);

    qtyInput.addEventListener('change', () => {
      let val = Number(qtyInput.value) || 0;
      if (val < minQty) val = minQty;
      if (qtyStep > 1) {
        val = roundUpToStep(Math.ceil(val), qtyStep);
      }
      qtyInput.value = val;
      updateCoverage();
      updateTotal();
    });

    coverageInput.addEventListener('change', () => {
      let val = Number(coverageInput.value) || 0;
      if (isLinear) {
        val = Math.max(1, Math.round(val));
        coverageInput.value = val;
      } else {
        if (val < 0) val = 0;
        coverageInput.value = formatCoverage(val);
      }
      updateQuantityFromCoverage();
      updateTotal();
    });

    updateQuantityFromCoverage();
    // Enforce minimum display of 10 ft² without recomputing qty
    if ((Number(coverageInput.value) || 0) < 10) coverageInput.value = 10;
    updateTotal();
    });
  }

  window.initFlooringCalculator = initFlooringCalculator;

  document.addEventListener('DOMContentLoaded', () => {
    initFlooringCalculator(document);
  });
})();
