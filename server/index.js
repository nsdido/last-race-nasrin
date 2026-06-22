const dao = require('./dao');

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

app.get('/api/network/full', async (req, res) => {
  try {
    const network = await dao.getFullNetwork();
    res.json(network);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/network/planning', async (req, res) => {
  try {
    const network = await dao.getPlanningNetwork();
    res.json(network);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/ranking', async (req, res) => {
  try {
    const ranking = await dao.getRanking();
    res.json(ranking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});