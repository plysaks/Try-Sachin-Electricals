document.addEventListener('DOMContentLoaded', function() {
    // ====================================================================================
    // NOTE: Google AdSense script injection has been REMOVED from here.
    // The meta tag for verification should be placed directly in the HTML <head>.
    // If you intend to display ads, you will need to add the ad unit code
    // where you want the ads to appear, _after_ verification.
    // ====================================================================================

    // ====================================================================================
    // 1. CONFIGURATION: Your Live Data Source
    // ====================================================================================
    // MODIFIED: Replaced the old URL with the new one for the product catalog.
    const productDataURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTH-7zq9uBbhmgXFAjr1zYskABxAeXBZWjBYRKswuvbRyhdxx3D8Z0I9VB7FyFFPtf3QUZ8aYh0mw-G/pub?output=csv';

    // Get references to HTML elements
    const productGridContainer = document.getElementById('product-grid-container');
    const productFiltersContainer = document.getElementById('product-filters');
    const searchBar = document.getElementById('search-bar');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navUl = document.getElementById('nav-ul');
    const faders = document.querySelectorAll('.fade-in');

    let allProducts = [];

    // ====================================================================================
    // 2. DATA LOADING AND INITIALIZATION
    // ====================================================================================
    async function loadProducts() {
        try {
            Papa.parse(productDataURL, {
                download: true, header: true, dynamicTyping: true,
                complete: function(results) {
                    console.log("Data loaded successfully.");
                    allProducts = results.data.filter(p => p.name && p.name.trim() !== "");
                    if (allProducts.length === 0) {
                        productGridContainer.innerHTML = '<p class="no-results">No products found. Please check the data source.</p>';
                        return;
                    }
                    setupFilters();
                    displayProducts(allProducts);
                },
                error: function(error) {
                    console.error("Error loading data:", error);
                    productGridContainer.innerHTML = '<p class="no-results">Error: Could not load product data.</p>';
                }
            });
        } catch (error) { console.error("A critical error occurred:", error); }
    }

    // ====================================================================================
    // 3. CORE FUNCTIONS
    // ====================================================================================
    function displayProducts(productsToDisplay) {
        productGridContainer.innerHTML = '';
        if (productsToDisplay.length === 0) {
            productGridContainer.innerHTML = '<p class="no-results">No products match your search.</p>';
            return;
        }
        productsToDisplay.forEach(product => {
            // ENHANCED: Added currency symbol to the rate display
            const rateHTML = product.rate ? `<div class="product-rate">₹${product.rate}</div>` : '';

            const productCard = `
                <div class="product-card fade-in">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="card-content">
                        <h3>${product.name}</h3>
                        ${rateHTML} 
                        <span class="category-badge">${product.subCategory}</span>
                        <p>${product.description}</p>
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
        const categories = ['All', ...new Set(allProducts.map(p => p.category).filter(c => c))];
        productFiltersContainer.innerHTML = categories.map(cat => `<button class="filter-btn ${cat === 'All' ? 'active-filter' : ''}" data-category="${cat}">${cat}</button>`).join('');
    }

    // ====================================================================================
    // 4. EVENT LISTENERS
    // ====================================================================================
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

    hamburgerMenu.addEventListener('click', () => { navUl.classList.toggle('active'); });
    navUl.querySelectorAll('a').forEach(link => {
        if (link.href.includes('#')) {
            link.addEventListener('click', () => { if (navUl.classList.contains('active')) navUl.classList.remove('active'); });
        }
    });

    // ====================================================================================
    // 5. PAGE INITIALIZATION
    // ====================================================================================
    const appearOptions = { threshold: 0.2, rootMargin: "0px 0px -50px 0px" };
    const initialFaders = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        });
    }, appearOptions);
    faders.forEach(fader => initialFaders.observe(fader));

    loadProducts();
});
