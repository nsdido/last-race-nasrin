'use strict';

const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('last_race.db', (err) => {
  if (err) {
    console.error('Database opening error:', err.message);
    throw err;
  }
});

module.exports = db;