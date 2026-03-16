/**
 * seed_postgres.js — Popula o banco PostgreSQL/Supabase com dados de teste.
 * Compatível com o Knex no modo pg (usa .returning('id')).
 *
 * Uso: node scripts/seed_postgres.js
 *      npm run seed:postgres
 *
 * O script é idempotente: verifica existência antes de inserir.
 */
require("dotenv").config();
const knexfile = require("../knexfile.js");
const Knex = require("knex");
const bcrypt = require("bcryptjs");

const knex = Knex(knexfile[process.env.NODE_ENV || "development"]);

/** Extrai o ID (int ou objeto) retornado pelo Knex em PostgreSQL */
function extractId(res) {
  if (!res || !res[0]) throw new Error("Insert não retornou ID");
  const first = res[0];
  return typeof first === "object" ? first.id : first;
}

async function seed() {
  try {
    console.log("🌱  Iniciando seed PostgreSQL...");

    // ─── Usuários ────────────────────────────────────────────────────────────
    const senhaAdmin        = await bcrypt.hash("admin123", 12);
    const senhaSupervisor   = await bcrypt.hash("supervisor123", 12);
    const senhaEncarregado  = await bcrypt.hash("encarregado123", 12);

    async function upsertUser(email, data) {
      const existing = await knex("users").where({ email }).first();
      if (existing) {
        console.log(`  ↩  Usuário já existe: ${email} (id=${existing.id})`);
        return existing.id;
      }
      const res = await knex("users").insert(data).returning("id");
      const id = extractId(res);
      console.log(`  ✅  Usuário criado: ${email} (id=${id})`);
      return id;
    }

    const adminId = await upsertUser("admin@construcao.com", {
      nome: "Administrador",
      email: "admin@construcao.com",
      senha: senhaAdmin,
      perfil: "admin",
      "isActive": true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    const supervisorId = await upsertUser("supervisor@construcao.com", {
      nome: "Maria Supervisor",
      email: "supervisor@construcao.com",
      senha: senhaSupervisor,
      perfil: "supervisor",
      "isActive": true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    const enc1Id = await upsertUser("joao@construcao.com", {
      nome: "João Encarregado",
      email: "joao@construcao.com",
      senha: senhaEncarregado,
      perfil: "encarregado",
      "isActive": true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    const enc2Id = await upsertUser("pedro@construcao.com", {
      nome: "Pedro Silva",
      email: "pedro@construcao.com",
      senha: senhaEncarregado,
      perfil: "encarregado",
      "isActive": true,
      metadata: JSON.stringify({ createdAt: new Date() }),
    });

    // ─── Obras ───────────────────────────────────────────────────────────────
    async function upsertObra(codigo, data) {
      const existing = await knex("obras").where({ codigo }).first();
      if (existing) {
        console.log(`  ↩  Obra já existe: ${data.nome} (id=${existing.id})`);
        return existing.id;
      }
      const res = await knex("obras").insert(data).returning("id");
      const id = extractId(res);
      console.log(`  ✅  Obra criada: ${data.nome} (id=${id})`);
      return id;
    }

    const obra1Id = await upsertObra("RES-001", {
      nome: "Residencial Jardim das Flores",
      codigo: "RES-001",
      endereco: JSON.stringify({
        logradouro: "Rua das Acácias", numero: "1000",
        bairro: "Jardim Primavera", cidade: "São Paulo", estado: "SP", cep: "01234-567",
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
    });

    const obra2Id = await upsertObra("IND-002", {
      nome: "Galpão Industrial TechPark",
      codigo: "IND-002",
      endereco: JSON.stringify({
        logradouro: "Avenida Industrial", numero: "5000",
        bairro: "Distrito Industrial", cidade: "Campinas", estado: "SP", cep: "13050-000",
      }),
      responsavel: supervisorId,
      equipe: JSON.stringify([
        { usuario: enc2Id, funcao: "Encarregado Geral", dataInclusao: new Date() },
      ]),
      dataInicio: new Date("2024-02-01"),
      dataPrevisaoTermino: new Date("2024-08-31"),
      status: "em_andamento",
      orcamento: JSON.stringify({ valor: 2500000, valorGasto: 750000 }),
      descricao: "Construção de galpão industrial com área de 5.000m²",
      metadata: JSON.stringify({ createdAt: new Date(), createdBy: adminId }),
    });

    const obra3Id = await upsertObra("PUB-003", {
      nome: "Escola Municipal Centro",
      codigo: "PUB-003",
      endereco: JSON.stringify({
        logradouro: "Rua da Educação", numero: "250",
        bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01010-000",
      }),
      responsavel: supervisorId,
      equipe: JSON.stringify([
        { usuario: enc1Id, funcao: "Encarregado de Obra", dataInclusao: new Date() },
      ]),
      dataInicio: new Date("2024-03-01"),
      dataPrevisaoTermino: new Date("2025-02-28"),
      status: "planejamento",
      orcamento: JSON.stringify({ valor: 3000000, valorGasto: 0 }),
      descricao: "Reforma e ampliação de escola municipal",
      metadata: JSON.stringify({ createdAt: new Date(), createdBy: adminId }),
    });

    // ─── Obra-Encarregados (N:N) ──────────────────────────────────────────────
    async function upsertObraEncarregado(obraId, userId) {
      const existing = await knex("obra_encarregados")
        .where({ "obraId": obraId, "userId": userId }).first();
      if (!existing) {
        await knex("obra_encarregados").insert({ "obraId": obraId, "userId": userId });
      }
    }
    await upsertObraEncarregado(obra1Id, enc1Id);
    await upsertObraEncarregado(obra1Id, enc2Id);
    await upsertObraEncarregado(obra2Id, enc2Id);
    await upsertObraEncarregado(obra3Id, enc1Id);

    // Atualizar obraAtual dos encarregados
    await knex("users").where({ id: enc1Id }).update({ obraAtual: obra1Id });
    await knex("users").where({ id: enc2Id }).update({ obraAtual: obra2Id });

    console.log("✅  Obras e vínculos criados");

    // ─── Medições ─────────────────────────────────────────────────────────────
    const medicoes = [
      {
        obra: obra1Id,
        responsavel: enc1Id,
        data: new Date("2026-03-01"),
        periodo: JSON.stringify({ inicio: "2026-02-01", fim: "2026-02-28" }),
        area: "Fundação",
        tipoServico: "Concretagem",
        comprimento: 20,
        largura: 15,
        altura: 0.3,
        areaCalculada: 300,
        volume: 90,
        itens: JSON.stringify([
          { descricao: "Concreto fck 25", unidade: "m³", quantidade: 90, valorUnitario: 450, valorTotal: 40500 },
          { descricao: "Aço CA-50 10mm", unidade: "kg", quantidade: 1800, valorUnitario: 8, valorTotal: 14400 },
        ]),
        observacoes: "Concretagem da laje de fundação realizada sem intercorrências.",
        status: "aprovada",
        aprovadoPor: supervisorId,
        dataAprovacao: new Date("2026-03-03"),
        sincronizado: true,
        syncId: `sync-med-001-${Date.now()}`,
        metadata: JSON.stringify({ createdAt: new Date("2026-03-01"), createdBy: enc1Id }),
        created_at: new Date("2026-03-01"),
      },
      {
        obra: obra1Id,
        responsavel: enc1Id,
        data: new Date("2026-03-08"),
        periodo: JSON.stringify({ inicio: "2026-03-01", fim: "2026-03-07" }),
        area: "Estrutura",
        tipoServico: "Alvenaria",
        comprimento: 20,
        largura: 15,
        areaCalculada: 300,
        itens: JSON.stringify([
          { descricao: "Tijolo cerâmico 9 furos", unidade: "milheiro", quantidade: 5, valorUnitario: 1200, valorTotal: 6000 },
          { descricao: "Argamassa de assentamento", unidade: "m³", quantidade: 3, valorUnitario: 350, valorTotal: 1050 },
        ]),
        observacoes: "Levantamento das paredes do 1º pavimento.",
        status: "enviada",
        sincronizado: false,
        syncId: `sync-med-002-${Date.now()}`,
        metadata: JSON.stringify({ createdAt: new Date("2026-03-08"), createdBy: enc1Id }),
        created_at: new Date("2026-03-08"),
      },
      {
        obra: obra2Id,
        responsavel: enc2Id,
        data: new Date("2026-03-05"),
        periodo: JSON.stringify({ inicio: "2026-02-15", fim: "2026-03-04" }),
        area: "Cobertura",
        tipoServico: "Montagem metálica",
        comprimento: 50,
        largura: 30,
        areaCalculada: 1500,
        itens: JSON.stringify([
          { descricao: "Perfil metálico W200", unidade: "ton", quantidade: 12, valorUnitario: 8500, valorTotal: 102000 },
          { descricao: "Parafusos e conectores", unidade: "cx", quantidade: 40, valorUnitario: 180, valorTotal: 7200 },
        ]),
        observacoes: "Montagem da estrutura metálica da cobertura do galpão.",
        status: "rejeitada",
        motivoRejeicao: "Documentação de rastreabilidade do aço não anexada.",
        sincronizado: true,
        syncId: `sync-med-003-${Date.now()}`,
        metadata: JSON.stringify({ createdAt: new Date("2026-03-05"), createdBy: enc2Id }),
        created_at: new Date("2026-03-05"),
      },
      {
        obra: obra2Id,
        responsavel: enc2Id,
        data: new Date("2026-03-12"),
        periodo: JSON.stringify({ inicio: "2026-03-05", fim: "2026-03-11" }),
        area: "Cobertura",
        tipoServico: "Telha metálica",
        comprimento: 50,
        largura: 30,
        areaCalculada: 1500,
        itens: JSON.stringify([
          { descricao: "Telha trapezoidal TP40", unidade: "m²", quantidade: 1550, valorUnitario: 42, valorTotal: 65100 },
          { descricao: "Parafuso autorroscante", unidade: "cx", quantidade: 80, valorUnitario: 95, valorTotal: 7600 },
        ]),
        observacoes: "Instalação de telhas com toda documentação de rastreabilidade.",
        status: "enviada",
        sincronizado: false,
        syncId: `sync-med-004-${Date.now()}`,
        metadata: JSON.stringify({ createdAt: new Date("2026-03-12"), createdBy: enc2Id }),
        created_at: new Date("2026-03-12"),
      },
      {
        obra: obra1Id,
        responsavel: enc1Id,
        data: new Date("2026-02-15"),
        periodo: JSON.stringify({ inicio: "2026-02-08", fim: "2026-02-14" }),
        area: "Infraestrutura",
        tipoServico: "Escavação",
        comprimento: 25,
        largura: 18,
        areaCalculada: 450,
        itens: JSON.stringify([
          { descricao: "Escavação mecânica", unidade: "m³", quantidade: 270, valorUnitario: 35, valorTotal: 9450 },
          { descricao: "Transporte de terra", unidade: "m³", quantidade: 270, valorUnitario: 15, valorTotal: 4050 },
        ]),
        observacoes: "Escavação para fundação concluída.",
        status: "aprovada",
        aprovadoPor: supervisorId,
        dataAprovacao: new Date("2026-02-16"),
        sincronizado: true,
        syncId: `sync-med-005-${Date.now()}`,
        metadata: JSON.stringify({ createdAt: new Date("2026-02-15"), createdBy: enc1Id }),
        created_at: new Date("2026-02-15"),
      },
    ];

    let inseridas = 0;
    for (const med of medicoes) {
      const res = await knex("medicoes").insert(med).returning("id");
      const id = extractId(res);
      console.log(`  ✅  Medição inserida: id=${id}, obra=${med.obra}, status=${med.status}`);
      inseridas++;
    }

    console.log(`\n✅  Seed PostgreSQL concluído! ${inseridas} medições inseridas.`);
    console.log("\n📊  Credenciais de teste:");
    console.log("   admin@construcao.com     / admin123");
    console.log("   supervisor@construcao.com / supervisor123");
    console.log("   joao@construcao.com       / encarregado123");
    console.log("   pedro@construcao.com      / encarregado123");

    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error("❌  Erro no seed PostgreSQL:", err.message || err);
    console.error(err.stack);
    await knex.destroy();
    process.exit(1);
  }
}

seed();
