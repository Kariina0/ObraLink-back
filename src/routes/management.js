const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { successResponse } = require("../utils/helpers");
const { runWithDeletedAtFallback } = require("../utils/dbHelpers");
const { PERFIS } = require("../constants");
const supabase = require("../config/supabaseClient");

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
    const periodo = Math.min(365, Math.max(1, parseInt(req.query.periodo) || 30));
    const dataCorte = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

    // Buscar todas as obras ativas
    const { data: obras, error: obrasErr } = await runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase
        .from("obras")
        .select("id, nome, status, orcamento, dataPrevisaoTermino");

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      return query.neq("status", "cancelada");
    });

    if (obrasErr) throw obrasErr;

    if (!obras || obras.length === 0) {
      return res.json(
        successResponse(
          { resumoGeral: { totalOrcado: 0, totalRealizado: 0, obrasEmAlerta: 0, solicitacoesPendentes: 0, valorPendenteEstimado: 0 }, obras: [], alertas: [] },
          "Visão gerencial carregada",
        ),
      );
    }

    const obraIds = obras.map((o) => o.id);

    // Medições aprovadas e solicitações pendentes — consultas paralelas (ambas dependem de obraIds)
    const [
      { data: medicoesAprovadas, error: medErr },
      { data: solicitacoes,      error: solErr },
    ] = await Promise.all([
      runWithDeletedAtFallback((withDeletedAt) => {
        let query = supabase
          .from("medicoes")
          .select("obra, itens, data")
          .in("obra", obraIds)
          .eq("status", "aprovada");

        if (withDeletedAt) query = query.is("deletedAt", null);
        return query;
      }),
      runWithDeletedAtFallback((withDeletedAt) => {
        let query = supabase
          .from("solicitacoes_compra")
          .select("obra, valorTotal")
          .in("obra", obraIds)
          .eq("status", "pendente");

        if (withDeletedAt) query = query.is("deletedAt", null);
        return query;
      }),
    ]);

    if (medErr) throw medErr;
    if (solErr) throw solErr;

    // Acumular valores por obra a partir das medições aprovadas
    const medicoesPorObra = {};
    const realizadoPorObra = {};
    for (const row of medicoesAprovadas ?? []) {
      // Contar apenas medições dentro do período
      if (row.data && row.data >= dataCorte) {
        medicoesPorObra[row.obra] = (medicoesPorObra[row.obra] || 0) + 1;
      }
      // Valor realizado total (independente do período)
      let itens;
      try { itens = row.itens ? JSON.parse(row.itens) : []; } catch { itens = []; }
      const soma = Array.isArray(itens)
        ? itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0)
        : 0;
      realizadoPorObra[row.obra] = (realizadoPorObra[row.obra] || 0) + soma;
    }

    const solicitacoesPorObra = {};
    const valorPendentePorObra = {};
    for (const row of solicitacoes ?? []) {
      solicitacoesPorObra[row.obra] = (solicitacoesPorObra[row.obra] || 0) + 1;
      valorPendentePorObra[row.obra] = (valorPendentePorObra[row.obra] || 0) + Number(row.valorTotal || 0);
    }

    const hoje = Date.now();
    const ALERTA_PRAZO_DIAS = 30;
    const ALERTA_ORCAMENTO_PCT = 80;

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

    res.setHeader("Cache-Control", "no-store");
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
    const periodo = Math.min(365, Math.max(1, parseInt(req.query.periodo) || 30));
    const dataCorte = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000).toISOString();

    const { data: obras, error: obrasErr } = await runWithDeletedAtFallback((withDeletedAt) => {
      let query = supabase
        .from("obras")
        .select("id, nome, status, orcamento, dataPrevisaoTermino");

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      return query.neq("status", "cancelada");
    });

    if (obrasErr) throw obrasErr;

    const obraIds = (obras ?? []).map((o) => o.id);
    const realizadoPorObra = {};
    const medicoesPorObra = {};
    const solicitacoesPorObra = {};
    const valorPendentePorObra = {};

    if (obraIds.length > 0) {
      const { data: medsData } = await runWithDeletedAtFallback((withDeletedAt) => {
        let query = supabase
          .from("medicoes")
          .select("obra, itens, data")
          .in("obra", obraIds)
          .eq("status", "aprovada");

        if (withDeletedAt) {
          query = query.is("deletedAt", null);
        }

        return query;
      });

      for (const row of medsData ?? []) {
        if (row.data && row.data >= dataCorte) {
          medicoesPorObra[row.obra] = (medicoesPorObra[row.obra] || 0) + 1;
        }
        let itens;
        try { itens = row.itens ? JSON.parse(row.itens) : []; } catch { itens = []; }
        const soma = Array.isArray(itens)
          ? itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0)
          : 0;
        realizadoPorObra[row.obra] = (realizadoPorObra[row.obra] || 0) + soma;
      }

      const { data: solData } = await runWithDeletedAtFallback((withDeletedAt) => {
        let query = supabase
          .from("solicitacoes_compra")
          .select("obra, valorTotal")
          .in("obra", obraIds)
          .eq("status", "pendente");

        if (withDeletedAt) {
          query = query.is("deletedAt", null);
        }

        return query;
      });

      for (const row of solData ?? []) {
        solicitacoesPorObra[row.obra] = (solicitacoesPorObra[row.obra] || 0) + 1;
        valorPendentePorObra[row.obra] = (valorPendentePorObra[row.obra] || 0) + Number(row.valorTotal || 0);
      }
    }

    const hoje = Date.now();
    const rows = (obras ?? []).map((obra) => {
      const orcado = parseOrcamento(obra.orcamento);
      const realizado = realizadoPorObra[obra.id] || 0;
      const percentualGasto = orcado > 0 ? Math.round((realizado / orcado) * 100) : 0;
      let prazoDiasRestantes = "";
      if (obra.dataPrevisaoTermino) {
        const fim = new Date(obra.dataPrevisaoTermino).getTime();
        prazoDiasRestantes = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));
      }
      return {
        "Obra":                          obra.nome,
        "Status":                        obra.status,
        "Orçado (R$)":                   orcado.toFixed(2),
        "Realizado (R$)":                realizado.toFixed(2),
        "% Gasto":                       `${percentualGasto}%`,
        "Prazo (dias)":                  prazoDiasRestantes,
        [`Medições (${periodo}d)`]:      medicoesPorObra[obra.id] || 0,
        "Solicitações pendentes":        solicitacoesPorObra[obra.id] || 0,
        "Valor pendente est. (R$)":      (valorPendentePorObra[obra.id] || 0).toFixed(2),
      };
    });

    const headers = [
      "Obra", "Status", "Orçado (R$)", "Realizado (R$)", "% Gasto",
      "Prazo (dias)", `Medições (${periodo}d)`, "Solicitações pendentes", "Valor pendente est. (R$)",
    ];
    const csv = toCSV(headers, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="painel-obras-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\uFEFF" + csv);
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
    const { obraId, mes, status } = req.query;
    const ALLOWED_STATUSES = ["enviada", "aprovada", "rejeitada", "rascunho"];

    const buildMedicoesQuery = (withDeletedAt) => {
      let query = supabase
        .from("medicoes")
        .select("id, obra, responsavel, data, area, tipoServico, status, areaCalculada, volume, observacoes, itens, obras(nome), users:responsavel(nome)")
        .order("data", { ascending: false });

      if (withDeletedAt) {
        query = query.is("deletedAt", null);
      }

      if (obraId) {
        const obraNum = parseInt(obraId, 10);
        if (!isNaN(obraNum) && obraNum > 0) query = query.eq("obra", obraNum);
      }

      if (status && ALLOWED_STATUSES.includes(status)) {
        query = query.eq("status", status);
      }

      if (mes && /^\d{4}-\d{2}$/.test(mes)) {
        const [ano, month] = mes.split("-");
        const monthNum = parseInt(month, 10);
        if (monthNum < 1 || monthNum > 12) {
          return { error: { message: "Mês inválido." }, data: null };
        }
        const inicio = new Date(`${ano}-${month}-01T00:00:00.000Z`).toISOString();
        const fimDate = new Date(Number(ano), Number(month), 1);
        query = query.gte("data", inicio).lt("data", fimDate.toISOString());
      }

      return query;
    };

    const built = buildMedicoesQuery(false);
    if (built?.error?.message === "Mês inválido.") {
      return res.status(400).json({ success: false, error: { message: "Mês inválido." } });
    }

    const { data: medicoes, error: medErr } = await runWithDeletedAtFallback(buildMedicoesQuery);
    if (medErr) throw medErr;

    const rows = (medicoes ?? []).map((m) => {
      let valorTotal;
      try {
        const itens = m.itens ? JSON.parse(m.itens) : [];
        valorTotal = Array.isArray(itens)
          ? itens.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0)
          : 0;
      } catch { valorTotal = 0; }

      return {
        "ID":               m.id,
        "Obra":             m.obras?.nome || "",
        "Responsável":      m.users?.nome || "",
        "Data":             m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "",
        "Área/Ambiente":    m.area || "",
        "Tipo de Serviço":  m.tipoServico || "",
        "Status":           m.status || "",
        "Área calc. (m²)":  m.areaCalculada != null ? Number(m.areaCalculada).toFixed(2) : "",
        "Volume (m³)":      m.volume != null ? Number(m.volume).toFixed(2) : "",
        "Valor Total (R$)": valorTotal.toFixed(2),
        "Observações":      m.observacoes || "",
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
