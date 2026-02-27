const express = require("express");
const router = express.Router();
const medicaoRepo = require("../repositories/MedicaoRepository");
const { authenticate } = require("../middleware/auth");
const { PERFIS } = require("../constants");
const { ForbiddenError } = require("../utils/errors");

// Todas as rotas requerem autenticação
router.use(authenticate);

router.post("/", async (req, res) => {
	try {
		// prevent caching so clients always receive fresh data
		res.set("Cache-Control", "no-store");

		const payload = req.body || {};
		let anexos = null;
		if (Array.isArray(payload.anexos)) {
			anexos = payload.anexos;
		} else if (payload.foto) {
			anexos = [{ url: payload.foto }];
		}
		// payload de medição geométrica legado: normaliza para o formato canônico
		const isRawMeasurement = ["comprimento", "largura", "altura", "area", "volume"].some((k) => payload[k] !== undefined);
		const basePayload = {
			...payload,
			responsavel: req.user.id,
		};
		let created;
		if (isRawMeasurement) {
			const unidade = payload.area ? "m²" : "m";
			const item = {
				descricao: "Medição",
				quantidade: payload.area !== undefined ? Number(payload.area) : 1,
				unidade,
				valorUnitario: payload.valorUnitario || null,
				valorTotal: payload.volume !== undefined ? Number(payload.volume) : null,
				observacoes: payload.observacoes || null,
				local: null,
			};

			const medicaoPayload = {
				obra: payload.obra || req.user.obraAtual || null,
				responsavel: req.user.id,
				data: payload.data || null,
				observacoes: payload.observacoes || null,
				itens: JSON.stringify([item]),
				anexos: anexos ? JSON.stringify(anexos) : null,
				status: payload.status || null,
				clientTimestamp: payload.clientTimestamp || null,
				metadata: JSON.stringify({ createdAt: new Date() })
			};
			created = await medicaoRepo.create(medicaoPayload);
		} else {
			created = await medicaoRepo.create(basePayload);
		}
		return res.status(201).json(created);
	} catch (err) {
		const logger = require("../utils/logger");
		logger.error("Erro ao criar medição:", err);
		return res.status(500).json({ error: "Erro ao salvar medição" });
	}
});

router.get("/", async (req, res) => {
	try {
		// prevent caching so clients don't get stale 304 responses
		res.set("Cache-Control", "no-store");

		const page = parseInt(req.query.page || "1", 10);
		const limit = parseInt(req.query.limit || "50", 10);
		const filter =
			req.user.perfil === PERFIS.ENCARREGADO
				? { responsavel: req.user.id }
				: {};
		const result = await medicaoRepo.findAll(filter, { page, limit, sort: { "metadata.createdAt": -1 } });

		// parse JSON fields so client receives structured data
		const parsed = result.data.map((r) => {
			const copy = { ...r };
			try {
				if (copy.itens && typeof copy.itens === "string") copy.itens = JSON.parse(copy.itens);
			} catch (err) {
				// leave as string on parse error
			}
			try {
				if (copy.anexos && typeof copy.anexos === "string") copy.anexos = JSON.parse(copy.anexos);
			} catch (err) {}
			try {
				if (copy.metadata && typeof copy.metadata === "string") copy.metadata = JSON.parse(copy.metadata);
			} catch (err) {}
			return copy;
		});

		return res.json({ ...result, data: parsed });
	} catch (err) {
		const logger = require("../utils/logger");
		logger.error("Erro ao buscar medições:", err);
		return res.status(500).json({ error: "Erro ao buscar medições" });
	}
});

// Get single medicao by id (parsed)
router.get("/:id", async (req, res) => {
	try {
		res.set("Cache-Control", "no-store");
		const id = parseInt(req.params.id, 10);
		if (!id) return res.status(400).json({ error: "ID inválido" });
		const row = await medicaoRepo.findById(id);
		if (
			req.user.perfil === PERFIS.ENCARREGADO &&
			Number(row.responsavel) !== Number(req.user.id)
		) {
			throw new ForbiddenError("Você não tem permissão para acessar esta medição");
		}
		const copy = { ...row };
		try {
			if (copy.itens && typeof copy.itens === "string") copy.itens = JSON.parse(copy.itens);
		} catch (err) {}
		try {
			if (copy.anexos && typeof copy.anexos === "string") copy.anexos = JSON.parse(copy.anexos);
		} catch (err) {}
		try {
			if (copy.metadata && typeof copy.metadata === "string") copy.metadata = JSON.parse(copy.metadata);
		} catch (err) {}
		return res.json(copy);
	} catch (err) {
		const logger = require("../utils/logger");
		logger.error("Erro ao buscar medição por id:", err);
		if (err instanceof ForbiddenError) return res.status(403).json({ error: err.message });
		if (err && err.name === "NotFoundError") return res.status(404).json({ error: "Medição não encontrada" });
		return res.status(500).json({ error: "Erro ao buscar medição" });
	}
});

module.exports = router;