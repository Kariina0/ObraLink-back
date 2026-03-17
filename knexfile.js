require("dotenv").config();
const path = require("path");

function resolveClient(env) {
  return (
    process.env[`DB_CLIENT_${env.toUpperCase()}`] ||
    process.env.DB_CLIENT ||
    "pg"
  ).toLowerCase();
}

function buildConfig(env) {
  const client = resolveClient(env);

  if (client === "sqlite3" || client === "better-sqlite3") {
    const defaultFile = env === "test" ? ":memory:" : "./data/dev.sqlite3";
    return {
      client,
      connection: {
        filename: process.env.DB_SQLITE_FILENAME || defaultFile,
      },
      useNullAsDefault: true,
      migrations: {
        directory: path.join(__dirname, "migrations"),
      },
    };
  }

  const connectionString =
    env === "test"
      ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
      : process.env.DATABASE_URL;

  return {
    client: "pg",
    connection: {
      connectionString,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: path.join(__dirname, "migrations"),
    },
    pool: env === "test" ? { min: 1, max: 2 } : { min: 2, max: 10 },
  };
}

module.exports = {
  development: buildConfig("development"),
  test: buildConfig("test"),
  production: buildConfig("production"),
};
