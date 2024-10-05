// ==UserScript==
// @name         Dropshipping Detector
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Detect if the current site is a dropshipping website. Relies on "Antidrop.fr".
// @author       [Ambroise Dhenain](https://ambroise.dhenain.fr/)
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Customizable probability threshold for showing full-screen warning
  const PROBABILITY_THRESHOLD = 49; // If probability >= 50, full-screen overlay is shown, otherwise banner is shown
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

  // Show a fullscreen warning when dropshipping is detected
  function showDropshippingWarning(mark, technos, similarArticles, lastSearchDate) {
    // Calculate the dropshipping probability as a percentage
    const probability = (mark / 5) * 100;

    // If probability is less than the threshold, show the top banner
    if (probability <= PROBABILITY_THRESHOLD) {
      showTopBannerWarning(probability);
    } else {
      // Otherwise, show the full-screen overlay
      showFullScreenWarning(probability, technos, similarArticles, lastSearchDate);
    }
  }

  // Function to show the less intrusive top banner (for probability <= PROBABILITY_THRESHOLD)
  function showTopBannerWarning(probability) {
    const warningColor = 'orange'; // Orange for low probability warnings

    // Create a top banner
    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.width = '100vw';
    banner.style.backgroundColor = 'rgba(255, 165, 0, 0.95)'; // Orange background
    banner.style.color = 'black';
    banner.style.fontSize = '16px';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'space-between';
    banner.style.padding = '10px 20px';
    banner.style.zIndex = '2147483647'; // Max z-index

    // Add the warning text with an orange SVG icon
    const warningText = document.createElement('div');
    warningText.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${warningColor}" width="24px" height="24px" style="${iconStyle}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> ATTENTION: Ce site a ${probability}% de probabilité d'être un site de DROPSHIPPING!`;
    warningText.style.color = 'black';
    banner.appendChild(warningText);

    // Add a close button to remove the banner
    const closeButton = document.createElement('button');
    closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="black" width="24px" height="24px" style="${iconStyle}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 18 12 14.41 8.41 18 7 16.59 10.59 13 7 9.41 8.41 8 12 11.59 15.59 8 17 9.41 13.41 13 17 16.59z"/></svg> Fermer`;
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '16px';
    closeButton.addEventListener('click', () => {
      banner.remove();
    });
    banner.appendChild(closeButton);

    // Append the banner to the body
    document.body.appendChild(banner);
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

  // Function to show the full-screen overlay (for probability > PROBABILITY_THRESHOLD)
  function showFullScreenWarning(probability, technos, similarArticles, lastSearchDate) {
    const warningColor = 'red'; // Red for high probability warnings

    // Create the full-screen overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    overlay.style.color = 'white';
    overlay.style.fontSize = '16px';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'flex-start'; // Align content from the top
    overlay.style.overflow = 'auto'; // Enable scrolling for the whole overlay
    overlay.style.padding = '20px';
    overlay.style.zIndex = '2147483647'; // Max z-index

    // Add a close button with an icon to remove the overlay
    const closeButton = document.createElement('button');
    closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24px" height="24px" style="${iconStyle}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 18 12 14.41 8.41 18 7 16.59 10.59 13 7 9.41 8.41 8 12 11.59 15.59 8 17 9.41 13.41 13 17 16.59z"/></svg> Fermer`;
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '20px';
    closeButton.style.fontSize = '16px';
    closeButton.style.color = 'white';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
      overlay.remove();
    });
    overlay.appendChild(closeButton);

    // Add the probability at the top (in a big way)
    const probabilityText = document.createElement('div');
    probabilityText.textContent = `${probability}%`;
    probabilityText.style.fontSize = '40px';
    probabilityText.style.fontWeight = 'bold';
    probabilityText.style.marginBottom = '20px';
    probabilityText.style.color = warningColor;  // Same color as warning
    overlay.appendChild(probabilityText);

    // Add the warning text (in French) with a red SVG icon
    const warningText = document.createElement('div');
    warningText.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${warningColor}" width="48px" height="48px" style="${iconStyle}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg> ATTENTION: Ce site a ${probability}% de probabilité d'être un site de DROPSHIPPING!`;
    warningText.style.marginBottom = '20px';
    warningText.style.color = 'white';
    overlay.appendChild(warningText);

    // Add the explanation of how the result was determined
    const explanationText = document.createElement('div');
    explanationText.innerHTML = `Le résultat ci-dessus est basé sur plusieurs facteurs, tels que les technologies utilisées par ce site, les produits vendus, et d'autres éléments techniques.<br><br>
      Un pourcentage de 100% est généralement très fiable. Si vous avez des doutes, vous pouvez visiter <a href="https://antidrop.fr/contact" target="_blank" style="color: white; text-decoration: underline;">ce lien</a> pour plus de détails ou pour contester le résultat.`;
    explanationText.style.marginBottom = '20px';
    explanationText.style.textAlign = 'center';
    explanationText.style.color = 'white';
    overlay.appendChild(explanationText);

    // Add a reference to antidrop.fr
    const sourceText = document.createElement('div');
    sourceText.innerHTML = 'Résultat fourni par <a href="https://antidrop.fr" target="_blank" style="color: white; text-decoration: underline;">antidrop.fr</a>';
    sourceText.style.fontSize = '16px';
    sourceText.style.marginBottom = '20px';
    sourceText.style.color = 'white';
    overlay.appendChild(sourceText);

    // Add the "lastSearchDate" using datetime formatting
    const lastSearchText = document.createElement('div');
    const formattedDate = new Date(lastSearchDate).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
    lastSearchText.innerHTML = `Dernière mise à jour sur la base de données AntiDrop: <br />${formattedDate}`;
    lastSearchText.style.fontSize = '16px';
    lastSearchText.style.marginBottom = '20px';
    lastSearchText.style.color = 'white';
    overlay.appendChild(lastSearchText);

    // Add bottom-left "Ce site n'est pas du dropshipping" link
    const notDropshippingLink = document.createElement('a');
    notDropshippingLink.href = 'https://antidrop.fr/contact';
    notDropshippingLink.textContent = 'Ce site n\'est pas du dropshipping';
    notDropshippingLink.target = '_blank';
    notDropshippingLink.style.position = 'absolute';
    notDropshippingLink.style.bottom = '10px';
    notDropshippingLink.style.left = '10px';
    notDropshippingLink.style.color = 'white';
    notDropshippingLink.style.textDecoration = 'underline';
    overlay.appendChild(notDropshippingLink);

    const commonSectionStyle = `
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  width: 90%;
  padding: 20px;
  color: white;
  flex-grow: 1; /* Allow both sections to share available space */
  overflow-y: auto;
  max-height: 50vh; /* Ensure each section takes no more than 40% of the viewport height */
`;

