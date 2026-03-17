-- =============================================================================
-- SUPABASE MIGRATION — Auth Integration, Schema Additions & RLS Policies
-- Versão: 20260316_supabase_auth_rls
--
-- Execute no SQL Editor do Supabase (Project → SQL Editor → New Query).
-- Este script é idempotente — pode ser executado múltiplas vezes com segurança.
--
-- O que este script faz:
-- 1. Adiciona auth_id (UUID) em public.users para vincular com auth.users
-- 2. Adiciona coluna "deletedAt" nas tabelas que não a possuem (diarios, solicitacoes_compra, users)
-- 3. Backfill de deletedAt a partir do campo metadata JSON (migração do soft-delete legado)
-- 4. Cria trigger que sincroniza auth.users → public.users no cadastro
-- 5. Cria trigger que remove auth.users ao deletar de public.users
-- 6. Habilita RLS em todas as tabelas
-- 7. Define políticas de RLS para service_role (backend) e authenticated (usuários)
-- 8. Cria stored procedures (RPCs) para consultas complexas com JOINs
-- =============================================================================

-- ── 1. Adicionar auth_id em public.users ─────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- ── 2. Adicionar "deletedAt" nas tabelas sem coluna dedicada ─────────────────
-- Padroniza soft-delete para todas as tabelas (via coluna, não via metadata JSON)

ALTER TABLE public.diarios
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE public.solicitacoes_compra
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

-- Índices de suporte ao soft-delete (filtro WHERE "deletedAt" IS NULL)
CREATE INDEX IF NOT EXISTS idx_diarios_deletedat        ON public.diarios("deletedAt");
CREATE INDEX IF NOT EXISTS idx_solicitacoes_deletedat   ON public.solicitacoes_compra("deletedAt");
CREATE INDEX IF NOT EXISTS idx_users_deletedat          ON public.users("deletedAt");

-- ── 3. Backfill de deletedAt a partir de metadata JSON ───────────────────────
-- Migra registros que tinham soft-delete via metadata.deletedAt

UPDATE public.users
  SET "deletedAt" = (metadata::jsonb->>'deletedAt')::TIMESTAMPTZ
  WHERE metadata IS NOT NULL
    AND metadata != ''
    AND "deletedAt" IS NULL
    AND (metadata::jsonb ? 'deletedAt')
    AND (metadata::jsonb->>'deletedAt') IS NOT NULL;

UPDATE public.diarios
  SET "deletedAt" = (metadata::jsonb->>'deletedAt')::TIMESTAMPTZ
  WHERE metadata IS NOT NULL
    AND metadata != ''
    AND "deletedAt" IS NULL
    AND (metadata::jsonb ? 'deletedAt')
    AND (metadata::jsonb->>'deletedAt') IS NOT NULL;

UPDATE public.solicitacoes_compra
  SET "deletedAt" = (metadata::jsonb->>'deletedAt')::TIMESTAMPTZ
  WHERE metadata IS NOT NULL
    AND metadata != ''
    AND "deletedAt" IS NULL
    AND (metadata::jsonb ? 'deletedAt')
    AND (metadata::jsonb->>'deletedAt') IS NOT NULL;

-- ── 4. Trigger: auth.users → public.users (on signup) ───────────────────────
-- Quando um usuário é criado no Supabase Auth, inserimos/vinculamos em public.users

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    auth_id,
    email,
    nome,
    perfil,
    "isActive",
    metadata
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'encarregado'),
    TRUE,
    json_build_object('createdAt', NOW())::TEXT
  )
  ON CONFLICT (email)
    DO UPDATE SET auth_id = NEW.id
    WHERE public.users.auth_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 5. Trigger: sincroniza atualização de email do Supabase Auth ─────────────

CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
    SET email = NEW.email
    WHERE auth_id = NEW.id
      AND email != NEW.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_update();

-- ── 6. Habilitar RLS em todas as tabelas ─────────────────────────────────────
-- O backend usa service_role_key, que bypassa RLS automaticamente.
-- RLS protege acessos diretos via SDK no frontend (caso existam).

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_encarregados  ENABLE ROW LEVEL SECURITY;

-- ── 7. Políticas de RLS ───────────────────────────────────────────────────────
-- service_role (backend) → acesso total, sem restrições (bypass automático do PostgreSQL)
-- authenticated (frontend Supabase SDK, se usado) → acesso limitado ao próprio usuário
-- anon → sem acesso

-- ── 7a. users ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_service_all     ON public.users;
DROP POLICY IF EXISTS users_read_own        ON public.users;
DROP POLICY IF EXISTS users_update_own      ON public.users;

CREATE POLICY users_read_own ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- ── 7b. obras ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS obras_authenticated_select ON public.obras;
DROP POLICY IF EXISTS obras_admin_all            ON public.obras;

