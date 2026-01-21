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