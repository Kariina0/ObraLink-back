require("dotenv").config();
const database = require("../src/config/database");
const User = require("../src/models/User");
const Obra = require("../src/models/Obra");
const logger = require("../src/utils/logger");

async function seed() {
  try {
    // Conectar ao banco
    await database.connect();
    logger.info("🌱 Iniciando seed...");

    // Limpar dados existentes
    await User.deleteMany({});
    await Obra.deleteMany({});
    logger.info("🧹 Dados antigos removidos");

    // Criar usuários
    const admin = await User.create({
      nome: "Administrador",
      email: "admin@construcao.com",
      senha: "admin123",
      perfil: "admin",
      isActive: true,
      metadata: {
        createdAt: new Date(),
      },
    });

    const supervisor = await User.create({
      nome: "Maria Supervisor",
      email: "supervisor@construcao.com",
      senha: "supervisor123",
      perfil: "supervisor",
      isActive: true,
      metadata: {
        createdAt: new Date(),
      },
    });

    const encarregado1 = await User.create({
      nome: "João Encarregado",
      email: "joao@construcao.com",
      senha: "encarregado123",
      perfil: "encarregado",
      isActive: true,
      metadata: {
        createdAt: new Date(),
      },
    });

    const encarregado2 = await User.create({
      nome: "Pedro Silva",
      email: "pedro@construcao.com",
      senha: "encarregado123",
      perfil: "encarregado",
      isActive: true,
      metadata: {
        createdAt: new Date(),
      },
    });

    logger.info("✅ Usuários criados");

    // Criar obras
    const obra1 = await Obra.create({
      nome: "Residencial Jardim das Flores",
      codigo: "RES-001",
      endereco: {
        logradouro: "Rua das Acácias",
        numero: "1000",
        bairro: "Jardim Primavera",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01234-567",
      },
      responsavel: supervisor._id,
      equipe: [
        {
          usuario: encarregado1._id,
          funcao: "Encarregado de Obra",
          dataInclusao: new Date(),
        },
        {
          usuario: encarregado2._id,
          funcao: "Encarregado de Acabamento",
          dataInclusao: new Date(),
        },
      ],
      dataInicio: new Date("2024-01-01"),
      dataPrevisaoTermino: new Date("2024-12-31"),
      status: "em_andamento",
      orcamento: {
        valor: 1500000,
        valorGasto: 450000,
      },
      descricao: "Construção de edifício residencial com 4 pavimentos",
      metadata: {
        createdAt: new Date(),
        createdBy: admin._id,
      },
    });

    const obra2 = await Obra.create({
      nome: "Galpão Industrial TechPark",
      codigo: "IND-002",
      endereco: {
        logradouro: "Avenida Industrial",
        numero: "5000",
        bairro: "Distrito Industrial",
        cidade: "Campinas",
        estado: "SP",
        cep: "13050-000",
      },
      responsavel: supervisor._id,
      equipe: [
        {
          usuario: encarregado2._id,
          funcao: "Encarregado Geral",
          dataInclusao: new Date(),
        },
      ],
      dataInicio: new Date("2024-02-01"),
      dataPrevisaoTermino: new Date("2024-08-31"),
      status: "em_andamento",
      orcamento: {
        valor: 2500000,
        valorGasto: 750000,
      },
      descricao: "Construção de galpão industrial com área de 5.000m²",
      metadata: {
        createdAt: new Date(),
        createdBy: admin._id,
      },
    });

    const obra3 = await Obra.create({
      nome: "Escola Municipal Centro",
      codigo: "PUB-003",
      endereco: {
        logradouro: "Rua da Educação",
        numero: "250",
        bairro: "Centro",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01010-000",
      },
      responsavel: supervisor._id,
      equipe: [
        {
          usuario: encarregado1._id,
          funcao: "Encarregado de Obra",
          dataInclusao: new Date(),
        },
      ],
      dataInicio: new Date("2024-03-01"),
      dataPrevisaoTermino: new Date("2025-02-28"),
      status: "planejamento",
      orcamento: {
        valor: 3000000,
        valorGasto: 0,
      },
      descricao: "Reforma e ampliação de escola municipal",
      metadata: {
        createdAt: new Date(),
        createdBy: admin._id,
      },
    });

    logger.info("✅ Obras criadas");

    // Atualizar obra atual dos encarregados
    await User.findByIdAndUpdate(encarregado1._id, { obraAtual: obra1._id });
    await User.findByIdAndUpdate(encarregado2._id, { obraAtual: obra2._id });

    logger.info("✅ Seed concluído com sucesso!");
    logger.info("\n📊 Dados criados:");
    logger.info("👤 Usuários:");
    logger.info(`   - Admin: admin@construcao.com / admin123`);
    logger.info(`   - Supervisor: supervisor@construcao.com / supervisor123`);
    logger.info(`   - Encarregado 1: joao@construcao.com / encarregado123`);
    logger.info(`   - Encarregado 2: pedro@construcao.com / encarregado123`);
    logger.info("\n🏗️ Obras:");
    logger.info(`   - ${obra1.nome} (${obra1.codigo})`);
    logger.info(`   - ${obra2.nome} (${obra2.codigo})`);
    logger.info(`   - ${obra3.nome} (${obra3.codigo})`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error("❌ Erro ao executar seed:", error);
    process.exit(1);
  }
}

seed();
