const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/helpers");
const { PERFIS } = require("../constants");

const getKnex = () => require("../config/database").knex;

/**
 * Extrai valor numérico do campo orcamento (armazenado como TEXT no banco).
 * Aceita número puro, string numérica ou objeto { total: 1234 }.
 */
function parseOrcamento(raw) {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    // Tenta JSON primeiro
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "number") return parsed;
      if (parsed && typeof parsed === "object") {
        return Number(parsed.total || parsed.valor || parsed.orcamento || 0) || 0;
      }
    } catch {
      // Não é JSON — tenta converter diretamente
      const n = Number(raw);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

/**
 * @route GET /api/management/overview
 * @desc Visão gerencial consolidada por período
 * @access Admin, Supervisor
 *
 * Query params:
 *   periodo (number, padrão 30) — janela em dias para contar medições
 */
router.get(
  "/overview",
  authenticate,
  authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const knex = getKnex();
    const periodo = Math.max(1, parseInt(req.query.periodo) || 30);
    const dataCorte = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

    // Buscar todas as obras ativas
    const obras = await knex("obras")
      .select("id", "nome", "status", "orcamento", "dataPrevisaoTermino")
      .whereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)")
      .whereNot("status", "cancelada");

    if (obras.length === 0) {
      return res.json(
        successResponse(
          { resumoGeral: { totalOrcado: 0, totalRealizado: 0, obrasEmAlerta: 0, solicitacoesPendentes: 0, valorPendenteEstimado: 0 }, obras: [], alertas: [] },
          "Visão gerencial carregada",
        ),
      );
    }

    const obraIds = obras.map((o) => o.id);

    // Contar medições aprovadas por obra no período
    const medicoesRaw = await knex("medicoes")
      .select("obra", knex.raw("count(id) as total"))
      .whereIn("obra", obraIds)
      .where("status", "aprovada")
      .where("data", ">=", dataCorte)
      .groupBy("obra");

    const medicoesPorObra = {};
    for (const row of medicoesRaw) {
      medicoesPorObra[row.obra] = Number(row.total || 0);
    }

    // Somar valorTotal das medições aprovadas por obra (campo calculado nos itens JSON)
    const medicoesValorRaw = await knex("medicoes")
      .select("obra", "itens")
      .whereIn("obra", obraIds)
      .where("status", "aprovada");

    const realizadoPorObra = {};
    for (const row of medicoesValorRaw) {
      let itens = [];
      try { itens = row.itens ? JSON.parse(row.itens) : []; } catch { itens = []; }
      const soma = Array.isArray(itens)
        ? itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0)
        : 0;
      realizadoPorObra[row.obra] = (realizadoPorObra[row.obra] || 0) + soma;
    }

    // Contar e somar solicitações pendentes por obra
    const solicitacoesRaw = await knex("solicitacoes_compra")
      .select("obra", knex.raw("count(id) as total"), knex.raw(`sum(coalesce("valorTotal", 0)) as "valorEstimado"`))
      .whereIn("obra", obraIds)
      .where("status", "pendente")
      .groupBy("obra");

    const solicitacoesPorObra = {};
    const valorPendentePorObra = {};
    for (const row of solicitacoesRaw) {
      solicitacoesPorObra[row.obra] = Number(row.total || 0);
      valorPendentePorObra[row.obra] = Number(row.valorEstimado || 0);
    }

    const hoje = Date.now();
    const ALERTA_PRAZO_DIAS = 30; // obras com menos de 30 dias para o fim são alertadas
    const ALERTA_ORCAMENTO_PCT = 80; // obras com >= 80% do orçamento consumido

    let totalOrcado = 0;
    let totalRealizado = 0;
    let obrasEmAlerta = 0;
    let totalSolPendentes = 0;
    let totalValorPendente = 0;

    const obrasDetalhe = obras.map((obra) => {
      const orcado = parseOrcamento(obra.orcamento);
      const realizado = realizadoPorObra[obra.id] || 0;
      const percentualGasto = orcado > 0 ? Math.round((realizado / orcado) * 100) : 0;

      let prazoDiasRestantes = null;
      let alertaPrazo = false;
      if (obra.dataPrevisaoTermino) {
        const fim = new Date(obra.dataPrevisaoTermino).getTime();
        prazoDiasRestantes = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));
        alertaPrazo = prazoDiasRestantes >= 0 && prazoDiasRestantes <= ALERTA_PRAZO_DIAS;
      }

      const emAlerta = percentualGasto >= ALERTA_ORCAMENTO_PCT || alertaPrazo;
      if (emAlerta) obrasEmAlerta++;

      const solPendentes = solicitacoesPorObra[obra.id] || 0;
      const valPendente = valorPendentePorObra[obra.id] || 0;

      totalOrcado += orcado;
      totalRealizado += realizado;
      totalSolPendentes += solPendentes;
      totalValorPendente += valPendente;

      return {
        obraId: obra.id,
        nome: obra.nome,
        status: obra.status,
        orcado,
        realizado,
        percentualGasto,
        prazoDiasRestantes,
        alertaPrazo,
        medicoesPeriodo: medicoesPorObra[obra.id] || 0,
        solicitacoesPendentes: solPendentes,
      };
    });

    const alertas = obrasDetalhe.filter(
      (o) => o.percentualGasto >= ALERTA_ORCAMENTO_PCT || o.alertaPrazo,
    );

    res.json(
      successResponse(
        {
          resumoGeral: {
            totalOrcado,
            totalRealizado,
            obrasEmAlerta,
            solicitacoesPendentes: totalSolPendentes,
            valorPendenteEstimado: totalValorPendente,
          },
          obras: obrasDetalhe,
          alertas,
        },
        "Visão gerencial carregada",
      ),
    );
  }),
);

