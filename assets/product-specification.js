document.addEventListener('DOMContentLoaded', function () {
    var wrapper = document.querySelector('.child-accordion-wrapper');
    if (!wrapper) return;

    var firstAccordion = wrapper.querySelector('.accordion');
    if (!firstAccordion) return;

    var header = firstAccordion.querySelector('.class-summary');
    var content = firstAccordion.querySelector('.accordion__content');
    if (!header || !content) return;

    content.style.maxHeight = content.scrollHeight + 'px';
    header.classList.add('active');
    header.setAttribute('open', '');

    document.querySelectorAll(".custom-collapsible-content .accordion").forEach(function (accordion) {
    const header = accordion.querySelector(".class-summary");
    const button = header.querySelector("button.title_arrow-wrapper");
  
    if (header) {
      header.addEventListener("click", function (e) {
        e.stopPropagation();
  
        const content = accordion.querySelector(".accordion__content");
        const isOpen = content.style.maxHeight;
  
        header.classList.toggle("active");
        button.setAttribute("aria-expanded", button.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
        
        if (isOpen) {
          // Close accordion
          content.style.maxHeight = null;
          header.removeAttribute("open");
          
  
          // Also shrink parent accordions after child is closed
          setTimeout(() => updateParentAccordions(accordion), 200); // wait for animation
        } else {
          // Open accordion
          content.style.maxHeight = content.scrollHeight + 30 + "px";
          header.setAttribute("open", "");
          // button.setAttribute("aria-expanded", "true");
  
          // Delay ensures child has expanded before updating parent
          setTimeout(() => updateParentAccordions(accordion), 200); // match your CSS transition
        }
      });
    }
  });
});