-- Usuários autenticados veem obras onde são responsável ou encarregado
CREATE POLICY obras_authenticated_select ON public.obras
  FOR SELECT
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND (
      responsavel = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
      OR id IN (
        SELECT "obraId" FROM public.obra_encarregados
        WHERE "userId" = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
      )
    )
  );

-- ── 7c. medicoes ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS medicoes_authenticated_select ON public.medicoes;

CREATE POLICY medicoes_authenticated_select ON public.medicoes
  FOR SELECT
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND responsavel = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 7d. diarios ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS diarios_authenticated_select ON public.diarios;

CREATE POLICY diarios_authenticated_select ON public.diarios
  FOR SELECT
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND responsavel = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 7e. arquivos ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS arquivos_authenticated_select ON public.arquivos;

CREATE POLICY arquivos_authenticated_select ON public.arquivos
  FOR SELECT
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND "uploadedBy" = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 7f. solicitacoes_compra ───────────────────────────────────────────────
DROP POLICY IF EXISTS solicitacoes_authenticated_select ON public.solicitacoes_compra;

CREATE POLICY solicitacoes_authenticated_select ON public.solicitacoes_compra
  FOR SELECT
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND solicitante = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 7g. obra_encarregados ─────────────────────────────────────────────────
DROP POLICY IF EXISTS obra_encarregados_authenticated_select ON public.obra_encarregados;

CREATE POLICY obra_encarregados_authenticated_select ON public.obra_encarregados
  FOR SELECT
  TO authenticated
  USING (
    "userId" = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 8. Storage: bucket "files" ────────────────────────────────────────────────
-- Cria o bucket e define políticas de acesso.
-- Execute apenas uma vez; INSERT ignora se já existir.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'files',
  'files',
  FALSE,          -- privado: URLs assinadas obrigatórias
  5242880,        -- 5MB (5 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: service_role pode fazer tudo (backend)
-- Nota: storage RLS é separado das políticas de tabela.
-- O backend usa service_role_key e bypassa automaticamente.

-- Política para usuários autenticados verem seus próprios arquivos:
DROP POLICY IF EXISTS storage_authenticated_select ON storage.objects;
CREATE POLICY storage_authenticated_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'files'
    AND auth.uid() IS NOT NULL
  );

-- ── 9. Stored Procedures (RPCs) para queries complexas ───────────────────────
-- Chamadas via supabase.rpc('nome_funcao', { params }) no repositório.

-- ── 9a. Medições filtradas com JOINs ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_medicoes_filtered(
  p_obra          INTEGER   DEFAULT NULL,
  p_responsavel   INTEGER   DEFAULT NULL,
  p_status        TEXT      DEFAULT NULL,
  p_area          TEXT      DEFAULT NULL,
  p_tipo_servico  TEXT      DEFAULT NULL,
  p_data_inicio   TIMESTAMPTZ DEFAULT NULL,
  p_data_fim      TIMESTAMPTZ DEFAULT NULL,
  p_page          INTEGER   DEFAULT 1,
  p_limit         INTEGER   DEFAULT 10
)
RETURNS TABLE (
  id              INTEGER,
  obra            INTEGER,
  responsavel     INTEGER,
  data            TIMESTAMPTZ,
  periodo         TEXT,
  itens           TEXT,
  observacoes     TEXT,
  status          TEXT,
  "aprovadoPor"   INTEGER,
  "dataAprovacao" TIMESTAMPTZ,
  comprimento     FLOAT,
  largura         FLOAT,
  altura          FLOAT,
  "areaCalculada" FLOAT,
  volume          FLOAT,
  area            TEXT,
  "tipoServico"   TEXT,
  "deletedAt"     TIMESTAMPTZ,
  "motivoRejeicao" TEXT,
  created_at      TIMESTAMPTZ,
  "obraNome"      TEXT,
  "responsavelNome" TEXT,
  total_count     BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER := (p_page - 1) * p_limit;
  v_total  BIGINT;
BEGIN
  -- Contagem total (sem LIMIT)
  SELECT COUNT(*) INTO v_total
  FROM public.medicoes m
  WHERE m."deletedAt" IS NULL
    AND (p_obra        IS NULL OR m.obra         = p_obra)
    AND (p_responsavel IS NULL OR m.responsavel  = p_responsavel)
    AND (p_status      IS NULL OR m.status       = p_status)
    AND (p_area        IS NULL OR m.area         = p_area)
    AND (p_tipo_servico IS NULL OR m."tipoServico" = p_tipo_servico)
    AND (p_data_inicio IS NULL OR m.data        >= p_data_inicio)
    AND (p_data_fim    IS NULL OR m.data        <= p_data_fim);

  RETURN QUERY
  SELECT
    m.id,
    m.obra,
    m.responsavel,
    m.data,
    m.periodo,
    m.itens,
    m.observacoes,
    m.status,
    m."aprovadoPor",
    m."dataAprovacao",
    m.comprimento,
    m.largura,
    m.altura,
    m."areaCalculada",
    m.volume,
    m.area,
    m."tipoServico",
    m."deletedAt",
    m."motivoRejeicao",
    m.created_at,
    o.nome                   AS "obraNome",
    u.nome                   AS "responsavelNome",
    v_total                  AS total_count
  FROM public.medicoes m
  LEFT JOIN public.obras  o ON o.id = m.obra
  LEFT JOIN public.users  u ON u.id = m.responsavel
  WHERE m."deletedAt" IS NULL
    AND (p_obra        IS NULL OR m.obra         = p_obra)
    AND (p_responsavel IS NULL OR m.responsavel  = p_responsavel)
    AND (p_status      IS NULL OR m.status       = p_status)
    AND (p_area        IS NULL OR m.area         = p_area)
    AND (p_tipo_servico IS NULL OR m."tipoServico" = p_tipo_servico)
    AND (p_data_inicio IS NULL OR m.data        >= p_data_inicio)
    AND (p_data_fim    IS NULL OR m.data        <= p_data_fim)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

-- ── 9b. Total de medição por obra ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_total_medicao_por_obra(p_obra_id INTEGER)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      (elem->>'quantidade')::NUMERIC * (elem->>'valorUnitario')::NUMERIC
    ), 0
  )
  FROM public.medicoes m,
    LATERAL jsonb_array_elements(m.itens::jsonb) AS elem
  WHERE m.obra      = p_obra_id
    AND m.status    = 'aprovada'
    AND m."deletedAt" IS NULL;