// ── Helpers de exportação CSV ─────────────────────────────────────────────────

/**
 * Converte array de objetos em CSV RFC 4180.
 * @param {string[]} headers - colunas na ordem desejada
 * @param {object[]} rows    - cada objeto deve ter as mesmas chaves
 */
function toCSV(headers, rows) {
  const escapeCell = (val) => {
    if (val == null) return "";
    let str = String(val);
    // Previne CSV injection (formula injection) em Excel/Sheets
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * @route GET /api/management/exports/obras.csv
 * @desc Exporta visão gerencial de obras como CSV
 * @access Admin, Supervisor
 */
router.get(
  "/exports/obras.csv",
  authenticate,
  authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const knex = getKnex();
    const periodo = Math.max(1, parseInt(req.query.periodo) || 30);
    const dataCorte = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

    const obras = await knex("obras")
      .select("id", "nome", "status", "orcamento", "dataPrevisaoTermino")
      .whereRaw("(metadata IS NULL OR (metadata::jsonb)->>'deletedAt' IS NULL)")
      .whereNot("status", "cancelada");

    const obraIds = obras.map((o) => o.id);
    const realizadoPorObra = {};

    if (obraIds.length > 0) {
      const medicoesValorRaw = await knex("medicoes")
        .select("obra", "itens")
        .whereIn("obra", obraIds)
        .where("status", "aprovada");

      for (const row of medicoesValorRaw) {
        let itens = [];
        try { itens = row.itens ? JSON.parse(row.itens) : []; } catch { itens = []; }
        const soma = Array.isArray(itens)
          ? itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0)
          : 0;
        realizadoPorObra[row.obra] = (realizadoPorObra[row.obra] || 0) + soma;
      }
    }

    const medicoesPorObra = {};
    if (obraIds.length > 0) {
      const medicoesCount = await knex("medicoes")
        .select("obra", knex.raw("count(id) as total"))
        .whereIn("obra", obraIds)
        .where("status", "aprovada")
        .where("data", ">=", dataCorte)
        .groupBy("obra");
      for (const row of medicoesCount) {
        medicoesPorObra[row.obra] = Number(row.total || 0);
      }
    }

    const solicitacoesPorObra = {};
    if (obraIds.length > 0) {
      const solRaw = await knex("solicitacoes_compra")
        .select("obra", knex.raw("count(id) as total"))
        .whereIn("obra", obraIds)
        .where("status", "pendente")
        .groupBy("obra");
      for (const row of solRaw) {
        solicitacoesPorObra[row.obra] = Number(row.total || 0);
      }
    }

    const hoje = Date.now();
    const rows = obras.map((obra) => {
      const orcado = parseOrcamento(obra.orcamento);
      const realizado = realizadoPorObra[obra.id] || 0;
      const percentualGasto = orcado > 0 ? Math.round((realizado / orcado) * 100) : 0;
      let prazoDiasRestantes = "";
      if (obra.dataPrevisaoTermino) {
        const fim = new Date(obra.dataPrevisaoTermino).getTime();
        prazoDiasRestantes = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));
      }
      return {
        "Obra":                     obra.nome,
        "Status":                   obra.status,
        "Orçado (R$)":              orcado.toFixed(2),
        "Realizado (R$)":           realizado.toFixed(2),
        "% Gasto":                  `${percentualGasto}%`,
        "Prazo (dias)":             prazoDiasRestantes,
        [`Medições (${periodo}d)`]: medicoesPorObra[obra.id] || 0,
        "Solicitações pendentes":   solicitacoesPorObra[obra.id] || 0,
      };
    });

    const headers = [
      "Obra", "Status", "Orçado (R$)", "Realizado (R$)", "% Gasto",
      "Prazo (dias)", `Medições (${periodo}d)`, "Solicitações pendentes",
    ];
    const csv = toCSV(headers, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="painel-obras-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\uFEFF" + csv); // BOM UTF-8 para compatibilidade com Excel
  }),
);

