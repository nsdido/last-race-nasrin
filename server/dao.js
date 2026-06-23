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
 * Used by Passport login.
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
 * Used by Passport session.
 */
async function getUserById(id) {
  return await dbGet(`
    SELECT id, username
    FROM users
    WHERE id = ?
  `, [id]);
}

async function getAllStations() {
  return await dbAll(`
    SELECT id, name
    FROM stations
    ORDER BY id
  `);
}

async function getAllSegmentsRaw() {
  return await dbAll(`
    SELECT id, station1_id AS station1Id, station2_id AS station2Id
    FROM segments
    ORDER BY id
  `);
}

function buildAdjacencyList(stations, segments) {
  const graph = new Map();

  for (const station of stations) {
    graph.set(station.id, []);
  }

  for (const segment of segments) {
    graph.get(segment.station1Id).push(segment.station2Id);
    graph.get(segment.station2Id).push(segment.station1Id);
  }

  return graph;
}

function computeDistance(graph, startId, destinationId) {
  const queue = [{ stationId: startId, distance: 0 }];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.stationId === destinationId) {
      return current.distance;
    }

    const neighbors = graph.get(current.stationId) || [];

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          stationId: neighborId,
          distance: current.distance + 1
        });
      }
    }
  }

  return Infinity;
}

async function selectRandomStartAndDestination() {
  const stations = await getAllStations();
  const segments = await getAllSegmentsRaw();
  const graph = buildAdjacencyList(stations, segments);

  const validPairs = [];

  for (const start of stations) {
    for (const destination of stations) {
      if (start.id === destination.id) {
        continue;
      }

      const distance = computeDistance(graph, start.id, destination.id);

      if (distance >= 3 && distance < Infinity) {
        validPairs.push({
          startStationId: start.id,
          startStationName: start.name,
          destinationStationId: destination.id,
          destinationStationName: destination.name,
          distance
        });
      }
    }
  }

  if (validPairs.length === 0) {
    throw new Error('No valid start/destination pairs found');
  }

  const randomIndex = Math.floor(Math.random() * validPairs.length);
  return validPairs[randomIndex];
}

async function createGame(userId) {
  const pair = await selectRandomStartAndDestination();
  const createdAt = new Date().toISOString();

  const result = await dbRun(`
    INSERT INTO games (
      user_id,
      start_station_id,
      destination_station_id,
      initial_coins,
      final_score,
      status,
      created_at,
      completed_at
    )
    VALUES (?, ?, ?, 20, NULL, 'planning', ?, NULL)
  `, [
    userId,
    pair.startStationId,
    pair.destinationStationId,
    createdAt
  ]);

  return {
    id: result.lastID,
    startStationId: pair.startStationId,
    startStationName: pair.startStationName,
    destinationStationId: pair.destinationStationId,
    destinationStationName: pair.destinationStationName,
    minimumDistance: pair.distance,
    initialCoins: 20,
    status: 'planning',
    createdAt
  };
}

async function getGameById(gameId, userId) {
  return await dbGet(`
    SELECT 
      g.id,
      g.user_id AS userId,
      g.start_station_id AS startStationId,
      ss.name AS startStationName,
      g.destination_station_id AS destinationStationId,
      ds.name AS destinationStationName,
      g.initial_coins AS initialCoins,
      g.final_score AS finalScore,
      g.status,
      g.created_at AS createdAt,
      g.completed_at AS completedAt
    FROM games g
    JOIN stations ss ON g.start_station_id = ss.id
    JOIN stations ds ON g.destination_station_id = ds.id
    WHERE g.id = ? AND g.user_id = ?
  `, [gameId, userId]);
}

async function getSegmentsByIds(segmentIds) {
  if (segmentIds.length === 0) {
    return [];
  }

  const placeholders = segmentIds.map(() => '?').join(',');

  return await dbAll(`
    SELECT 
      s.id,
      s.station1_id AS station1Id,
      st1.name AS station1Name,
      s.station2_id AS station2Id,
      st2.name AS station2Name,
      s.line_id AS lineId,
      l.name AS lineName
    FROM segments s
    JOIN stations st1 ON s.station1_id = st1.id
    JOIN stations st2 ON s.station2_id = st2.id
    JOIN lines l ON s.line_id = l.id
    WHERE s.id IN (${placeholders})
  `, segmentIds);
}

async function getInterchangeStationIds() {
  const rows = await dbAll(`
    SELECT station_id AS stationId
    FROM station_lines
    GROUP BY station_id
    HAVING COUNT(*) > 1
  `);

  return new Set(rows.map((row) => row.stationId));
}

