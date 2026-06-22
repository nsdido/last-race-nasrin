'use strict';

const crypto = require('crypto');
const passport = require('passport');
const LocalStrategy = require('passport-local');

const dao = require('./dao');

function verifyPassword(password, hash, salt) {
  const computedHash = crypto.scryptSync(password, salt, 32).toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(computedHash, 'hex')
  );
}

passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await dao.getUserByUsername(username);

    if (!user) {
      return done(null, false, { message: 'Invalid username or password' });
    }

    const validPassword = verifyPassword(password, user.hash, user.salt);

    if (!validPassword) {
      return done(null, false, { message: 'Invalid username or password' });
    }

    return done(null, {
      id: user.id,
      username: user.username
    });
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await dao.getUserById(id);

    if (!user) {
      return done(null, false);
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ error: 'Not authenticated' });
}

module.exports = {
  passport,
  isLoggedIn
};