/**
 * @route GET /api/management/exports/medicoes.csv
 * @desc Exporta boletim de medições como CSV, com filtros opcionais
 * @access Admin, Supervisor
 *
 * Query params:
 *   obraId (number) — filtrar por obra
 *   mes    (string) — formato YYYY-MM, filtra medições do mês
 */
router.get(
  "/exports/medicoes.csv",
  authenticate,
  authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR),
  asyncHandler(async (req, res) => {
    const knex = getKnex();
    const { obraId, mes } = req.query;

    let qb = knex("medicoes")
      .leftJoin("obras", "medicoes.obra", "obras.id")
      .leftJoin("users", "medicoes.responsavel", "users.id")
      .whereRaw("(medicoes.metadata IS NULL OR (medicoes.metadata::jsonb)->>'deletedAt' IS NULL)")
      .select(
        "medicoes.id",
        "obras.nome as obraNome",
        "users.nome as responsavelNome",
        "medicoes.data",
        "medicoes.area",
        "medicoes.tipoServico",
        "medicoes.status",
        "medicoes.areaCalculada",
        "medicoes.volume",
        "medicoes.observacoes",
        "medicoes.itens",
      )
      .orderBy("medicoes.data", "desc");

    if (obraId) {
      const obraNum = parseInt(obraId, 10);
      if (!isNaN(obraNum) && obraNum > 0) qb = qb.andWhere("medicoes.obra", obraNum);
    }

    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [ano, month] = mes.split("-");
      const monthNum = parseInt(month, 10);
      if (monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ success: false, error: { message: "Mês inválido." } });
      }
      const inicio = new Date(`${ano}-${month}-01T00:00:00.000Z`).toISOString();
      const fimDate = new Date(Number(ano), Number(month), 1); // primeiro dia do próximo mês
      const fim = fimDate.toISOString();
      qb = qb.andWhere("medicoes.data", ">=", inicio).andWhere("medicoes.data", "<", fim);
    }

    const medicoes = await qb;

    const rows = medicoes.map((m) => {
      let valorTotal = 0;
      try {
        const itens = m.itens ? JSON.parse(m.itens) : [];
        valorTotal = Array.isArray(itens)
          ? itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0)
          : 0;
      } catch { valorTotal = 0; }

      return {
        "ID":                m.id,
        "Obra":              m.obraNome || "",
        "Responsável":       m.responsavelNome || "",
        "Data":              m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "",
        "Área/Ambiente":     m.area || "",
        "Tipo de Serviço":   m.tipoServico || "",
        "Status":            m.status || "",
        "Área calc. (m²)":   m.areaCalculada != null ? Number(m.areaCalculada).toFixed(2) : "",
        "Volume (m³)":       m.volume != null ? Number(m.volume).toFixed(2) : "",
        "Valor Total (R$)":  valorTotal.toFixed(2),
        "Observações":       m.observacoes || "",
      };
    });

    const headers = [
      "ID", "Obra", "Responsável", "Data", "Área/Ambiente", "Tipo de Serviço",
      "Status", "Área calc. (m²)", "Volume (m³)", "Valor Total (R$)", "Observações",
    ];
    const csv = toCSV(headers, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="boletim-medicoes-${mes || "geral"}.csv"`);
    res.send("\uFEFF" + csv);
  }),
);

/**
 * @route GET /api/management/exports/boletim.pdf
 * @desc Exportação PDF — aguardando instalação de biblioteca (pdfkit/puppeteer)
 * @access Admin, Supervisor
 */
router.get(
  "/exports/boletim.pdf",
  authenticate,
  authorize(PERFIS.ADMIN, PERFIS.SUPERVISOR),
  asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Exportação em PDF ainda não está disponível. Use a exportação CSV (boletim CSV) como alternativa.",
      },
    });
  }),
);

module.exports = router;
