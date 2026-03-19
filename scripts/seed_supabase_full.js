/**
 * seed_supabase_full.js — Seed completo para Supabase / PostgreSQL
 *
 * Gera massa de dados realistas para testes de:
 *   paginação, filtros, aprovações, dashboard, relatórios e relacionamentos.
 *
 * Volume gerado:
 *   - 15 usuários  (2 admin · 4 supervisor · 9 encarregado)
 *   - 12 obras
 *   - 27 vínculos  obra ↔ encarregado
 *   - 36 arquivos (3 fotos reais por obra)
 *   - 80 medições  (rascunho · enviada · aprovada · rejeitada)
 *   - 50 diários de obra
 *   - 40 solicitações de compra
 *
 * Uso:
 *   node scripts/seed_supabase_full.js
 *   NODE_ENV=production node scripts/seed_supabase_full.js
 *
 * ⚠  Execute apenas uma vez por ambiente.
 *    Usuários e obras são idempotentes (upsert por e-mail / código).
 *    Arquivos, medições, diários e solicitações são inseridos sem deduplicação.
 *    Se precisar reexecutar do zero, truncate as tabelas primeiro.
 */

"use strict";

require("dotenv").config();
const knexfile = require("../knexfile.js");
const Knex     = require("knex");
const bcrypt   = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const knex = Knex(knexfile[process.env.NODE_ENV || "development"]);

/* ═══════════════════════════ HELPERS ════════════════════════════════════ */

/** Extrai o id inteiro do resultado de .returning('id') do Knex + PostgreSQL */
function extractId(res) {
  if (!res || !res[0]) throw new Error("Insert não retornou ID");
  const first = res[0];
  return typeof first === "object" ? first.id : first;
}

/** Upsert: insere somente se o campo único não existir. Retorna o id. */
async function upsertBy(table, field, value, data, label) {
  const existing = await knex(table).where({ [field]: value }).first();
  if (existing) {
    console.log(`  ↩  ${label} já existe (id=${existing.id})`);
    return existing.id;
  }
  const res = await knex(table).insert(data).returning("id");
  const id  = extractId(res);
  console.log(`  ✅  ${label} criado (id=${id})`);
  return id;
}

/**
 * Retorna uma Date determinística dentro de um intervalo, usando um índice
 * como semente para distribuir uniformemente sem usar Math.random().
 */
function seededDate(start, end, index, total) {
  const s   = new Date(start).getTime();
  const e   = new Date(end).getTime();
  const frac = total > 1 ? index / (total - 1) : 0.5;
  return new Date(s + frac * (e - s));
}

/** Calcula valorTotal de um array de itens de solicitação / medição. */
function somaItens(itens) {
  return itens.reduce((acc, it) => acc + it.quantidade * it.valorUnitario, 0);
}

/** Formata itens de medição adicionando valorTotal por linha. */
function itensMedicao(itens) {
  return itens.map(it => ({ ...it, valorTotal: it.quantidade * it.valorUnitario }));
}

/** Formata itens de solicitação adicionando valorTotal por linha. */
function itensSolicitacao(itens) {
  return itens.map(it => ({
    descricao:     it.descricao,
    unidade:       it.unidade,
    quantidade:    it.quantidade,
    valorUnitario: it.valorUnitario,
    valorTotal:    it.quantidade * it.valorUnitario,
  }));
}

const PHOTO_FIXTURE_NAMES = ["foto-obra.jpg", "foto-obra1.jpg", "foto-obra2.jpg"];
const PHOTO_FIXTURE_DIRS = [
  path.resolve(__dirname, "../imagens"),
  path.resolve(__dirname, "../../frontend/static"),
];

function resolvePhotoFixturePath(filename) {
  for (const dirPath of PHOTO_FIXTURE_DIRS) {
    const filePath = path.join(dirPath, filename);
    if (fs.existsSync(filePath)) return filePath;
  }

  throw new Error(
    `Fixture de foto não encontrado: ${filename} (diretórios verificados: ${PHOTO_FIXTURE_DIRS.join(", ")})`,
  );
}

async function loadPhotoFixtures() {
  const fixtures = [];

  for (const filename of PHOTO_FIXTURE_NAMES) {
    const filePath = resolvePhotoFixturePath(filename);
    const buffer = await fsp.readFile(filePath);
    const stat = await fsp.stat(filePath);

    fixtures.push({
      filename,
      filePath,
      buffer,
      size: stat.size,
      mimeType: "image/jpeg",
      extension: path.extname(filename) || ".jpg",
    });
  }

  return fixtures;
}

