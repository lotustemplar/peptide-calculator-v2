"use strict";

/**
 * Neon Postgres storage for the scheduled_notifications mapping.
 * Schema creation is idempotent and runs on first use.
 * Tests inject a query executor (PGlite) via setQueryExecutor.
 */

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS scheduled_notifications (
    onesignal_id TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    schedule_id  TEXT NOT NULL,
    send_at      TEXT NOT NULL,
    created_at   TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_sn_user_id ON scheduled_notifications(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_sn_schedule_id ON scheduled_notifications(schedule_id)",
];

let schemaPromise = null;
let queryExecutor = null;
const neonClients = new Map();

function queryConnectionString() {
  return process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
}

function schemaConnectionString() {
  return process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
}

function normalizeRows(result) {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray(result.rows)) {
    return result.rows;
  }
  return [];
}

function neonClient(connectionString) {
  if (!neonClients.has(connectionString)) {
    const { neon } = require("@neondatabase/serverless");
    neonClients.set(connectionString, neon(connectionString));
  }
  return neonClients.get(connectionString);
}

async function runQuery(connectionString, text, params) {
  if (queryExecutor) {
    return normalizeRows(await queryExecutor(text, params));
  }
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  const rows = await neonClient(connectionString).query(text, params);
  return normalizeRows(rows);
}

async function query(text, params = []) {
  return runQuery(queryConnectionString(), text, params);
}

function resetDbState() {
  schemaPromise = null;
  queryExecutor = null;
  neonClients.clear();
}

function setQueryExecutor(executor) {
  queryExecutor = executor;
  schemaPromise = null;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const connectionString = queryExecutor ? "" : schemaConnectionString();
      for (const statement of SCHEMA_STATEMENTS) {
        await runQuery(connectionString, statement, []);
      }
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

module.exports = {
  SCHEMA_STATEMENTS,
  ensureSchema,
  query,
  resetDbState,
  setQueryExecutor,
};
