'use strict';

const db = require('./db');

/**
 * Convert sqlite callback style into Promise style.
 */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/**
 * Full network for setup phase.
 * Logged-in users can see stations, lines, and segments.
 */
async function getFullNetwork() {
  const stations = await dbAll(`
    SELECT id, name, x, y
    FROM stations
    ORDER BY id
  `);

  const lines = await dbAll(`
    SELECT id, name, color
    FROM lines
    ORDER BY id
  `);

  const segments = await dbAll(`
    SELECT 
      s.id,
      s.station1_id AS station1Id,
      st1.name AS station1Name,
      s.station2_id AS station2Id,
      st2.name AS station2Name,
      s.line_id AS lineId,
      l.name AS lineName,
      l.color AS lineColor
    FROM segments s
    JOIN stations st1 ON s.station1_id = st1.id
    JOIN stations st2 ON s.station2_id = st2.id
    JOIN lines l ON s.line_id = l.id
    ORDER BY s.id
  `);

  return { stations, lines, segments };
}

/**
 * Planning network.
 * During planning, the client should see stations and segment pairs,
 * but not line information.
 */
async function getPlanningNetwork() {
  const stations = await dbAll(`
    SELECT id, name, x, y
    FROM stations
    ORDER BY id
  `);

  const segments = await dbAll(`
    SELECT 
      s.id,
      s.station1_id AS station1Id,
      st1.name AS station1Name,
      s.station2_id AS station2Id,
      st2.name AS station2Name
    FROM segments s
    JOIN stations st1 ON s.station1_id = st1.id
    JOIN stations st2 ON s.station2_id = st2.id
    ORDER BY s.id
  `);

  return { stations, segments };
}

/**
 * Ranking: each user's best completed score.
 */
async function getRanking() {
  return await dbAll(`
    SELECT 
      u.username,
      MAX(g.final_score) AS bestScore
    FROM users u
    JOIN games g ON u.id = g.user_id
    WHERE g.status = 'completed'
    GROUP BY u.id, u.username
    ORDER BY bestScore DESC, u.username ASC
  `);
}

/**
 * Get one user by username.
 * Used later by Passport login.
 */
async function getUserByUsername(username) {
  return await dbGet(`
    SELECT id, username, hash, salt
    FROM users
    WHERE username = ?
  `, [username]);
}

/**
 * Get one user by id.
 * Used later by Passport session.
 */
async function getUserById(id) {
  return await dbGet(`
    SELECT id, username
    FROM users
    WHERE id = ?
  `, [id]);
}

module.exports = {
  getFullNetwork,
  getPlanningNetwork,
  getRanking,
  getUserByUsername,
  getUserById,
  dbAll,
  dbGet,
  dbRun
};