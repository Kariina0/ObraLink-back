const express = require("express");
const PDFDocument = require("pdfkit");
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/helpers");
const { PERFIS } = require("../constants");

const router = express.Router();
const getKnex = () => require("../config/database").knex;

router.use(authenticate);
router.use(authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR));

function safeParse(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function sumItens(itensRaw) {
  const itens = safeParse(itensRaw, []);
  if (!Array.isArray(itens)) return 0;
  return itens.reduce((acc, item) => {
    const valorTotal = Number(item?.valorTotal);
    if (Number.isFinite(valorTotal) && valorTotal > 0) return acc + valorTotal;

    const quantidade = Number(item?.quantidade || 0);
    const valorUnitario = Number(item?.valorUnitario || 0);
    const total = quantidade * valorUnitario;
    return acc + (Number.isFinite(total) ? total : 0);
  }, 0);
}

function toCsvRow(values) {
  return values
    .map((v) => {
      const text = String(v ?? "").replace(/"/g, '""');
      return `"${text}"`;
    })
    .join(",");
}

async function buildOverview(periodoDias = 30) {
  const knex = getKnex();

  const [obrasRaw, medicoesAprovadas, solicitacoesPendentes] = await Promise.all([
    knex("obras").select("*"),
    knex("medicoes").where("status", "aprovada").select("*"),
    knex("solicitacoes_compra").where("status", "pendente").select("*"),
  ]);

  const obras = obrasRaw.filter((obra) => {
    const meta = safeParse(obra.metadata, {});
    return !meta.deletedAt;
  });

  const limiteData = new Date();
  limiteData.setDate(limiteData.getDate() - Number(periodoDias || 30));

  const obraSummaries = obras.map((obra) => {
    const orcamento = safeParse(obra.orcamento, {});
    const orcado = toMoney(orcamento.valor || orcamento.orcamentoTotal || 0);
    const gastoRegistrado = toMoney(orcamento.valorGasto || 0);

    const medicoesObra = medicoesAprovadas.filter((m) => Number(m.obra) === Number(obra.id));
    const realizadoPorMedicoes = medicoesObra.reduce((acc, m) => acc + sumItens(m.itens), 0);
    const realizado = gastoRegistrado > 0 ? gastoRegistrado : realizadoPorMedicoes;

    const percentual = orcado > 0 ? (realizado / orcado) * 100 : 0;

    const medicoesPeriodo = medicoesObra.filter((m) => {
      const dt = new Date(m.data || m.created_at || m.createdAt || 0);
      return Number.isFinite(dt.getTime()) && dt >= limiteData;
    }).length;

    const solicitacoesObra = solicitacoesPendentes.filter((s) => Number(s.obra) === Number(obra.id));
    const totalEstimadoPendencias = solicitacoesObra.reduce((acc, s) => acc + sumItens(s.itens), 0);

    let prazoDiasRestantes = null;
    let alertaPrazo = false;
    if (obra.dataPrevisaoTermino) {
      const termino = new Date(obra.dataPrevisaoTermino);
      if (!Number.isNaN(termino.getTime())) {
        const diff = termino.getTime() - Date.now();
        prazoDiasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
        alertaPrazo = obra.status !== "concluida" && prazoDiasRestantes <= 15;
      }
    }

    const alerta = percentual >= 100 ? "critico" : percentual >= 80 ? "alerta" : "ok";

    return {
      obraId: obra.id,
      nome: obra.nome,
      codigo: obra.codigo,
      status: obra.status,
      orcado,
      realizado,
      percentualGasto: Number(percentual.toFixed(2)),
      medicoesAprovadas: medicoesObra.length,
      medicoesPeriodo,
      solicitacoesPendentes: solicitacoesObra.length,
      valorPendenteEstimado: Number(totalEstimadoPendencias.toFixed(2)),
      prazoDiasRestantes,
      alertaPrazo,
      alerta,
    };
  });

  const resumoGeral = {
    obras: obraSummaries.length,
    obrasEmAlerta: obraSummaries.filter((o) => o.alerta !== "ok" || o.alertaPrazo).length,
    totalOrcado: Number(obraSummaries.reduce((acc, o) => acc + o.orcado, 0).toFixed(2)),
    totalRealizado: Number(obraSummaries.reduce((acc, o) => acc + o.realizado, 0).toFixed(2)),
    solicitacoesPendentes: obraSummaries.reduce((acc, o) => acc + o.solicitacoesPendentes, 0),
    valorPendenteEstimado: Number(obraSummaries.reduce((acc, o) => acc + o.valorPendenteEstimado, 0).toFixed(2)),
  };

  return {
    periodoDias: Number(periodoDias || 30),
    resumoGeral,
    obras: obraSummaries,
    alertas: obraSummaries.filter((o) => o.alerta !== "ok" || o.alertaPrazo),
  };
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const periodo = Number(req.query.periodo || 30);
    const data = await buildOverview(periodo);
    res.json(successResponse(data, "Visão gerencial carregada"));
  }),
);