$$;

-- ── 9c. Uso de storage por obra ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_storage_usage(p_obra_id INTEGER DEFAULT NULL)
RETURNS TABLE (obra INTEGER, total_bytes BIGINT, total_arquivos BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.obra,
    COALESCE(SUM(a.tamanho), 0)::BIGINT AS total_bytes,
    COUNT(*)::BIGINT                    AS total_arquivos
  FROM public.arquivos a
  WHERE a."deletedAt" IS NULL
    AND (p_obra_id IS NULL OR a.obra = p_obra_id)
  GROUP BY a.obra;
$$;

-- ── 9d. Encarregados de uma obra com dados do usuário ─────────────────────
CREATE OR REPLACE FUNCTION public.listar_encarregados(p_obra_id INTEGER)
RETURNS TABLE (
  id             INTEGER,
  "obraId"       INTEGER,
  "userId"       INTEGER,
  funcao         TEXT,
  "dataInclusao" TIMESTAMPTZ,
  nome           TEXT,
  email          TEXT,
  perfil         TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oe.id,
    oe."obraId",
    oe."userId",
    oe.funcao,
    oe."dataInclusao",
    u.nome,
    u.email,
    u.perfil
  FROM public.obra_encarregados oe
  JOIN public.users u ON u.id = oe."userId"
  WHERE oe."obraId" = p_obra_id
    AND u."deletedAt" IS NULL
  ORDER BY oe."dataInclusao" ASC;
$$;

-- ── 10. View de estatísticas para /api/stats ───────────────────────────────
CREATE OR REPLACE VIEW public.v_stats AS
SELECT
  (SELECT COUNT(*) FROM public.obras            WHERE "deletedAt" IS NULL)                         AS total_obras,
  (SELECT COUNT(*) FROM public.medicoes          WHERE "deletedAt" IS NULL)                         AS total_medicoes,
  (SELECT COUNT(*) FROM public.medicoes          WHERE "deletedAt" IS NULL AND status = 'enviada')  AS medicoes_pendentes,
  (SELECT COUNT(*) FROM public.medicoes          WHERE "deletedAt" IS NULL AND status = 'aprovada') AS medicoes_aprovadas,
  (SELECT COUNT(*) FROM public.solicitacoes_compra WHERE "deletedAt" IS NULL)                       AS total_solicitacoes,
  (SELECT COUNT(*) FROM public.solicitacoes_compra WHERE "deletedAt" IS NULL AND status = 'pendente') AS solicitacoes_pendentes,
  (SELECT COUNT(*) FROM public.arquivos          WHERE "deletedAt" IS NULL)                         AS total_arquivos;

-- ── Verificação final ─────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✓ Migração Supabase Auth + RLS concluída com sucesso.';
  RAISE NOTICE '  - auth_id adicionado em public.users';
  RAISE NOTICE '  - deletedAt adicionado em diarios, solicitacoes_compra, users';
  RAISE NOTICE '  - Backfill de metadata.deletedAt executado';
  RAISE NOTICE '  - Trigger on_auth_user_created criado';
  RAISE NOTICE '  - RLS habilitado em todas as tabelas';
  RAISE NOTICE '  - Stored procedures criadas: get_medicoes_filtered, get_total_medicao_por_obra, get_storage_usage, listar_encarregados';
  RAISE NOTICE '  - Bucket "files" criado/verificado no Storage';
  RAISE NOTICE '  - View v_stats criada';
END $$;
