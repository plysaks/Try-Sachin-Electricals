document.addEventListener('DOMContentLoaded', function() {
    // ====================================================================================
    // NOTE: Google AdSense script injection has been REMOVED from here.
    // The meta tag for verification should be placed directly in the HTML <head>.
    // If you intend to display ads, you will need to add the ad unit code
    // where you want the ads to appear, _after_ verification.
    // ====================================================================================

    // ====================================================================================
    // 1. CONFIGURATION: Your Live Data Source & Google Form Base URL
    // ====================================================================================
    const productDataURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTH-7zq9uBbhmgXFAjr1zYskABxAeXBZWjBYRKswuvbRyhdxx3D8Z0I9VB7FyFFPtf3QUZ8aYh0mw-G/pub?output=csv';

    // Google Form Link for "Contact for Final Quote" button (no pre-filling for this button)
    const GOOGLE_FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSelUepZx0GFxx4wUnQG6xXJ6WsJ2WwG1Sf-zGlztKWA1V-vpg/viewform';


    // Get references to HTML elements
    const quoteProductGrid = document.getElementById('quote-product-grid'); 
    const productFiltersContainer = document.getElementById('product-filters');
    const searchBar = document.getElementById('search-bar');
    const totalAmountDisplay = document.getElementById('total-amount');
    const printQuoteButton = document.getElementById('print-quote');
    const contactForQuoteButton = document.getElementById('contact-for-quote-button');

    // Shared elements
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navUl = document.getElementById('nav-ul');
    const faders = document.querySelectorAll('.fade-in'); // For initial fade-in animation

    // Elements for single-page navigation
    const pageContentSections = document.querySelectorAll('.page-content');
    const headerNavLinks = document.querySelectorAll('.header-nav-link'); // Selects links that trigger JS navigation
    const footerNavLinks = document.querySelectorAll('.footer-nav-link');


    let quotableProducts = [];    // Stores ALL loaded products suitable for estimation (with rates)
    let selectedProducts = {}; // Stores {productId: {product, quantity}} for the quote estimator
    let currentActiveCategory = 'All'; // To keep track of the currently active filter

    // ====================================================================================
    // 2. DATA LOADING & INITIALIZATION
    // ====================================================================================
    async function loadAllDataAndInitialize() {
        try {
            Papa.parse(productDataURL, {
                download: true, header: true, dynamicTyping: true,
                complete: function(results) {
                    console.log("Data loaded successfully.");
                    // Filter out products without a name or a valid rate, assign unique IDs
                    quotableProducts = results.data.filter(p => p.name && p.name.trim() !== "" && typeof p.rate === 'number' && p.rate > 0);
                    quotableProducts.forEach((p, index) => {
                        if (!p.id) p.id = `product-${index}`;
                    });

                    if (quotableProducts.length === 0) {
                        if (quoteProductGrid) quoteProductGrid.innerHTML = '<p class="no-results">No products with rates available for estimation. Please ensure your Google Sheet has a "rate" column with positive numbers.</p>';
                        if (productFiltersContainer) productFiltersContainer.innerHTML = '<p class="no-results">No categories available.</p>';
                        return;
                    }

                    // Setup filters and display initial products in the estimator grid
                    setupFilters();
                    applyFiltersAndSearch(); // Initially display all products
                    updateTotalAmount(); // Initial update for quote summary
                },
                error: function(error) {
                    console.error("Error loading data:", error);
                    if (quoteProductGrid) quoteProductGrid.innerHTML = '<p class="no-results">Error: Could not load product data for estimation.</p>';
                    if (productFiltersContainer) productFiltersContainer.innerHTML = '<p class="no-results">Error loading categories.</p>';
                }
            });
        } catch (error) { console.error("A critical error occurred:", error); }
    }

    // ====================================================================================
    // 3. CORE FUNCTIONS - Product Display & Filtering for Estimator
    // ====================================================================================
    function displayProductsForQuote(productsToDisplay) {
        if (!quoteProductGrid) return;
        quoteProductGrid.innerHTML = '';
        if (productsToDisplay.length === 0) {
            quoteProductGrid.innerHTML = '<p class="no-results">No products match your criteria.</p>';
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

    function setupFilters() {
        if (!productFiltersContainer) return;
        // Get categories from quotable products
        const categories = ['All', ...new Set(quotableProducts.map(p => p.category).filter(c => c))];
        productFiltersContainer.innerHTML = categories.map(cat => `<button class="filter-btn ${cat === currentActiveCategory ? 'active-filter' : ''}" data-category="${cat}">${cat}</button>`).join('');
    }

    function applyFiltersAndSearch() {
        let filteredProducts = quotableProducts;

        // Apply search term
        const searchTerm = searchBar.value.toLowerCase();
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(p => 
                (p.name && p.name.toLowerCase().includes(searchTerm)) || 
                (p.subCategory && p.subCategory.toLowerCase().includes(searchTerm)) || 
                (p.category && p.category.toLowerCase().includes(searchTerm)) ||
                (p.description && p.description.toLowerCase().includes(searchTerm)) 
            );
        }

        // Apply category filter
        const activeFilterBtn = productFiltersContainer.querySelector('.active-filter');
        const selectedCategory = activeFilterBtn ? activeFilterBtn.dataset.category : 'All'; 
        if (selectedCategory !== 'All') {
            filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
        }

        displayProductsForQuote(filteredProducts);
    }

    // ====================================================================================
    // 4. CORE FUNCTIONS - Quote Calculation
    // ====================================================================================
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
            selectedProducts[productId].quantity = quantity; 
        } else {
            itemTotalSpan.textContent = '0.00';
        }
    }

    function updateTotalAmount() {
        if (!totalAmountDisplay) return;
        let grandTotal = 0;
        for (const id in selectedProducts) {
            const item = selectedProducts[id];
            if (item.rate) {
                grandTotal += (item.rate * item.quantity);
            }
        }
        totalAmountDisplay.textContent = `Total Estimated Amount: ₹${grandTotal.toFixed(2)}`;
    }

    // ====================================================================================
    // 5. SINGLE-PAGE NAVIGATION FUNCTIONS
    // ====================================================================================
    function hideAllSections() {
        pageContentSections.forEach(section => {
            section.classList.remove('active-page-content');
            section.classList.add('hidden');
        });
    }

    // Function to show a specific content section and scroll to an element within it
    function showSection(targetElementId) {
        let sectionToShowId;
        const targetElement = document.getElementById(targetElementId);

        if (!targetElement) {
            console.warn(`Target element with ID "${targetElementId}" not found. Defaulting to estimator-section.`);
            sectionToShowId = 'estimator-section';
        } else {
            // Find the parent section of the target element
            let currentElement = targetElement;
            while (currentElement && !currentElement.classList.contains('page-content')) {
                currentElement = currentElement.parentElement;
            }
            if (currentElement) {
                sectionToShowId = currentElement.id;
            } else {
                console.warn(`Parent .page-content section not found for element ID "${targetElementId}". Defaulting to estimator-section.`);
                sectionToShowId = 'estimator-section';
            }
        }

        hideAllSections();
        const activeSection = document.getElementById(sectionToShowId);

        if (activeSection) {
            activeSection.classList.remove('hidden');
            activeSection.classList.add('active-page-content');

            const headerHeight = document.querySelector('header').offsetHeight;
            const scrollOffset = headerHeight + 20; // Extra 20px for visual spacing

            const elementToScrollTo = document.getElementById(targetElementId);
            if (elementToScrollTo) {
                const elementPosition = elementToScrollTo.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({
                    top: elementPosition - scrollOffset,
                    behavior: 'smooth'
                });
            } else { // Fallback to scrolling to the top of the section if specific element not found or is the section itself
                window.scrollTo({
                    top: activeSection.getBoundingClientRect().top + window.pageYOffset - scrollOffset,
                    behavior: 'smooth'
                });
            }

            // Special handling for the estimator section to ensure it's functional
            if (sectionToShowId === 'estimator-section') {
                applyFiltersAndSearch();
                updateTotalAmount();
            }
        }
    }

    // ====================================================================================
    // 6. EVENT LISTENERS
    // ====================================================================================
    
    function attachAllEventListeners() {
        // Search Bar Listener (only present in estimator section)
        if (searchBar) {
            searchBar.addEventListener('input', () => {
                if (productFiltersContainer) productFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
                currentActiveCategory = 'All';
                applyFiltersAndSearch();
            });
        }

        // Product Filters Listener (only present in estimator section)
        if (productFiltersContainer) {
            productFiltersContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    productFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
                    e.target.classList.add('active-filter');
                    currentActiveCategory = e.target.dataset.category;
                    if (searchBar) searchBar.value = '';
                    applyFiltersAndSearch();
                }
            });
        }

        // Quote Estimation Grid Listeners (only present in estimator section)
        if (quoteProductGrid) {
            quoteProductGrid.addEventListener('change', (e) => {
                const productCard = e.target.closest('.product-card');
                if (!productCard) return;

                const productId = productCard.dataset.productId;
                const quantityInput = productCard.querySelector('.product-quantity-input');
                const itemTotalSpan = productCard.querySelector('.calculated-item-total');

                if (e.target.classList.contains('product-select-checkbox')) {
                    if (e.target.checked) {
                        const quantity = parseInt(quantityInput.value) || 1;
                        quantityInput.disabled = false;
                        const fullProduct = quotableProducts.find(p => p.id === productId); 
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

        // Print Quote Button Listener (only present in estimator section)
        if (printQuoteButton) {
            printQuoteButton.addEventListener('click', () => {
                let grandTotal = 0;
                let quoteRows = '';
                if (Object.keys(selectedProducts).length === 0) {
                    quoteRows = `<tr><td colspan="4">No products selected for estimation.</td></tr>`;
                } else {
                    for (const id in selectedProducts) {
                        const item = selectedProducts[id];
                        if (item.name && item.quantity && item.rate) {
                            const itemTotal = (item.rate * item.quantity);
                            grandTotal += itemTotal;
                            quoteRows += `
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
                
                const quoteContent = `
                    <html>
                    <head>
                        <title>SACHIN ELECTRICALS - Your Estimated Quote</title>
                        <style>
                            body { font-family: 'Roboto', sans-serif; margin: 40px; color: #333; }
                            h1 { font-family: 'Poppins', sans-serif; color: #FFC107; text-align: center; margin-bottom: 30px; }
                            h2 { font-family: 'Poppins', sans-serif; color: #555; margin-top: 40px; border-bottom: 1px solid #eee; padding-bottom: 10px;}
                            .quote-header { text-align: center; margin-bottom: 50px; }
                            .quote-header img { max-width: 150px; margin-bottom: 10px; } 
                            .quote-date { text-align: right; font-size: 0.9em; color: #777; margin-bottom: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                            th { background-color: #f2f2f2; color: #333; }
                            .total-row td { font-weight: bold; background-color: #fff3e0; }
                            .grand-total { font-size: 1.5em; font-weight: bold; text-align: right; margin-top: 30px; color: #FFC107; }
                            .note { font-size: 0.9em; color: #777; margin-top: 50px; text-align: center; }
                            .gst-note { font-size: 1em; font-weight: bold; color: #555; text-align: right; margin-top: 15px; } 
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
                                ${quoteRows}
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td colspan="3" style="text-align:right;">Grand Total:</td>
                                    <td>₹${grandTotal.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        <p class="gst-note">GST Extra as per applicable</p>
                        <p class="note">This is an estimated quote. Prices are subject to change and final confirmation.</p>
                    </body>
                    </html>
                `;

                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.open();
                    printWindow.document.write(quoteContent);
                    printWindow.document.close();
                    printWindow.focus(); 
                    setTimeout(() => {
                        printWindow.print();
                    }, 500); 
                } else {
                    alert('Please allow pop-ups for this website to generate the quote.');
                }
            });
        }

        // Contact For Quote Button Listener (OPENS BASE GOOGLE FORM URL WITHOUT PRE-FILLING) (only present in estimator section)
        if (contactForQuoteButton) {
            contactForQuoteButton.addEventListener('click', () => {
                // This button now simply opens the Google Form link provided.
                window.open(GOOGLE_FORM_BASE_URL, '_blank');
            });
        }

        // Shared Hamburger Menu Listener
        if (hamburgerMenu && navUl) {
            hamburgerMenu.addEventListener('click', () => { navUl.classList.toggle('active'); });
            // Close menu and navigate to section when a nav link is clicked
            navUl.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', (e) => { 
                    // Only prevent default and handle with JS if it's an internal link
                    if (link.classList.contains('header-nav-link')) {
                        e.preventDefault(); 
                        const targetId = link.getAttribute('href').substring(1);
                        showSection(targetId);
                        if (navUl.classList.contains('active')) navUl.classList.remove('active'); 
                    }
                });
            });
        }

        // Single-page navigation for header links
        headerNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                showSection(targetId);
            });
        });

        // Single-page navigation for footer links
        footerNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                showSection(targetId);
            });
        });

        // Handle initial load based on URL hash
        const initialHash = window.location.hash.substring(1);
        if (initialHash) {
            showSection(initialHash);
        } else {
            showSection('estimator-section'); // Default to estimator section
        }
    }


    // ====================================================================================
    // 7. PAGE INITIALIZATION (Load data and apply animations)
    // ====================================================================================
    // Initial setup for faders (visible only on estimator section initially)
    const appearOptions = { threshold: 0.2, rootMargin: "0px 0px -50px 0px" };
    const initialFaders = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, appearOptions);
    faders.forEach(fader => initialFaders.observe(fader)); 

    // Load product data and initialize estimator UI
    loadAllDataAndInitialize();
    
    // Attach all event listeners after initial data load/UI setup
    attachAllEventListeners(); 
});
