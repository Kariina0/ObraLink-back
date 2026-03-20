/**
 * Testes Unitários: Funcionalidade de Rascunhos
 * Testa: criar, editar, deletar, enviar e segurança de rascunhos
 */

const medicaoService = require("../../src/services/MedicaoService");
const medicaoRepository = require("../../src/repositories/MedicaoRepository");
const obraRepository = require("../../src/repositories/ObraRepository");
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} = require("../../src/utils/errors");
const { PERFIS } = require("../../src/constants");

jest.mock("../../src/repositories/MedicaoRepository");
jest.mock("../../src/repositories/ObraRepository");

describe("MedicaoService - Rascunhos", () => {
  const userId = 1;
  const supervisorId = 2;
  const outroUserId = 3;
  const obraId = 1;

  const mockObra = {
    id: obraId,
    nome: "Obra Test",
  };

  const mockRascunho = {
    id: 1,
    obra: obraId,
    responsavel: userId,
    status: "rascunho",
    comprimento: 10,
    largura: 8,
    altura: 3,
    areaCalculada: 80,
    volume: 240,
    observacoes: "Teste rascunho",
    data: new Date().toISOString(),
    anexosDetalhes: [],
    fotoUrl: null,
  };

  const mockMedicaoEnviada = {
    ...mockRascunho,
    id: 2,
    status: "enviada",
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 1: Criar Rascunho
  // ──────────────────────────────────────────────────────────────────
  describe("create() - Salvar Rascunho", () => {
    it("✅ Deve criar rascunho com status 'rascunho'", async () => {
      const payload = {
        obra: obraId,
        status: "rascunho",
        comprimento: 10,
        largura: 8,
        altura: 3,
        observacoes: "Teste",
      };

      obraRepository.findById.mockResolvedValueOnce(mockObra);
      obraRepository.isEncarregadoVinculado.mockResolvedValueOnce(true);
      medicaoRepository.create.mockResolvedValueOnce(1);
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);

      const result = await medicaoService.create(payload, userId, PERFIS.ENCARREGADO);

      expect(result.status).toBe("rascunho");
      expect(result.responsavel).toBe(userId);
      expect(medicaoRepository.create).toHaveBeenCalled();
    });

    it("❌ Deve rejeitar rascunho se obra não existe", async () => {
      const payload = {
        obra: 999,
        status: "rascunho",
        comprimento: 10,
        largura: 8,
      };

      obraRepository.findById.mockResolvedValueOnce(null);

      await expect(
        medicaoService.create(payload, userId, PERFIS.ENCARREGADO)
      ).rejects.toThrow(NotFoundError);
    });

    it("❌ Encarregado não pode criar rascunho em obra não vinculada", async () => {
      const payload = {
        obra: obraId,
        status: "rascunho",
      };

      obraRepository.findById.mockResolvedValueOnce(mockObra);
      obraRepository.isEncarregadoVinculado.mockResolvedValueOnce(false);

      await expect(
        medicaoService.create(payload, userId, PERFIS.ENCARREGADO)
      ).rejects.toThrow(ForbiddenError);
    });

    it("✅ Supervisor pode criar rascunho em qualquer obra", async () => {
      const payload = {
        obra: obraId,
        status: "rascunho",
        comprimento: 10,
        largura: 8,
      };

      obraRepository.findById.mockResolvedValueOnce(mockObra);
      medicaoRepository.create.mockResolvedValueOnce(1);
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);

      const result = await medicaoService.create(payload, supervisorId, PERFIS.SUPERVISOR);

      expect(result).toBeDefined();
      expect(medicaoRepository.create).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 2: Editar Rascunho
  // ──────────────────────────────────────────────────────────────────
  describe("update() - Editar Rascunho", () => {
    it("✅ Encarregado pode editar seu próprio rascunho", async () => {
      const updates = {
        comprimento: 12,
        observacoes: "Atualizado",
      };

      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);
      medicaoRepository.update.mockResolvedValueOnce({ ...mockRascunho, ...updates });
      medicaoRepository.findById.mockResolvedValueOnce({ ...mockRascunho, ...updates });

      const result = await medicaoService.update(
        mockRascunho.id,
        updates,
        userId,
        PERFIS.ENCARREGADO
      );

      expect(result.comprimento).toBe(12);
      expect(medicaoRepository.update).toHaveBeenCalled();
    });

    it("❌ Encarregado NÃO pode editar rascunho de outro", async () => {
      const outroRascunho = { ...mockRascunho, responsavel: outroUserId };

      medicaoRepository.findById.mockResolvedValueOnce(outroRascunho);

      await expect(
        medicaoService.update(mockRascunho.id, {}, userId, PERFIS.ENCARREGADO)
      ).rejects.toThrow(ForbiddenError);
    });

    it("❌ Supervisor não pode editar rascunho de outro usuário", async () => {
      const outroRascunho = { ...mockRascunho, responsavel: outroUserId };

      medicaoRepository.findById.mockResolvedValueOnce(outroRascunho);

      await expect(
        medicaoService.update(
          mockRascunho.id,
          { observacoes: "Editado" },
          supervisorId,
          PERFIS.SUPERVISOR
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it("❌ Não pode editar rascunho já aprovado", async () => {
      const aprovado = { ...mockRascunho, status: "aprovada" };

      medicaoRepository.findById.mockResolvedValueOnce(aprovado);

      await expect(
        medicaoService.update(mockRascunho.id, {}, userId, PERFIS.ENCARREGADO)
      ).rejects.toThrow(ValidationError);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 3: Deletar Rascunho
  // ──────────────────────────────────────────────────────────────────
  describe("delete() - Apagar Rascunho", () => {
    it("✅ Encarregado pode deletar seu próprio rascunho", async () => {
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);
      medicaoRepository.delete.mockResolvedValueOnce({ success: true });

      const result = await medicaoService.delete(
        mockRascunho.id,
        userId,
        PERFIS.ENCARREGADO
      );

      expect(medicaoRepository.delete).toHaveBeenCalledWith(mockRascunho.id);
    });

    it("❌ Encarregado NÃO pode deletar rascunho de outro", async () => {
      const outroRascunho = { ...mockRascunho, responsavel: outroUserId };

      medicaoRepository.findById.mockResolvedValueOnce(outroRascunho);

      await expect(
        medicaoService.delete(mockRascunho.id, userId, PERFIS.ENCARREGADO)
      ).rejects.toThrow(ForbiddenError);
    });

    it("✅ Admin pode deletar qualquer rascunho", async () => {
      const outroRascunho = { ...mockRascunho, responsavel: outroUserId };

      medicaoRepository.findById.mockResolvedValueOnce(outroRascunho);
      medicaoRepository.delete.mockResolvedValueOnce({ success: true });

      const result = await medicaoService.delete(
        mockRascunho.id,
        supervisorId,
        PERFIS.ADMIN
      );

      expect(medicaoRepository.delete).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 4: Enviar Rascunho (Converter para "enviada")
  // ──────────────────────────────────────────────────────────────────
  describe("update() - Enviar Rascunho como Medição", () => {
    it("✅ Deve converter rascunho para 'enviada'", async () => {
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);
      medicaoRepository.update.mockResolvedValueOnce({ ...mockRascunho, status: "enviada" });
      medicaoRepository.findById.mockResolvedValueOnce({ ...mockRascunho, status: "enviada" });

      const result = await medicaoService.update(
        mockRascunho.id,
        {
          status: "enviada",
          area: "Sala 01",
          tipoServico: "pintura",
          itens: [{ descricao: "Item envio", quantidade: 1, unidade: "m²" }],
        },
        userId,
        PERFIS.ENCARREGADO
      );

      expect(result.status).toBe("enviada");
    });

    it("❌ Só pode enviar rascunho de si mesmo (encarregado)", async () => {
      const outroRascunho = { ...mockRascunho, responsavel: outroUserId };

      medicaoRepository.findById.mockResolvedValueOnce(outroRascunho);

      await expect(
        medicaoService.update(
          mockRascunho.id,
          { status: "enviada" },
          userId,
          PERFIS.ENCARREGADO
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 5: Segurança - Apenas responsável consegue ver
  // ──────────────────────────────────────────────────────────────────
  describe("getById() - Segurança de Rascunho", () => {
    it("✅ Responsável pode ver seu próprio rascunho", async () => {
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);

      const result = await medicaoService.getById(
        mockRascunho.id,
        userId,
        PERFIS.ENCARREGADO
      );

      expect(result).toEqual(mockRascunho);
    });

    it("❌ Outro encarregado NÃO pode ver rascunho", async () => {
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);

      await expect(
        medicaoService.getById(mockRascunho.id, outroUserId, PERFIS.ENCARREGADO)
      ).rejects.toThrow(ForbiddenError);
    });

    it("❌ Supervisor não pode ver rascunho de outro usuário", async () => {
      medicaoRepository.findById.mockResolvedValueOnce(mockRascunho);

      await expect(
        medicaoService.getById(
          mockRascunho.id,
          supervisorId,
          PERFIS.SUPERVISOR
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 6: Rascunhos não contam nas listas
  // ──────────────────────────────────────────────────────────────────
  describe("getByResponsavel() - Rascunhos Excluídos", () => {
    it("✅ Deve excluir rascunhos por padrão", async () => {
      const medicacoes = [mockMedicaoEnviada];
      const result = { data: medicacoes, total: 1, page: 1, limit: 10 };

      medicaoRepository.findByResponsavelExcludingDrafts.mockResolvedValueOnce(result);
      medicaoRepository.getStatusSummaryFiltered.mockResolvedValueOnce({
        enviada: 1,
        aprovada: 0,
        rejeitada: 0,
        rascunho: 0,
      });

      const response = await medicaoService.getByResponsavel(userId, { page: 1, limit: 10 }, {});

      expect(medicaoRepository.findByResponsavelExcludingDrafts).toHaveBeenCalled();
      expect(response.data).not.toContainEqual(mockRascunho);
    });

    it("✅ Deve permitir filtrar rascunhos explicitamente", async () => {
      const rascunhos = [mockRascunho];
      const result = { data: rascunhos, total: 1, page: 1, limit: 10 };

      medicaoRepository.findByResponsavelFiltered.mockResolvedValueOnce(result);
      medicaoRepository.getStatusSummaryFiltered.mockResolvedValueOnce({
        rascunho: 1,
      });

      const response = await medicaoService.getByResponsavel(
        userId,
        { page: 1, limit: 10 },
        { status: "rascunho" }
      );

      expect(medicaoRepository.findByResponsavelFiltered).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 7: Lista Global não mostra rascunhos
  // ──────────────────────────────────────────────────────────────────
  describe("getAll() - Supervisores/Admins", () => {
    it("✅ Supervisor vê apenas medições enviadas/aprovadas/rejeitadas", async () => {
      const medicacoes = [mockMedicaoEnviada];
      const result = { data: medicacoes, total: 1, page: 1, limit: 10 };

      medicaoRepository.findAllFiltered.mockResolvedValueOnce(result);
      medicaoRepository.getStatusSummaryFiltered.mockResolvedValueOnce({
        enviada: 1,
        aprovada: 0,
        rejeitada: 0,
      });

      const response = await medicaoService.getAll({ page: 1, limit: 10 }, PERFIS.SUPERVISOR, {});

      expect(response.data).toEqual(medicacoes);
      expect(response.data).not.toContainEqual(mockRascunho);
    });

    it("❌ Encarregado não pode chamar getAll()", async () => {
      await expect(
        medicaoService.getAll({ page: 1, limit: 10 }, PERFIS.ENCARREGADO, {})
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 8: Rota Específica de Rascunhos
  // ──────────────────────────────────────────────────────────────────
  describe("getByResponsavel() com status=rascunho", () => {
    it("✅ Deve retornar apenas rascunhos do usuário", async () => {
      const rascunhos = [mockRascunho];
      const result = { data: rascunhos, total: 1, page: 1, limit: 10 };

      medicaoRepository.findByResponsavelFiltered.mockResolvedValueOnce(result);
      medicaoRepository.getStatusSummaryFiltered.mockResolvedValueOnce({
        rascunho: 1,
      });

      const response = await medicaoService.getByResponsavel(
        userId,
        { page: 1, limit: 10 },
        { status: "rascunho" }
      );

      expect(response.data).toEqual(rascunhos);
      expect(response.data[0].status).toBe("rascunho");
    });

    it("❌ Outro usuário não vê rascunhos do primeiro", async () => {
      const result = { data: [], total: 0, page: 1, limit: 10 };

      medicaoRepository.findByResponsavelFiltered.mockResolvedValueOnce(result);

      const response = await medicaoService.getByResponsavel(
        outroUserId,
        { page: 1, limit: 10 },
        { status: "rascunho" }
      );

      expect(response.data).toHaveLength(0);
    });
  });
});
