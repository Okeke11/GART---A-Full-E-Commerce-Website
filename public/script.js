document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. USERNAME DISPLAY ---
    const storedName = localStorage.getItem('realUsername');
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.textContent = storedName ? `Hi, ${storedName}` : "Hi, Guest";
    }

    // --- 2. SIDEBAR & DROPDOWN LOGIC ---
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const closeBtn = document.getElementById('close-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    function toggleSidebar() {
        if(sidebar && overlay) {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    }

    if(hamburgerBtn) hamburgerBtn.addEventListener('click', toggleSidebar);
    if(closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if(overlay) overlay.addEventListener('click', toggleSidebar);

    const categoriesBtn = document.getElementById('categories-btn');
    const dropdownMenu = document.getElementById('category-dropdown');
    
    if(categoriesBtn && dropdownMenu) {
        categoriesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dropdownMenu.classList.toggle('show');
            const arrow = categoriesBtn.querySelector('i');
            if(arrow) arrow.style.transform = dropdownMenu.classList.contains('show') ? "rotate(180deg)" : "rotate(0deg)";
        });
    }

    if(document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('userEmail');
            localStorage.removeItem('realUsername');
        });
    }

    // --- 3. GLOBAL NOTIFICATION SYSTEM ---
    manageNotifications();

    // --- 4. SHOPPING CART BADGE ---
    updateCartBadge(); 

    // --- 5. LOAD PRODUCTS (Only if on home page) ---
    if(document.querySelector('.main-content')) {
        loadProducts();
    }

    // --- 6. CATEGORY FILTER ---
    const categoryLinks = document.querySelectorAll('#category-dropdown a');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedCategory = e.target.textContent.toLowerCase().trim();
            filterProducts(selectedCategory);
            // Close sidebar on mobile after selection
            if(window.innerWidth < 768) toggleSidebar(); 
        });
    });

    // --- 7. SEARCH LOGIC (Moved Inside Here) ---
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if(searchBtn && searchInput) {
        // Click Search Button
        searchBtn.addEventListener('click', () => {
            const term = searchInput.value.trim();
            if(term) executeSearch(term);
        });

        // Press "Enter" Key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = searchInput.value.trim();
                if(term) executeSearch(term);
            }
        });
    }
});

// --- NOTIFICATION LOGIC ---
async function manageNotifications() {
    const email = localStorage.getItem('userEmail'); 
    const badge = document.getElementById('notif-badge');

    if (!email) return;

    try {
        const response = await fetch(`/notifications?email=${email}`);
        const data = await response.json();

        if (data.success && data.notifications) {
            const unseenCount = data.notifications.filter(n => !n.seen).length;

            if (badge) {
                if (unseenCount > 0) {
                    badge.style.display = 'flex';
                    badge.textContent = unseenCount;
                } else {
                    badge.style.display = 'none';
                }
            }
  
            localStorage.setItem('cached_notifications', JSON.stringify(data.notifications));
        }
    } catch (error) {
        console.error("Error fetching notifications:", error);
    }
}

let allProducts = []; // Store products here

async function loadProducts() {
    const container = document.querySelector('.main-content');
    if(!container) return; 

    // Reset Title
    container.querySelector('h1').innerText = 'Fresh Recommendations';
    container.querySelector('p').innerText = 'Select a category to start shopping.';
    
    // Ensure grid exists
    let grid = document.getElementById('productGrid');
    if(!grid) {
        grid = document.createElement('div');
        grid.className = 'product-grid';
        grid.id = 'productGrid';
        container.appendChild(grid);
    }
    
    try {
        const response = await fetch('/api/products');
        const data = await response.json();

        if (data.success) {
            allProducts = data.products;
            renderProducts(allProducts);
        }
    } catch (err) {
        console.error("Error loading products:", err);
    }
}

function renderProducts(productsToRender) {
    const grid = document.getElementById('productGrid');
    if(!grid) return;
    grid.innerHTML = ''; 

    const currentUser = localStorage.getItem('userEmail');

    if (productsToRender.length === 0) {
        grid.innerHTML = '<p>No products found.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement('div');
        card.classList.add('product-card');

        const isMyProduct = currentUser && product.sellerEmail === currentUser;

        // 1. Card Click -> Details Page
        card.style.cursor = "pointer";
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-cart-btn')) return;
            window.location.href = `product_details.html?id=${product._id}`;
        });

        // 2. Generate Image Slides
        let imagesHtml = '';
        if (product.images.length > 0) {
            product.images.forEach((img, index) => {
                imagesHtml += `<img src="/uploads/${img}" class="${index === 0 ? 'active' : ''}" data-index="${index}">`;
            });
        } else {
            imagesHtml = '<img src="https://via.placeholder.com/250" class="active">';
        }

        const btnText = isMyProduct ? 'Your Listing' : 'Add to Cart';
        const btnStyle = isMyProduct ? 'background-color: #95a5a6; cursor: default;' : '';

        card.innerHTML = `
            <div class="card-image-container">
                ${imagesHtml}
                ${product.images.length > 1 ? `
                    <button class="slider-btn prev-btn"><i class="fa-solid fa-chevron-left"></i></button>
                    <button class="slider-btn next-btn"><i class="fa-solid fa-chevron-right"></i></button>
                ` : ''}
            </div>
            <div class="card-info">
                <h3>${product.title}</h3>
                <div class="card-price">₦ ${parseInt(product.price).toLocaleString()}</div>
                <button class="add-cart-btn" style="${btnStyle}">${btnText}</button>
            </div>
        `;

        // 3. Connect the Add to Cart Button
        const addBtn = card.querySelector('.add-cart-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isMyProduct) {
                alert("You cannot add your own product to cart.");
                return;
            }
            addToCart(product);
        });

        // 4. Slider Logic
        if (product.images.length > 1) {
            setupCardSlider(card, product.images.length);
        }

        grid.appendChild(card);
    });
}

