function updateParentAccordions(accordion) {
  var parentContent = accordion.parentElement && accordion.parentElement.closest('.accordion__content');
  while (parentContent) {
    if (parentContent.style.maxHeight) {
      parentContent.style.maxHeight = parentContent.scrollHeight + 30 + 'px';
    }
    parentContent = parentContent.parentElement && parentContent.parentElement.closest('.accordion__content');
  }
}

function setAccordionState(accordion, open) {
  var header = accordion.querySelector('.class-summary');
  var content = accordion.querySelector('.accordion__content');
  if (!header || !content) return;

  var button = header.querySelector('button.title_arrow-wrapper');

  header.classList.toggle('active', open);
  if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    header.setAttribute('open', '');
    content.inert = false;
    content.style.maxHeight = content.scrollHeight + 30 + 'px';
  } else {
    header.removeAttribute('open');
    content.inert = true;
    content.style.maxHeight = null;
  }
}

// One delegated click handler, bound once for the life of the page
if (!window.__accordionDelegateBound) {
  window.__accordionDelegateBound = true;

  document.addEventListener('click', function (e) {
    var header = e.target.closest('.custom-collapsible-content .class-summary');
    if (!header) return;

    var accordion = header.closest('.accordion');
    if (!accordion) return;

    e.preventDefault();
    var isOpen = header.hasAttribute('open');
    setAccordionState(accordion, !isOpen);

    setTimeout(function () { updateParentAccordions(accordion); }, 200);
  });
}

// Apply the open state.
function syncAccordions() {
  var accs = Array.prototype.slice.call(
    document.querySelectorAll('.custom-collapsible-content .accordion')
  );

  //Children first, so parents measure the expanded children
  accs.reverse().forEach(function (acc) {
    var header = acc.querySelector('.class-summary');
    if (!header) return;

    var isOpen = header.hasAttribute('open') || header.classList.contains('active');
    setAccordionState(acc, isOpen);
  });
}

function initAccordions() {
  //open the first child accordion on first load only
  var wrapper = document.querySelector('.child-accordion-wrapper');
  var firstAccordion = wrapper && wrapper.querySelector('.accordion');
  if (firstAccordion && !firstAccordion.dataset.firstOpened) {
    firstAccordion.dataset.firstOpened = 'true';
    var h = firstAccordion.querySelector('.class-summary');
    if (h) h.setAttribute('open', '');
  }

  requestAnimationFrame(function () {
    syncAccordions();
    // re-measure once images and fonts have settled
    setTimeout(syncAccordions, 300);
  })
}

// Called after the spec section is swapped via AJAX
window.initSpec = function () {
  initAccordions();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccordions());
} else {
  initAccordions();
}