function createSeedStorageClient() {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "obras-arquivos";
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return { provider: "local", bucket, client: null };
  }

  return {
    provider: "supabase",
    bucket,
    client: createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function uploadFixtureToStorage(storage, fixture, storagePath) {
  if (storage.provider !== "supabase" || !storage.client) {
    return {
      provider: "local",
      storagePath,
      storageUrl: `/api/files/raw/${storagePath}`,
    };
  }

  const { error: uploadError } = await storage.client.storage
    .from(storage.bucket)
    .upload(storagePath, fixture.buffer, {
      contentType: fixture.mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Falha no upload do seed para Supabase: ${uploadError.message}`);
  }

  const { data: signed, error: signedError } = await storage.client.storage
    .from(storage.bucket)
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

  return {
    provider: "supabase",
    storagePath,
    storageUrl: signedError ? null : signed?.signedUrl || null,
  };
}

/* ═══════════════════════════ DADOS BASE ═════════════════════════════════ */

const AMBIENTES = [
  "fachada", "banheiro", "sala", "cobertura", "telhado",
  "garagem", "cozinha", "quarto", "corredor", "fundação",
  "estrutura", "estacionamento",
];

const TIPOS_SERVICO = [
  "alvenaria", "pintura", "revestimento", "instalacao_eletrica",
  "instalacao_hidraulica", "impermeabilizacao", "estrutura",
  "cobertura", "acabamento", "escavacao", "outros",
];

const CLIMAS = ["ensolarado", "nublado", "chuvoso", "ventania", "instavel"];

const PRIORIDADES = ["baixa", "media", "alta", "urgente"];

const MOTIVOS_REJEICAO = [
  "Documentação de rastreabilidade do material não anexada.",
  "Dimensões informadas divergem do projeto executivo.",
  "Período de execução não corresponde ao registrado em campo.",
  "Falta de nota fiscal ou comprovante de entrega.",
  "Quantitativo de material informado acima do medido no campo.",
  "Ausência de ART ou RRT do responsável técnico.",
  "Serviço executado fora do escopo contratual.",
];

const ATIVIDADES_POOL = [
  "Concretagem de laje",
  "Assentamento de piso cerâmico",
  "Reboco interno",
  "Instalação elétrica — quadro de distribuição",
  "Pintura de fachada",
  "Levantamento de alvenaria",
  "Instalação hidráulica — tubulação",
  "Impermeabilização de caixa d'água",
  "Colocação de telhas metálicas",
  "Acabamento de fachada — pastilha",
  "Concretagem de pilares e vigas",
  "Escavação de fundação",
  "Colocação de forma metálica",
  "Instalação de caixilhos e esquadrias",
  "Assentamento de bloco de concreto",
  "Revestimento cerâmico de banheiros",
  "Pintura interna — 1ª demão",
  "Instalação de calhas e rufos",
  "Terraplanagem e compactação",
  "Montagem de andaime tubular",
];

/* ═══════════════════════════ SEED PRINCIPAL ═════════════════════════════ */

async function seed() {
  try {
    console.log("\n🌱  Iniciando seed completo para Supabase...\n");
    const now = () => new Date().toISOString();

    /* ── 1. Hashes de senha ──────────────────────────────── */
    console.log("🔐  Gerando hashes de senha...");
    const [hAdmin, hSupervisor, hEncarregado] = await Promise.all([
      bcrypt.hash("Admin@2025",       12),
      bcrypt.hash("Supervisor@2025",  12),
      bcrypt.hash("Enc@2025",         12),
    ]);

    /* ── 2. Usuários (15) ────────────────────────────────── */
    console.log("\n👤  Criando usuários (15)...");

    const USERS = [
      // ── Admins (2)
      { nome: "Carlos Henrique",   email: "carlos.admin@obralink.com",    senha: hAdmin,        perfil: "admin"        },
      { nome: "Rafael Pinto",      email: "rafael.admin@obralink.com",    senha: hAdmin,        perfil: "admin"        },
      // ── Supervisores (4)
      { nome: "Maria Oliveira",    email: "maria.sup@obralink.com",       senha: hSupervisor,   perfil: "supervisor"   },
      { nome: "Fernanda Costa",    email: "fernanda.sup@obralink.com",    senha: hSupervisor,   perfil: "supervisor"   },
      { nome: "Ricardo Almeida",   email: "ricardo.sup@obralink.com",     senha: hSupervisor,   perfil: "supervisor"   },
      { nome: "Ana Paula Martins", email: "ana.sup@obralink.com",         senha: hSupervisor,   perfil: "supervisor"   },
      // ── Encarregados (9)
      { nome: "João Silva",        email: "joao.silva@obralink.com",      senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Pedro Santos",      email: "pedro.santos@obralink.com",    senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Lucas Costa",       email: "lucas.costa@obralink.com",     senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Bruno Ferreira",    email: "bruno.ferreira@obralink.com",  senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Marcos Alves",      email: "marcos.alves@obralink.com",    senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Roberto Lima",      email: "roberto.lima@obralink.com",    senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Tiago Rocha",       email: "tiago.rocha@obralink.com",     senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Fábio Mendes",      email: "fabio.mendes@obralink.com",    senha: hEncarregado,  perfil: "encarregado"  },
      { nome: "Sérgio Nunes",      email: "sergio.nunes@obralink.com",    senha: hEncarregado,  perfil: "encarregado"  },
    ];

    const userIds = [];
    for (const u of USERS) {
      const id = await upsertBy("users", "email", u.email, {
        nome:         u.nome,
        email:        u.email,
        senha:        u.senha,
        perfil:       u.perfil,
        isActive:     true,
        sincronizado: false,
        syncId:       uuidv4(),
        metadata:     JSON.stringify({ createdAt: now() }),
      }, `Usuário ${u.nome}`);
      userIds.push(id);
    }

    // Aliases semânticos (índices 0-14)
    const [
      adm1, adm2,
      sup1, sup2, sup3, sup4,
      enc1, enc2, enc3, enc4, enc5, enc6, enc7, enc8, enc9,
    ] = userIds;

    /* ── 3. Obras (12) ───────────────────────────────────── */
    console.log("\n🏗️   Criando obras (12)...");

    const OBRAS_DEF = [
      {
        codigo: "ESC-001", nome: "Escola Municipal Centro",
        descricao: "Construção de nova escola municipal com 12 salas de aula, quadra coberta e refeitório.",
        cliente: "Prefeitura Municipal de São Paulo",
        status: "em_andamento", dataInicio: "2025-01-15", dataPrevisaoTermino: "2026-06-30",
        orcamento: { valor: 4500000, valorGasto: 1200000 },
        endereco: { logradouro: "Rua da Educação", numero: "250", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01010-000" },
        responsavel: sup1,
      },
      {
        codigo: "RES-002", nome: "Residencial Jardim das Flores",
        descricao: "Edifício residencial de 8 pavimentos com 64 apartamentos, subsolo e garden.",
        cliente: "Incorporadora Flores S.A.",
        status: "em_andamento", dataInicio: "2025-02-01", dataPrevisaoTermino: "2026-12-31",
        orcamento: { valor: 9200000, valorGasto: 2800000 },
        endereco: { logradouro: "Av. das Acácias", numero: "1000", bairro: "Jardim Primavera", cidade: "Campinas", estado: "SP", cep: "13050-111" },
        responsavel: sup2,
      },
      {
        codigo: "IND-003", nome: "Galpão Industrial TechPark",
        descricao: "Galpão industrial de 5.000 m² com docas, mezanino e bloco administrativo.",
        cliente: "TechPark Logística S.A.",
        status: "em_andamento", dataInicio: "2025-03-01", dataPrevisaoTermino: "2026-02-28",
        orcamento: { valor: 3800000, valorGasto: 1600000 },
        endereco: { logradouro: "Av. Industrial", numero: "5000", bairro: "Distrito Industrial", cidade: "Sorocaba", estado: "SP", cep: "18110-000" },
        responsavel: sup1,
      },
      {
        codigo: "RES-004", nome: "Condomínio Vale Verde",
        descricao: "Condomínio horizontal com 48 unidades, clube, quadra poliesportiva e área verde.",
        cliente: "Vale Verde Empreendimentos",
        status: "em_andamento", dataInicio: "2025-04-01", dataPrevisaoTermino: "2027-03-31",
        orcamento: { valor: 12500000, valorGasto: 1800000 },
        endereco: { logradouro: "Estrada do Verde", numero: "km 5", bairro: "Vale Verde", cidade: "Jundiaí", estado: "SP", cep: "13210-000" },
        responsavel: sup3,
      },
      {
        codigo: "PUB-005", nome: "Hospital Municipal Norte",
        descricao: "Reforma e ampliação do hospital municipal: UTI, bloco cirúrgico e pronto-socorro.",
        cliente: "Prefeitura Municipal de São Paulo",
        status: "planejamento", dataInicio: "2025-09-01", dataPrevisaoTermino: "2027-08-31",
        orcamento: { valor: 18000000, valorGasto: 0 },
        endereco: { logradouro: "Av. Saúde", numero: "800", bairro: "Vila Norte", cidade: "São Paulo", estado: "SP", cep: "02200-000" },
        responsavel: sup2,
      },
      {
        codigo: "COM-006", nome: "Prédio Comercial Alfa",
        descricao: "Edifício comercial de 15 andares para locação, área total de 12.000 m².",
        cliente: "Alfa Investimentos Imobiliários",
        status: "em_andamento", dataInicio: "2025-01-01", dataPrevisaoTermino: "2026-09-30",
        orcamento: { valor: 22000000, valorGasto: 8500000 },
        endereco: { logradouro: "Av. Paulista", numero: "2200", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP", cep: "01310-100" },
        responsavel: sup4,
      },
      {
        codigo: "PUB-007", nome: "UBS Vila Nova",
        descricao: "Unidade Básica de Saúde com 6 consultórios, farmácia, laboratório e recepção.",
        cliente: "Prefeitura Municipal de Santo André",
        status: "concluida", dataInicio: "2024-05-01", dataPrevisaoTermino: "2025-04-30",
        dataTermino: "2025-03-28",
        orcamento: { valor: 2100000, valorGasto: 1980000 },
        endereco: { logradouro: "Rua da Saúde", numero: "123", bairro: "Vila Nova", cidade: "Santo André", estado: "SP", cep: "09050-000" },
        responsavel: sup1,
      },
      {
        codigo: "INF-008", nome: "Ponte Rua das Flores",
        descricao: "Ponte em concreto armado protendido sobre o córrego, extensão de 35 m.",
        cliente: "Prefeitura Municipal de São Bernardo",
        status: "em_andamento", dataInicio: "2025-06-01", dataPrevisaoTermino: "2025-12-31",
        orcamento: { valor: 1750000, valorGasto: 900000 },
        endereco: { logradouro: "Rua das Flores", numero: "s/n", bairro: "Jardim Esperança", cidade: "São Bernardo do Campo", estado: "SP", cep: "09700-000" },
        responsavel: sup3,
      },
      {
        codigo: "RES-009", nome: "Residencial Serra Norte",
        descricao: "Condomínio vertical com 2 torres de 12 andares, piscina, spa e academia.",
        cliente: "Construtora Serra Norte",
        status: "planejamento", dataInicio: "2025-11-01", dataPrevisaoTermino: "2027-10-31",
        orcamento: { valor: 16000000, valorGasto: 0 },
        endereco: { logradouro: "Rua das Serras", numero: "550", bairro: "Alto da Serra", cidade: "Mogi das Cruzes", estado: "SP", cep: "08780-000" },
        responsavel: sup4,
      },
      {
        codigo: "COM-010", nome: "Reforma Mercado Central",
        descricao: "Reforma completa do mercado central: fachada, cobertura, instalações e piso.",
        cliente: "Associação dos Comerciantes",
        status: "em_andamento", dataInicio: "2025-01-20", dataPrevisaoTermino: "2025-11-30",
        orcamento: { valor: 3200000, valorGasto: 2100000 },
        endereco: { logradouro: "Praça do Mercado", numero: "1", bairro: "Centro", cidade: "Guarulhos", estado: "SP", cep: "07010-000" },
        responsavel: sup2,
      },
      {
        codigo: "PUB-011", nome: "Creche Municipal Sul",
        descricao: "Creche para 200 crianças com fraldário, refeitório, parque infantil e berçário.",
        cliente: "Prefeitura Municipal de São Paulo",
        status: "concluida", dataInicio: "2024-03-01", dataPrevisaoTermino: "2025-02-28",
        dataTermino: "2025-01-15",
        orcamento: { valor: 1900000, valorGasto: 1870000 },
        endereco: { logradouro: "Rua das Crianças", numero: "400", bairro: "Jardim Sul", cidade: "São Paulo", estado: "SP", cep: "04350-000" },
        responsavel: sup3,
      },
      {
        codigo: "PUB-012", nome: "Centro Esportivo Municipal",
        descricao: "Centro esportivo com piscina olímpica, ginásio poliesportivo e 3 campos gramados.",
        cliente: "Prefeitura Municipal de São Paulo",
        status: "em_andamento", dataInicio: "2025-05-01", dataPrevisaoTermino: "2027-04-30",
        orcamento: { valor: 28000000, valorGasto: 3500000 },
        endereco: { logradouro: "Av. do Esporte", numero: "1000", bairro: "Vila Olímpica", cidade: "São Paulo", estado: "SP", cep: "04110-000" },
        responsavel: sup4,
      },
    ];

    const obraIds = [];
    for (const o of OBRAS_DEF) {
      const id = await upsertBy("obras", "codigo", o.codigo, {
        nome:                o.nome,
        codigo:              o.codigo,
        descricao:           o.descricao,
        cliente:             o.cliente,
        status:              o.status,
        dataInicio:          o.dataInicio,
        dataPrevisaoTermino: o.dataPrevisaoTermino,
        dataTermino:         o.dataTermino || null,
        endereco:            JSON.stringify(o.endereco),
        responsavel:         o.responsavel,
        equipe:              JSON.stringify([]),
        orcamento:           JSON.stringify(o.orcamento),
        syncId:              uuidv4(),
        metadata:            JSON.stringify({ createdAt: now(), createdBy: adm1 }),
      }, `Obra ${o.nome}`);
      obraIds.push(id);
    }

    /* ── 4. Vínculos obra ↔ encarregado (27) ─────────────── */
    console.log("\n🔗  Criando vínculos obra-encarregado (27)...");

    // [obraIndex, encUserId]
    const VINCULOS = [
      [0, enc1], [0, enc2],
      [1, enc3], [1, enc4], [1, enc5],
      [2, enc6], [2, enc7],
      [3, enc8], [3, enc9],
      [4, enc1], [4, enc3],
      [5, enc5], [5, enc6], [5, enc7],
      [6, enc2], [6, enc4],
      [7, enc8],
      [8, enc9], [8, enc1],
      [9, enc2], [9, enc3],
      [10, enc4], [10, enc5], [10, enc6],
      [11, enc7], [11, enc8], [11, enc9],
    ];

    for (const [obraIdx, userId] of VINCULOS) {
      const obraId = obraIds[obraIdx];
      const ex = await knex("obra_encarregados").where({ obraId, userId }).first();
      if (!ex) {
        await knex("obra_encarregados").insert({ obraId, userId, dataInclusao: new Date() });
        console.log(`  ✅  Vínculo obra[${obraIdx}] (${OBRAS_DEF[obraIdx].codigo}) ↔ user(${userId})`);
      } else {
        console.log(`  ↩  Vínculo já existe: obra[${obraIdx}] ↔ user(${userId})`);
      }
    }

    /* Atualizar obraAtual de cada encarregado para a 1ª obra vinculada */
    const obraAtualMap = {
      [enc1]: obraIds[0], [enc2]: obraIds[0],
      [enc3]: obraIds[1], [enc4]: obraIds[1], [enc5]: obraIds[1],
      [enc6]: obraIds[2], [enc7]: obraIds[2],
      [enc8]: obraIds[3], [enc9]: obraIds[3],
    };
    for (const [userId, obraId] of Object.entries(obraAtualMap)) {
      await knex("users").where({ id: Number(userId) }).update({ obraAtual: obraId });
    }

    /* ── 5. Mapa de acesso encarregado → obras permitidas ── */
    // Usado para garantir que cada medição/diário/solicitação respeita a RN-08
    const ENC_OBRAS = {
      [enc1]: [obraIds[0], obraIds[4], obraIds[8]],
      [enc2]: [obraIds[0], obraIds[6], obraIds[9]],
      [enc3]: [obraIds[1], obraIds[4], obraIds[9]],
      [enc4]: [obraIds[1], obraIds[6], obraIds[10]],
      [enc5]: [obraIds[1], obraIds[5], obraIds[10]],
      [enc6]: [obraIds[2], obraIds[5], obraIds[10]],
      [enc7]: [obraIds[2], obraIds[5], obraIds[11]],
      [enc8]: [obraIds[3], obraIds[7], obraIds[11]],
      [enc9]: [obraIds[3], obraIds[8], obraIds[11]],
    };

    /* ── 5.1 Arquivos/Fotos reais (36) ─────────────────── */
    console.log("\n🖼️   Criando arquivos com fotos reais (3 por obra)...");

    const storage = createSeedStorageClient();
    const photoFixtures = await loadPhotoFixtures();
    const fotosPorObra = new Map();

    for (let obraIdx = 0; obraIdx < obraIds.length; obraIdx++) {
      const obraId = obraIds[obraIdx];
      const vinculosDaObra = VINCULOS
        .filter(([idx]) => idx === obraIdx)
        .map(([, userId]) => userId);

      const fotoIds = [];

      for (let photoIndex = 0; photoIndex < photoFixtures.length; photoIndex++) {
        const fixture = photoFixtures[photoIndex];
        const uploaderId =
          vinculosDaObra[photoIndex % Math.max(vinculosDaObra.length, 1)] || enc1;

        const uniqueName = `${OBRAS_DEF[obraIdx].codigo.toLowerCase()}-${uuidv4()}${fixture.extension}`;
        const storagePath = `fotos/seed/${OBRAS_DEF[obraIdx].codigo.toLowerCase()}/${uniqueName}`;
        const uploaded = await uploadFixtureToStorage(storage, fixture, storagePath);

        const tipoArquivo =
          photoIndex === 0
            ? "foto_obra"
            : photoIndex === 1
              ? "relatorio"
              : "medicao";

        const inserted = await knex("arquivos")
          .insert({
            nome: uniqueName,
            nomeOriginal: fixture.filename,
            tipo: "fotos",
            tipoArquivo,
            mimeType: fixture.mimeType,
            tamanho: fixture.size,
            tamanhoOriginal: fixture.size,
            descricao: `Seed automático (${tipoArquivo}) — ${OBRAS_DEF[obraIdx].nome}`,
            obra: obraId,
            uploadedBy: uploaderId,
            comprimido: false,
            sincronizado: true,
            syncId: uuidv4(),
            storage_provider: uploaded.provider,
            storage_path: uploaded.storagePath,
            storage_url: uploaded.storageUrl,
            metadata: JSON.stringify({
              createdAt: now(),
              createdBy: uploaderId,
              source: "seed_supabase_full",
            }),
          })
          .returning("id");

        fotoIds.push(extractId(inserted));
      }

      fotosPorObra.set(obraId, fotoIds);
      console.log(`  ✅  Obra ${OBRAS_DEF[obraIdx].codigo}: ${fotoIds.length} fotos vinculadas`);
    }

    console.log(`  📦  Storage provider do seed: ${storage.provider} (bucket: ${storage.bucket})`);

    /* ── 6. Medições (80) ────────────────────────────────── */
    console.log("\n📐  Criando medições (80)...");

    /**
     * Definição das medições como tuplas compactas:
     *   [encId, obraIndex, area, tipoServico, comprimento, largura, altura|null,
     *    status, aprovadoPorId|null, motivoRejeicao|null, dateOffset(dias desde 2025-01-01)]
     *
     * altura == null  → só areaCalculada; altura > 0 → também volume
     * aprovadoPorId é obrigatório para status 'aprovada' / 'rejeitada'.
     */
    const MED_DEFS = [
      // ─── Escola Municipal Centro (obra 0) — enc1 e enc2 ──────────────────
      [enc1, 0, "fundação",   "estrutura",          20, 15, 0.4,  "aprovada",  sup1, null, 5],
      [enc1, 0, "alvenaria",  "alvenaria",          20, 8,  null, "aprovada",  sup1, null, 20],
      [enc1, 0, "cobertura",  "cobertura",          25, 18, null, "enviada",   null, null, 60],
      [enc1, 0, "fachada",    "pintura",            30, 6,  null, "rascunho",  null, null, 90],
      [enc2, 0, "banheiro",   "revestimento",       4,  3,  null, "aprovada",  sup2, null, 15],
      [enc2, 0, "sala",       "acabamento",         12, 8,  null, "aprovada",  sup2, null, 40],
      [enc2, 0, "telhado",    "impermeabilizacao",  25, 18, null, "rejeitada", sup1, MOTIVOS_REJEICAO[0], 55],
      [enc2, 0, "garagem",    "revestimento",       18, 10, null, "enviada",   null, null, 80],

      // ─── Residencial Jardim das Flores (obra 1) — enc3, enc4, enc5 ───────
      [enc3, 1, "fundação",   "escavacao",          30, 20, 1.2,  "aprovada",  sup2, null, 10],
      [enc3, 1, "estrutura",  "estrutura",          30, 20, 0.5,  "aprovada",  sup2, null, 35],
      [enc3, 1, "alvenaria",  "alvenaria",          15, 8,  null, "enviada",   null, null, 75],
      [enc4, 1, "banheiro",   "instalacao_hidraulica", 4, 3, null,"aprovada",  sup3, null, 25],
      [enc4, 1, "cozinha",    "revestimento",       4,  4,  null, "aprovada",  sup3, null, 50],
      [enc4, 1, "quarto",     "pintura",            4,  4,  null, "rejeitada", sup2, MOTIVOS_REJEICAO[1], 65],
      [enc4, 1, "sala",       "acabamento",         6,  5,  null, "rascunho",  null, null, 85],
      [enc5, 1, "cobertura",  "cobertura",          30, 20, null, "aprovada",  sup4, null, 30],
      [enc5, 1, "fachada",    "pintura",            40, 4,  null, "enviada",   null, null, 70],
      [enc5, 1, "telhado",    "impermeabilizacao",  30, 20, null, "rascunho",  null, null, 100],

      // ─── Galpão Industrial TechPark (obra 2) — enc6, enc7 ────────────────
      [enc6, 2, "fundação",   "escavacao",          50, 30, 1.5,  "aprovada",  sup1, null, 8],
      [enc6, 2, "estrutura",  "estrutura",          50, 30, 0.6,  "aprovada",  sup1, null, 28],
      [enc6, 2, "cobertura",  "cobertura",          50, 30, null, "aprovada",  sup1, null, 55],
      [enc6, 2, "fachada",    "pintura",            60, 12, null, "rejeitada", sup1, MOTIVOS_REJEICAO[2], 78],
      [enc7, 2, "garagem",    "revestimento",       50, 30, null, "aprovada",  sup2, null, 45],
      [enc7, 2, "cobertura",  "impermeabilizacao",  50, 30, null, "enviada",   null, null, 85],
      [enc7, 2, "telhado",    "cobertura",          50, 30, null, "rascunho",  null, null, 110],

      // ─── Condomínio Vale Verde (obra 3) — enc8, enc9 ─────────────────────
      [enc8, 3, "fundação",   "escavacao",          15, 12, 1.0,  "aprovada",  sup3, null, 12],
      [enc8, 3, "alvenaria",  "alvenaria",          10, 8,  null, "aprovada",  sup3, null, 35],
      [enc8, 3, "cobertura",  "cobertura",          12, 10, null, "enviada",   null, null, 72],
      [enc9, 3, "banheiro",   "instalacao_hidraulica", 3, 3, null,"aprovada",  sup4, null, 22],
      [enc9, 3, "garagem",    "revestimento",       8,  6,  null, "aprovada",  sup4, null, 48],
      [enc9, 3, "fachada",    "pintura",            12, 5,  null, "rejeitada", sup3, MOTIVOS_REJEICAO[3], 62],
      [enc9, 3, "telhado",    "impermeabilizacao",  12, 10, null, "rascunho",  null, null, 90],

      // ─── Hospital Municipal Norte (obra 4) — enc1, enc3 ──────────────────
      [enc1, 4, "fundação",   "escavacao",          40, 30, 2.0,  "aprovada",  sup1, null, 15],
      [enc1, 4, "estrutura",  "estrutura",          40, 30, 0.5,  "aprovada",  sup2, null, 50],
      [enc1, 4, "alvenaria",  "alvenaria",          20, 10, null, "enviada",   null, null, 95],
      [enc3, 4, "cobertura",  "cobertura",          40, 30, null, "rascunho",  null, null, 110],
      [enc3, 4, "fachada",    "pintura",            50, 6,  null, "enviada",   null, null, 75],
      [enc3, 4, "banheiro",   "instalacao_hidraulica", 4, 3, null,"rejeitada", sup1, MOTIVOS_REJEICAO[4], 40],

      // ─── Prédio Comercial Alfa (obra 5) — enc5, enc6, enc7 ───────────────
      [enc5, 5, "fundação",   "escavacao",          25, 20, 3.0,  "aprovada",  sup4, null, 5],
      [enc5, 5, "estrutura",  "estrutura",          25, 20, 0.6,  "aprovada",  sup4, null, 30],
      [enc5, 5, "alvenaria",  "alvenaria",          12, 8,  null, "aprovada",  sup4, null, 60],
      [enc6, 5, "cobertura",  "impermeabilizacao",  25, 20, null, "aprovada",  sup1, null, 45],
      [enc6, 5, "fachada",    "pintura",            30, 15, null, "enviada",   null, null, 85],
      [enc7, 5, "estacionamento", "revestimento",   25, 20, null, "aprovada",  sup2, null, 55],
      [enc7, 5, "corredor",   "acabamento",         30, 2,  null, "enviada",   null, null, 90],
      [enc7, 5, "sala",       "instalacao_eletrica",10, 8,  null, "rascunho",  null, null, 105],

      // ─── UBS Vila Nova (obra 6, concluída) — enc2, enc4 ──────────────────
      [enc2, 6, "fundação",   "estrutura",          12, 10, 0.4,  "aprovada",  sup1, null, 3],
      [enc2, 6, "alvenaria",  "alvenaria",          12, 10, null, "aprovada",  sup1, null, 25],
      [enc2, 6, "fachada",    "pintura",            14, 4,  null, "aprovada",  sup1, null, 50],
      [enc4, 6, "banheiro",   "revestimento",       3,  2,  null, "aprovada",  sup3, null, 35],
      [enc4, 6, "cobertura",  "impermeabilizacao",  12, 10, null, "aprovada",  sup3, null, 55],

      // ─── Ponte Rua das Flores (obra 7) — enc8 ───────────────────────────
      [enc8, 7, "fundação",   "escavacao",          35, 8,  2.5,  "aprovada",  sup3, null, 5],
      [enc8, 7, "estrutura",  "estrutura",          35, 8,  0.8,  "aprovada",  sup3, null, 30],
      [enc8, 7, "cobertura",  "impermeabilizacao",  35, 8,  null, "rejeitada", sup3, MOTIVOS_REJEICAO[5], 55],
      [enc8, 7, "fachada",    "pintura",            70, 3,  null, "enviada",   null, null, 80],
      [enc8, 7, "garagem",    "acabamento",         35, 6,  null, "rascunho",  null, null, 100],

      // ─── Residencial Serra Norte (obra 8) — enc9, enc1 ───────────────────
      [enc9, 8, "fundação",   "escavacao",          20, 15, 1.8,  "aprovada",  sup4, null, 10],
      [enc9, 8, "estrutura",  "estrutura",          20, 15, 0.5,  "enviada",   null, null, 45],
      [enc1, 8, "alvenaria",  "alvenaria",          10, 8,  null, "rascunho",  null, null, 80],
      [enc1, 8, "cobertura",  "cobertura",          20, 15, null, "enviada",   null, null, 60],

      // ─── Reforma Mercado Central (obra 9) — enc2, enc3 ───────────────────
      [enc2, 9, "fachada",    "pintura",            60, 6,  null, "aprovada",  sup2, null, 10],
      [enc2, 9, "cobertura",  "cobertura",          40, 20, null, "aprovada",  sup2, null, 30],
      [enc2, 9, "telhado",    "impermeabilizacao",  40, 20, null, "rejeitada", sup2, MOTIVOS_REJEICAO[6], 55],
      [enc3, 9, "piso",       "revestimento",       40, 20, null, "aprovada",  sup1, null, 20],
      [enc3, 9, "instalação", "instalacao_eletrica",40, 20, null, "enviada",   null, null, 65],
      [enc3, 9, "fachada",    "acabamento",         60, 6,  null, "rascunho",  null, null, 85],

      // ─── Creche Municipal Sul (obra 10, concluída) — enc4, enc5, enc6 ────
      [enc4, 10, "fundação",  "estrutura",          15, 12, 0.4,  "aprovada",  sup3, null, 3],
      [enc4, 10, "alvenaria", "alvenaria",          10, 8,  null, "aprovada",  sup3, null, 20],
      [enc5, 10, "fachada",   "pintura",            18, 4,  null, "aprovada",  sup4, null, 35],
      [enc5, 10, "cobertura", "impermeabilizacao",  15, 12, null, "aprovada",  sup4, null, 50],
      [enc6, 10, "banheiro",  "revestimento",       4,  3,  null, "aprovada",  sup1, null, 40],
      [enc6, 10, "telhado",   "cobertura",          15, 12, null, "aprovada",  sup1, null, 60],

      // ─── Centro Esportivo Municipal (obra 11) — enc7, enc8, enc9 ─────────
      [enc7, 11, "fundação",  "escavacao",          60, 40, 2.0,  "aprovada",  sup4, null, 8],
      [enc7, 11, "estrutura", "estrutura",          60, 40, 0.6,  "aprovada",  sup4, null, 35],
      [enc7, 11, "cobertura", "cobertura",          60, 40, null, "enviada",   null, null, 80],
      [enc8, 11, "piscina",   "impermeabilizacao",  50, 25, null, "aprovada",  sup3, null, 50],
      [enc8, 11, "garagem",   "revestimento",       60, 20, null, "enviada",   null, null, 90],
      [enc9, 11, "fachada",   "pintura",            80, 10, null, "aprovada",  sup2, null, 60],
      [enc9, 11, "ginásio",   "acabamento",         60, 40, null, "enviada",   null, null, 100],
      [enc9, 11, "corredor",  "revestimento",       200,3,  null, "rascunho",  null, null, 115],
    ];

    console.log(`  → Inserindo ${MED_DEFS.length} medições...`);
    const MEDICOES_TOTAL = MED_DEFS.length;

    for (let i = 0; i < MEDICOES_TOTAL; i++) {
      const [encId, obraIdx, area, tipoServico, comp, larg, alt,
             status, aprovadoPorId, motivoRej, offsetDias] = MED_DEFS[i];

      const obraId = obraIds[obraIdx];
      const baseDate = new Date("2025-01-01");
      baseDate.setDate(baseDate.getDate() + offsetDias);
      const dataReg  = new Date(baseDate);

      const areaCalculada = comp * larg;
      const volume        = alt != null ? comp * larg * alt : null;

      const itensRaw = gerarItensMedicao(area, tipoServico, areaCalculada, volume);
      const itens    = itensMedicao(itensRaw);
      const anexosDaObra = fotosPorObra.get(obraId) || [];
      const anexosMedicao = anexosDaObra.length > 0
        ? [
            anexosDaObra[i % anexosDaObra.length],
            anexosDaObra[(i + 1) % anexosDaObra.length],
          ].filter((id, idx, arr) => id && arr.indexOf(id) === idx)
        : [];

      const dataAprovacao = (status === "aprovada" || status === "rejeitada")
        ? new Date(dataReg.getTime() + 3 * 24 * 60 * 60 * 1000)
        : null;

      await knex("medicoes").insert({
        obra:            obraId,
        responsavel:     encId,
        data:            dataReg,
        periodo:         JSON.stringify({
          inicio: new Date(dataReg.getTime() - 15 * 864e5).toISOString().slice(0, 10),
          fim:    dataReg.toISOString().slice(0, 10),
        }),
        area,
        tipoServico,
        comprimento:     comp,
        largura:         larg,
        altura:          alt,
        areaCalculada,
        volume,
        itens:           JSON.stringify(itens),
        anexos:          JSON.stringify(anexosMedicao),
        observacoes:     gerarObservacaoMedicao(area, tipoServico),
        status,
        aprovadoPor:     aprovadoPorId || null,
        dataAprovacao,
        motivoRejeicao:  motivoRej || null,
        sincronizado:    status === "aprovada",
        syncId:          uuidv4(),
        clientTimestamp: dataReg,
        metadata:        JSON.stringify({ createdAt: dataReg.toISOString(), createdBy: encId }),
        created_at:      dataReg,
        updated_at:      dataAprovacao || dataReg,
      });
    }
    console.log(`  ✅  ${MEDICOES_TOTAL} medições inseridas`);

    /* ── 7. Diários de obra (50) ─────────────────────────── */
    console.log("\n📋  Criando diários de obra (50)...");

    /**
     * Diários: [encId, obraIndex, climaIndex, atividadesIndices[], offsetDias]
     */
    const DIARIO_DEFS = [
      // Escola Municipal Centro (obra 0)
      [enc1, 0, 0, [0, 1, 5],      3],
      [enc1, 0, 1, [2, 6],         18],
      [enc1, 0, 2, [0, 13],        35],
      [enc2, 0, 0, [4, 14],        10],
      [enc2, 0, 3, [1, 7, 15],     45],

      // Residencial Jardim das Flores (obra 1)
      [enc3, 1, 0, [0, 2, 5],      8],
      [enc3, 1, 1, [8, 12],        28],
      [enc4, 1, 0, [3, 9, 16],     15],
      [enc4, 1, 4, [4, 10],        40],
      [enc5, 1, 2, [6, 11, 17],    55],

      // Galpão Industrial TechPark (obra 2)
      [enc6, 2, 0, [0, 1, 12],     5],
      [enc6, 2, 1, [2, 8, 13],     22],
      [enc7, 2, 0, [3, 9, 14],     38],
      [enc7, 2, 4, [5, 15],        60],

      // Condomínio Vale Verde (obra 3)
      [enc8, 3, 0, [0, 5, 16],     10],
      [enc8, 3, 2, [1, 7],         30],
      [enc9, 3, 0, [4, 11, 17],    18],
      [enc9, 3, 1, [6, 13],        48],

      // Hospital Municipal Norte (obra 4)
      [enc1, 4, 0, [0, 12, 18],    15],
      [enc3, 4, 3, [2, 8, 19],     42],
      [enc3, 4, 1, [5, 10],        70],

      // Prédio Comercial Alfa (obra 5)
      [enc5, 5, 0, [0, 1, 3],      3],
      [enc5, 5, 1, [4, 8, 14],     25],
      [enc6, 5, 0, [6, 12, 17],    40],
      [enc7, 5, 2, [2, 9, 15],     58],
      [enc7, 5, 0, [7, 13, 18],    75],

      // UBS Vila Nova (obra 6, concluída)
      [enc2, 6, 0, [0, 4, 14],     5],
      [enc2, 6, 1, [1, 9, 16],     20],
      [enc4, 6, 0, [3, 7, 17],     35],
      [enc4, 6, 4, [5, 11],        48],

      // Ponte Rua das Flores (obra 7)
      [enc8, 7, 0, [0, 8, 19],     4],
      [enc8, 7, 3, [2, 10, 13],    28],
      [enc8, 7, 1, [6, 12],        52],

      // Residencial Serra Norte (obra 8)
      [enc9, 8, 0, [0, 1, 11],     8],
      [enc1, 8, 2, [3, 9, 18],     35],
      [enc1, 8, 0, [5, 14],        60],

      // Reforma Mercado Central (obra 9)
      [enc2, 9, 0, [4, 8, 16],     6],
      [enc2, 9, 1, [2, 10, 17],    22],
      [enc3, 9, 0, [1, 7, 15],     38],
      [enc3, 9, 4, [0, 13, 19],    54],

      // Creche Municipal Sul (obra 10, concluída)
      [enc4, 10, 0, [0, 6, 14],    4],
      [enc5, 10, 1, [3, 9, 18],    18],
      [enc6, 10, 0, [5, 11, 16],   32],
      [enc6, 10, 2, [1, 8, 17],    48],

      // Centro Esportivo Municipal (obra 11)
      [enc7, 11, 0, [0, 2, 12],    6],
      [enc7, 11, 1, [4, 10, 19],   28],
      [enc8, 11, 0, [1, 7, 15],    44],
      [enc8, 11, 3, [3, 9, 18],    62],
      [enc9, 11, 0, [5, 13, 17],   80],
      [enc9, 11, 4, [6, 11, 16],   95],
    ];

    console.log(`  → Inserindo ${DIARIO_DEFS.length} diários...`);
    for (let diarioIndex = 0; diarioIndex < DIARIO_DEFS.length; diarioIndex++) {
      const [encId, obraIdx, climaIdx, ativIndices, offsetDias] = DIARIO_DEFS[diarioIndex];
      const obraId   = obraIds[obraIdx];
      const dataReg  = new Date("2025-01-01");
      dataReg.setDate(dataReg.getDate() + offsetDias);
      const clima    = CLIMAS[climaIdx];
      const atividades = ativIndices.map(i => ATIVIDADES_POOL[i % ATIVIDADES_POOL.length]);
      const fotosDaObra = fotosPorObra.get(obraId) || [];
      const fotosDiario = fotosDaObra.length > 0
        ? [
            fotosDaObra[diarioIndex % fotosDaObra.length],
            fotosDaObra[(diarioIndex + 2) % fotosDaObra.length],
          ].filter((id, idx, arr) => id && arr.indexOf(id) === idx)
        : [];

      await knex("diarios").insert({
        obra:             obraId,
        responsavel:      encId,
        data:             dataReg,
        clima,
        atividades:       JSON.stringify(atividades.map(descricao => ({ descricao, concluida: true }))),
        equipamentos:     JSON.stringify(gerarEquipamentos(null)),
        maoDeObra:        JSON.stringify(gerarMaoDeObra()),
        materiais:        JSON.stringify(gerarMateriais(atividades[0])),
        ocorrencias:      gerarOcorrencias(climaIdx),
        fotos:            JSON.stringify(fotosDiario),
        observacoesGerais: gerarObsGeral(),
        sincronizado:     true,
        syncId:           uuidv4(),
        clientTimestamp:  dataReg,
        metadata:         JSON.stringify({ createdAt: dataReg.toISOString(), createdBy: encId }),
        created_at:       dataReg,
        updated_at:       dataReg,
      });
    }
    console.log(`  ✅  ${DIARIO_DEFS.length} diários inseridos`);

    /* ── 8. Solicitações de compra (40) ──────────────────── */
    console.log("\n🛒  Criando solicitações de compra (40)...");

    /**
     * [encId, obraIndex, prioridadeIndex, status,
     *  aprovadoPorId|null, motivoRejeicao|null, offsetDias]
     */
    const SOL_DEFS = [
      // Obra 0
      [enc1, 0, 2, "aprovada",   sup1, null, 4],
      [enc1, 0, 3, "aprovada",   sup1, null, 22],
      [enc2, 0, 1, "pendente",   null, null, 70],
      [enc2, 0, 2, "rejeitada",  sup2, "Quantidade solicitada excede estoque mínimo de segurança.", 50],

      // Obra 1
      [enc3, 1, 1, "aprovada",   sup2, null, 8],
      [enc3, 1, 3, "aprovada",   sup2, null, 30],
      [enc4, 1, 0, "pendente",   null, null, 72],
      [enc4, 1, 2, "aprovada",   sup3, null, 45],
      [enc5, 1, 1, "rejeitada",  sup4, "Fornecedor não está na lista aprovada de parceiros.", 60],
      [enc5, 1, 3, "pendente",   null, null, 85],

      // Obra 2
      [enc6, 2, 2, "aprovada",   sup1, null, 6],
      [enc6, 2, 3, "aprovada",   sup1, null, 25],
      [enc7, 2, 1, "pendente",   null, null, 68],
      [enc7, 2, 0, "aprovada",   sup2, null, 40],

      // Obra 3
      [enc8, 3, 2, "aprovada",   sup3, null, 10],
      [enc8, 3, 1, "pendente",   null, null, 55],
      [enc9, 3, 3, "aprovada",   sup4, null, 20],
      [enc9, 3, 0, "rejeitada",  sup3, "Especificação técnica incompleta. Revisar memorial descritivo.", 45],

      // Obra 4
      [enc1, 4, 3, "aprovada",   sup1, null, 15],
      [enc3, 4, 2, "pendente",   null, null, 60],

      // Obra 5
      [enc5, 5, 3, "aprovada",   sup4, null, 4],
      [enc6, 5, 2, "aprovada",   sup4, null, 28],
      [enc7, 5, 1, "pendente",   null, null, 78],
      [enc7, 5, 0, "aprovada",   sup2, null, 50],

      // Obra 6 (concluída)
      [enc2, 6, 2, "aprovada",   sup1, null, 3],
      [enc4, 6, 1, "aprovada",   sup3, null, 22],

      // Obra 7
      [enc8, 7, 3, "aprovada",   sup3, null, 5],
      [enc8, 7, 2, "rejeitada",  sup3, "Valor unitário acima do teto da tabela de referência SINAPI.", 35],

      // Obra 8
      [enc9, 8, 1, "pendente",   null, null, 40],
      [enc1, 8, 2, "aprovada",   sup4, null, 15],

      // Obra 9
      [enc2, 9, 1, "aprovada",   sup2, null, 7],
      [enc3, 9, 3, "aprovada",   sup2, null, 28],
      [enc3, 9, 0, "pendente",   null, null, 65],

      // Obra 10 (concluída)
      [enc4, 10, 2, "aprovada",  sup3, null, 5],
      [enc5, 10, 1, "aprovada",  sup4, null, 20],
      [enc6, 10, 0, "aprovada",  sup1, null, 38],

      // Obra 11
      [enc7, 11, 3, "aprovada",  sup4, null, 8],
      [enc8, 11, 2, "pendente",  null, null, 55],
      [enc9, 11, 1, "aprovada",  sup2, null, 30],
      [enc9, 11, 3, "rejeitada", sup2, "Marca especificada descontinuada — substituir por similar aprovado.", 50],
    ];

    console.log(`  → Inserindo ${SOL_DEFS.length} solicitações...`);
    for (const [encId, obraIdx, prioIdx, status, aprovadoPorId, motivoRej, offsetDias] of SOL_DEFS) {
      const obraId = obraIds[obraIdx];
      const dataReg = new Date("2025-01-01");
      dataReg.setDate(dataReg.getDate() + offsetDias);
      const dataNecessidade = new Date(dataReg.getTime() + 7 * 864e5);

      const itensRaw   = gerarItensSolicitacao(PRIORIDADES[prioIdx]);
      const itens      = itensSolicitacao(itensRaw);
      const valorTotal = itens.reduce((acc, it) => acc + it.valorTotal, 0);

      const dataAprovacao = (status === "aprovada" || status === "rejeitada")
        ? new Date(dataReg.getTime() + 2 * 864e5)
        : null;

      await knex("solicitacoes_compra").insert({
        obra:             obraId,
        solicitante:      encId,
        dataSolicitacao:  dataReg,
        dataNecessidade,
        prioridade:       PRIORIDADES[prioIdx],
        itens:            JSON.stringify(itens),
        justificativa:    gerarJustificativa(PRIORIDADES[prioIdx]),
        observacoes:      null,
        status,
        aprovadoPor:      aprovadoPorId || null,
        dataAprovacao,
        motivoRejeicao:   motivoRej || null,
        valorTotal,
        sincronizado:     status !== "pendente",
        syncId:           uuidv4(),
        clientTimestamp:  dataReg,
        metadata:         JSON.stringify({ createdAt: dataReg.toISOString(), createdBy: encId }),
        created_at:       dataReg,
        updated_at:       dataAprovacao || dataReg,
      });
    }
    console.log(`  ✅  ${SOL_DEFS.length} solicitações inseridas`);

    /* ── Resumo final ────────────────────────────────────── */
    const [totalUsers]  = await knex("users").count("id as c");
    const [totalObras]  = await knex("obras").count("id as c");
    const [totalVinc]   = await knex("obra_encarregados").count("id as c");
    const [totalArq]    = await knex("arquivos").count("id as c");
    const [totalMed]    = await knex("medicoes").count("id as c");
    const [totalDiar]   = await knex("diarios").count("id as c");
    const [totalSol]    = await knex("solicitacoes_compra").count("id as c");

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅  Seed concluído com sucesso!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  👤 Usuários:            ${totalUsers.c}`);
    console.log(`  🏗️  Obras:               ${totalObras.c}`);
    console.log(`  🔗 Vínculos:            ${totalVinc.c}`);
    console.log(`  🖼️  Arquivos/Fotos:      ${totalArq.c}`);
    console.log(`  📐 Medições:            ${totalMed.c}`);
    console.log(`  📋 Diários:             ${totalDiar.c}`);
    console.log(`  🛒 Solicitações:        ${totalSol.c}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n🔑  Credenciais de acesso:");
    console.log("     Admin:        carlos.admin@obralink.com  / Admin@2025");
    console.log("     Supervisor:   maria.sup@obralink.com     / Supervisor@2025");
    console.log("     Encarregado:  joao.silva@obralink.com    / Enc@2025");
    console.log("");

  } catch (err) {
    console.error("\n❌  Erro durante o seed:", err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await knex.destroy();
  }
}

/* ═══════════════════════ FUNÇÕES GERADORAS DE CONTEÚDO ══════════════════ */

/** Gera itens de medição coerentes com área/tipo de serviço informado. */
function gerarItensMedicao(area, tipoServico, areaCalc, volume) {
  const m2 = areaCalc ? parseFloat(areaCalc.toFixed(2)) : 1;
  const m3 = volume   ? parseFloat(volume.toFixed(2))   : null;

  const TABELAS = {
    pintura:              [{ descricao: "Tinta acrílica premium",     unidade: "l",  quantidade: m2 * 0.3,  valorUnitario: 28  },
                           { descricao: "Selador acrílico",           unidade: "l",  quantidade: m2 * 0.15, valorUnitario: 18  }],
    revestimento:         [{ descricao: "Cerâmica 60×60 cm",          unidade: "m²", quantidade: m2,        valorUnitario: 65  },
                           { descricao: "Argamassa colante AC-III",   unidade: "kg", quantidade: m2 * 5.5,  valorUnitario: 1.8 },
                           { descricao: "Rejunte epóxi",              unidade: "kg", quantidade: m2 * 0.6,  valorUnitario: 22  }],
    alvenaria:            [{ descricao: "Bloco cerâmico 9×19×19 cm",  unidade: "un", quantidade: m2 * 25,   valorUnitario: 1.2 },
                           { descricao: "Argamassa de assentamento",  unidade: "m³", quantidade: m2 * 0.02, valorUnitario: 320 }],
    impermeabilizacao:    [{ descricao: "Manta EPDM 4 mm",            unidade: "m²", quantidade: m2,        valorUnitario: 48  },
                           { descricao: "Primer asfáltico",           unidade: "l",  quantidade: m2 * 0.3,  valorUnitario: 14  }],
    instalacao_eletrica:  [{ descricao: "Cabo flexível 2,5 mm²",      unidade: "m",  quantidade: m2 * 2,    valorUnitario: 4.5 },
                           { descricao: "Eletroduto corrugado 3/4\"", unidade: "m",  quantidade: m2 * 1.2,  valorUnitario: 3.2 },
                           { descricao: "Disjuntor 20A",              unidade: "un", quantidade: Math.ceil(m2 / 20), valorUnitario: 35 }],
    instalacao_hidraulica:[{ descricao: "Tubo PVC 50 mm",             unidade: "m",  quantidade: m2 * 0.8,  valorUnitario: 12  },
                           { descricao: "Tubo PVC 100 mm",            unidade: "m",  quantidade: m2 * 0.4,  valorUnitario: 22  },
                           { descricao: "Conexões e acessórios",      unidade: "un", quantidade: Math.ceil(m2 / 5), valorUnitario: 18  }],
    estrutura:            m3
      ? [{ descricao: "Concreto fck 30 MPa",                          unidade: "m³", quantidade: m3,        valorUnitario: 520 },
         { descricao: "Aço CA-50 12,5 mm",                            unidade: "kg", quantidade: m3 * 90,   valorUnitario: 9.5 },
         { descricao: "Forma metálica",                               unidade: "m²", quantidade: m2 * 0.8,  valorUnitario: 35  }]
      : [{ descricao: "Concreto fck 30 MPa",                          unidade: "m³", quantidade: m2 * 0.2,  valorUnitario: 520 },
         { descricao: "Aço CA-50 12,5 mm",                            unidade: "kg", quantidade: m2 * 18,   valorUnitario: 9.5 }],
    cobertura:            [{ descricao: "Telha termoacústica 0,5 mm", unidade: "m²", quantidade: m2,        valorUnitario: 95  },
                           { descricao: "Perfil C 100×50×17",         unidade: "m",  quantidade: m2 * 0.6,  valorUnitario: 28  }],
    escavacao:            m3
      ? [{ descricao: "Escavação mecanizada",                         unidade: "m³", quantidade: m3,        valorUnitario: 85  },
         { descricao: "Reaterro compactado",                          unidade: "m³", quantidade: m3 * 0.6,  valorUnitario: 55  }]
      : [{ descricao: "Escavação mecanizada",                         unidade: "m³", quantidade: m2 * 0.3,  valorUnitario: 85  }],
    acabamento:           [{ descricao: "Gesso em pó",                unidade: "kg", quantidade: m2 * 1.2,  valorUnitario: 3.5 },
                           { descricao: "Massa corrida PVA",          unidade: "l",  quantidade: m2 * 0.4,  valorUnitario: 22  }],
    outros:               [{ descricao: "Material diverso",           unidade: "un", quantidade: 10,        valorUnitario: 150 }],
  };

  const template = TABELAS[tipoServico] || TABELAS["outros"];
  return template.map(it => ({
    ...it,
    quantidade:    parseFloat(Math.max(it.quantidade, 0.1).toFixed(2)),
    local:         area,
  }));
}

/** Gera observação coerente para uma medição com base na área e serviço. */
function gerarObservacaoMedicao(area, tipoServico) {
  const obs = {
    pintura:              `Pintura aplicada em ${area}. Superfície preparada com verniz selador. Aguardar 24h para segunda demão.`,
    revestimento:         `Revestimento cerâmico em ${area} assentado com argamassa AC-III. Rejuntamento realizado após 48h.`,
    alvenaria:            `Alvenaria de ${area} levantada com bloco cerâmico. Prumo e nível verificados a cada fiada.`,
    impermeabilizacao:    `Impermeabilização de ${area} realizada com manta EPDM. Teste de estanqueidade por 72h.`,
    instalacao_eletrica:  `Instalação elétrica em ${area} conforme projeto. Eletrodutos fixados antes do reboco.`,
    instalacao_hidraulica:`Instalação hidráulica em ${area} em conformidade com ABNT NBR 5626. Teste de pressão realizado.`,
    estrutura:            `Estrutura de concreto de ${area} concretada conforme projeto executivo. Cura realizada por 7 dias.`,
    cobertura:            `Cobertura de ${area} montada com perfis metálicos e telha termoacústica. Calhas e rufos instalados.`,
    escavacao:            `Escavação de ${area} realizada com retroescavadeira. Cota de arrasamento atingida conforme projeto.`,
    acabamento:           `Acabamento de ${area} com massa corrida e gesso. Superfície lixada e pronta para pintura.`,
    outros:               `Serviço executado em ${area} conforme especificação técnica do projeto.`,
  };
  return obs[tipoServico] || obs["outros"];
}

/** Gera lista de equipamentos para o diário. */
function gerarEquipamentos(tipoServico) {
  const eq = {
    estrutura:   ["Betoneira 400L", "Vibrador de imersão", "Andaime tubular 6 m"],
    pintura:     ["Compressor de ar 10 HP", "Pistola de pintura", "Rolo texturizador"],
    revestimento:["Cortadora de piso", "Nível a laser", "Betoneira 400L"],
    cobertura:   ["Guindaste 5t", "Andaime fachadeiro", "Parafusadeira elétrica"],
    default:     ["Compactador de placa", "Esmerilhadeira angular", "Furadeira de impacto"],
  };
  return (eq[tipoServico] || eq["default"]).map(nome => ({ nome, qtd: 1, horimetro: "---" }));
}

/** Gera composição de mão de obra do diário. */
function gerarMaoDeObra() {
  return [
    { funcao: "Pedreiro",        quantidade: 3, horasTrabalhadas: 8 },
    { funcao: "Servente",        quantidade: 4, horasTrabalhadas: 8 },
    { funcao: "Encarregado",     quantidade: 1, horasTrabalhadas: 8 },
    { funcao: "Operador",        quantidade: 1, horasTrabalhadas: 7 },
  ];
}

/** Gera lista de materiais consumidos para o diário. */
function gerarMateriais(atividade) {
  return [
    { descricao: "Cimento CP II-E 50 kg",    quantidade: 10, unidade: "sc" },
    { descricao: "Areia média lavada",        quantidade: 1.5, unidade: "m³" },
    { descricao: "Brita 0",                  quantidade: 0.8, unidade: "m³" },
  ];
}

/** Gera ocorrências conforme condição climática (ou null). */
function gerarOcorrencias(climaIdx) {
  const map = {
    2: "Início de chuva às 14h30. Atividades externas suspensas por 1h30.",
    3: "Ventos fortes às 10h. Andaime inspecionado e reforçado conforme NR-18.",
    4: "Chuva intermitente durante o turno da tarde. Parcela do serviço de pintura adiada.",
  };
  return map[climaIdx] || null;
}

/** Gera observação geral para o diário. */
function gerarObsGeral() {
  const opts = [
    "Trabalhos transcorreram dentro do previsto. Cronograma em dia.",
    "Produção abaixo do esperado por falta de material. Pedido emergencial emitido.",
    "Visita do engenheiro fiscal. Liberação de serviço concedida.",
    "Trabalho noturno autorizado pelo cliente para recuperar atraso.",
    "Reunião de segurança (DDS) realizada às 7h com toda a equipe.",
    null, null,
  ];
  return opts[Math.floor(opts.length / 2)];
}

/** Gera itens de solicitação de compra coerentes com a prioridade. */
function gerarItensSolicitacao(prioridade) {
  const tabelas = {
    baixa:   [
      { descricao: "Tinta acrílica branca 18L",               unidade: "balde",  quantidade: 5,   valorUnitario: 180  },
      { descricao: "Rolo de lã para pintura",                  unidade: "un",     quantidade: 10,  valorUnitario: 18   },
    ],
    media:   [
      { descricao: "Cimento CP II-E 50 kg",                    unidade: "sc",     quantidade: 100, valorUnitario: 42   },
      { descricao: "Areia média lavada",                       unidade: "m³",     quantidade: 8,   valorUnitario: 110  },
      { descricao: "Brita 0",                                  unidade: "m³",     quantidade: 5,   valorUnitario: 130  },
    ],
    alta:    [
      { descricao: "Cerâmica 60×60 cm (caixa 2 m²)",           unidade: "cx",     quantidade: 60,  valorUnitario: 130  },
      { descricao: "Argamassa colante AC-III 20 kg",           unidade: "sc",     quantidade: 40,  valorUnitario: 38   },
      { descricao: "Rejunte epóxi 2 kg",                       unidade: "cx",     quantidade: 20,  valorUnitario: 45   },
    ],
    urgente: [
      { descricao: "Concreto fck 30 MPa (caminhão betoneira)", unidade: "m³",     quantidade: 15,  valorUnitario: 520  },
      { descricao: "Aço CA-50 10 mm (barra 12 m)",             unidade: "barra",  quantidade: 200, valorUnitario: 58   },
      { descricao: "Espaçador plástico para ferragem",         unidade: "cx",     quantidade: 10,  valorUnitario: 28   },
    ],
  };
  return tabelas[prioridade] || tabelas["media"];
}

/** Gera justificativa de solicitação coerente com a prioridade. */
function gerarJustificativa(prioridade) {
  const map = {
    baixa:   "Reposição de material de consumo para manutenção do ritmo da obra.",
    media:   "Necessário para continuidade das atividades programadas na próxima semana.",
    alta:    "Estoque crítico. A falta do material impacta diretamente o cronograma.",
    urgente: "Material esgotado. Obra paralisará em < 24h caso não haja reposição.",
  };
  return map[prioridade] || map["media"];
}

/* ══════════════════════════════════════════════════════════════════════ */

seed();
