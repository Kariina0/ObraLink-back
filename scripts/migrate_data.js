require("dotenv").config();
const mongoose = require("mongoose");
const knexfile = require("../knexfile.js");
const knex = require("knex")(knexfile.development);

const MONGODB_URI = process.env.MONGODB_URI;

const mapping = {};

function ensureMap(col) {
  if (!mapping[col]) mapping[col] = {};
}

function idStr(id) {
  if (!id) return null;
  return id.toString ? id.toString() : String(id);
}

function mapRef(col, mongoId) {
  if (!mongoId) return null;
  ensureMap(col);
  const id = idStr(mongoId);
  return mapping[col][id] || null;
}

function mapRefArray(col, arr) {
  if (!arr) return null;
  return arr.map((a) => mapRef(col, a));
}

async function fetchCollection(name) {
  const db = mongoose.connection.db;
  const collNames = (await db.listCollections().toArray()).map((c) => c.name);
  const candidate = collNames.find((n) => n === name || n === name.toLowerCase());
  const collection = db.collection(candidate || name);
  return collection.find().toArray();
}

async function processUsers() {
  const docs = await fetchCollection("users");
  ensureMap("users");
  for (const d of docs) {
    const row = {
      nome: d.nome || null,
      email: d.email || null,
      senha: d.senha || null,
      perfil: d.perfil || null,
      obraAtual: mapRef("obras", d.obraAtual),
      isActive: d.isActive == null ? true : !!d.isActive,
      lastSync: d.lastSync ? new Date(d.lastSync) : null,
      syncId: idStr(d._id),
      refreshToken: d.refreshToken || null,
      sincronizado: !!d.sincronizado,
      metadata: d.metadata ? JSON.stringify(d.metadata) : JSON.stringify({}),
    };

    const [insertedId] = await knex("users").insert(row);
    mapping.users[idStr(d._id)] = insertedId;
  }
}

async function processObras() {
  const docs = await fetchCollection("obras");
  ensureMap("obras");
  for (const d of docs) {
    const row = {
      nome: d.nome || null,
      codigo: d.codigo || null,
      endereco: d.endereco ? JSON.stringify(d.endereco) : null,
      coordenadas: d.coordenadas ? JSON.stringify(d.coordenadas) : null,
      responsavel: mapRef("users", d.responsavel),
      equipe: d.equipe ? JSON.stringify(d.equipe) : null,
      dataInicio: d.dataInicio ? new Date(d.dataInicio) : null,
      dataPrevisaoTermino: d.dataPrevisaoTermino ? new Date(d.dataPrevisaoTermino) : null,
      dataTermino: d.dataTermino ? new Date(d.dataTermino) : null,
      status: d.status || null,
      orcamento: d.orcamento ? JSON.stringify(d.orcamento) : null,
      descricao: d.descricao || null,
      observacoes: d.observacoes || null,
      syncId: idStr(d._id),
      metadata: d.metadata ? JSON.stringify(d.metadata) : JSON.stringify({}),
    };

    const [insertedId] = await knex("obras").insert(row);
    mapping.obras[idStr(d._id)] = insertedId;
  }
}

async function processMeasurements() {
  const docs = await fetchCollection("measurements");
  ensureMap("measurements");
  for (const d of docs) {
    const row = {
      comprimento: d.comprimento || null,
      largura: d.largura || null,
      altura: d.altura || null,
      area: d.area || null,
      volume: d.volume || null,
      observacoes: d.observacoes ? String(d.observacoes) : null,
    };

    const [insertedId] = await knex("measurements").insert(row);
    mapping.measurements[idStr(d._id)] = insertedId;
  }
}

async function processPurchases() {
  const docs = await fetchCollection("purchases");
  ensureMap("purchases");
  for (const d of docs) {
    const row = {
      items: d.items ? JSON.stringify(d.items) : null,
      status: d.status || null,
      user: mapRef("users", d.user),
      createdAt: d.createdAt ? new Date(d.createdAt) : null,
    };

    const [insertedId] = await knex("purchases").insert(row);
    mapping.purchases[idStr(d._id)] = insertedId;
  }
}

async function processArquivos() {
  const docs = await fetchCollection("arquivos");
  ensureMap("arquivos");
  for (const d of docs) {
    const row = {
      nome: d.nome || null,
      nomeOriginal: d.nomeOriginal || null,
      caminho: d.caminho || null,
      url: d.url || null,
      tipo: d.tipo || null,
      mimeType: d.mimeType || null,
      tamanho: d.tamanho || null,
      dimensoes: d.dimensoes ? JSON.stringify(d.dimensoes) : null,
      coordenadas: d.coordenadas ? JSON.stringify(d.coordenadas) : null,
      descricao: d.descricao || null,
      tags: d.tags ? JSON.stringify(d.tags) : null,
      obra: mapRef("obras", d.obra),
      uploadedBy: mapRef("users", d.uploadedBy),
      comprimido: !!d.comprimido,
      tamanhoOriginal: d.tamanhoOriginal || null,
      sincronizado: !!d.sincronizado,
      syncId: idStr(d._id),
      clientTimestamp: d.clientTimestamp ? new Date(d.clientTimestamp) : null,
      metadata: d.metadata ? JSON.stringify(d.metadata) : JSON.stringify({}),
    };

    const [insertedId] = await knex("arquivos").insert(row);
    mapping.arquivos[idStr(d._id)] = insertedId;
  }
}

