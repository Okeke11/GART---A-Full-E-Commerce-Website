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

    // --- 3. GLOBAL NOTIFICATION SYSTEM (The New Part) ---
    manageNotifications();
});

// --- UPDATED CLIENT-SIDE NOTIFICATION LOGIC ---
async function manageNotifications() {
    const email = localStorage.getItem('userEmail'); // Need email to fetch data
    const badge = document.getElementById('notif-badge');

    if (!email) return;

    try {
        // 1. Ask Server for Notifications
        const response = await fetch(`/notifications?email=${email}`);
        const data = await response.json();

        if (data.success && data.notifications) {
            // 2. Count Unseen
            const unseenCount = data.notifications.filter(n => !n.seen).length;

            // 3. Update Badge
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

document.addEventListener('DOMContentLoaded', () => {
    loadProducts(); // Load products when page opens
    
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

let allProducts = []; // Store products here

async function loadProducts() {
    const container = document.querySelector('.main-content'); // Where we put the grid
    
    // Clear initial content (like "Welcome to Gart")
    container.innerHTML = '<h1>Fresh Recommendations</h1><div class="product-grid" id="productGrid"></div>';
    const grid = document.getElementById('productGrid');

    try {
        const response = await fetch('/api/products');
        const data = await response.json();

        if (data.success) {
            allProducts = data.products;
            renderProducts(allProducts); // Show all initially
        }
    } catch (err) {
        console.error("Error loading products:", err);
    }
}

function renderProducts(productsToRender) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = ''; // Clear grid

    if (productsToRender.length === 0) {
        grid.innerHTML = '<p>No products found in this category.</p>';
        return;
    }

    productsToRender.forEach(product => {
        // Create Card HTML
        const card = document.createElement('div');
        card.classList.add('product-card');

        // --- NEW CODE STARTS HERE ---
        // This makes the whole card clickable
        card.style.cursor = "pointer"; // Makes the mouse look like a hand
        card.addEventListener('click', (e) => {
            // Prevent redirect if clicking the "Add to Cart" button
            if (e.target.classList.contains('add-cart-btn')) return;

            // Go to the details page with the product ID
            window.location.href = `product_details.html?id=${product._id}`;
        });
        // --- NEW CODE ENDS HERE ---
        
        // Generate Image Slides (Hidden by default except first one)
        let imagesHtml = '';
        if (product.images.length > 0) {
            product.images.forEach((img, index) => {
                // Add '/uploads/' before filename
                imagesHtml += `<img src="/uploads/${img}" class="${index === 0 ? 'active' : ''}" data-index="${index}">`;
            });
        } else {
            imagesHtml = '<img src="https://via.placeholder.com/250" class="active">';
        }

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
                <button class="add-cart-btn">Add to Cart</button>
            </div>
        `;

        // Add Slider Logic specific to this card
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
        // Simple filter based on category string
        const filtered = allProducts.filter(p => p.category.toLowerCase() === category);
        renderProducts(filtered);
    }
}