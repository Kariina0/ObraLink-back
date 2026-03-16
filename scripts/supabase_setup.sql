-- =============================================================================
-- SUPABASE SETUP — Canteiro de Obra Backend
-- Criado a partir das migrations Knex convertidas para PostgreSQL puro.
-- Execute este script no SQL Editor do Supabase (ou via psql).
-- =============================================================================

-- ── Extensões úteis ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tabela: users ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(255),
  email            VARCHAR(255) UNIQUE,
  senha            VARCHAR(255),
  perfil           VARCHAR(255),
  "obraAtual"      INTEGER,
  "isActive"       BOOLEAN DEFAULT TRUE,
  "lastSync"       TIMESTAMPTZ,
  "syncId"         VARCHAR(255) UNIQUE,
  "refreshToken"   VARCHAR(255),
  sincronizado     BOOLEAN DEFAULT FALSE,
  metadata         TEXT,
  -- password reset (migration 20260306)
  "resetPasswordToken"     VARCHAR(255),
  "resetPasswordExpiresAt" TIMESTAMPTZ,
  "resetPasswordUsedAt"    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: obras ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS obras (
  id                     SERIAL PRIMARY KEY,
  nome                   VARCHAR(255),
  codigo                 VARCHAR(255) UNIQUE,
  endereco               TEXT,
  coordenadas            TEXT,
  responsavel            INTEGER,
  equipe                 TEXT,
  "dataInicio"           DATE,
  "dataPrevisaoTermino"  DATE,
  "dataTermino"          DATE,
  status                 VARCHAR(255),
  orcamento              TEXT,
  descricao              TEXT,
  observacoes            TEXT,
  "syncId"               VARCHAR(255) UNIQUE,
  metadata               TEXT,
  -- business_rules migration (20260304)
  cliente                VARCHAR(255),
  -- add_indexes migration (20260304)
  "deletedAt"            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: arquivos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arquivos (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(255),
  "nomeOriginal"   VARCHAR(255),
  caminho          VARCHAR(255),
  url              VARCHAR(255),
  tipo             VARCHAR(255),
  "mimeType"       VARCHAR(255),
  tamanho          INTEGER,
  dimensoes        TEXT,
  coordenadas      TEXT,
  descricao        TEXT,
  tags             TEXT,
  obra             INTEGER,
  "uploadedBy"     INTEGER,
  comprimido       BOOLEAN DEFAULT FALSE,
  "tamanhoOriginal" INTEGER,
  sincronizado     BOOLEAN DEFAULT FALSE,
  "syncId"         VARCHAR(255) UNIQUE,
  "clientTimestamp" TIMESTAMPTZ,
  metadata         TEXT,
  -- add_storage_fields migration (20260226)
  storage_provider VARCHAR(255) DEFAULT 'local' NOT NULL,
  storage_path     VARCHAR(255),
  storage_url      VARCHAR(255),
  -- business_rules migration (20260304)
  "tipoArquivo"    VARCHAR(255),
  "solicitadoPor"  VARCHAR(255),
  "detalheProblema" TEXT,
  -- add_indexes migration (20260304)
  "deletedAt"      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: medicoes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicoes (
  id               SERIAL PRIMARY KEY,
  obra             INTEGER,
  responsavel      INTEGER,
  data             TIMESTAMPTZ,
  periodo          TEXT,
  itens            TEXT,
  anexos           TEXT,
  observacoes      TEXT,
  status           VARCHAR(255),
  "aprovadoPor"    INTEGER,
  "dataAprovacao"  TIMESTAMPTZ,
  sincronizado     BOOLEAN DEFAULT FALSE,
  "syncId"         VARCHAR(255) UNIQUE,
  "clientTimestamp" TIMESTAMPTZ,
  metadata         TEXT,
  -- add_dimensoes_medicao migration (20260304)
  comprimento      FLOAT,
  largura          FLOAT,
  altura           FLOAT,
  "areaCalculada"  FLOAT,
  volume           FLOAT,
  -- business_rules migration (20260304)
  area             VARCHAR(255),
  "tipoServico"    VARCHAR(255),
  -- add_indexes migration (20260304)
  "deletedAt"      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: diarios ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diarios (
  id                  SERIAL PRIMARY KEY,
  obra                INTEGER,
  responsavel         INTEGER,
  data                TIMESTAMPTZ,
  clima               TEXT,
  equipamentos        TEXT,
  "maoDeObra"         TEXT,
  atividades          TEXT,
  materiais           TEXT,
  ocorrencias         TEXT,
  visitantes          TEXT,
  fotos               TEXT,
  "observacoesGerais" TEXT,
  assinatura          TEXT,
  sincronizado        BOOLEAN DEFAULT FALSE,
  "syncId"            VARCHAR(255) UNIQUE,
  "clientTimestamp"   TIMESTAMPTZ,
  metadata            TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: solicitacoes_compra ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id                 SERIAL PRIMARY KEY,
  obra               INTEGER,
  solicitante        INTEGER,
  "dataSolicitacao"  TIMESTAMPTZ,
  "dataNecessidade"  TIMESTAMPTZ,
  prioridade         VARCHAR(255),
  itens              TEXT,
  justificativa      TEXT,
  observacoes        TEXT,
  anexos             TEXT,
  status             VARCHAR(255),
  "aprovadoPor"      INTEGER,
  "dataAprovacao"    TIMESTAMPTZ,
  "motivoRejeicao"   TEXT,
  "dataConclusao"    TIMESTAMPTZ,
  "notaFiscal"       VARCHAR(255),
  "valorTotal"       DECIMAL(14, 2),
  sincronizado       BOOLEAN DEFAULT FALSE,
  "syncId"           VARCHAR(255) UNIQUE,
  "clientTimestamp"  TIMESTAMPTZ,
  metadata           TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabela: obra_encarregados (N:N) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS obra_encarregados (
  id             SERIAL PRIMARY KEY,
  "obraId"       INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  "userId"       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  funcao         VARCHAR(255) DEFAULT 'encarregado',
  "dataInclusao" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("obraId", "userId")
);

-- ── Índices de performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicoes_obra        ON medicoes(obra);
CREATE INDEX IF NOT EXISTS idx_medicoes_responsavel ON medicoes(responsavel);
CREATE INDEX IF NOT EXISTS idx_medicoes_status      ON medicoes(status);
CREATE INDEX IF NOT EXISTS idx_medicoes_tiposervico ON medicoes("tipoServico");
CREATE INDEX IF NOT EXISTS idx_medicoes_deletedat   ON medicoes("deletedAt");
CREATE INDEX IF NOT EXISTS idx_medicoes_created_at  ON medicoes(created_at);
CREATE INDEX IF NOT EXISTS idx_obras_status         ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_deletedat      ON obras("deletedAt");
CREATE INDEX IF NOT EXISTS idx_arquivos_obra        ON arquivos(obra);
CREATE INDEX IF NOT EXISTS idx_arquivos_uploadedby  ON arquivos("uploadedBy");
CREATE INDEX IF NOT EXISTS idx_arquivos_deletedat   ON arquivos("deletedAt");
CREATE INDEX IF NOT EXISTS idx_solicitacoes_obra    ON solicitacoes_compra(obra);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status  ON solicitacoes_compra(status);

-- ── Trigger: atualiza updated_at automaticamente ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','obras','arquivos','medicoes','diarios','solicitacoes_compra']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
       CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t, t, t
    );
  END LOOP;
END $$;
