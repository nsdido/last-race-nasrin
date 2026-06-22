'use strict';

const db = require('./db');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

db.serialize(() => {
  db.run('PRAGMA foreign_keys = OFF');

  db.run('DROP TABLE IF EXISTS game_steps');
  db.run('DROP TABLE IF EXISTS games');
  db.run('DROP TABLE IF EXISTS events');
  db.run('DROP TABLE IF EXISTS segments');
  db.run('DROP TABLE IF EXISTS station_lines');
  db.run('DROP TABLE IF EXISTS lines');
  db.run('DROP TABLE IF EXISTS stations');
  db.run('DROP TABLE IF EXISTS users');

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE station_lines (
      station_id INTEGER NOT NULL,
      line_id INTEGER NOT NULL,
      PRIMARY KEY (station_id, line_id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (line_id) REFERENCES lines(id)
    )
  `);

  db.run(`
    CREATE TABLE segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station1_id INTEGER NOT NULL,
      station2_id INTEGER NOT NULL,
      line_id INTEGER NOT NULL,
      FOREIGN KEY (station1_id) REFERENCES stations(id),
      FOREIGN KEY (station2_id) REFERENCES stations(id),
      FOREIGN KEY (line_id) REFERENCES lines(id),
      CHECK (station1_id <> station2_id)
    )
  `);

  db.run(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      effect INTEGER NOT NULL CHECK (effect >= -4 AND effect <= 4)
    )
  `);

  db.run(`
    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_station_id INTEGER NOT NULL,
      destination_station_id INTEGER NOT NULL,
      initial_coins INTEGER NOT NULL DEFAULT 20,
      final_score INTEGER,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (start_station_id) REFERENCES stations(id),
      FOREIGN KEY (destination_station_id) REFERENCES stations(id)
    )
  `);

  db.run(`
    CREATE TABLE game_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      step_number INTEGER NOT NULL,
      segment_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      coins_after_step INTEGER NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (segment_id) REFERENCES segments(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )
  `);

  const users = [
    ['nasrin@example.com', 'password'],
    ['alice@example.com', 'password'],
    ['bob@example.com', 'password']
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (username, hash, salt)
    VALUES (?, ?, ?)
  `);

  for (const [username, password] of users) {
    const { hash, salt } = hashPassword(password);
    insertUser.run(username, hash, salt);
  }

  insertUser.finalize();

  const stations = [
    ['Centrale', 100, 100],
    ['Porta Velaria', 220, 100],
    ['Crocevia del Falco', 340, 100],
    ['Piazza delle Lanterne', 460, 100],
    ['Fontana Oscura', 100, 220],
    ['Borgo Sereno', 220, 220],
    ['Viale dei Mosaici', 340, 220],
    ['Torre Cinerea', 460, 220],
    ['Campo dell Eco', 100, 340],
    ['Giardino Nord', 220, 340],
    ['Mercato Sud', 340, 340],
    ['Porto Antico', 460, 340]
  ];

  const insertStation = db.prepare(`
    INSERT INTO stations (name, x, y)
    VALUES (?, ?, ?)
  `);

  stations.forEach((station) => insertStation.run(station));
  insertStation.finalize();

  const lines = [
    ['Red Line', 'red'],
    ['Blue Line', 'blue'],
    ['Green Line', 'green'],
    ['Yellow Line', 'gold']
  ];

  const insertLine = db.prepare(`
    INSERT INTO lines (name, color)
    VALUES (?, ?)
  `);

  lines.forEach((line) => insertLine.run(line));
  insertLine.finalize();

  const stationLines = [
    [1, 1], [2, 1], [3, 1], [4, 1],
    [1, 2], [5, 2], [6, 2], [7, 2],
    [2, 3], [5, 3], [8, 3], [9, 3],
    [4, 4], [8, 4], [7, 4], [12, 4],
    [6, 3], [10, 3], [11, 3]
  ];

  const insertStationLine = db.prepare(`
    INSERT INTO station_lines (station_id, line_id)
    VALUES (?, ?)
  `);

  stationLines.forEach((stationLine) => insertStationLine.run(stationLine));
  insertStationLine.finalize();

  const segments = [
    [1, 2, 1],
    [2, 3, 1],
    [3, 4, 1],
    [1, 5, 2],
    [5, 6, 2],
    [6, 7, 2],
    [2, 5, 3],
    [5, 8, 3],
    [8, 9, 3],
    [6, 10, 3],
    [10, 11, 3],
    [4, 8, 4],
    [8, 7, 4],
    [7, 12, 4]
  ];

  const insertSegment = db.prepare(`
    INSERT INTO segments (station1_id, station2_id, line_id)
    VALUES (?, ?, ?)
  `);

  segments.forEach((segment) => insertSegment.run(segment));
  insertSegment.finalize();

  const events = [
    ['Quiet journey', 0],
    ['Wrong platform', -2],
    ['Kind passenger helps you', 1],
    ['Ticket inspection delay', -1],
    ['Fast connection', 2],
    ['Lost wallet moment', -4],
    ['Lucky shortcut', 3],
    ['Crowded train', -3],
    ['Found bonus coin', 4]
  ];

  const insertEvent = db.prepare(`
    INSERT INTO events (description, effect)
    VALUES (?, ?)
  `);

  events.forEach((event) => insertEvent.run(event));
  insertEvent.finalize();

  const games = [
    [2, 1, 4, 25, 'completed', '2026-06-01T10:00:00', '2026-06-01T10:05:00'],
    [2, 1, 7, 18, 'completed', '2026-06-02T11:00:00', '2026-06-02T11:05:00'],
    [3, 5, 12, 30, 'completed', '2026-06-03T12:00:00', '2026-06-03T12:05:00']
  ];

  const insertGame = db.prepare(`
    INSERT INTO games (
      user_id,
      start_station_id,
      destination_station_id,
      final_score,
      status,
      created_at,
      completed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  games.forEach((game) => insertGame.run(game));
  insertGame.finalize();

  console.log('Database initialized successfully.');
});

db.close();