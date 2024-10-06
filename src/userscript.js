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
    const language = 'fr'; // AntiDrop only support "fr" at this time

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

  // Function to show the less intrusive top banner (for probability <= PROBABILITY_THRESHOLD)
  function showTopBannerWarning(probability, technos, similarArticles, lastSearchDate) {
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

    // Add the warning text with an orange SVG icon and a link to open the overlay
    const warningText = document.createElement('div');
    warningText.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${warningColor}" width="24px" height="24px" style="${iconStyle}">
        <path d="M0 0h24v24H0V0z" fill="none"/>
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
      <span>ATTENTION: Ce site a ${probability}% de probabilité d'être un site de DROPSHIPPING!</span>
      <span style="font-style: italic">(${technos?.length || 0} technos | ${similarArticles?.length || 0} articles)</span>
      <a href="#" id="viewDetails" style="text-decoration: underline; color: black; font-weight: bold; margin-left: 20px;">Voir les détails</a>
    `;
    warningText.style.color = 'black';
    banner.appendChild(warningText);

    // Add a close button to remove the banner
    const bannerCloseButton = document.createElement('button');
    bannerCloseButton.innerHTML = `Réduire`;
    bannerCloseButton.style.background = 'transparent';
    bannerCloseButton.style.border = 'none';
    bannerCloseButton.style.cursor = 'pointer';
    bannerCloseButton.style.fontSize = '16px';
    bannerCloseButton.addEventListener('click', () => {
      banner.style.height = '4px';
      banner.style.opacity = '0.5';

      banner.addEventListener('mouseenter', () => {
        banner.style.height = 'auto';
        banner.style.fontSize = '16px';
        banner.style.padding = '10px 20px';
        banner.style.opacity = '1';
      });

      banner.addEventListener('mouseleave', () => {
        banner.style.height = '20px';
        banner.style.fontSize = '12px';
        banner.style.padding = '2px 10px';
        banner.style.opacity = '0.5';
      });

      banner.addEventListener('click', () => {
        banner.style.height = 'auto';
        banner.style.fontSize = '16px';
        banner.style.padding = '10px 20px';
        banner.style.opacity = '1';
      });
    });

    banner.appendChild(bannerCloseButton);

    // Append the banner to the body
    document.body.appendChild(banner);

    // Add event listener to the "Voir les détails" link to show the overlay
    document.getElementById('viewDetails').addEventListener('click', (e) => {
      e.preventDefault();
      showFullScreenWarning(probability, technos, similarArticles, lastSearchDate);  // Call the overlay function
    });
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
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 100)';
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
    const overlayCloseButton = document.createElement('button');
    overlayCloseButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24px" height="24px" style="${iconStyle}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 18 12 14.41 8.41 18 7 16.59 10.59 13 7 9.41 8.41 8 12 11.59 15.59 8 17 9.41 13.41 13 17 16.59z"/></svg> Fermer`;
    overlayCloseButton.style.position = 'absolute';
    overlayCloseButton.style.top = '10px';
    overlayCloseButton.style.right = '20px';
    overlayCloseButton.style.fontSize = '16px';
    overlayCloseButton.style.color = 'white';
    overlayCloseButton.style.background = 'transparent';
    overlayCloseButton.style.border = 'none';
    overlayCloseButton.style.cursor = 'pointer';
    overlayCloseButton.addEventListener('click', () => {
      overlay.remove();
      if (!document.getElementById('dropshippingBanner')) {
        showTopBannerWarning(probability, technos, similarArticles, lastSearchDate); // Recreate the banner if it's not there
      }
    });
    overlay.appendChild(overlayCloseButton);

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

// Add bottom-left "Ce site n'est pas du dropshipping" link
    const notDropshippingLink = document.createElement('a');
    notDropshippingLink.href = 'https://antidrop.fr/contact';
    notDropshippingLink.textContent = 'Ce site n\'est pas du dropshipping !';
    notDropshippingLink.target = '_blank';

// Natural flow, no absolute positioning
    notDropshippingLink.style.alignSelf = 'flex-start'; // Align to the left
    notDropshippingLink.style.color = 'white';
    notDropshippingLink.style.textDecoration = 'underline';
    notDropshippingLink.style.marginTop = 'auto'; // Push to the bottom of the content

    overlay.appendChild(notDropshippingLink);


    const commonSectionStyle = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      width: 90%;
      padding: 20px;
      color: white;
      max-height: none; /* Allow sections to take full height */
      overflow: visible; /* Prevent section scrolling */
    `;

    if (technos && technos.length > 0) {
      const technosSection = document.createElement('div');
      technosSection.style = commonSectionStyle;

      // Add the title and warning (sticky at the top)
      const technosTitleContainer = document.createElement('div');
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

      technosTitleContainer.appendChild(technosTitle);
      technosTitleContainer.appendChild(technosWarning);
      technosSection.appendChild(technosTitleContainer);

      // Add the scrollable list of technos
      const technosList = document.createElement('div');
      technosList.style.overflow = 'visible'; // Ensure no scroll on technos list

      technos.forEach(tech => {
        const techDiv = document.createElement('div');
        techDiv.style.marginBottom = '10px';
        techDiv.innerHTML = `<strong>${tech.name}:</strong> ${tech.description}`;
        technosList.appendChild(techDiv);
      });

      technosSection.appendChild(technosList); // Append the scrollable content to the section
      overlay.appendChild(technosSection);
    }

    if (similarArticles && similarArticles.length > 0) {
      const articlesSection = document.createElement('div');
      articlesSection.style = commonSectionStyle;

      const articlesTitleContainer = document.createElement('div');

      const articlesTitle = document.createElement('div');
      articlesTitle.style.fontSize = '1.8rem';
      articlesTitle.style.fontWeight = 'bold';
      articlesTitle.style.marginBottom = '10px';
      articlesTitle.style.color = 'white';
      articlesTitle.textContent = 'Articles similaires trouvés sur des sites de dropshipping';

      const articlesWarning = document.createElement('div');
      articlesWarning.style.fontSize = '14px';
      articlesWarning.style.marginBottom = '20px';
      articlesWarning.style.color = 'orange';
      articlesWarning.textContent = `Attention: Les correspondances peuvent ne pas être exactes. Certains articles ci-dessous  peuvent ne pas être vendus par ${domainName}. Veuillez les vérifier attentivement.`;

      articlesTitleContainer.appendChild(articlesTitle);
      articlesTitleContainer.appendChild(articlesWarning);
      articlesSection.appendChild(articlesTitleContainer); // Append sticky title/warning


      articlesSection.appendChild(getArticlesList(similarArticles)); // Append the scrollable content to the section
      overlay.appendChild(articlesSection);
    }

    const explanationSection = document.createElement('div');
    explanationSection.style.textAlign = 'center';
    explanationSection.style.marginTop = '40px'; // Add some spacing from the previous sections
    explanationSection.style.color = 'white';

    const explanationText = document.createElement('div');
    explanationText.innerHTML = `
    <p>Le résultat ci-dessus est basé sur plusieurs facteurs, tels que les technologies utilisées par ce site, les produits vendus, et d'autres éléments techniques.</p>
    <p>Un pourcentage de 100% est généralement très fiable. Si vous avez des doutes, vous pouvez visiter <a href="https://antidrop.fr/contact" target="_blank" style="color: white; text-decoration: underline;">ce lien</a> pour plus de détails ou pour contester le résultat.</p>
    <p>Résultat fourni par <a href="https://antidrop.fr" target="_blank" style="color: white; text-decoration: underline;">antidrop.fr</a></p>
    <p>Dernière mise à jour sur la base de données AntiDrop: ${new Date(lastSearchDate).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })}</p>
