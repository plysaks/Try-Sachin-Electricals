document.addEventListener('DOMContentLoaded', function() {
    // ====================================================================================
    // NOTE: Google AdSense script injection has been REMOVED from here.
    // The meta tag for verification should be placed directly in the HTML <head>.
    // If you intend to display ads, you will need to add the ad unit code
    // where you want the ads to appear, _after_ verification.
    // ====================================================================================

    // ====================================================================================
    // 1. CONFIGURATION: Your Live Data Source & Google Form IDs
    // ====================================================================================
    const productDataURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTH-7zq9uBbhmgXFAjr1zYskABxAeXBZWjBYRKswuvbRyhdxx3D8Z0I9VB7FyFFPtf3QUZ8aYh0mw-G/pub?output=csv';

    // CONFIGURATION: Google Form Field IDs (YOU MUST UPDATE THESE)
    // Use the "Get pre-filled link" feature on your Google Form to find these IDs.
    const GOOGLE_FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSelUepZx0GFxx4wUnQG6xXJ6WsJ2WwG1Sf-zGlztKWA1V-vpg/viewform';
    const GOOGLE_FORM_ENTRY_ID_PRODUCTS = 'entry.123456789'; // Placeholder: Replace with your Google Form field ID for the list of products
    const GOOGLE_FORM_ENTRY_ID_TOTAL = 'entry.987654321';   // Placeholder: Replace with your Google Form field ID for the total amount


    // Get references to HTML elements (main site)
    const productGridContainer = document.getElementById('product-grid-container');
    const productFiltersContainer = document.getElementById('product-filters');
    const searchBar = document.getElementById('search-bar');
    
    // Get references to HTML elements (quote estimation section)
    const quoteProductGrid = document.getElementById('quote-product-grid');
    const totalAmountDisplay = document.getElementById('total-amount');
    const printQuoteButton = document.getElementById('print-quote');
    const contactForQuoteButton = document.getElementById('contact-for-quote-button');

    // Shared elements
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navUl = document.getElementById('nav-ul');
    const faders = document.querySelectorAll('.fade-in'); // For initial fade-in animation

    let allProducts = []; // Stores all loaded products
    let selectedProducts = {}; // Stores {productId: {product, quantity}} for the quote estimator


    // ====================================================================================
    // 2. DATA LOADING
    // ====================================================================================
    async function loadAllProductsAndInitialize() {
        try {
            Papa.parse(productDataURL, {
                download: true, header: true, dynamicTyping: true,
                complete: function(results) {
                    console.log("Data loaded successfully.");
                    // Filter out products without a name, assign unique IDs
                    allProducts = results.data.filter(p => p.name && p.name.trim() !== "");
                    allProducts.forEach((p, index) => {
                        if (!p.id) p.id = `product-${index}`;
                    });

                    // Initialize main product catalog if elements exist
                    if (productGridContainer && productFiltersContainer) {
                        if (allProducts.length === 0) {
                            productGridContainer.innerHTML = '<p class="no-results">No products found. Please check the data source.</p>';
                        } else {
                            setupFilters();
                            displayProducts(allProducts);
                        }
                    }

                    // Initialize quote estimation section if elements exist
                    if (quoteProductGrid && totalAmountDisplay) {
                        const productsWithRates = allProducts.filter(p => typeof p.rate === 'number' && p.rate > 0);
                        if (productsWithRates.length === 0) {
                            quoteProductGrid.innerHTML = '<p class="no-results">No products with rates available for estimation. Please ensure your Google Sheet has a "rate" column with positive numbers.</p>';
                        } else {
                            displayProductsForQuote(productsWithRates);
                            attachQuoteEventListeners();
                            updateTotalAmount(); // Initial update for quote summary
                        }
                    }
                },
                error: function(error) {
                    console.error("Error loading data:", error);
                    if (productGridContainer) productGridContainer.innerHTML = '<p class="no-results">Error: Could not load product data for catalog.</p>';
                    if (quoteProductGrid) quoteProductGrid.innerHTML = '<p class="no-results">Error: Could not load product data for estimation.</p>';
                }
            });
        } catch (error) { console.error("A critical error occurred:", error); }
    }

    // ====================================================================================
    // 3. CORE FUNCTIONS - Main Product Catalog
    // ====================================================================================
    function displayProducts(productsToDisplay) {
        if (!productGridContainer) return; // Ensure element exists
        productGridContainer.innerHTML = '';
        if (productsToDisplay.length === 0) {
            productGridContainer.innerHTML = '<p class="no-results">No products match your search.</p>';
            return;
        }
        productsToDisplay.forEach(product => {
            const rateHTML = product.rate ? `<div class="product-rate">₹${product.rate.toFixed(2)}</div>` : '';
            const productCard = `
                <div class="product-card fade-in">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="card-content">
                        <h3>${product.name}</h3>
                        ${rateHTML} 
                        <span class="category-badge">${product.subCategory || 'General'}</span>
                        <p>${product.description || ''}</p>
                    </div>
                </div>`;
            productGridContainer.innerHTML += productCard;
        });

        // Re-apply the fade-in animation to the newly created cards
        const newCards = productGridContainer.querySelectorAll('.product-card');
        const cardObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        newCards.forEach(card => cardObserver.observe(card));
    }

    function setupFilters() {
        if (!productFiltersContainer) return; // Ensure element exists
        const categories = ['All', ...new Set(allProducts.map(p => p.category).filter(c => c))];
        productFiltersContainer.innerHTML = categories.map(cat => `<button class="filter-btn ${cat === 'All' ? 'active-filter' : ''}" data-category="${cat}">${cat}</button>`).join('');
    }

    // ====================================================================================
    // 4. CORE FUNCTIONS - Quote Estimation
    // ====================================================================================
    function displayProductsForQuote(productsToDisplay) {
        if (!quoteProductGrid) return; // Ensure element exists
        quoteProductGrid.innerHTML = '';
        if (productsToDisplay.length === 0) {
            quoteProductGrid.innerHTML = '<p class="no-results">No products available for estimation.</p>';
            return;
        }

        productsToDisplay.forEach((product) => {
            const isSelected = selectedProducts[product.id] ? 'checked' : '';
            const quantity = selectedProducts[product.id] ? selectedProducts[product.id].quantity : 1;
            const currentItemTotal = (product.rate * quantity).toFixed(2);

            const productCard = `
                <div class="product-card quote-item fade-in" data-product-id="${product.id}" data-product-rate="${product.rate}">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="card-content">
                        <h3>${product.name}</h3>
                        <p>${product.description || ''}</p>
                        <span class="category-badge">${product.subCategory || 'General'}</span>
                        <div class="product-rate">Rate: ₹${product.rate.toFixed(2)}</div>
                        
                        <div class="quote-controls">
                            <label class="checkbox-container">
                                Select:
                                <input type="checkbox" class="product-select-checkbox" ${isSelected}>
                                <span class="checkmark"></span>
                            </label>
                            <div class="quantity-control">
                                <label for="qty-${product.id}">Qty:</label>
                                <input type="number" id="qty-${product.id}" class="product-quantity-input" value="${quantity}" min="1" ${isSelected ? '' : 'disabled'}>
                            </div>
                        </div>
                        <div class="item-total">Item Total: ₹<span class="calculated-item-total">${isSelected ? currentItemTotal : '0.00'}</span></div>
                    </div>
                </div>`;
            quoteProductGrid.innerHTML += productCard;
        });

        const newCards = quoteProductGrid.querySelectorAll('.product-card');
        const cardObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        newCards.forEach(card => cardObserver.observe(card));
    }

    function updateIndividualItemTotal(productCard) {
        const productId = productCard.dataset.productId;
        const productRate = parseFloat(productCard.dataset.productRate);
        const quantityInput = productCard.querySelector('.product-quantity-input');
        const itemTotalSpan = productCard.querySelector('.calculated-item-total');
        const checkbox = productCard.querySelector('.product-select-checkbox');

        if (checkbox.checked && selectedProducts[productId]) {
            let quantity = parseInt(quantityInput.value) || 1;
            const total = (productRate * quantity);
            itemTotalSpan.textContent = total.toFixed(2);
            selectedProducts[productId].quantity = quantity; // Ensure selectedProducts object is up-to-date
        } else {
            itemTotalSpan.textContent = '0.00';
        }
    }

    function updateTotalAmount() {
        if (!totalAmountDisplay) return; // Ensure element exists
        let grandTotal = 0;
        for (const id in selectedProducts) {
            const item = selectedProducts[id];
            // Ensure product and rate exist before calculation
            if (item.product && item.product.rate) {
                grandTotal += (item.product.rate * item.quantity);
            } else if (item.rate) { // If 'product' key isn't explicitly there but 'rate' is, use it
                grandTotal += (item.rate * item.quantity);
            }
        }
        totalAmountDisplay.textContent = `Total Estimated Amount: ₹${grandTotal.toFixed(2)}`;
    }

    // ====================================================================================
    // 5. EVENT LISTENERS
    // ====================================================================================
    
    // Main Product Catalog Event Listeners
    if (searchBar && productFiltersContainer) {
        searchBar.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            productFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
            const searchedProducts = allProducts.filter(p => 
                (p.name && p.name.toLowerCase().includes(searchTerm)) || 
                (p.subCategory && p.subCategory.toLowerCase().includes(searchTerm)) || 
                (p.category && p.category.toLowerCase().includes(searchTerm))
            );
            displayProducts(searchedProducts);
        });

        productFiltersContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                productFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
                e.target.classList.add('active-filter');
                searchBar.value = '';
                const selectedCategory = e.target.dataset.category;
                const filteredProducts = selectedCategory === 'All' ? allProducts : allProducts.filter(p => p.category === selectedCategory);
                displayProducts(filteredProducts);
            }
        });
    }

    // Quote Estimation Event Listeners
    function attachQuoteEventListeners() {
        if (quoteProductGrid) {
            quoteProductGrid.addEventListener('change', (e) => {
                const productCard = e.target.closest('.product-card');
                if (!productCard) return;

                const productId = productCard.dataset.productId;
                const productRate = parseFloat(productCard.dataset.productRate);
                const quantityInput = productCard.querySelector('.product-quantity-input');
                const itemTotalSpan = productCard.querySelector('.calculated-item-total');

                if (e.target.classList.contains('product-select-checkbox')) {
                    if (e.target.checked) {
                        const quantity = parseInt(quantityInput.value) || 1;
                        quantityInput.disabled = false;
                        const fullProduct = allProducts.find(p => p.id === productId);
                        if (fullProduct) {
                            selectedProducts[productId] = { ...fullProduct, quantity: quantity };
                        }
                    } else {
                        quantityInput.disabled = true;
                        itemTotalSpan.textContent = '0.00';
                        delete selectedProducts[productId];
                    }
                } else if (e.target.classList.contains('product-quantity-input')) {
                    let quantity = parseInt(e.target.value);
                    if (isNaN(quantity) || quantity < 1) {
                        quantity = 1;
                        e.target.value = 1;
                    }
                    if (selectedProducts[productId]) {
                        selectedProducts[productId].quantity = quantity;
                    }
                }
                updateIndividualItemTotal(productCard);
                updateTotalAmount();
            });
        }

        if (printQuoteButton) {
            printQuoteButton.addEventListener('click', () => {
                let quoteContent = `
                    <html>
                    <head>
                        <title>SACHIN ELECTRICALS - Your Estimated Quote</title>
                        <style>
                            body { font-family: 'Roboto', sans-serif; margin: 40px; color: #333; }
                            h1 { font-family: 'Poppins', sans-serif; color: #FFC107; text-align: center; margin-bottom: 30px; }
                            h2 { font-family: 'Poppins', sans-serif; color: #555; margin-top: 40px; border-bottom: 1px solid #eee; padding-bottom: 10px;}
                            .quote-header { text-align: center; margin-bottom: 50px; }
                            .quote-header img { max-width: 150px; margin-bottom: 10px; } /* If you want to add a logo */
                            .quote-date { text-align: right; font-size: 0.9em; color: #777; margin-bottom: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f2f2f2; color: #333; }
                            .total-row td { font-weight: bold; background-color: #fff3e0; }
                            .grand-total { font-size: 1.5em; font-weight: bold; text-align: right; margin-top: 30px; color: #FFC107; }
                            .note { font-size: 0.9em; color: #777; margin-top: 50px; text-align: center; }
                            .gst-note { font-size: 1em; font-weight: bold; color: #555; text-align: right; margin-top: 15px; } /* Added style for GST note */
                        </style>
                    </head>
                    <body>
                        <div class="quote-header">
                            <h1>SACHIN ELECTRICALS</h1>
                            <h2>Your Estimated Quote</h2>
                            <div class="quote-date">Date: ${new Date().toLocaleDateString()}</div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Rate (₹)</th>
                                    <th>Item Total (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                let grandTotal = 0;
                if (Object.keys(selectedProducts).length === 0) {
                    quoteContent += `<tr><td colspan="4">No products selected for estimation.</td></tr>`;
                } else {
                    for (const id in selectedProducts) {
                        const item = selectedProducts[id];
                        if (item.name && item.quantity && item.rate) {
                            const itemTotal = (item.rate * item.quantity);
                            grandTotal += itemTotal;
                            quoteContent += `
                                <tr>
                                    <td>${item.name} <br><small>(${item.subCategory || 'N/A'})</small></td>
                                    <td>${item.quantity}</td>
                                    <td>${item.rate.toFixed(2)}</td>
                                    <td>${itemTotal.toFixed(2)}</td>
                                </tr>
                            `;
                        }
                    }
                }
                
                quoteContent += `
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td colspan="3" style="text-align:right;">Grand Total:</td>
                                    <td>₹${grandTotal.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        <p class="gst-note">GST Extra as per applicable</p> <!-- Added GST Note Here -->
                        <p class="note">This is an estimated quote. Prices are subject to change and final confirmation.</p>
                    </body>
                    </html>
                `;

                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.open();
                    printWindow.document.write(quoteContent);
                    printWindow.document.close();
                    printWindow.focus(); // Focus on the new window
                    // Give the browser a moment to render the content before printing
                    setTimeout(() => {
                        printWindow.print();
                        // Optionally close the window after print dialog is initiated
                        // printWindow.close(); 
                    }, 500); 
                } else {
                    alert('Please allow pop-ups for this website to generate the quote.');
                }
            });
        }

        if (contactForQuoteButton) {
            contactForQuoteButton.addEventListener('click', () => {
                let productsSummary = [];
                let grandTotal = 0;

                for (const id in selectedProducts) {
                    const item = selectedProducts[id];
                    if (item.name && item.quantity && item.rate) {
                        const itemTotal = (item.rate * item.quantity).toFixed(2);
                        productsSummary.push(`${item.name} (Qty: ${item.quantity}) - ₹${itemTotal}`);
                        grandTotal += (item.rate * item.quantity);
                    }
                }

                let prefilledFormURL = GOOGLE_FORM_BASE_URL + '/formResponse?';

                if (productsSummary.length > 0) {
                    const productsString = productsSummary.join('\n'); // Use newline for readability in form
                    prefilledFormURL += `${GOOGLE_FORM_ENTRY_ID_PRODUCTS}=${encodeURIComponent(productsString)}&`;
                } else {
                    prefilledFormURL += `${GOOGLE_FORM_ENTRY_ID_PRODUCTS}=${encodeURIComponent('No products selected for estimate.')}&`;
                }
                
                prefilledFormURL += `${GOOGLE_FORM_ENTRY_ID_TOTAL}=${encodeURIComponent(grandTotal.toFixed(2))}`;

                window.open(prefilledFormURL, '_blank');
            });
        }
    }


    // Shared Hamburger Menu Listener
    if (hamburgerMenu && navUl) {
        hamburgerMenu.addEventListener('click', () => { navUl.classList.toggle('active'); });
        navUl.querySelectorAll('a').forEach(link => {
            // Check if it's a local section link (starts with #)
            if (link.href.includes('#')) {
                link.addEventListener('click', () => { 
                    // Only close if the menu is active
                    if (navUl.classList.contains('active')) navUl.classList.remove('active'); 
                });
            }
        });
    }

    // ====================================================================================
    // 6. PAGE INITIALIZATION (Load data and apply animations)
    // ====================================================================================
    const appearOptions = { threshold: 0.2, rootMargin: "0px 0px -50px 0px" };
    const initialFaders = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, appearOptions);
    faders.forEach(fader => initialFaders.observe(fader)); // Apply to all elements with .fade-in

    loadAllProductsAndInitialize(); // Start the data loading and initialization process
});
