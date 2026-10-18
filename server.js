const express = require('express');
const app = express();
const connectDB = require('./config/db');
const bookRoute = require('./routes/bookRoute');
const memberRoute = require('./routes/memberRoute');
const loanRoute = require('./routes/loanRoute');

connectDB();
app.use(express.json());

app.use('/api/books', bookRoute);
app.use('/api/members', memberRoute);
app.use('/api/loans', loanRoute);

app.get('/', async (req, res) => {
    try {
        res.send({ message: 'Welcome to Practical Exam!' });
    } catch (error) {
        res.send({ error: error.message });
    }
});


const PORT = process.env.PORT || 9999;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));