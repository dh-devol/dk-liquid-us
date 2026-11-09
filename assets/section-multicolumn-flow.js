(function () { 
    // adds link to image without causing issue with accessibility but still allowing a hover on the image
    if (window.multicolumnCardLinkInit) return;
    window.multicolumnCardLinkInit = true;

    document.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0) return;

        var wrapper = event.target.closest('.multicolumn-card__image-wrapper');
        if (!wrapper) return;

        var card = wrapper.closest('.multicolumn-card');
        var link = card && card.querySelector('.multicolumn-card__link');
        if (!link) return;

        if (event.ctrlKey || event.metaKey || event.shiftKey) {
            window.open(link.href, '_blank');
        } else {
            link.click();
        }
    });
})();