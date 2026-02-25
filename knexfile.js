module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: "./data/sqlite.db",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./migrations",
    },
  },
};
