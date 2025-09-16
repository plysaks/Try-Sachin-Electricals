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
    const GOOGLE_FORM_BASE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSelUepZx0GFxx4wUnQG6xXJ6Ws2WwG1Sf-zGlztKWA1V-vpg/viewform';


    // Get references to HTML elements
    const quoteProductGrid = document.getElementById('quote-product-grid'); 
    const productFiltersContainer = document.getElementById('product-filters');
    const searchBar = document.getElementById('search-bar');
    const totalAmountDisplay = document.getElementById('total-amount');
    const printQuoteButton = document.getElementById('print-quote');
    const contactForQuoteButton = document.getElementById('contact-for-quote-button');

    // Modal elements
    const productModalOverlay = document.getElementById('product-modal-overlay');
    const productModalContent = document.getElementById('product-modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalProductImage = document.getElementById('modal-product-image');
    const modalProductName = document.getElementById('modal-product-name');
    const modalProductDescription = document.getElementById('modal-product-description');
    const modalProductTest = document.getElementById('modal-product-test');
    const modalProductNote = document.getElementById('modal-product-note'); // Reference for the new note element
    const modalQuoteControls = document.getElementById('modal-quote-controls');
    const modalSelectCheckbox = modalQuoteControls.querySelector('.product-select-checkbox-modal');
    const modalQuantityInput = modalQuoteControls.querySelector('.product-quantity-input-modal');


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
    // Utility Function to convert URLs in text into clickable links
    // ====================================================================================
    function linkify(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        // Regex to find URLs (http, https)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

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
                        // Ensure a default for warranty, description, test, and text if not present in data
                        if (typeof p.warranty === 'undefined') p.warranty = ''; 
                        if (typeof p.description === 'undefined') p.description = '';
                        if (typeof p.Test === 'undefined') p.Test = ''; // Ensure 'Test' field is initialized
                        if (typeof p.text === 'undefined') p.text = ''; // Ensure 'text' field is initialized for notes
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

            // Determine if description is long enough to be truncated (e.g., > 100 characters)
            const isDescriptionLong = (product.description && product.description.length > 100); 
            const warrantyHtml = product.warranty ? `<div class="product-warranty">Warranty: ${product.warranty}</div>` : '';
            const noteHtml = product.text ? `<div class="product-note">${linkify(product.text)}</div>` : ''; // New: HTML for the 'text' note
            
            const productCard = `
                <div class="product-card quote-item fade-in" data-product-id="${product.id}" data-product-rate="${product.rate}">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="card-content">
                        <h3>${product.name}</h3>
                        <div class="product-description-wrapper ${isDescriptionLong ? '' : 'no-truncate'}">
                            <p>${linkify(product.description || '')}</p>
                        </div>
                        <!-- Read more button is not rendered for normal card view as single click does nothing -->
                        <span class="category-badge">${product.subCategory || 'General'}</span>
                        <div class="product-rate">Rate: ₹${product.rate.toFixed(2)}</div>
                        ${warrantyHtml}
                        ${noteHtml} <!-- Insert the note HTML here -->
                        
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

        // Re-attach dblclick listeners to newly rendered cards
        const newCards = quoteProductGrid.querySelectorAll('.product-card');
        newCards.forEach(card => {
            // REMOVED THE OFFENDING LINE: card.removeEventListener('click', handleProductCardSingleClick);
            // Single clicks on the card body now do nothing by default as there's no listener.
            card.addEventListener('dblclick', handleProductCardDblClick);
        });

        // Re-observe for fade-in animation
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
    // MODAL FUNCTIONS
    // ====================================================================================
    let currentModalProductId = null; // To keep track of the product in the modal

    function openProductModal(productId) {
        const product = quotableProducts.find(p => p.id === productId);
        if (!product) {
            console.error("Product not found for modal:", productId);
            return;
        }

        currentModalProductId = productId; // Store the ID

        modalProductImage.src = product.image;
        modalProductImage.alt = product.name;
        modalProductName.textContent = product.name;
        modalProductDescription.innerHTML = linkify(product.description || 'No description available.');
        modalProductTest.textContent = `Test: ${product.Test || 'N/A'}`; // Display the 'Test' column value
        
        // Update modal's 'text' field
        if (modalProductNote) {
            modalProductNote.innerHTML = product.text ? `<span class="product-note-modal-label">Note:</span> ${linkify(product.text)}` : '';
            modalProductNote.style.display = product.text ? 'block' : 'none'; // Show/hide based on content
        }

        // Update modal's "Select" and "Qty" based on current selection in the main grid
        if (selectedProducts[productId]) {
            modalSelectCheckbox.checked = true;
            modalQuantityInput.value = selectedProducts[productId].quantity;
            modalQuantityInput.disabled = false;
        } else {
            modalSelectCheckbox.checked = false;
            modalQuantityInput.value = 1;
            modalQuantityInput.disabled = true;
        }

        productModalOverlay.classList.add('visible');
        document.body.classList.add('modal-open'); // Add class to body to prevent scroll
    }

    function closeProductModal() {
        productModalOverlay.classList.remove('visible');
        document.body.classList.remove('modal-open'); // Remove class from body
        currentModalProductId = null; // Clear the stored ID
    }

    // Event handler for double click on product card
    function handleProductCardDblClick(e) {
        const productCard = e.target.closest('.product-card');
        if (productCard) {
            const productId = productCard.dataset.productId;
            openProductModal(productId);
            // IMPORTANT: No implicit selection here, only view
        }
    }
    
    // This function will handle the checkbox/quantity inputs inside the modal and sync to main grid
    function syncModalQuoteWithMainGrid(productId) {
        const mainGridCard = document.querySelector(`.product-card[data-product-id="${productId}"]`);
        if (!mainGridCard) return;

        const mainCheckbox = mainGridCard.querySelector('.product-select-checkbox');
        const mainQuantityInput = mainGridCard.querySelector('.product-quantity-input');
        const mainItemTotalSpan = mainGridCard.querySelector('.calculated-item-total');

        if (modalSelectCheckbox.checked) {
            // Add/Update in selectedProducts
            let quantity = parseInt(modalQuantityInput.value) || 1;
            const fullProduct = quotableProducts.find(p => p.id === productId); 
            if (fullProduct) {
                selectedProducts[productId] = { ...fullProduct, quantity: quantity };
            }

            // Update main grid's UI
            if (mainCheckbox) mainCheckbox.checked = true;
            if (mainQuantityInput) {
                mainQuantityInput.value = quantity;
                mainQuantityInput.disabled = false;
            }
        } else {
            // Remove from selectedProducts
            delete selectedProducts[productId];

            // Update main grid's UI
            if (mainCheckbox) mainCheckbox.checked = false;
            if (mainQuantityInput) {
                mainQuantityInput.value = 1;
                mainQuantityInput.disabled = true;
            }
            if (mainItemTotalSpan) mainItemTotalSpan.textContent = '0.00';
        }
        
        // Ensure totals are updated after synchronization
        updateTotalAmount();
        // Update individual item total in the main grid if the card is visible
        if (mainGridCard) updateIndividualItemTotal(mainGridCard);
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

        // Quote Estimation Grid CHANGE Listener (handles checkbox/quantity changes in main grid)
        // This is separate from card clicks.
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

        // IMPORTANT: No single-click listener on product card for expansion/selection here.
        // Dblclick listener is attached dynamically in displayProductsForQuote for modal.

        // Modal Close Button Listener
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeProductModal);
        }

        // Close modal when clicking outside content
        if (productModalOverlay) {
            productModalOverlay.addEventListener('click', (e) => {
                if (e.target === productModalOverlay) {
                    closeProductModal();
                }
            });
        }

        // Listen for ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && productModalOverlay.classList.contains('visible')) {
                closeProductModal();
            }
        });

        // Modal's "Select" checkbox listener
        if (modalSelectCheckbox && modalQuantityInput) {
            modalSelectCheckbox.addEventListener('change', () => {
                modalQuantityInput.disabled = !modalSelectCheckbox.checked;
                if (!modalSelectCheckbox.checked) {
                    modalQuantityInput.value = 1;
                }
                if (currentModalProductId) {
                    syncModalQuoteWithMainGrid(currentModalProductId);
                }
            });

            // Modal's "Qty" input listener
            modalQuantityInput.addEventListener('input', () => {
                let quantity = parseInt(modalQuantityInput.value);
                if (isNaN(quantity) || quantity < 1) {
                    quantity = 1;
                    modalQuantityInput.value = 1;
                }
                if (currentModalProductId) {
                    syncModalQuoteWithMainGrid(currentModalProductId);
                }
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
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, appearOptions);
    faders.forEach(fader => initialFaders.observe(fader)); 

    // Load product data and initialize estimator UI
    loadAllDataAndInitialize();
    
    // Attach all event listeners after initial data load/UI setup
    attachAllEventListeners(); 
});
