# Regras de negócio implementadas

## 1. Usuários, autenticação e segurança

### RN-01 — Perfis e autorização

- Perfis válidos: `admin`, `supervisor`, `encarregado`.
- Controle de acesso por `authorize(...)` nas rotas.
- `encarregado` é restrito a dados próprios/vinculados; `admin` tem acesso total.

### RN-02 — Senha e credenciais

- Senha mínima: `8` caracteres.
- Obrigatório: ao menos `1` maiúscula e `1` número.
- Senhas e refresh tokens são salvos com hash `bcrypt`.

### RN-03 — Sessão JWT

- Access token com validade padrão de `15m`.
- Refresh token com validade padrão de `7d`.
- Refresh token é rotacionado a cada renovação.

### RN-04 — Recuperação de senha

- Fluxo por código numérico de 6 dígitos.
- Código tem prazo de validade (`RESET_PASSWORD_TTL_MINUTES`).
- Código não pode ser reutilizado.

### RN-05 — Rate limit

- Global: `100` req / `15 min` (configurável).
- Login: `10` req / `15 min`.
- Refresh: `30` req / `15 min`.
- Forgot/reset: limites dedicados.

## 2. Obras e vínculo de equipe

### RN-06 — Cadastro e manutenção de obra

- Criação/edição/exclusão de obra: somente `admin`.
- Código de obra deve ser único.
- Código pode ser gerado automaticamente (`OBR-<timestamp>`).

### RN-07 — Vínculo obra x encarregado (N:N)

- Relação pela tabela `obra_encarregados`.
- Chave única por par `(obraId, userId)`.
- `encarregado` só visualiza obras às quais está vinculado.

## 3. Medições

### RN-08 — Criação

- `obra` e `itens` são obrigatórios.
- `encarregado` só cria em obra vinculada.
- `syncId` é gerado se ausente.

### RN-09 — Cálculo geométrico

- Se `comprimento` e `largura` existem, backend calcula `areaCalculada = comprimento * largura`.
- Se `altura` também existe, calcula `volume = comprimento * largura * altura`.

### RN-10 — Aprovação/rejeição

- Somente `admin` e `supervisor` podem aprovar/rejeitar.
- Aprovação registra `aprovadoPor` e `dataAprovacao`.
- Rejeição pode armazenar motivo em `metadata`.

### RN-11 — Edição/exclusão

- `encarregado` só altera/exclui medição própria.
- Medição `aprovada` não pode ser editada por não-admin.

## 4. Diário de obra

### RN-12 — Registro diário

- `obra` obrigatória.
- `atividades` com pelo menos um item.
- `clima` restrito ao enum (`ensolarado`, `nublado`, `chuvoso`, `ventania`, `instavel`).
- Arrays estruturados são serializados em JSON no banco.

### RN-13 — Acesso

- `encarregado` vê e altera somente seus próprios diários.
- `supervisor`/`admin` têm listagem ampliada.

## 5. Solicitações de compra

### RN-14 — Criação de solicitação

- `itens` obrigatório e com mínimo de 1 item.
- Prioridade permitida: `baixa`, `media`, `alta`, `urgente`.
- `valorTotal` calculado no backend como soma de `quantidade * valorUnitario`.
- Status inicial: `pendente`.

### RN-15 — Aprovação/rejeição

- Somente `admin` e `supervisor`.
- Aprovação preenche `aprovadoPor` e `dataAprovacao`.
- Rejeição pode registrar `motivoRejeicao`.

## 6. Arquivos e fotos

### RN-16 — Regras de upload

- Campos obrigatórios: `obra`, `tipoArquivo`, `descricao`.
- Quando `tipoArquivo=problema`, `detalheProblema` é obrigatório.
- Limite padrão por arquivo: `5 MB`.
- Tipos permitidos padrão: JPEG, PNG, PDF.

### RN-17 — Segurança de arquivo

- Validação por magic bytes (`fileTypeValidator`).
- Rota de acesso local autenticada: `/api/files/raw/:tipo/:filename`.
- Proteção contra path traversal.

### RN-18 — Compressão e armazenamento

- Imagens podem ser comprimidas com `sharp`.
- Storage configurável: `local` ou `supabase`.
- Em Supabase, URL assinada é renovada nas listagens.

## 7. Sincronização e baixa conectividade

### RN-19 — Protocolo de sync

- Endpoints: `/api/sync/pending`, `/api/sync/push`, `/api/sync/conflicts`, `/api/sync/retry`.
- Itens sincronizáveis exigem `syncId` e `clientTimestamp`.

### RN-20 — Resolução de conflito

- Estratégia `Last-Write-Wins` baseada em timestamp cliente vs. servidor.
- Resultado de `push` retorna listas de `success`, `conflicts`, `errors`.

## 8. LGPD e rastreabilidade

### RN-21 — Exclusão lógica

- O sistema prioriza exclusão lógica para preservar trilha operacional/auditoria.
- Há uso de `deletedAt` em colunas e em `metadata` dependendo da entidade.

### RN-22 — Minimização de dados sensíveis

- DTO de usuário não expõe senha/refresh token.
- Exportação de dados de usuário remove credenciais sensíveis.