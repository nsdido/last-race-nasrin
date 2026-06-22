'use strict';

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const PORT = 3001;
const CLIENT_URL = 'http://localhost:5173';

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});