`;

    explanationSection.appendChild(explanationText);

    overlay.appendChild(explanationSection);

    // Add disclaimer at the bottom
    const disclaimer = document.createElement('div');
    disclaimer.style.position = 'absolute';
    disclaimer.style.bottom = '10px';
    disclaimer.style.right = '10px';
    disclaimer.style.fontSize = '12px';
    disclaimer.style.color = 'gray';
    disclaimer.style.textAlign = 'center';
    disclaimer.innerHTML = 'Avertissement : Cet outil est destiné à informer les utilisateurs sur les sites potentiellement liés au dropshipping. Il n\'est pas garanti à 100% précis. Vous pouvez consulter les détails complets sur la page <a href="https://antidrop.fr/disclaimer" style="color: white; text-decoration: underline; font-size: 12px" target="_blank">d\'antidrop.fr</a>.';
    overlay.appendChild(disclaimer);

    document.body.appendChild(overlay);

    // Add an event listener for the Escape key to close the overlay
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        overlay.remove();
      }
    });
  }

  function getArticlesList(similarArticles) {
    const articlesList = document.createElement('div');
    articlesList.style.overflow = 'visible'; // Ensure no scroll on articles list

    const groupedArticles = {};

    similarArticles.forEach(article => {
      const apexDomain = getApexDomain(article.url);

      if (!groupedArticles[apexDomain]) {
        groupedArticles[apexDomain] = [];
      }

      groupedArticles[apexDomain].push(article);
    });

    Object.keys(groupedArticles).forEach(domain => {
      // Create a container for each domain and its articles
      const domainGroup = document.createElement('div');
      domainGroup.style.display = 'flex';
      domainGroup.style.flexDirection = 'column'; // Stack domain name and articles vertically
      domainGroup.style.width = '100%'; // Ensure full width for each domain block

      const domainDiv = document.createElement('div');
      domainDiv.style.marginBottom = '15px';
      domainDiv.innerHTML = `<strong>${domain}</strong>`;
      domainGroup.appendChild(domainDiv);

      // Create a container for articles under this domain
      const articlesContainer = document.createElement('div');
      articlesContainer.style.display = 'flex'; // Flex layout for multiple items in a row
      articlesContainer.style.flexWrap = 'wrap'; // Allow wrapping of items to the next row
      articlesContainer.style.gap = '20px'; // Space between articles

      groupedArticles[domain].forEach(article => {
        const articleDiv = document.createElement('div');
        articleDiv.style.display = 'flex';
        articleDiv.style.flexDirection = 'column'; // Column layout for article
        articleDiv.style.width = `${IMG_SIZE + 200}px`;
        articleDiv.style.marginBottom = '10px';

        // Create anchor for both image and article title
        const articleLink = document.createElement('a');
        articleLink.href = article.url;
        articleLink.style.display = 'flex'; // Flex layout for image and title side by side
        articleLink.style.alignItems = 'flex-start'; // Align title and image to the top
        articleLink.style.textDecoration = 'none';
        articleLink.target = '_blank';

        const img = document.createElement('img');
        img.src = article.images[0];
        img.style.width = `${IMG_SIZE}px`;
        img.style.height = `${IMG_SIZE}px`;
        img.style.marginRight = '10px';

        // Append image inside the link
        articleLink.appendChild(img);

        // Add the article title inside the link
        const articleText = document.createElement('span');
        articleText.style.wordWrap = 'break-word'; // Allow the title to wrap if too long
        articleText.style.fontSize = '14px'; // Adjust the size for readability
        articleText.style.color = 'white';
        articleText.innerHTML = `${article.title}`;
        articleLink.appendChild(articleText);

        articleDiv.appendChild(articleLink);

        // Add the price below, outside the link
        const priceDiv = document.createElement('div');
        priceDiv.textContent = `${article.price}€`;
        priceDiv.style.fontSize = '16px';
        priceDiv.style.fontWeight = 'bold';
        priceDiv.style.marginTop = '5px';
        priceDiv.style.color = 'white';

        // Append price to article div
        articleDiv.appendChild(priceDiv);

        articlesContainer.appendChild(articleDiv);
      });

      domainGroup.appendChild(articlesContainer);
      articlesList.appendChild(domainGroup);
    });

    return articlesList;
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
