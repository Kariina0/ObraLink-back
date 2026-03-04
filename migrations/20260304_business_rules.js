/**
 * Migration: regras de negócio — medições, obras e arquivos.
 *
 * 1. obra_encarregados  — tabela N:N entre obras e usuários com perfil encarregado.
 * 2. obras              — adiciona coluna "cliente".
 * 3. medicoes           — adiciona colunas "area" e "tipoServico".
 * 4. arquivos           — adiciona colunas "tipoArquivo", "solicitadoPor" e "detalheProblema".
 */
exports.up = async function (knex) {
  // 1. Tabela de relacionamento N:N obra ↔ encarregado
  const hasObraEnc = await knex.schema.hasTable("obra_encarregados");
  if (!hasObraEnc) {
    await knex.schema.createTable("obra_encarregados", (table) => {
      table.increments("id");
      table.integer("obraId").unsigned().notNullable()
        .references("id").inTable("obras").onDelete("CASCADE");
      table.integer("userId").unsigned().notNullable()
        .references("id").inTable("users").onDelete("CASCADE");
      table.string("funcao").nullable(); // ex: "encarregado", "supervisor"
      table.datetime("dataInclusao").defaultTo(knex.fn.now());
      table.unique(["obraId", "userId"]);
    });
  }

  // 2. obras — coluna "cliente"
  const hasCliente = await knex.schema.hasColumn("obras", "cliente");
  if (!hasCliente) {
    await knex.schema.alterTable("obras", (table) => {
      table.string("cliente").nullable();
    });
  }

  // 3. medicoes — área e tipo de serviço
  const hasMedicaoArea = await knex.schema.hasColumn("medicoes", "area");
  if (!hasMedicaoArea) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.string("area").nullable();       // ex: "quarto", "sala", "banheiro"
      table.string("tipoServico").nullable(); // ex: "pintura", "alvenaria"
    });
  }

  // 4. arquivos — tipo de arquivo, solicitante e detalhe de problema
  const hasTipoArquivo = await knex.schema.hasColumn("arquivos", "tipoArquivo");
  if (!hasTipoArquivo) {
    await knex.schema.alterTable("arquivos", (table) => {
      table.string("tipoArquivo").nullable(); // solicitacao | problema | relatorio | medicao | outros
      table.integer("solicitadoPor").unsigned().nullable();
      table.text("detalheProblema").nullable();
    });
  }
};

exports.down = async function (knex) {
  // 4. Remover colunas de arquivos
  const hasTipoArquivo = await knex.schema.hasColumn("arquivos", "tipoArquivo");
  if (hasTipoArquivo) {
    await knex.schema.alterTable("arquivos", (table) => {
      table.dropColumn("tipoArquivo");
      table.dropColumn("solicitadoPor");
      table.dropColumn("detalheProblema");
    });
  }

  // 3. Remover colunas de medicoes
  const hasMedicaoArea = await knex.schema.hasColumn("medicoes", "area");
  if (hasMedicaoArea) {
    await knex.schema.alterTable("medicoes", (table) => {
      table.dropColumn("area");
      table.dropColumn("tipoServico");
    });
  }

  // 2. Remover coluna cliente de obras
  const hasCliente = await knex.schema.hasColumn("obras", "cliente");
  if (hasCliente) {
    await knex.schema.alterTable("obras", (table) => {
      table.dropColumn("cliente");
    });
  }

  // 1. Remover tabela N:N
  await knex.schema.dropTableIfExists("obra_encarregados");
};
