'use strict';

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const dao = require('./dao');
const { passport, isLoggedIn } = require('./auth');

const PORT = 3001;
const CLIENT_URL = 'http://localhost:5173';

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './'
  }),
  secret: 'last race development secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running' });
});

/**
 * Login
 * Body:
 * {
 *   "username": "nasrin@example.com",
 *   "password": "password"
 * }
 */
app.post('/api/sessions', passport.authenticate('local'), (req, res) => {
  res.json(req.user);
});

/**
 * Check current logged-in user.
 */
app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

/**
 * Logout
 */
app.delete('/api/sessions/current', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(503).json({ error: 'Logout failed' });
    }

    res.status(204).end();
  });
});

/**
 * Full network for setup phase.
 * Protected: anonymous users cannot see the network.
 */
app.get('/api/network/full', isLoggedIn, async (req, res) => {
  try {
    const network = await dao.getFullNetwork();
    res.json(network);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Planning network.
 * Protected: anonymous users cannot play.
 */
app.get('/api/network/planning', isLoggedIn, async (req, res) => {
  try {
    const network = await dao.getPlanningNetwork();
    res.json(network);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Ranking page.
 * Protected because only registered users have access to registered-user features.
 */
app.get('/api/ranking', isLoggedIn, async (req, res) => {
  try {
    const ranking = await dao.getRanking();
    res.json(ranking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new game for the logged-in user.
 */
app.post('/api/games', isLoggedIn, async (req, res) => {
  try {
    const game = await dao.createGame(req.user.id);
    res.status(201).json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create game' });
  }
});

/**
 * Get one game owned by the logged-in user.
 */
app.get('/api/games/:gameId', isLoggedIn, async (req, res) => {
  try {
    const gameId = Number(req.params.gameId);

    if (!Number.isInteger(gameId) || gameId <= 0) {
      return res.status(400).json({ error: 'Invalid game id' });
    }

    const game = await dao.getGameById(gameId, req.user.id);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not retrieve game' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});