/**
 * Script de correção: recalcula areaCalculada e volume para medições
 * onde comprimento e largura já estão salvos mas areaCalculada está nulo.
 *
 * Executar: node scripts/fix_area_calculada.js
 */

const knex = require("knex")(
  require("../knexfile")[process.env.NODE_ENV || "development"]
);

async function run() {
  const rows = await knex("medicoes")
    .whereNotNull("comprimento")
    .whereNotNull("largura")
    .where(function () {
      this.whereNull("areaCalculada").orWhere("areaCalculada", "");
    })
    .select("id", "comprimento", "largura", "altura");

  console.log(`Encontradas ${rows.length} medições para corrigir.`);

  let corrigidas = 0;
  for (const row of rows) {
    const comprimento = Number(row.comprimento);
    const largura = Number(row.largura);
    const altura = row.altura != null ? Number(row.altura) : null;

    if (isNaN(comprimento) || isNaN(largura)) continue;

    const areaCalculada = comprimento * largura;
    const volume =
      altura != null && !isNaN(altura)
        ? comprimento * largura * altura
        : null;

    await knex("medicoes").where({ id: row.id }).update({ areaCalculada, volume });
    corrigidas++;
  }

  console.log(`Corrigidas: ${corrigidas} medições.`);
  await knex.destroy();
}

run().catch((err) => {
  console.error("Erro ao executar script:", err);
  knex.destroy();
  process.exit(1);
});
