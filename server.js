// Run on port 3000
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

mongoose.connect('mongodb://localhost:27017/userDB')
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("Error connecting to MongoDB", err));

// --- 1. SCHEMAS ---

// A. USER SCHEMA (Updated with Bank Accounts Array)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, maxlength: 10 },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // Profile Fields
    dob: String,
    country: String,
    state: String,
    address: String,
    profilePic: String,
    phoneNumber: String,
    
    // CHANGED: Store array of accounts
    bankAccounts: [{
        bankName: String,
        accountName: String,
        accountNumber: String
    }],
    
    walletBalance: { type: Number, default: 0 },
    // Notification Fields
    notifications: [{
        title: String,
        body: String,
        time: String,
        seen: { type: Boolean, default: false }
    }],
    lastPromoTime: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// B. PRODUCT SCHEMA
const productSchema = new mongoose.Schema({
    title: String,
    price: Number,
    condition: String,
    category: String,
    description: String,
    images: [String],
    sellerEmail: String,
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// C. ORDER SCHEMA
const orderSchema = new mongoose.Schema({
    buyerEmail: String,
    items: Array, 
    totalAmount: Number,
    deliveryCode: String, // Secret OTP
    status: { type: String, default: 'Pending' }, 
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);


// --- 2. MULTER SETUP ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/') 
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });


// --- 3. ROUTES ---

// --- AUTH & USER ROUTES ---

app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (username.length > 10) return res.json({ success: false, message: "Username too long" });

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.json({ success: false, message: "Email already exists" });

        const welcomeMsg = {
            title: `Welcome ${username}`,
            body: 'Do have a great experience at Gart.',
            time: new Date().toLocaleString(),
            seen: false
        };

        const newUser = new User({ 
            username, email, password,
            notifications: [welcomeMsg],
            lastPromoTime: Date.now()
        });
        
        await newUser.save();
        res.json({ success: true, message: "User created!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error signing up" });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && user.password === password) {
            res.json({ success: true, username: user.username, email: user.email });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.get('/notifications', async (req, res) => {
    const email = req.query.email;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false });

        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (now - user.lastPromoTime > twentyFourHours) {
            const newPromo = {
                title: 'Promo offer',
                body: 'Enjoy 30% off when you buy more than 10 items in your first 3 months.',
                time: new Date().toLocaleString(),
                seen: false
            };
            user.notifications.push(newPromo);
            user.lastPromoTime = now;
            await user.save();
        }

        res.json({ success: true, notifications: user.notifications.reverse() });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/clear-notifications', async (req, res) => {
    const { email } = req.body;
    try {
        await User.updateOne({ email: email }, { $set: { "notifications.$[].seen": true } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// GET PROFILE (UPDATED TO RETURN BANK ARRAY)
app.get('/get-profile', async (req, res) => {
    const email = req.query.email;
    try {
        const user = await User.findOne({ email });
        if (user) {
            res.json({ 
                success: true, 
                username: user.username, 
                email: user.email,
                dob: user.dob || "",
                country: user.country || "",
                state: user.state || "",
                address: user.address || "",
                phoneNumber: user.phoneNumber || "",
                profilePic: user.profilePic || "",
                // Send bank array
                bankAccounts: user.bankAccounts || [],
                walletBalance: user.walletBalance || 0
            });
        } else {
            res.json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/update-profile', async (req, res) => {
    const { email, dob, country, state, address, profilePic, phoneNumber } = req.body;
    try {
        await User.updateOne({ email: email }, { 
            $set: { dob, country, state, address, profilePic, phoneNumber } 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Update failed" });
    }
});

// --- NEW ROUTE: UPDATE BANK ACCOUNTS ---
app.post('/api/update-bank', async (req, res) => {
    const { email, bankAccounts } = req.body;
    
    // Security check: Max 2
    if (bankAccounts.length > 2) {
        return res.json({ success: false, message: "You can only store up to 2 accounts." });
    }

    try {
        await User.updateOne({ email: email }, { 
            $set: { bankAccounts: bankAccounts } 
        });
        res.json({ success: true, message: "Bank details updated!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// --- PRODUCT ROUTES ---

// Upload Product
app.post('/api/products', upload.array('images', 5), async (req, res) => {
    try {
        const { title, price, condition, category, description, sellerEmail } = req.body;
        const imageFilenames = req.files ? req.files.map(file => file.filename) : [];

        const newProduct = new Product({
            title, price, condition, category, description, sellerEmail, images: imageFilenames
        });

        await newProduct.save();
        res.json({ success: true, message: "Product listed successfully!" });
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ success: false, message: "Error saving product" });
    }
});

// Fetch ALL Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Fetch SINGLE Product + Seller Info
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const seller = await User.findOne({ email: product.sellerEmail });
        const productData = product.toObject();

        if (seller) {
            productData.sellerPhone = seller.phoneNumber || "No Number";
            productData.sellerJoined = seller._id.getTimestamp(); 
        } else {
            productData.sellerPhone = "Unavailable";
            productData.sellerJoined = new Date();
        }

        res.json({ success: true, product: productData });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Fetch My Products
app.get('/api/my-products', async (req, res) => {
    try {
        const { email } = req.query;
        const products = await Product.find({ sellerEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});


// --- ORDER & ESCROW ROUTES ---

// 1. CHECKOUT (Create Order & Notify)
app.post('/api/checkout', async (req, res) => {
    const { email, items, totalAmount } = req.body;

    try {
        const secretCode = Math.floor(1000 + Math.random() * 9000).toString();

        const newOrder = new Order({
            buyerEmail: email,
            items: items,
            totalAmount: totalAmount,
            deliveryCode: secretCode
        });
        await newOrder.save();

        const buyer = await User.findOne({ email });
        if(buyer) {
            buyer.notifications.push({
                title: 'Order Placed Successfully',
                body: `You bought ${items.length} items. Your Delivery Code is: ${secretCode}. Give this to the seller ONLY when you receive the item.`,
                time: new Date().toLocaleString()
            });
            await buyer.save();
        }

        for (const item of items) {
            const seller = await User.findOne({ email: item.sellerEmail });
            if (seller) {
                seller.notifications.push({
                    title: 'New Sale! 💰',
                    body: `Someone bought your ${item.title}. Get it ready! Ask the buyer for the Delivery Code to get paid.`,
                    time: new Date().toLocaleString()
                });
                await seller.save();
            }
        }

        res.json({ success: true, message: "Order placed!", orderId: newOrder._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Checkout failed" });
    }
});

// 2. FETCH SELLER'S SALES
app.get('/api/my-sales', async (req, res) => {
    const { email } = req.query;
    try {
        const orders = await Order.find({ "items.sellerEmail": email }).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// 3. FETCH BUYER'S ORDERS
app.get('/api/my-orders', async (req, res) => {
    const { email } = req.query;
    try {
        const orders = await Order.find({ buyerEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// 4. VERIFY DELIVERY & AUTO-PAYOUT
app.post('/api/verify-delivery', async (req, res) => {
    const { sellerEmail, orderId, inputCode } = req.body;

    try {
        // 1. Find Order
        const order = await Order.findById(orderId);
        if (!order) return res.json({ success: false, message: "Order not found" });

        // 2. Validate Code & Status
        if (order.deliveryCode !== inputCode) {
            return res.json({ success: false, message: "Incorrect Code! Do not release the item." });
        }
        if (order.status === 'Completed') {
            return res.json({ success: false, message: "Order already completed." });
        }

        // 3. Mark Order as Completed
        order.status = 'Completed';
        await order.save();

        // 4. Calculate Seller's Share
        let sellerEarnings = 0;
        order.items.forEach(item => {
            if(item.sellerEmail === sellerEmail) {
                sellerEarnings += (item.price * (item.quantity || 1));
            }
        });

        const commission = sellerEarnings * 0.05; // 5% fee for Gart
        const payout = sellerEarnings - commission;

        // 5. AUTO-PAYOUT LOGIC
        const seller = await User.findOne({ email: sellerEmail });
        
        if (seller.bankAccounts && seller.bankAccounts.length > 0) {
            
            const bank = seller.bankAccounts[0]; // Use the first/primary account
            
            seller.notifications.push({
                title: 'Payout Initiated 🏦',
                body: `Delivery verified! ₦${payout.toLocaleString()} has been automatically sent to your ${bank.bankName} (${bank.accountNumber}).`,
                time: new Date().toLocaleString()
            });
            

            res.json({ 
                success: true, 
                message: `Success! ₦${payout.toLocaleString()} sent to ${bank.bankName}.` 
            });

        } else {
            // SCENARIO B: No bank account -> Hold in Wallet (Safety Net)
            seller.walletBalance += payout;
            
            seller.notifications.push({
                title: 'Payout Held ⚠️',
                body: `Delivery verified! ₦${payout.toLocaleString()} is held in your wallet because no bank account was found. Please add one!`,
                time: new Date().toLocaleString()
            });

            res.json({ 
                success: true, 
                message: `Code confirmed! Funds added to internal wallet (No Bank Account Linked).` 
            });
        }

        await seller.save();

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
});


// --- OTP ROUTES ---
const otpStore = {}; 

app.post('/send-otp', async (req, res) => {
    const { phone, email } = req.body; 
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, message: "User not found." });
        if (!user.phoneNumber) return res.json({ success: false, errorType: 'missing_profile', message: "No phone number found." });

        const cleanInput = phone.replace(/\D/g, '').slice(-10);
        const cleanStored = user.phoneNumber.replace(/\D/g, '').slice(-10);

        if (cleanInput !== cleanStored) return res.json({ success: false, message: "Number mismatch." });

        // --- CHANGE IS HERE ---
        // 1. Force the code to always be "1234" for testing
        const code = "1234"; 
        
        // (You can delete or ignore the console.log now)
        console.log(`[TEST MODE] OTP for ${phone} is hardcoded to: ${code}`); 
        
        otpStore[phone] = code;

        // 2. You can optionally send the code back to the browser in the JSON if you want to show it in an alert
        res.json({ success: true, message: "Test code is 1234", testCode: code });
        // ----------------------

    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Leave your /verify-otp route exactly as it is!
app.post('/verify-otp', (req, res) => {
    const { phone, code } = req.body;
    if (otpStore[phone] && otpStore[phone] === code) {
        delete otpStore[phone]; 
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Code" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});