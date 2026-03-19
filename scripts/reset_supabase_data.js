"use strict";

require("dotenv").config();
const Knex = require("knex");
const knexfile = require("../knexfile");

const env = process.env.NODE_ENV || "development";
const knex = Knex(knexfile[env]);

async function resetData() {
  try {
    const client = knex.client.config.client;

    if (client !== "pg") {
      throw new Error(
        `Este script foi feito para PostgreSQL/Supabase. Cliente atual: ${client}`,
      );
    }

    const result = await knex.raw(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('knex_migrations', 'knex_migrations_lock')
      ORDER BY tablename
    `);

    const tables = result.rows.map((row) => `"${row.tablename}"`);

    if (tables.length === 0) {
      console.log("Nenhuma tabela para truncar.");
      return;
    }

    await knex.raw(
      `TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`,
    );

    console.log(`✅ Reset concluído. Tabelas truncadas: ${tables.length}`);
  } finally {
    await knex.destroy();
  }
}

resetData().catch((error) => {
  console.error("❌ Falha ao resetar dados:", error.message);
  process.exit(1);
});
