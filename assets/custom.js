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
          content.style.maxHeight = content.scrollHeight + "px";
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
        parent.style.maxHeight = parent.scrollHeight + "px";
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

if (window.innerWidth <= 991) return;

const staffRows = document.querySelectorAll(".staff-multicolumn .staff-row");
if (!staffRows.length) return;

  staffRows.forEach((row) => {
    const staffImages = row.querySelectorAll(".multicolumn-card__image-wrapper");
    const staffDetail = row.querySelector(".staff-detail"); 
    const staffName = staffDetail.querySelector(".staff-name");
    const staffRole = staffDetail.querySelector(".staff-role");
    const staffDegree = staffDetail.querySelector(".staff-degree");
    const staffDescription = staffDetail.querySelector(".staff-description");
    const staffImage = staffDetail.querySelector(".staff__image");
    const staffurl = staffDetail.querySelector(".staff-url");

    if (!staffImages.length || !staffDetail) return;

    staffImages.forEach((image) => {
        image.addEventListener("click", function (event) {
            event.preventDefault();

            const isActive = this.classList.contains("active");

            document.querySelectorAll(".staff-detail").forEach((detail) => {
                detail.classList.remove("active");
            });

            document.querySelectorAll(".multicolumn-card__image-wrapper").forEach((img) => {
                img.classList.remove("active");
            });

            if (isActive) {
                return;
            }

            const name = this.getAttribute("data-name");
            const role = this.getAttribute("data-role");
            const degree = this.getAttribute("data-degree");
            const description = this.getAttribute("data-description");
            const personImagesrc = this.getAttribute("data-image-src");
            const personImagealt = this.getAttribute("data-image-alt");
            const urlText = this.getAttribute("data-url-title");
            const urlPath = this.getAttribute("data-url-path");

            if (name) staffName.textContent = name;
            if (role) staffRole.textContent = role;
            if (degree) staffDegree.textContent = degree;
            if (description) staffDescription.innerHTML = description;
            if (personImagesrc) staffImage.src = personImagesrc;
            if (personImagealt) staffImage.alt = personImagealt;
            if (urlText) staffurl.textContent = urlText;
            if (urlPath) staffurl.href = urlPath;
          

            staffDetail.classList.add("active");
            this.classList.add("active");

            // Scroll into view smoothly after short delay
            setTimeout(() => {
              const topOffset = staffDetail.getBoundingClientRect().top + window.pageYOffset - 100;
              window.scrollTo({
                top: topOffset,
                behavior: 'smooth'
              });
            }, 200);
        });
    });
  });
 
});
