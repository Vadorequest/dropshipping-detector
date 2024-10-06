// ==UserScript==
// @name         Dropshipping Detector
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Detect if the current site is a dropshipping website. Relies on "Antidrop.fr".
// @author       Ambroise Dhenain - ambroise.dhenain.fr
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /**
    Change these thresholds to make the detector more or less aggressive based on the dropshipping probability.
   */
  const PROBABILITY_THRESHOLD_BANNER = 50; // Lower than that number, no warning will show
  const PROBABILITY_THRESHOLD_OVERLAY = 90; // Lower than that number, Banner warning will show. Higher or equal, overlay will show

  /**
    Change the image size of the articles.
   */
  const IMG_SIZE = 150;

  const domainName = window.location.hostname;

  // Align SVG icons with text
  const iconStyle = 'vertical-align: middle; margin-right: 10px;';

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
    const language = 'fr'; // AntiDrop only supports "fr" at this time

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
          console.debug('[Dropshipping Detector] Dropshipping site detected.', data);
          showDropshippingWarning(
            data?.mark ?? 0,
            data?.website?.technos ?? [],
            data?.similarArticles ?? [],
            data?.lastSearchDate ?? null
          );
        } else {
          console.debug('[Dropshipping Detector] No dropshipping detected.', data);
        }
      })
      .catch(error => {
        console.error('[Dropshipping Detector] API request failed:', error);
      });
  }

  function showDropshippingWarning(mark, technos, similarArticles, lastSearchDate) {
    const probability = (mark / 5) * 100;

    // If probability is less than the banner threshold, do nothing
    if (probability < PROBABILITY_THRESHOLD_BANNER) {
      console.debug('[Dropshipping Detector] Probability below threshold, no warning displayed.');
      return;
    }

    // If probability is between 50% and 89%, show the banner
    if (probability >= PROBABILITY_THRESHOLD_BANNER && probability < PROBABILITY_THRESHOLD_OVERLAY) {
      showTopBannerWarning(probability, technos, similarArticles, lastSearchDate);
    }
    // If probability is 90% or higher, show the full overlay
    else if (probability >= PROBABILITY_THRESHOLD_OVERLAY) {
      showFullScreenWarning(probability, technos, similarArticles, lastSearchDate);
    }
  }

  function generateBannerHtml(probability, technos, similarArticles) {
    const warningColor = 'orange';
    return `
    <div style="position: fixed; top: 0; left: 0; width: 100vw; background-color: rgba(255, 165, 0, 0.95); color: black;
      font-size: 16px; display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; z-index: 2147483647;"
      data-banner>
      
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${warningColor}" width="24px" height="24px" style="${iconStyle}">
          <path d="M0 0h24v24H0V0z" fill="none"/><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
        <span>ATTENTION: Ce site a ${probability}% de probabilité d'être un site de DROPSHIPPING selon AntiDrop !</span>
        <span style="font-style: italic">(${technos?.length || 0} techno${technos?.length > 1 ? 's' : ''} | ${similarArticles?.length || 0} article${similarArticles?.length > 1 ? 's' : ''})</span>
        <a href="#" id="viewDetails" style="text-decoration: underline; color: black; font-weight: bold; margin-left: 20px;">Voir les détails</a>
      </div>

      <!-- Réduire button -->
      <button style="background: transparent; border: none; cursor: pointer; font-size: 16px;"
        onclick="(function() {
          const banner = this.closest('[data-banner]');
          banner.style.opacity = '0.8';

          // Add hover behavior only after shrinking
          banner.onmouseenter = function() {
            banner.style.height = 'auto';
            banner.style.fontSize = '16px';
            banner.style.padding = '10px 20px';
            banner.style.opacity = '1';
          };
          banner.onmouseleave = function() {
            banner.style.height = '20px';
            banner.style.fontSize = '12px';
            banner.style.padding = '2px 10px';
            banner.style.opacity = '0.8';
          };
        }).call(this)">
        Réduire
      </button>
    </div>
  `;
  }

  function showTopBannerWarning(probability, technos, similarArticles, lastSearchDate) {
    const bannerHtml = generateBannerHtml(probability, technos, similarArticles);
    const banner = document.createElement('div');
    banner.innerHTML = bannerHtml;
    document.body.appendChild(banner);

    document.getElementById('viewDetails').addEventListener('click', (e) => {
      e.preventDefault();
      showFullScreenWarning(probability, technos, similarArticles, lastSearchDate);
    });
  }

  function showFullScreenWarning(probability, technos, similarArticles, lastSearchDate) {
    const overlayHtml = `
    <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.9); color: white; 
      display: flex; flex-direction: column; align-items: center; padding: 20px; z-index: 2147483647; overflow: auto;" data-overlay>
      
      <a href="https://antidrop.fr/contact" target="_blank" style="color: white; text-decoration: underline; position: absolute; left: 10px; top: 10px;">Ce site n'est pas du dropshipping !</a>
      
      <!-- Close button -->
      <button style="position: absolute; top: 10px; right: 20px; background: transparent; border: none; cursor: pointer; color: white"
        onclick="this.closest('[data-overlay]').remove()">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24px" height="24px" style="${iconStyle}">
          <path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 18 12 14.41 8.41 18 7 16.59 10.59 13 7 9.41 8.41 8 12 11.59 15.59 8 17 9.41 13.41 13 17 16.59z"/>
        </svg> Fermer
      </button>
      
      <!-- Probability -->
      <div style="font-size: 40px; font-weight: bold; margin: 20px; color: red;">${probability}%</div>

      <!-- Warning text -->
      <div style="margin-bottom: 20px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" width="48px" height="48px" style="${iconStyle}">
          <path d="M0 0h24v24H0V0z" fill="none"/><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg> ATTENTION: Ce site a ${probability}% de probabilité d'être un site de DROPSHIPPING selon AntiDrop !
      </div>

      <!-- Technologies section -->
      ${technos && technos.length > 0 ? `
        <div style="width: 100%;">
          <h2 style="font-size: 1.8rem; font-weight: bold; margin-bottom: 10px; text-align: left; color: white;">Technologies détectées en lien avec le dropshipping</h2>
          <p style="color: orange; text-align: left;">
            Attention : Certaines des technologies listées ci-dessous sont couramment associées à des sites de dropshipping.<br />
            Cependant, cela ne signifie pas automatiquement que ce site en fait partie. Nous vous invitons à vérifier vous-même en fonction de vos propres critères.
          </p>
          ${technos.map((tech, index) => `<div style="text-align: left;">${index + 1}) <strong>${tech.name}:</strong> ${tech.description}</div>`).join('')}
        </div>
      ` : ''}
      
      <!-- Articles section -->
      ${similarArticles && similarArticles.length > 0 ? `
        <div style="width: 100%; margin-top: 20px;">
          <h2 style="font-size: 1.8rem; font-weight: bold; margin-bottom: 10px; text-align: left; color: white;">Articles similaires trouvés sur des sites de dropshipping</h2>
          <p style="color: orange; text-align: left;">
            Important : Les articles ci-dessous ont été trouvés sur des sites identifiés comme utilisant le dropshipping, mais les correspondances ne sont pas toujours parfaites.<br />
            Le système AntiDrop se base notamment sur la reconnaissance d'images, ce qui peut parfois mener à des résultats inexacts.<br />
            Nous vous conseillons de bien examiner chaque article et de faire vos propres recherches.
          </p>
          ${getArticlesList(similarArticles)}
        </div>
      ` : ''}

      <!-- Update information -->
      <div style="margin-top: 40px; text-align: center;">
        <p>Le résultat ci-dessus est basé sur plusieurs facteurs, tels que les technologies utilisées par ce site, les produits vendus, et d'autres éléments techniques.</p>
        <p>Dernière mise à jour sur la base de données AntiDrop: ${new Date(lastSearchDate).toLocaleDateString('fr-FR')}</p>
      </div>

      <!-- Disclaimer at the bottom -->
      <div style="position: relative; width: 100%; margin-top: 20px;">
        <div style="position: absolute; bottom: 10px; right: 10px; font-size: 12px; color: gray; text-align: center;">
          Avertissement : Cet outil est destiné à informer les utilisateurs sur les sites potentiellement liés au dropshipping. 
          Il n'est pas garanti à 100% précis. Vous pouvez consulter les détails complets sur la page 
          <a href="https://antidrop.fr/disclaimer" style="color: white; text-decoration: underline; font-size: 12px" target="_blank">
            d'antidrop.fr
          </a>.
        </div>
      </div>
    </div>
  `;

    const overlay = document.createElement('div');
    overlay.innerHTML = overlayHtml;
    document.body.appendChild(overlay);

    // Add event listener for "Esc" key press
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const overlay = document.querySelector('[data-overlay]');
        if (overlay) {
          overlay.remove();
        }
      }
    });
  }

  function getArticlesList(similarArticles) {
    const groupedArticles = {};

    // Group articles by domain
    similarArticles.forEach(article => {
      const apexDomain = getApexDomain(article.url);
      if (!groupedArticles[apexDomain]) {
        groupedArticles[apexDomain] = [];
      }
      groupedArticles[apexDomain].push(article);
    });

    // Generate HTML for each domain and its articles
    return Object.keys(groupedArticles).map(domain => {
      const articlesHtml = groupedArticles[domain].map(article => `
      <div style="display: flex; flex-direction: column; width: ${IMG_SIZE + 200}px; margin-bottom: 10px;">
        <a href="${article.url}" style="display: flex; align-items: flex-start; text-decoration: none;" target="_blank">
          <img src="${article.images[0]}" style="width: ${IMG_SIZE}px; height: ${IMG_SIZE}px; margin-right: 10px;">
          <span style="word-wrap: break-word; font-size: 14px; color: white;">${article.title}</span>
        </a>
        <div style="font-size: 16px; font-weight: bold; margin-top: 5px; color: white;">${article.price}€</div>
      </div>
    `).join('');

      return `
      <div style="display: flex; flex-direction: column; width: 100%;">
        <div style="margin-bottom: 15px;"><strong>${domain}</strong></div>
        <div style="display: flex; flex-wrap: wrap; gap: 20px; overflow: auto;">${articlesHtml}</div>
      </div>
    `;
    }).join('');
  }


  function getApexDomain(url) {
    const domain = new URL(url).hostname;
    const parts = domain.split('.').reverse();

    // Handle domains like co.uk, com.au, etc.
    if (parts.length >= 3 && (parts[1] === 'co' || parts[1] === 'com')) {
      return parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    return parts[1] + '.' + parts[0];
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
