function updateParentAccordions(accordion) {
  var parentContent = accordion.parentElement && accordion.parentElement.closest('.accordion__content');
  while (parentContent) {
    if (parentContent.style.maxHeight) {
      parentContent.style.maxHeight = parentContent.scrollHeight + 30 + 'px';
    }
    parentContent = parentContent.parentElement && parentContent.parentElement.closest('.accordion__content');
  }
}

function initAccordions() {
  // set all accordions to inert
  document.querySelectorAll('.custom-collapsible-content .accordion').forEach(function (acc) {
    var c = acc.querySelector('.accordion__content');
    if (c) c.inert = true;
  });

  // Open the first child accordion (no early returns)
  var wrapper = document.querySelector('.child-accordion-wrapper');
  var firstAccordion = wrapper && wrapper.querySelector('.accordion');
  if (firstAccordion) {
    var firstHeader = firstAccordion.querySelector('.class-summary');
    var firstContent = firstAccordion.querySelector('.accordion__content');
    if (firstHeader && firstContent) {
      firstContent.style.maxHeight = firstContent.scrollHeight + 'px';
      firstContent.inert = false;
      firstHeader.classList.add('active');
      firstHeader.setAttribute('open', '');
      var firstButton = firstHeader.querySelector('button.title_arrow-wrapper');
      if (firstButton) firstButton.setAttribute('aria-expanded', 'true');
    }
  }

  // Click handlers
  document.querySelectorAll('.custom-collapsible-content .accordion').forEach(function (accordion) {
    var header = accordion.querySelector('.class-summary');
    var content = accordion.querySelector('.accordion__content');
    if (!header || !content) return;

    var button = header.querySelector('button.title_arrow-wrapper');

    header.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault(); // only needed if header is a <summary>

      var isOpen = !!content.style.maxHeight;

      header.classList.toggle('active');
      if (button) {
        button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      }

      if (isOpen) {
        content.style.maxHeight = null;
        content.inert = true;
        header.removeAttribute('open');
      } else {
        content.style.maxHeight = content.scrollHeight + 30 + 'px';
        content.inert = false;
        header.setAttribute('open', '');
      }

      setTimeout(function () { updateParentAccordions(accordion); }, 200);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccordions);
} else {
  initAccordions();
}