function setupCardSlider(card, totalImages) {
    let currentIndex = 0;
    const images = card.querySelectorAll('img');
    const prevBtn = card.querySelector('.prev-btn');
    const nextBtn = card.querySelector('.next-btn');

    function showImage(index) {
        images.forEach(img => img.classList.remove('active'));
        images[index].classList.add('active');
    }

    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex === 0) ? totalImages - 1 : currentIndex - 1;
        showImage(currentIndex);
    });

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex === totalImages - 1) ? 0 : currentIndex + 1;
        showImage(currentIndex);
    });
}

function filterProducts(category) {
    // Update Header
    document.querySelector('.main-content h1').innerText = category === 'all' ? 'All Products' : category.charAt(0).toUpperCase() + category.slice(1);
    
    if (category === 'all' || category === 'categories') {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category && p.category.toLowerCase() === category);
        renderProducts(filtered);
    }
}

// --- SHOPPING CART LOGIC ---
function getCartKey() {
    const email = localStorage.getItem('userEmail');
    return email ? `cart_${email}` : 'cart_guest';
}

function updateCartBadge() {
    const cartKey = getCartKey();
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const cartIcon = document.querySelector('.fa-cart-shopping');
    if(!cartIcon) return; 

    const badgeContainer = cartIcon.parentElement;
    let badgeSpan = badgeContainer.querySelector('.cart-count');
    
    if (!badgeSpan) {
        badgeSpan = document.createElement('span');
        badgeSpan.className = 'cart-count';
        badgeSpan.style.position = 'absolute';
        badgeSpan.style.top = '-8px';
        badgeSpan.style.right = '-8px';
        badgeSpan.style.background = '#e74c3c'; 
        badgeSpan.style.color = 'white';
        badgeSpan.style.borderRadius = '50%';
        badgeSpan.style.padding = '2px 6px';
        badgeSpan.style.fontSize = '0.7rem';
        badgeSpan.style.fontWeight = 'bold';
        badgeContainer.style.position = 'relative'; 
        badgeContainer.appendChild(badgeSpan);
    }

    if (cart.length > 0) {
        badgeSpan.style.display = 'block';
        badgeSpan.textContent = cart.length;
    } else {
        badgeSpan.style.display = 'none';
    }
}

function addToCart(product) {
    const email = localStorage.getItem('userEmail');
    if(!email) {
        alert("Please log in to add items to your cart.");
        window.location.href = 'login.html';
        return;
    }
    const cartKey = getCartKey();
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    const existingItemIndex = cart.findIndex(item => item._id === product._id);
    
    if (existingItemIndex > -1) {
        if(!cart[existingItemIndex].quantity) cart[existingItemIndex].quantity = 1; 
        cart[existingItemIndex].quantity += 1;
        alert("Item quantity updated in cart!");
    } else {
        product.quantity = 1;
        cart.push(product);
        alert("Item added to cart!");
    }
    localStorage.setItem(cartKey, JSON.stringify(cart));
    updateCartBadge();
}

// --- FIXED SEARCH FUNCTION ---
async function executeSearch(term) {
    // 1. Target the CORRECT ID (productGrid, NOT product-grid)
    const grid = document.getElementById('productGrid');
    if(!grid) return;

    // 2. Change Header to "Search Results"
    document.querySelector('.main-content h1').innerText = `Results for "${term}"`;
    grid.innerHTML = '<p style="text-align:center; width:100%;">Searching...</p>';

    try {
        const response = await fetch(`/api/search?term=${term}`);
        const data = await response.json();

        grid.innerHTML = ''; // Clear loading message

        if (data.success && data.products.length > 0) {
            // 3. Use renderProducts to show items
            renderProducts(data.products);
        } else {
            // 4. Show the "None for now" UI
            grid.innerHTML = `
                <div style="text-align:center; width:100%; padding:50px; grid-column: 1 / -1; color:#7f8c8d;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                    <h3>None for now</h3>
                    <p>We couldn't find anything matching "${term}".</p>
                    <button onclick="loadProducts()" style="margin-top:15px; padding:10px 20px; background:#3498db; color:white; border:none; border-radius:5px; cursor:pointer;">
                        View All Products
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p style="text-align:center;">Search failed. Try again.</p>';
    }
}