# Roadmap técnico (baseado no estado atual)

## Concluído

- Autenticação JWT com refresh token e RBAC
- CRUD de obras, medições, diários, solicitações e arquivos
- Upload com compressão e validação de arquivo
- Storage local e Supabase
- Endpoints de sincronização (`/api/sync/*`)
- Painel gerencial e exportações CSV
- Recuperação de senha por código
- Testes automatizados do backend (Jest/Supertest)

## Prioridade alta

### 1) Fortalecer segurança de sessão no frontend

- Migrar tokens de `localStorage` para cookies `httpOnly` com estratégia de refresh compatível.

### 2) Uniformizar soft delete

- Padronizar exclusão lógica para usar colunas dedicadas (`deletedAt`) em todas as consultas críticas, reduzindo dependência de `metadata` JSON.

### 3) Cobertura de testes por domínio

- Ampliar testes para fluxos de obras, diário e sync conflict handling.

## Prioridade média

### 4) Exportação PDF

- Implementar `/api/management/exports/boletim.pdf` (hoje retorna `501`).

### 5) Observabilidade operacional

- Adicionar métricas de sincronização (sucesso/conflito/erro por tipo).

### 6) Contrato formal da API

- Publicar especificação OpenAPI com exemplos reais dos payloads.

## Prioridade evolutiva

### 7) UX de baixa conectividade

- Expandir no frontend a experiência de reprocessamento manual por item sincronizado.

### 8) Governança LGPD

- Adicionar política de retenção/anonimização operacional no nível de produto.

### 9) CI de qualidade

- Pipeline com lint + testes + bloqueio de merge por falha.