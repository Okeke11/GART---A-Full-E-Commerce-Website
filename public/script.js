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
    updateCartBadge(); // Check cart immediately on load

    // --- 5. LOAD PRODUCTS (Only if on home page) ---
    if(document.querySelector('.main-content')) {
        loadProducts();
    }

    // Setup Category Filter Buttons (Dropdown)
    const categoryLinks = document.querySelectorAll('#category-dropdown a');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedCategory = e.target.textContent.toLowerCase().trim(); // e.g., "phones"
            filterProducts(selectedCategory);
        });
    });
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
    if(!container) return; // Guard clause if not on home page

    container.innerHTML = '<h1>Fresh Recommendations</h1><div class="product-grid" id="productGrid"></div>';
    
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
        grid.innerHTML = '<p>No products found in this category.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const card = document.createElement('div');
        card.classList.add('product-card');

        const isMyProduct = currentUser && product.sellerEmail === currentUser;

        // 1. Card Click -> Details Page
        card.style.cursor = "pointer";
        card.addEventListener('click', (e) => {
            // If the user clicked the Add to Cart button, do nothing (handled below)
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

        // If it's my product, make button Grey (#95a5a6) and say "Your Listing"
        // If not, make it Default Blue/Black and say "Add to Cart"
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
            e.stopPropagation(); // Stops the click from bubbling up to the card
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

// Function to handle image swapping for a specific card
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
        e.stopPropagation(); // Stop clicking image
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
    if (category === 'all' || category === 'categories') {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category.toLowerCase() === category);
        renderProducts(filtered);
    }
}

// --- SHOPPING CART LOGIC (UPDATED FOR MULTI-USER) ---

function getCartKey() {
    const email = localStorage.getItem('userEmail');
    // If no user is logged in, use a generic 'guest' cart
    return email ? `cart_${email}` : 'cart_guest';
}

function updateCartBadge() {
    
    // 1. DYNAMIC KEY: Use the email to find the specific cart
    const cartKey = getCartKey();
    const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    
    // Find the cart icon container
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

    // 1. DYNAMIC KEY: Get this specific user's cart
    const cartKey = getCartKey();
    let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

    // 2. Check if item exists
    const existingItemIndex = cart.findIndex(item => item._id === product._id);
    
    if (existingItemIndex > -1) {
        // Item exists? Increase quantity!
        if(!cart[existingItemIndex].quantity) {
            cart[existingItemIndex].quantity = 1; 
        }
        cart[existingItemIndex].quantity += 1;
        alert("Item quantity updated in cart!");
    } else {
        // New item? Set quantity to 1 and push
        product.quantity = 1;
        cart.push(product);
        alert("Item added to cart!");
    }

    // 3. Save back to storage
    localStorage.setItem(cartKey, JSON.stringify(cart));

    // 4. Update UI
    updateCartBadge();
}