console.log("oos-form.js connected");

window.addEventListener('stoq:restock-modal:submitted', (event) => {
  const notification = document.getElementById('cart-notification');
  notification.ariaLabel = "Form submission message";
  
  const message = notification.getElementsByTagName("span")[0];
  message.innerHTML = "Thank you, we'll send you a message as soon as it is back in stock."

  const cartPopupContainer = document.getElementById("cart-popup-container");
  cartPopupContainer.innerHTML = '<div id="message-notification" class="cart-notification-wrapper page-width"></div>';

  const notificationContainer = document.getElementById("message-notification");
  notificationContainer.innerHTML = notification.outerHTML;
  cartPopupContainer.classList.add('show');
});

