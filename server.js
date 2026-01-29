//Run on port 3000
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

mongoose.connect('mongodb://localhost:27017/userDB')
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("Error connecting to MongoDB", err));

// --- USER SCHEMA ---
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
    phoneNumber: String, // Already here, which is good
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


// --- 1. SETUP MULTER (For Image Uploads) ---
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Added fs to ensure folder exists

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure where to save images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/') // Save to 'public/uploads' folder
    },
    filename: (req, file, cb) => {
        // Rename file to avoid duplicates (e.g., 1745382-myimage.png)
        // Clean the filename to prevent errors with spaces
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

// --- 2. PRODUCT SCHEMA ---
const productSchema = new mongoose.Schema({
    title: String,
    price: Number,
    condition: String,
    category: String,
    description: String,
    images: [String], // We will store an array of image filenames
    sellerEmail: String, // To know who sold it
    createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// --- 3. ROUTES ---

// POST: Save a new product (Supports up to 5 images)
app.post('/api/products', upload.array('images', 5), async (req, res) => {
    try {
        const { title, price, condition, category, description, sellerEmail } = req.body;
        
        // Get filenames from the uploaded files (Safe check if files exist)
        const imageFilenames = req.files ? req.files.map(file => file.filename) : [];

        const newProduct = new Product({
            title,
            price,
            condition,
            category,
            description,
            sellerEmail,
            images: imageFilenames
        });

        await newProduct.save();
        res.json({ success: true, message: "Product listed successfully!" });
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ success: false, message: "Error saving product" });
    }
});

// --- PRODUCT ROUTES ---

// 1. GET: Fetch ALL products (For Home Page) -> THIS WAS MISSING
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }); // Newest first
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 2. GET: Fetch SINGLE product by ID (For Details Page)
app.get('/api/products/:id', async (req, res) => {
    try {
        // A. Get the product
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // B. Find the Seller details
        const seller = await User.findOne({ email: product.sellerEmail });

        // C. Combine data
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
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// --- USER ROUTES ---

// 1. SIGNUP
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (username.length > 10) return res.json({ success: false, message: "Username too long" });

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.json({ success: false, message: "Email already exists" });

        // Welcome Message
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

// 2. LOGIN
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

// 3. GET NOTIFICATIONS
app.get('/notifications', async (req, res) => {
    const email = req.query.email;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false });

        // Promo Check (24 hours)
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

// 4. CLEAR NOTIFICATIONS
app.post('/clear-notifications', async (req, res) => {
    const { email } = req.body;
    try {
        await User.updateOne(
            { email: email },
            { $set: { "notifications.$[].seen": true } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 5. GET PROFILE (UPDATED FOR PHONE NUMBER)
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
                phoneNumber: user.phoneNumber || "", // <--- ADDED THIS
                profilePic: user.profilePic || ""
            });
        } else {
            res.json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 6. UPDATE PROFILE (UPDATED FOR PHONE NUMBER)
app.post('/update-profile', async (req, res) => {
    // Added phoneNumber to the variables we extract from req.body
    const { email, dob, country, state, address, profilePic, phoneNumber } = req.body;
    try {
        await User.updateOne({ email: email }, { 
            $set: { 
                dob, 
                country, 
                state, 
                address, 
                profilePic,
                phoneNumber // <--- ADDED THIS
            } 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Update failed" });
    }
});
// --- OTP VERIFICATION ROUTES ---

// In-Memory Storage for OTPs
const otpStore = {}; 

// 1. SEND OTP (SMART CHECK)
app.post('/send-otp', async (req, res) => {
    const { phone, email } = req.body; 

    try {
        // A. Find the user
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.json({ success: false, message: "User not found." });
        }

        // B. Check if Profile has a number
        if (!user.phoneNumber) {
            return res.json({ 
                success: false, 
                errorType: 'missing_profile', 
                message: "No phone number found in profile." 
            });
        }

        // C. Clean numbers for comparison (Remove spaces, dashes, take last 10 digits)
        const cleanInput = phone.replace(/\D/g, '').slice(-10);
        const cleanStored = user.phoneNumber.replace(/\D/g, '').slice(-10);

        // D. Compare
        if (cleanInput !== cleanStored) {
            return res.json({ 
                success: false, 
                message: "This number does not match the one in your Profile." 
            });
        }

        // E. If Match, Proceed to Send OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        
        // LOG CODE TO TERMINAL (Simulating SMS)
        console.log("--------------------------------------");
        console.log(`[SMS SERVICE] Sending OTP to ${phone}: ${code}`);
        console.log("--------------------------------------");
        
        otpStore[phone] = code;

        res.json({ success: true, message: "Code sent!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// 2. VERIFY OTP
app.post('/verify-otp', (req, res) => {
    const { phone, code } = req.body;

    // Check if the phone exists and code matches
    if (otpStore[phone] && otpStore[phone] === code) {
        delete otpStore[phone]; // Clear code so it can't be reused
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Code" });
    }
});

// GET: Fetch a SINGLE product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json({ success: true, product });
        } else {
            res.status(404).json({ success: false, message: "Product not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// GET: Fetch products for a specific seller
app.get('/api/my-products', async (req, res) => {
    try {
        const { email } = req.query;
        // Find products where sellerEmail matches the request
        const products = await Product.find({ sellerEmail: email }).sort({ createdAt: -1 });
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// DELETE: Allow user to delete their own product
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error deleting product" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});