module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: process.env.DB_PATH || "./data/sqlite.db",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },
  test: {
    client: "sqlite3",
    connection: {
      filename: ":memory:",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },
  production: {
    client: "sqlite3",
    connection: {
      filename: process.env.DB_PATH || "./data/sqlite.db",
    },
    useNullAsDefault: true,
    pool: { min: 1, max: 10 },
    migrations: {
      directory: "./migrations",
    },
  },
};
