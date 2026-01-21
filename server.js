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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});