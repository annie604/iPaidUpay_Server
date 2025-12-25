require('dotenv').config(); // Check if .env is loaded (auto loaded by prisma config usually, but for running node index.js we need it)
// Note: If using node --env-file=.env (Node 20+) or dotenv
// We installed dotenv.
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = 3001;

app.use(cors({
    origin: ['http://localhost:2758'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
const groupRoutes = require('./routes/groupRoutes');
app.use('/api/groups', groupRoutes);

app.get('/', (req, res) => {
    res.send('IpaidUpay API is running');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
