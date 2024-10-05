// ==UserScript==
// @name         Dropshipping Detector
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Detect if the current site is a dropshipping website. Relies on "Antidrop.fr".
// @author       [Ambroise Dhenain](https://ambroise.dhenain.fr/)
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Function to detect if a site is e-commerce and collect reasons
  function detectEcommerce() {
    let isEcommerce = false;
    const reasons = [];

    // Detect Checkout Forms
    if (detectCheckoutForms()) {
      reasons.push('Checkout or cart form detected');
      isEcommerce = true;
    }

    // Detect Product Listings (based on common CSS classes, not actual products)
    if (detectProductListings()) {
      reasons.push('Multiple product listings detected (CSS class-based detection)');
      isEcommerce = true;
    }

    // Detect Cart Link
    if (detectCartLink()) {
      reasons.push('Cart link detected');
      isEcommerce = true;
    }

    // Detect Prices
    if (detectPrices()) {
      reasons.push('Product price detected');
      isEcommerce = true;
    }

    // Detect Cart in Local Storage
    if (detectCartInLocalStorage()) {
      reasons.push('Cart data found in localStorage');
      isEcommerce = true;
    }

    // Detect E-commerce Platforms
    const platformReason = detectEcommercePlatform();
    if (platformReason) {
      reasons.push(platformReason);
      isEcommerce = true;
    }

    // If we detect an e-commerce site, call the Antidrop API
    if (isEcommerce) {
      console.debug('[Dropshipping Detector] E-commerce detected.', reasons);
      callAntidropAPI();
    }
  }

  // Call Antidrop API to check for dropshipping
  function callAntidropAPI() {
    const apiUrl = 'https://antidrop.fr/api/scan';
    const currentUrl = window.location.href;
    const language = 'fr'; // Language can be adjusted as needed

    // Prepare request payload
    const payload = new URLSearchParams();
    payload.append('lg', language);
    payload.append('url', currentUrl);

    console.debug('[Dropshipping Detector] Sending request to Antidrop API.', payload);

    // Send POST request to Antidrop API
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    })
      .then(response => response.json())
      .then(data => {
        if (data && data.mark > 0) {
          console.warn('[Dropshipping Detector] Dropshipping site detected.');
          showDropshippingWarning(data.mark, data.website.technos);
        } else {
          console.debug('[Dropshipping Detector] No dropshipping detected.');
        }
      })
      .catch(error => {
        console.error('[Dropshipping Detector] API request failed:', error);
      });
  }

  // Show a fullscreen warning when dropshipping is detected
  function showDropshippingWarning(mark, technos) {
    // Calculate the dropshipping probability as a percentage
    const probability = (mark / 5) * 100;

    // Display an alert
    alert(`Warning: This site has been flagged as a dropshipping website with ${probability}% probability!`);

    // Create a full-screen overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.color = 'white';
    overlay.style.fontSize = '2rem';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.padding = '20px';

    // Add the warning text
    const warningText = document.createElement('div');
    warningText.textContent = `⚠️ WARNING: This site has a ${probability}% probability of being a DROPSHIPPING website!`;
    warningText.style.marginBottom = '20px';
    overlay.appendChild(warningText);

    // Create a collapsible section for technologies
    const detailsButton = document.createElement('button');
    detailsButton.textContent = 'Show Details';
    detailsButton.style.marginBottom = '10px';
    detailsButton.style.fontSize = '1.5rem';
    detailsButton.style.cursor = 'pointer';
    overlay.appendChild(detailsButton);

    const technosSection = document.createElement('div');
    technosSection.style.display = 'none';
    technosSection.style.textAlign = 'left';
    technosSection.style.maxWidth = '80%';
    technosSection.style.maxHeight = '50%';
    technosSection.style.overflowY = 'auto';
    technosSection.style.border = '1px solid white';
    technosSection.style.padding = '10px';

    technos.forEach(tech => {
      const techDiv = document.createElement('div');
      techDiv.style.marginBottom = '10px';
      techDiv.innerHTML = `<strong>${tech.name}:</strong> ${tech.description}`;
      technosSection.appendChild(techDiv);
    });

    overlay.appendChild(technosSection);

    // Toggle the display of the technologies section
    detailsButton.addEventListener('click', () => {
      technosSection.style.display = technosSection.style.display === 'none' ? 'block' : 'none';
    });

    // Append overlay to the body
    document.body.appendChild(overlay);
  }

  // Detect Checkout or Cart Forms in multiple languages
  function detectCheckoutForms() {
    const forms = document.querySelectorAll('form');
    const keywords = [
      'checkout', 'cart', 'add to cart', // English
      'panier', 'commander', 'ajouter au panier', // French
      'warenkorb', 'zur kasse', 'in den warenkorb', // German
      'carrito', 'finalizar compra', 'añadir al carrito', // Spanish
      'carrello', 'procedi al pagamento', 'aggiungi al carrello' // Italian
    ];

    return Array.from(forms).some(form => {
      const action = form.getAttribute('action') || '';
      const text = form.innerText.toLowerCase();
      return keywords.some(keyword => action.includes(keyword) || text.includes(keyword));
    });
  }

  // Detect Product Listings (based on common CSS classes, not actual products)
  function detectProductListings() {
    const productGrids = document.querySelectorAll('.product, .item, .product-card, .product-listing');
    const keywords = [
      'product', 'item', // English
      'produit', 'article', // French
      'produkt', 'artikel', // German
      'producto', 'artículo', // Spanish
      'prodotto', 'articolo' // Italian
    ];

    const bodyText = document.body.innerText.toLowerCase();
    const productsDetected = keywords.some(keyword => bodyText.includes(keyword));

    // The detection is primarily based on the presence of product-related CSS classes
    return productGrids.length > 3 || productsDetected;
  }

  // Detect Cart Link in multiple languages
  function detectCartLink() {
    const links = document.querySelectorAll('a');
    const keywords = [
      'cart', 'checkout', // English
      'panier', 'commander', // French
      'warenkorb', 'kasse', // German
      'carrito', 'comprar', // Spanish
      'carrello', 'pagamento' // Italian
    ];

    return Array.from(links).some(link =>
      keywords.some(keyword => link.textContent.toLowerCase().includes(keyword) || link.getAttribute('href')?.includes(keyword))
    );
  }

  // Detect Prices (using regex for currency symbols) in multiple formats
  function detectPrices() {
    const priceRegex = /(\$\d{1,3}(,\d{3})*(\.\d{2})?)|(\€\d{1,3}(.\d{3})*(,\d{2})?)|(\£\d{1,3}(,\d{3})*(\.\d{2})?)/;
    const bodyText = document.body.innerText;
    return priceRegex.test(bodyText);
  }

  // Detect Cart in Local Storage
  function detectCartInLocalStorage() {
    const cartKeys = ['cart', 'shoppingCart', 'cartItems', 'panier', 'warenkorb', 'carrito', 'carrello'];
    return cartKeys.some(key => localStorage.getItem(key));
  }

  // Detect Specific E-commerce Platforms (Shopify, WooCommerce, Magento, etc.)
  function detectEcommercePlatform() {
    // Detect Shopify
    if (document.querySelector('meta[name="shopify-checkout-api-token"]')) {
      return 'Shopify platform detected';
    }

    // Detect WooCommerce
    if (document.querySelector('script[src*="woocommerce"]')) {
      return 'WooCommerce platform detected';
    }

    // Detect Magento
    if (document.querySelector('script[src*="mage"]') || document.body.classList.contains('cms-index-index')) {
      return 'Magento platform detected';
    }

    // Detect PrestaShop
    if (document.querySelector('meta[name="generator"][content*="PrestaShop"]')) {
      return 'PrestaShop platform detected';
    }

    // Detect BigCommerce
    if (document.querySelector('script[src*="bigcommerce"]')) {
      return 'BigCommerce platform detected';
    }

    // Detect Wix Stores
    if (document.querySelector('script[src*="wixstores"]') || document.querySelector('meta[content*="Wix.com"]')) {
      return 'Wix platform detected';
    }

    // Detect Squarespace Commerce
    if (document.querySelector('meta[name="generator"][content*="Squarespace"]')) {
      return 'Squarespace Commerce platform detected';
    }

    return null;  // No platform detected
  }

  // Run the detection on page load
  window.addEventListener('load', detectEcommerce);
})();
