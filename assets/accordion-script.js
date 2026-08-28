// dropdown accordion logic used on some bundles
window.initAccordion = function(root) {
    console.log("initAccordion triggered")
    const accordionBtn = root.querySelector('.switch-dropdown-accordion');
    const selectDiv = root.querySelector('.switch-select');
    const mmBundle = root.querySelector('.mm-bundle');
    function hideAccordion () {
    accordionBtn.style.display = "none";
    }
    function accordionAnimation () {
        accordionBtn.toggleAttribute("open");
        if (selectDiv.style.display === "block") {
            selectDiv.style.display = "none";
            selectDiv.setAttribute("aria-expanded", "false");
        } else {
            selectDiv.style.display = "block";
            selectDiv.setAttribute("aria-expanded", "true");
        }
    }
    if (accordionBtn && mmBundle) {
    hideAccordion();
    }
    if (accordionBtn) {
    accordionBtn.addEventListener("click", accordionAnimation);
    }
};

document.addEventListener("DOMContentLoaded", () => {window.initAccordion(document);});