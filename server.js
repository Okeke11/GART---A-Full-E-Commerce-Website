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

// Configure where to save images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/') // Save to 'public/uploads' folder
    },
    filename: (req, file, cb) => {
        // Rename file to avoid duplicates (e.g., 1745382-myimage.png)
        cb(null, Date.now() + '-' + file.originalname); 
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
        
        // Get filenames from the uploaded files
        const imageFilenames = req.files.map(file => file.filename);

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
        console.error(error);
        res.status(500).json({ success: false, message: "Error saving product" });
    }
});

// GET: Fetch all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 }); // Newest first
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});
// --- ROUTES ---

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

// 5. GET PROFILE (This was missing!)
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
                profilePic: user.profilePic || ""
            });
        } else {
            res.json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// 6. UPDATE PROFILE (This was also missing!)
app.post('/update-profile', async (req, res) => {
    const { email, dob, country, state, address, profilePic } = req.body;
    try {
        await User.updateOne({ email: email }, { 
            $set: { dob, country, state, address, profilePic } 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Update failed" });
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});