async function getRandomEvent() {
  return await dbGet(`
    SELECT id, description, effect
    FROM events
    ORDER BY RANDOM()
    LIMIT 1
  `);
}

function validateRoute(game, selectedSegmentIds, segmentsById, interchangeStationIds) {
  if (selectedSegmentIds.length === 0) {
    return {
      valid: false,
      reason: 'No segment selected'
    };
  }

  const uniqueSegmentIds = new Set(selectedSegmentIds);

  if (uniqueSegmentIds.size !== selectedSegmentIds.length) {
    return {
      valid: false,
      reason: 'A segment was selected more than once'
    };
  }

  let currentStationId = game.startStationId;
  let previousLineId = null;

  for (const segmentId of selectedSegmentIds) {
    const segment = segmentsById.get(segmentId);

    if (!segment) {
      return {
        valid: false,
        reason: `Segment ${segmentId} does not exist`
      };
    }

    if (previousLineId !== null && previousLineId !== segment.lineId) {
      if (!interchangeStationIds.has(currentStationId)) {
        return {
          valid: false,
          reason: 'Line change outside an interchange station'
        };
      }
    }

    if (segment.station1Id === currentStationId) {
      currentStationId = segment.station2Id;
    } else if (segment.station2Id === currentStationId) {
      currentStationId = segment.station1Id;
    } else {
      return {
        valid: false,
        reason: 'Selected segments are not connected in sequence'
      };
    }

    previousLineId = segment.lineId;
  }

  if (currentStationId !== game.destinationStationId) {
    return {
      valid: false,
      reason: 'Route does not reach the destination'
    };
  }

  return {
    valid: true,
    reason: 'Valid route'
  };
}

async function submitRoute(gameId, userId, selectedSegmentIds) {
  const game = await getGameById(gameId, userId);

  if (!game) {
    return {
      statusCode: 404,
      body: { error: 'Game not found' }
    };
  }

  if (game.status !== 'planning') {
    return {
      statusCode: 409,
      body: { error: 'Game is not in planning phase' }
    };
  }

  const segments = await getSegmentsByIds(selectedSegmentIds);
  const segmentsById = new Map(segments.map((segment) => [segment.id, segment]));
  const interchangeStationIds = await getInterchangeStationIds();

  const validation = validateRoute(
    game,
    selectedSegmentIds,
    segmentsById,
    interchangeStationIds
  );

  if (!validation.valid) {
    const completedAt = new Date().toISOString();

    await dbRun(`
      UPDATE games
      SET status = 'completed',
          final_score = 0,
          completed_at = ?
      WHERE id = ? AND user_id = ?
    `, [completedAt, gameId, userId]);

    return {
      statusCode: 200,
      body: {
        valid: false,
        reason: validation.reason,
        finalScore: 0,
        steps: []
      }
    };
  }

  let coins = game.initialCoins;
  let currentStationId = game.startStationId;
  const steps = [];

  for (let i = 0; i < selectedSegmentIds.length; i++) {
    const segment = segmentsById.get(selectedSegmentIds[i]);
    const event = await getRandomEvent();

    let fromStationName;
    let toStationName;

    if (segment.station1Id === currentStationId) {
      fromStationName = segment.station1Name;
      toStationName = segment.station2Name;
      currentStationId = segment.station2Id;
    } else {
      fromStationName = segment.station2Name;
      toStationName = segment.station1Name;
      currentStationId = segment.station1Id;
    }

    coins += event.effect;

    await dbRun(`
      INSERT INTO game_steps (
        game_id,
        step_number,
        segment_id,
        event_id,
        coins_after_step
      )
      VALUES (?, ?, ?, ?, ?)
    `, [
      gameId,
      i + 1,
      segment.id,
      event.id,
      coins
    ]);

    steps.push({
      stepNumber: i + 1,
      segmentId: segment.id,
      from: fromStationName,
      to: toStationName,
      lineName: segment.lineName,
      eventDescription: event.description,
      eventEffect: event.effect,
      coinsAfterStep: coins
    });
  }

  const finalScore = Math.max(0, coins);
  const completedAt = new Date().toISOString();

  await dbRun(`
    UPDATE games
    SET status = 'completed',
        final_score = ?,
        completed_at = ?
    WHERE id = ? AND user_id = ?
  `, [finalScore, completedAt, gameId, userId]);

  return {
    statusCode: 200,
    body: {
      valid: true,
      reason: validation.reason,
      finalScore,
      steps
    }
  };
}

module.exports = {
  getFullNetwork,
  getPlanningNetwork,
  getRanking,
  getUserByUsername,
  getUserById,
  createGame,
  getGameById,
  selectRandomStartAndDestination,
  submitRoute,
  dbAll,
  dbGet,
  dbRun
};