router.get(
  "/exports/obras.csv",
  asyncHandler(async (req, res) => {
    const periodo = Number(req.query.periodo || 30);
    const overview = await buildOverview(periodo);

    const lines = [];
    lines.push(
      toCsvRow([
        "Obra",
        "Codigo",
        "Status",
        "Orcado",
        "Realizado",
        "PercentualGasto",
        "MedicoesAprovadas",
        "MedicoesPeriodo",
        "SolicitacoesPendentes",
        "ValorPendenteEstimado",
        "PrazoDiasRestantes",
        "AlertaPrazo",
        "Alerta",
      ]),
    );

    overview.obras.forEach((obra) => {
      lines.push(
        toCsvRow([
          obra.nome,
          obra.codigo,
          obra.status,
          obra.orcado,
          obra.realizado,
          obra.percentualGasto,
          obra.medicoesAprovadas,
          obra.medicoesPeriodo,
          obra.solicitacoesPendentes,
          obra.valorPendenteEstimado,
          obra.prazoDiasRestantes ?? "",
          obra.alertaPrazo ? "sim" : "nao",
          obra.alerta,
        ]),
      );
    });

    const csv = lines.join("\n");
    const filename = `painel-gerencial-obras-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.status(200).send(`\ufeff${csv}`);
  }),
);

router.get(
  "/exports/medicoes.csv",
  asyncHandler(async (req, res) => {
    const knex = getKnex();
    const { obraId, mes } = req.query;

    let qb = knex("medicoes")
      .leftJoin("obras", "medicoes.obra", "obras.id")
      .leftJoin("users", "medicoes.responsavel", "users.id")
      .where("medicoes.status", "aprovada")
      .select(
        "medicoes.*",
        "obras.nome as obraNome",
        "users.nome as responsavelNome",
      );

    if (obraId) qb = qb.andWhere("medicoes.obra", Number(obraId));
    if (mes && /^\d{4}-\d{2}$/.test(String(mes))) {
      qb = qb.andWhereRaw("substr(medicoes.data, 1, 7) = ?", [mes]);
    }

    const rows = await qb.orderBy("medicoes.data", "asc");

    const lines = [
      toCsvRow([
        "ID",
        "Data",
        "Obra",
        "Responsavel",
        "Area",
        "TipoServico",
        "Status",
        "ValorTotalEstimado",
      ]),
    ];

    rows.forEach((row) => {
      lines.push(
        toCsvRow([
          row.id,
          row.data,
          row.obraNome || row.obra,
          row.responsavelNome || row.responsavel,
          row.area || "",
          row.tipoServico || "",
          row.status,
          Number(sumItens(row.itens).toFixed(2)),
        ]),
      );
    });

    const csv = lines.join("\n");
    const suffix = mes ? `-${mes}` : "";
    const filename = `boletim-medicoes${suffix}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.status(200).send(`\ufeff${csv}`);
  }),
);

router.get(
  "/exports/boletim.pdf",
  asyncHandler(async (req, res) => {
    const knex = getKnex();
    const { obraId, mes } = req.query;

    let qb = knex("medicoes")
      .leftJoin("obras", "medicoes.obra", "obras.id")
      .leftJoin("users", "medicoes.responsavel", "users.id")
      .where("medicoes.status", "aprovada")
      .select("medicoes.*", "obras.nome as obraNome", "users.nome as responsavelNome");

    if (obraId) qb = qb.andWhere("medicoes.obra", Number(obraId));
    if (mes && /^\d{4}-\d{2}$/.test(String(mes))) {
      qb = qb.andWhereRaw("substr(medicoes.data, 1, 7) = ?", [mes]);
    }

    const rows = await qb.orderBy("medicoes.data", "asc");
    const total = rows.reduce((acc, row) => acc + sumItens(row.itens), 0);

    const filename = `boletim-medicoes-${mes || new Date().toISOString().slice(0, 7)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    const doc = new PDFDocument({ margin: 42, size: "A4" });
    doc.pipe(res);

    doc.fontSize(16).text("Boletim de Medicoes", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
    if (mes) doc.text(`Mes de referencia: ${mes}`);
    if (obraId) doc.text(`Obra ID: ${obraId}`);
    doc.moveDown(0.6);

    doc.fontSize(11).text(`Total de medicoes aprovadas: ${rows.length}`);
    doc.text(`Valor total estimado: R$ ${total.toFixed(2)}`);
    doc.moveDown(0.8);

    doc.fontSize(9);
    rows.forEach((row, idx) => {
      const valor = sumItens(row.itens).toFixed(2);
      const linha = `${idx + 1}. ${row.data || "-"} | ${row.obraNome || row.obra} | ${row.area || "-"} | ${row.tipoServico || "-"} | R$ ${valor}`;
      doc.text(linha);
      if (idx < rows.length - 1) doc.moveDown(0.25);
    });

    doc.end();
  }),
);

module.exports = router;
