document.addEventListener("DOMContentLoaded", function () {
   const blogTitle = document.querySelector(".blog__title");
  const blogWrapper = document.querySelector(".blog__option-wrapper");

  if (blogTitle && blogWrapper) {
    blogTitle.addEventListener("click", function () {
      blogWrapper.classList.toggle("active");
    });
  } 

  document.querySelectorAll(".custom-collapsible-content .accordion").forEach(function (accordion) {
    const header = accordion.querySelector(".class-summary");
  
    if (header) {
      header.addEventListener("click", function (e) {
        e.stopPropagation();
  
        const content = accordion.querySelector(".accordion__content");
        const isOpen = content.style.maxHeight;
  
        header.classList.toggle("active");
  
        if (isOpen) {
          // Close accordion
          content.style.maxHeight = null;
          header.removeAttribute("open");
  
          // Also shrink parent accordions after child is closed
          setTimeout(() => updateParentAccordions(accordion), 350); // wait for 300ms transition + buffer
        } else {
          // Open accordion
          content.style.maxHeight = content.scrollHeight + 30 + "px";
          header.setAttribute("open", "");

          // Wait for 300ms CSS transition to finish before reading scrollHeight
          setTimeout(() => updateParentAccordions(accordion), 350);
        }
      });
    }
  });

// Script for add class on category details page inside product list for mobile
document.querySelectorAll(
  '.page-metafield-gallery.slideshow-thumbnail-gallery.small-hide'
).forEach(gallery => {

    const gallerySection = gallery.closest('section');
    if (!gallerySection) return;

    let nextSection = gallerySection.nextElementSibling;

    while (nextSection) {

        nextSection
          .querySelectorAll(
            '.pro-multicolumn.custom-multicolumn:not(.project-multi-column)'
          )
          .forEach(multiColumn => {
              multiColumn.classList.add('mobile-max-width');
          });

        nextSection = nextSection.nextElementSibling;
    }
});

// Script for add class on tb show page

(function () {
  const main = document.querySelector('main#MainContent');
  if (!main) return;

  if (main.querySelector('.tv-show-about-devols')) {
    main.classList.add('devol-tv-show-page');
  }

   if (main.querySelector('.showroom__description-wrapper')) {
    main.classList.add('showroom-description-page');
  }

   if (main.querySelector('.press-page-swiper')) {
    main.classList.add('press-page');
  }
  
})();


  
function updateParentAccordions(element) {
    let parent = element.parentElement;
    while (parent) {
      if (parent.classList.contains("accordion__content")) {
        // Dynamically adjust the max-height to include new child content
        parent.style.maxHeight = parent.scrollHeight + 30 + "px";
      }
      parent = parent.parentElement;
    }
  }

  
  function updateCartBubbleEmpty() {
    const bubble = document.querySelector('.cart-count-bubble');
    if (!bubble) return;
    const countEl = bubble.querySelector('[aria-hidden="true"]');
    const count = countEl ? parseInt(countEl.textContent, 10) : 0;
    bubble.classList.toggle('cart-count-bubble--empty', !count || count < 1);
  }

  updateCartBubbleEmpty();

  const bubble = document.querySelector('.cart-count-bubble');
  if (bubble && window.MutationObserver) {
    const observer = new MutationObserver(() => updateCartBubbleEmpty());
    observer.observe(bubble, { childList: true, subtree: true, characterData: true });
  }

  document.querySelectorAll('.mega-menu').forEach(menu => {
    menu.addEventListener('mouseenter', () => {
      menu.setAttribute('open', '');
    });

    menu.addEventListener('mouseleave', () => {
      menu.removeAttribute('open');
    });
  });


// Disable image click on mobile (iOS + Android safe)
if (window.matchMedia('(max-width: 991px)').matches) {
  document.addEventListener(
    'click',
    function (e) {
      const link = e.target.closest('.staff-row .multicolumn-card__image-wrapper');
      if (!link) return;

      e.preventDefault();
      e.stopPropagation();
    },
    true // CAPTURE phase (important for iOS)
  );
}

});