async function processMedicoes() {
  const docs = await fetchCollection("medicoes");
  ensureMap("medicoes");
  for (const d of docs) {
    const itens = d.itens ? JSON.stringify(d.itens) : null;
    const anexos = d.anexos
      ? JSON.stringify((d.anexos || []).map((a) => mapping.arquivos[idStr(a)] || null))
      : null;

    const row = {
      obra: mapRef("obras", d.obra),
      responsavel: mapRef("users", d.responsavel),
      data: d.data ? new Date(d.data) : null,
      periodo: d.periodo ? JSON.stringify(d.periodo) : null,
      itens: itens,
      anexos: anexos,
      observacoes: d.observacoes || null,
      status: d.status || null,
      aprovadoPor: mapRef("users", d.aprovadoPor),
      dataAprovacao: d.dataAprovacao ? new Date(d.dataAprovacao) : null,
      sincronizado: !!d.sincronizado,
      syncId: idStr(d._id),
      clientTimestamp: d.clientTimestamp ? new Date(d.clientTimestamp) : null,
      metadata: d.metadata ? JSON.stringify(d.metadata) : JSON.stringify({}),
    };

    const [insertedId] = await knex("medicoes").insert(row);
    mapping.medicoes[idStr(d._id)] = insertedId;
  }
}

async function processDiarios() {
  const docs = await fetchCollection("diarios");
  ensureMap("diarios");
  for (const d of docs) {
    const row = {
      obra: mapRef("obras", d.obra),
      responsavel: mapRef("users", d.responsavel),
      data: d.data ? new Date(d.data) : null,
      clima: d.clima ? JSON.stringify(d.clima) : null,
      equipamentos: d.equipamentos ? JSON.stringify(d.equipamentos) : null,
      maoDeObra: d.maoDeObra ? JSON.stringify(d.maoDeObra) : null,
      atividades: d.atividades ? JSON.stringify(d.atividades) : null,
      materiais: d.materiais ? JSON.stringify(d.materiais) : null,
      ocorrencias: d.ocorrencias ? JSON.stringify(d.ocorrencias) : null,
      visitantes: d.visitantes ? JSON.stringify(d.visitantes) : null,
      fotos: d.fotos ? JSON.stringify((d.fotos || []).map((f) => mapping.arquivos[idStr(f)] || null)) : null,
      observacoesGerais: d.observacoesGerais || null,
      assinatura: d.assinatura ? JSON.stringify(d.assinatura) : null,
      sincronizado: !!d.sincronizado,
      syncId: idStr(d._id),
      clientTimestamp: d.clientTimestamp ? new Date(d.clientTimestamp) : null,
      metadata: d.metadata ? JSON.stringify(d.metadata) : JSON.stringify({}),
    };

    const [insertedId] = await knex("diarios").insert(row);
    mapping.diarios[idStr(d._id)] = insertedId;
  }
}

async function processSolicitacoes() {
  const docs = await fetchCollection("solicitacaocompras");
  ensureMap("solicitacoes_compra");
  for (const d of docs) {
    const row = {
      obra: mapRef("obras", d.obra),
      solicitante: mapRef("users", d.solicitante),
      dataSolicitacao: d.dataSolicitacao ? new Date(d.dataSolicitacao) : null,
      dataNecessidade: d.dataNecessidade ? new Date(d.dataNecessidade) : null,
      prioridade: d.prioridade || null,
      itens: d.itens ? JSON.stringify(d.itens) : null,
      justificativa: d.justificativa || null,
      observacoes: d.observacoes || null,
      anexos: d.anexos ? JSON.stringify((d.anexos || []).map((a) => mapping.arquivos[idStr(a)] || null)) : null,
      status: d.status || null,
      aprovadoPor: mapRef("users", d.aprovadoPor),
      dataAprovacao: d.dataAprovacao ? new Date(d.dataAprovacao) : null,
      motivoRejeicao: d.motivoRejeicao || null,
      dataConclusao: d.dataConclusao ? new Date(d.dataConclusao) : null,
      notaFiscal: d.notaFiscal || null,
      valorTotal: d.valorTotal || null,
      sincronizado: !!d.sincronizado,
      syncId: idStr(d._id),
      clientTimestamp: d.clientTimestamp ? new Date(d.clientTimestamp) : null,
      metadata: d.metadata ? JSON.stringify(d.metadata) : JSON.stringify({}),
    };

    const [insertedId] = await knex("solicitacoes_compra").insert(row);
    mapping.solicitacoes_compra[idStr(d._id)] = insertedId;
  }
}

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI não definido no .env");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Conectado ao MongoDB");

  try {
    // Ordem: users -> obras -> measurements -> purchases -> arquivos -> medicoes -> diarios -> solicitacoes
    await processUsers();
    console.log("Users migrados");

    await processObras();
    console.log("Obras migradas");

    await processMeasurements();
    console.log("Measurements migrados");

    await processPurchases();
    console.log("Purchases migrados");

    await processArquivos();
    console.log("Arquivos migrados");

    await processMedicoes();
    console.log("Medicoes migradas");

    await processDiarios();
    console.log("Diarios migrados");

    await processSolicitacoes();
    console.log("Solicitacoes migradas");

    console.log("Migração concluída com sucesso.");
  } catch (err) {
    console.error("Erro durante migração:", err);
  } finally {
    await mongoose.disconnect();
    await knex.destroy();
    process.exit(0);
  }
}

run();
