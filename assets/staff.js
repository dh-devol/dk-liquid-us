if (!window.devolStaffClickHandlerAdded) {
  window.devolStaffClickHandlerAdded = true;

  document.addEventListener("click", function (event) {
    if (window.innerWidth <= 991) return;
    if (!(event.target instanceof Element)) return;

    const card = event.target.closest(
      ".staff-multicolumn .staff-row .multicolumn-card__image-wrapper"
    );
    if (!card) return;

    const row = card.closest(".staff-row");
    const detail = row?.querySelector(".staff-detail");
    if (!detail) return;

    event.preventDefault();

    const wasActive = card.classList.contains("active");

    document
      .querySelectorAll(".staff-multicolumn .staff-detail.active")
      .forEach((panel) => panel.classList.remove("active"));

    document
      .querySelectorAll(
        ".staff-multicolumn .multicolumn-card__image-wrapper.active"
      )
      .forEach((item) => item.classList.remove("active"));

    if (wasActive) return;

    const setText = (selector, value) => {
      const element = detail.querySelector(selector);
      if (element) element.textContent = value || "";
    };

    setText(".staff-name", card.dataset.name);
    setText(".staff-role", card.dataset.role);
    setText(".staff-degree", card.dataset.degree);

    const description = detail.querySelector(".staff-description");
    if (description) {
      description.innerHTML = card.dataset.description || "";
    }

    const image = detail.querySelector(".staff__image");
    if (image) {
      const src = card.dataset.imageSrc || "";
      image.hidden = !src;
      image.alt = card.dataset.imageAlt || card.dataset.name || "";

      if (src) {
        image.src = src;
      } else {
        image.removeAttribute("src");
      }
    }

    const link = detail.querySelector(".staff-url");
    if (link) {
      const path = card.dataset.urlPath || "";
      link.textContent =
        card.dataset.urlTitle || card.dataset.name || path;
      link.hidden = !path;

      if (path) {
        link.setAttribute("href", path);
      } else {
        link.removeAttribute("href");
      }
    }

    detail.classList.add("active");
    card.classList.add("active");

    setTimeout(() => {
      if (!detail.isConnected || !detail.classList.contains("active")) return;

      const top =
        detail.getBoundingClientRect().top + window.scrollY - 100;

      window.scrollTo({
        top,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth"
      });
    }, 200);
  });
}
