(() => {
  if (window.projectMulticolumnFlowLoaded) return;
  window.projectMulticolumnFlowLoaded = true;

  const mediumScreen = window.matchMedia(
    '(min-width: 590px) and (max-width: 991px)'
  );

  let movedCards = [];
  let hiddenSections = [];
  let addedBorders = [];
  let frame;

  function restore() {
    movedCards.forEach(({ card, marker }) => {
      marker.replaceWith(card);
    });

    hiddenSections.forEach(wrapper => {
      wrapper.hidden = false;
    });

    addedBorders.forEach(element => {
      element.classList.remove('bottom__section-border');
    });

    document.querySelectorAll('.project-flow-list').forEach(list => {
      list.classList.remove('project-flow-list');
    });

    movedCards = [];
    hiddenSections = [];
    addedBorders = [];
  }

  function getSection(wrapper) {
    return Array.from(wrapper.children).find(element =>
      element.matches('[data-project-flow]')
    );
  }

  function getType(section) {
    if (section.matches('.custom-product-list')) return 'products';
    if (section.matches('.project-multicolumns')) return 'projects';

    return `other:${section.dataset.projectFlow || ''}`;
  }

  function colourClasses(section) {
    return Array.from(section.classList)
      .filter(name => name.startsWith('color-'))
      .sort()
      .join(' ');
  }

  function hasBottomBorder(section) {
    return !!section.querySelector('.bottom__section-border');
  }

  function isCompatible(first, next) {
    if (!first || !next) return false;
    if (getType(first) !== getType(next)) return false;

    if (getType(first) === 'products') {
      if (
        first.querySelector('.multicolumn-list.slider') ||
        next.querySelector(
          '.top__section-border, .multicolumn-list.slider'
        )
      ) {
        return false;
      }

      const nextHasHeading = Array.from(
        next.querySelectorAll(
          '.multicolumn__title, .subtitle__wrapper'
        )
      ).some(element => element.textContent.trim() !== '');

      return !nextHasHeading;
    }


  if (
    first.querySelector('.multicolumn-list.slider') ||
    next.querySelector('.multicolumn-list.slider')
  ) {
    return false;
  }

  if (
    first.querySelector('.bottom__section-border') ||
    next.querySelector('.top__section-border')
  ) {
    return false;
  }

  const nextHasHeading = Array.from(
    next.querySelectorAll(
      '.multicolumn__title, .subtitle__wrapper'
    )
  ).some(element => element.textContent.trim() !== '');

  return !nextHasHeading;
}

  function flowRelatedSections() {
  function getRelatedSection(wrapper) {
    if (!wrapper || !wrapper.matches('.shopify-section')) return null;

    return Array.from(wrapper.children).find(element =>
      element.matches('.related-section[data-project-flow]')
    ) || null;
  }

  function getGrid(section) {
    const grids = section.querySelectorAll('.related-products-grid');

    // Keep sections with multiple separate grids unchanged.
    return grids.length === 1 ? grids[0] : null;
  }

  function hasBorder(section, className) {
    return section.classList.contains(className) ||
      !!section.querySelector(`.${className}`);
  }

  function hasHeading(section) {
    return Array.from(
      section.querySelectorAll('.related-title, .subtitle__wrapper')
    ).some(element => element.textContent.trim() !== '');
  }

  document.querySelectorAll(
    '.related-section[data-project-flow]'
  ).forEach(section => {
    const wrapper = section.closest('.shopify-section');

    if (!wrapper || wrapper.hidden) return;
    if (hasBorder(section, 'bottom__section-border')) return;

    const list = getGrid(section);
    if (!list) return;

    let nextWrapper = wrapper.nextElementSibling;

    while (
      nextWrapper &&
      nextWrapper.matches('.shopify-section') &&
      !nextWrapper.hidden
    ) {
      const nextSection = getRelatedSection(nextWrapper);
      if (!nextSection) break;

      // Do not pull cards across a heading, top border or colour change.
      if (
        hasHeading(nextSection) ||
        hasBorder(nextSection, 'top__section-border') ||
        colourClasses(section) !== colourClasses(nextSection)
      ) {
        break;
      }

      const nextList = getGrid(nextSection);
      if (!nextList) break;

      const cards = Array.from(nextList.children).filter(element =>
        element.matches('.product-card-wrapper')
      );

      if (!cards.length) break;

      list.classList.add('project-flow-list');

      cards.forEach(card => {
        const marker = document.createComment('related-card-position');
        card.before(marker);

        movedCards.push({ card, marker });
        list.appendChild(card);
      });

      nextWrapper.hidden = true;
      hiddenSections.push(nextWrapper);

      if (hasBorder(nextSection, 'bottom__section-border')) {
        section.classList.add('bottom__section-border');
        addedBorders.push(section);
        break;
      }

      nextWrapper = nextWrapper.nextElementSibling;
    }
  });
}

  function update() {
    restore();

    if (!mediumScreen.matches) return;

     flowRelatedSections();

    document.querySelectorAll('[data-project-flow]').forEach(section => {
      const wrapper = section.closest('.shopify-section');

      if (!wrapper || wrapper.hidden) return;

      const list = section.querySelector('.multicolumn-list');
      if (!list) return;

      const isProductGroup = getType(section) === 'products';

      // This section already closes its own group.
      if (isProductGroup && hasBottomBorder(section)) return;

      const hostPageWidth = section.querySelector('.page-width');
      if (isProductGroup && !hostPageWidth) return;

      let nextWrapper = wrapper.nextElementSibling;

      while (
        nextWrapper &&
        nextWrapper.matches('.shopify-section') &&
        !nextWrapper.hidden
      ) {
        const nextSection = getSection(nextWrapper);

        if (!isCompatible(section, nextSection)) break;

        const nextList = nextSection.querySelector('.multicolumn-list');
        if (!nextList) break;

        const closesGroup =
          isProductGroup && hasBottomBorder(nextSection);

        list.classList.add('project-flow-list');

        Array.from(nextList.children).forEach(card => {
          if (!card.matches('.multicolumn-list__item')) return;

          const marker = document.createComment('project-card-position');
          card.before(marker);

          movedCards.push({ card, marker });
          list.appendChild(card);
        });

        nextWrapper.hidden = true;
        hiddenSections.push(nextWrapper);

        if (closesGroup) {
          hostPageWidth.classList.add('bottom__section-border');
          addedBorders.push(hostPageWidth);
          break;
        }

        nextWrapper = nextWrapper.nextElementSibling;
      }
    });
  }

  function scheduleUpdate() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }

  mediumScreen.addEventListener('change', scheduleUpdate);

  document.addEventListener('shopify:section:unload', () => {
    cancelAnimationFrame(frame);
    restore();
  });

  document.addEventListener('shopify:section:load', scheduleUpdate);
  document.addEventListener('shopify:section:reorder', scheduleUpdate);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleUpdate, {
      once: true
    });
  } else {
    scheduleUpdate();
  }
})();
