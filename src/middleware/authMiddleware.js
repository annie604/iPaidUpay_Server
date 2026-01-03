const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // EXPECTED HEADER: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token present

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.sendStatus(403); // Invalid token
        }
        res.locals.user = user; // Optional: store in locals too if needed
        req.user = user;

        // Ensure userId is a string (handles legacy tokens issued before migration)
        if (req.user.userId) {
            req.user.userId = String(req.user.userId);
        }

        next();
    });
};

module.exports = authenticateToken;