// Applying styles to technos section
    if (technos && technos.length > 0) {
      const technosSection = document.createElement('div');
      technosSection.style = commonSectionStyle;

      // Add an explanation above the technos section
      const technosTitle = document.createElement('div');
      technosTitle.style.fontSize = '20px';
      technosTitle.style.fontWeight = 'bold';
      technosTitle.style.marginBottom = '10px';
      technosTitle.style.color = 'white';
      technosTitle.textContent = 'Technologies associées au dropshipping';

      const technosWarning = document.createElement('div');
      technosWarning.style.fontSize = '14px';
      technosWarning.style.marginBottom = '20px';
      technosWarning.style.color = 'orange';
      technosWarning.textContent = 'Attention: Les technologies détectées sur ce site peuvent indiquer un lien avec des pratiques de dropshipping. Veuillez les vérifier attentivement.';

      technosSection.appendChild(technosTitle);
      technosSection.appendChild(technosWarning);

      technos.forEach(tech => {
        const techDiv = document.createElement('div');
        techDiv.style.marginBottom = '10px';
        techDiv.innerHTML = `<strong>${tech.name}:</strong> ${tech.description}`;
        technosSection.appendChild(techDiv);
      });

      overlay.appendChild(technosSection);
    }

    if (similarArticles && similarArticles.length > 0) {
      const articlesSection = document.createElement('div');
      articlesSection.style = commonSectionStyle;

      const groupedArticles = {};

      similarArticles.forEach(article => {
        const apexDomain = getApexDomain(article.url);

        if (!groupedArticles[apexDomain]) {
          groupedArticles[apexDomain] = [];
        }

        groupedArticles[apexDomain].push(article);
      });

      // Add title and warning before articles section
      const articlesTitle = document.createElement('div');
      articlesTitle.style.fontSize = '1.8rem';
      articlesTitle.style.fontWeight = 'bold';
      articlesTitle.style.marginBottom = '10px';
      articlesTitle.style.color = 'white';
      articlesTitle.textContent = 'Articles similaires trouvés sur des sites de dropshipping connus';

      const articlesWarning = document.createElement('div');
      articlesWarning.style.fontSize = '14px';
      articlesWarning.style.marginBottom = '20px';
      articlesWarning.style.color = 'orange';
      articlesWarning.textContent = 'Attention: Les correspondances peuvent ne pas être exactes. Certains articles peuvent ne pas être liés directement à ce site.';

      articlesSection.appendChild(articlesTitle);
      articlesSection.appendChild(articlesWarning);

      Object.keys(groupedArticles).forEach(domain => {
        const domainDiv = document.createElement('div');
        domainDiv.style.marginBottom = '15px';
        domainDiv.innerHTML = `<strong>${domain}</strong>`;
        articlesSection.appendChild(domainDiv);

        groupedArticles[domain].forEach(article => {
          const articleDiv = document.createElement('div');
          articleDiv.style.display = 'flex'; // Flex layout for image and text alignment
          articleDiv.style.marginBottom = '10px';

          // Create anchor for both image and article title
          const articleLink = document.createElement('a');
          articleLink.href = article.url;
          articleLink.style.color = 'white';
          articleLink.style.textDecoration = 'underline';
          articleLink.target = '_blank';
          articleDiv.appendChild(articleLink);

          const img = document.createElement('img');
          img.src = article.images[0];
          img.style.width = `${IMG_SIZE}px`;
          img.style.height = `${IMG_SIZE}px`;
          img.style.marginRight = '20px';

          // Append image inside the link
          articleLink.appendChild(img);

          // Add the article title inside the link
          const articleText = document.createElement('span');
          articleText.innerHTML = `${article.title}`;
          articleLink.appendChild(articleText);

          // Add the price below, outside the link
          const priceDiv = document.createElement('div');
          priceDiv.textContent = `${article.price}€`;
          priceDiv.style.fontSize = '20px';
          priceDiv.style.fontWeight = 'bold';

          // Append price to article div
          articleDiv.appendChild(priceDiv);

          domainDiv.appendChild(articleDiv);
        });
      });

      overlay.appendChild(articlesSection);
    }

    // Add disclaimer at the bottom
    const disclaimer = document.createElement('div');
    disclaimer.style.position = 'absolute';
    disclaimer.style.bottom = '10px';
    disclaimer.style.right = '10px';
    disclaimer.style.fontSize = '12px';
    disclaimer.style.color = 'gray';
    disclaimer.style.textAlign = 'center';
    disclaimer.innerHTML = 'Avertissement : Cet outil est destiné à informer les utilisateurs sur les sites potentiellement liés au dropshipping. Il n\'est pas garanti à 100% précis. Vous pouvez consulter les détails complets sur la page <a href="https://antidrop.fr/disclaimer" style="color: white; text-decoration: underline;" target="_blank">d\'antidrop.fr</a>.';
    overlay.appendChild(disclaimer);

    document.body.appendChild(overlay);

    // Add an event listener for the Escape key to close the overlay
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        overlay.remove();
      }
    });
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
