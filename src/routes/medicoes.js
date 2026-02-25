const express = require("express");
const router = express.Router();
const medicaoRepo = require("../repositories/MedicaoRepository");
const BaseRepository = require("../repositories/BaseRepository");

// repository for legacy measurement records
const measurementRepo = new BaseRepository("measurements");

router.post("/", async (req, res) => {
	try {
		// prevent caching so clients always receive fresh data
		res.set("Cache-Control", "no-store");

		const payload = req.body || {};
		// if payload looks like a raw measurement (comprimento/largura/altura/area/volume), save to measurements table
		const isRawMeasurement = ["comprimento", "largura", "altura", "area", "volume"].some((k) => payload[k] !== undefined);
		let created;
		if (isRawMeasurement) {
			const measurement = await measurementRepo.create(payload);
			// also create a medicao record so it appears in reports
			// adapt measurement fields into the medicao.items shape expected by the frontend
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
				obra: payload.obra || null,
				responsavel: payload.responsavel || null,
				data: payload.data || null,
				observacoes: payload.observacoes || null,
				itens: JSON.stringify([item]),
				anexos: null,
				status: payload.status || null,
				clientTimestamp: payload.clientTimestamp || null,
				metadata: JSON.stringify({ measurementRef: measurement.id, createdAt: new Date() })
			};
			created = await medicaoRepo.create(medicaoPayload);
		} else {
			created = await medicaoRepo.create(payload);
		}
		return res.status(201).json(created);
	} catch (err) {
		console.error("Erro ao criar medição:", err);
		return res.status(500).json({ error: "Erro ao salvar medição" });
	}
});

router.get("/", async (req, res) => {
	try {
		// prevent caching so clients don't get stale 304 responses
		res.set("Cache-Control", "no-store");

		const page = parseInt(req.query.page || "1", 10);
		const limit = parseInt(req.query.limit || "50", 10);
		const result = await medicaoRepo.findAll({}, { page, limit, sort: { "metadata.createdAt": -1 } });

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
		console.error("Erro ao buscar medições:", err);
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
		console.error("Erro ao buscar medição por id:", err);
		if (err && err.name === "NotFoundError") return res.status(404).json({ error: "Medição não encontrada" });
		return res.status(500).json({ error: "Erro ao buscar medição" });
	}
});

module.exports = router;