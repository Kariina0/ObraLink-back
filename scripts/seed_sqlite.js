require("dotenv").config();
const knexfile = require("../knexfile.js");
const createKnex = () => require("knex")(knexfile.development);
const bcrypt = require("bcryptjs");
const logger = require("../src/utils/logger");

async function seed(options = {}) {
  const { exitOnComplete = true } = options;
  const knex = createKnex();

  try {
    logger.info("🌱 Iniciando seed SQLite...");

    // Limpar tabelas existentes (ordem para respeitar dependências)
    await knex("medicoes").del();
    await knex("diarios").del();
    await knex("solicitacoes_compra").del();
    await knex("arquivos").del();
    await knex("obras").del();
    await knex("users").del();
    logger.info("🧹 Dados antigos removidos (SQLite)");

    // Criar usuários (senhas hasheadas)
    const senhaAdmin = await bcrypt.hash("admin123", 12);
    const senhaSupervisor = await bcrypt.hash("supervisor123", 12);
    const senhaEncarregado = await bcrypt.hash("encarregado123", 12);

    const [adminId] = await knex("users").insert({
      nome: "Administrador",
      email: "admin@construcao.com",
      senha: senhaAdmin,
      perfil: "admin",
      isActive: true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    const [supervisorId] = await knex("users").insert({
      nome: "Maria Supervisor",
      email: "supervisor@construcao.com",
      senha: senhaSupervisor,
      perfil: "supervisor",
      isActive: true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    const [enc1Id] = await knex("users").insert({
      nome: "João Encarregado",
      email: "joao@construcao.com",
      senha: senhaEncarregado,
      perfil: "encarregado",
      isActive: true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    const [enc2Id] = await knex("users").insert({
      nome: "Pedro Silva",
      email: "pedro@construcao.com",
      senha: senhaEncarregado,
      perfil: "encarregado",
      isActive: true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    logger.info("✅ Usuários criados (SQLite)");

    // Criar obras
    const obra1 = {
      nome: "Residencial Jardim das Flores",
      codigo: "RES-001",
      endereco: JSON.stringify({
        logradouro: "Rua das Acácias",
        numero: "1000",
        bairro: "Jardim Primavera",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01234-567",
      }),
      responsavel: supervisorId,
      equipe: JSON.stringify([
        { usuario: enc1Id, funcao: "Encarregado de Obra", dataInclusao: new Date() },
        { usuario: enc2Id, funcao: "Encarregado de Acabamento", dataInclusao: new Date() },
      ]),
      dataInicio: new Date("2024-01-01"),
      dataPrevisaoTermino: new Date("2024-12-31"),
      status: "em_andamento",
      orcamento: JSON.stringify({ valor: 1500000, valorGasto: 450000 }),
      descricao: "Construção de edifício residencial com 4 pavimentos",
      metadata: JSON.stringify({ createdAt: new Date(), createdBy: adminId }),
    };

    const obra2 = {
      nome: "Galpão Industrial TechPark",
      codigo: "IND-002",
      endereco: JSON.stringify({
        logradouro: "Avenida Industrial",
        numero: "5000",
        bairro: "Distrito Industrial",
        cidade: "Campinas",
        estado: "SP",
        cep: "13050-000",
      }),
      responsavel: supervisorId,
      equipe: JSON.stringify([{ usuario: enc2Id, funcao: "Encarregado Geral", dataInclusao: new Date() }]),
      dataInicio: new Date("2024-02-01"),
      dataPrevisaoTermino: new Date("2024-08-31"),
      status: "em_andamento",
      orcamento: JSON.stringify({ valor: 2500000, valorGasto: 750000 }),
      descricao: "Construção de galpão industrial com área de 5.000m²",
      metadata: JSON.stringify({ createdAt: new Date(), createdBy: adminId }),
    };

    const obra3 = {
      nome: "Escola Municipal Centro",
      codigo: "PUB-003",
      endereco: JSON.stringify({
        logradouro: "Rua da Educação",
        numero: "250",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01010-000",
      }),
      responsavel: supervisorId,
      equipe: JSON.stringify([{ usuario: enc1Id, funcao: "Encarregado de Obra", dataInclusao: new Date() }]),
      dataInicio: new Date("2024-03-01"),
      dataPrevisaoTermino: new Date("2025-02-28"),
      status: "planejamento",
      orcamento: JSON.stringify({ valor: 3000000, valorGasto: 0 }),
      descricao: "Reforma e ampliação de escola municipal",
      metadata: JSON.stringify({ createdAt: new Date(), createdBy: adminId }),
    };

    const [obra1Id] = await knex("obras").insert(obra1);
    const [obra2Id] = await knex("obras").insert(obra2);
    const [obra3Id] = await knex("obras").insert(obra3);

    logger.info("✅ Obras criadas (SQLite)");

    // Atualizar obraAtual dos encarregados
    await knex("users").where({ id: enc1Id }).update({ obraAtual: obra1Id });
    await knex("users").where({ id: enc2Id }).update({ obraAtual: obra2Id });

    logger.info("✅ Seed SQLite concluído com sucesso!");
    logger.info("📊 Usuários criados:");
    logger.info(" - admin@construcao.com / admin123");
    logger.info(" - supervisor@construcao.com / supervisor123");
    logger.info(" - joao@construcao.com / encarregado123");
    logger.info(" - pedro@construcao.com / encarregado123");

    await knex.destroy();

    if (exitOnComplete) {
      process.exit(0);
    }

    return {
      users: [adminId, supervisorId, enc1Id, enc2Id],
      obras: [obra1Id, obra2Id, obra3Id],
    };
  } catch (error) {
    logger.error("❌ Erro ao executar seed SQLite:", error);
    await knex.destroy();

    if (exitOnComplete) {
      process.exit(1);
    }

    throw error;
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
