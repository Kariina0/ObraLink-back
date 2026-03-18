# Regras de negócio implementadas

> Referência de todas as regras aplicadas no backend (camada `services/`).  
> Atualizado em 17/03/2026.

---

## 1. Usuários, autenticação e segurança

### RN-01 — Perfis e autorização

- Perfis válidos: `admin`, `supervisor`, `encarregado`.
- Controle de acesso por `authorize(perfis...)` nas rotas.
- `encarregado` é restrito a dados próprios ou de obras vinculadas.
- `admin` tem acesso irrestrito a todos os recursos.
- `supervisor` pode visualizar e aprovar/rejeitar, mas não gerencia usuários.

### RN-02 — Senha e credenciais

- Comprimento mínimo: `8` caracteres.
- Obrigatório: ao menos `1` letra maiúscula e `1` dígito numérico.
- Senhas e refresh tokens armazenados com hash `bcrypt`.
- Credenciais nunca são retornadas nos DTOs de usuário.

### RN-03 — Sessão JWT

- Access token: validade padrão de `15 min` (configurável por variável de ambiente).
- Refresh token: validade padrão de `7 dias`.
- Refresh token é **rotacionado** a cada renovação (antigo invalidado).
- Token é validado pelo middleware `authenticate` em todas as rotas protegidas.

### RN-04 — Recuperação de senha

- Fluxo: solicitação → código numérico de 6 dígitos enviado → uso único para redefinir.
- Código tem prazo de validade controlado por `RESET_PASSWORD_TTL_MINUTES`.
- Código não pode ser reutilizado após uso bem-sucedido.

### RN-05 — Rate limiting

| Rota | Limite |
|------|--------|
| Global | 100 req / 15 min |
| `POST /auth/login` | 10 req / 15 min |
| `POST /auth/refresh` | 30 req / 15 min |
| `POST /auth/forgot-password` | Limite dedicado |
| `POST /auth/reset-password` | Limite dedicado |

---

## 2. Obras e vínculo de equipe

### RN-06 — Cadastro e manutenção de obra

- Criação, edição e exclusão: somente `admin`.
- Código de obra deve ser único no sistema.
- Código pode ser gerado automaticamente com o padrão `OBR-<timestamp>` se omitido.
- Exclusão é lógica (coluna `deletedAt`).

### RN-07 — Vínculo obra ↔ encarregado (N:N)

- Relação gerenciada pela tabela `obra_encarregados`.
- Chave única por par `(obraId, userId)` — sem duplicatas.
- `encarregado` só visualiza obras às quais está explicitamente vinculado.
- Apenas `admin` adiciona ou remove vínculos.

---

## 3. Medições

### RN-08 — Criação

- Campos obrigatórios: `obra`, `itens` (array com ao menos 1 item).
- `encarregado` só pode criar medições em obras às quais está vinculado.
- `syncId` é gerado automaticamente pelo backend se ausente na requisição.

### RN-09 — Cálculo geométrico automático

- Se `comprimento` e `largura` fornecidos: `areaCalculada = comprimento × largura`.
- Se `comprimento`, `largura` e `altura` fornecidos: `volume = comprimento × largura × altura`.
- Cálculo realizado no backend — não aceito diretamente do cliente.

### RN-10 — Aprovação e rejeição

- Somente `admin` e `supervisor` podem aprovar ou rejeitar.
- Aprovação registra `aprovadoPor` (id do usuário) e `dataAprovacao`.
- Rejeição armazena motivo em `metadata.motivoRejeicao`.

### RN-11 — Edição e exclusão

- `encarregado` só altera/exclui medição criada por ele mesmo.
- Medição com status `aprovada` não pode ser editada por `encarregado` nem `supervisor`.
- Apenas `admin` pode editar medição aprovada em situações excepcionais.

---

## 4. Diário de obra

### RN-12 — Registro diário

- Campos obrigatórios: `obra`, `atividades` (array com ao menos 1 item).
- `clima` restrito ao enum: `ensolarado | nublado | chuvoso | ventania | instavel`.
- Arrays e objetos estruturados (atividades, equipe, ocorrências) são serializados em JSON no banco.

### RN-13 — Controle de acesso ao diário

- `encarregado` visualiza e pode editar somente seus próprios registros.
- `supervisor` e `admin` têm acesso a todos os diários das obras vinculadas.

---

## 5. Solicitações de compra

### RN-14 — Criação de solicitação

- Campo obrigatório: `itens` (array com ao menos 1 item contendo `quantidade` e `valorUnitario`).
- `valorTotal` calculado exclusivamente no backend: `∑ (quantidade × valorUnitario)`.
- Prioridade permitida: `baixa | media | alta | urgente`.
- Status inicial: `pendente` (definido pelo sistema, nunca pelo cliente).

### RN-15 — Aprovação e rejeição

- Somente `admin` e `supervisor` podem aprovar ou rejeitar.
- Aprovação registra `aprovadoPor` e `dataAprovacao`.
- Rejeição pode registrar motivo em `motivoRejeicao`.

---

## 6. Arquivos e fotos

### RN-16 — Regras de upload

- Campos obrigatórios: `obra`, `tipoArquivo`, `descricao`.
- Quando `tipoArquivo = problema`, o campo `detalheProblema` é obrigatório.
- Limite padrão por arquivo: `5 MB` (configurável via `MAX_FILE_SIZE`).
- Tipos permitidos padrão: `image/jpeg`, `image/png`, `image/heic`, `image/heif`, `application/pdf`.

### RN-17 — Segurança no acesso a arquivos

- Todo arquivo é validado por **magic bytes** antes do armazenamento (`fileTypeValidator`).
- Acesso a arquivos locais via `/api/files/raw/:tipo/:filename` exige autenticação.
- Proteção contra **path traversal**: caracteres `..`, `/` e `\` no nome do arquivo são rejeitados.

### RN-18 — Compressão e armazenamento

- Imagens JPEG/PNG/HEIC/HEIF podem ser comprimidas com `sharp` quando suportadas pelo ambiente (qualidade configurável por `IMAGE_COMPRESSION_QUALITY`).
- Storage configurável: `local` (disco) ou `supabase` (nuvem).
- Em Supabase, URLs assinadas são renovadas automaticamente nas listagens.

---

## 7. Sincronização e baixa conectividade

### RN-19 — Protocolo de sincronização

- Endpoints: `/api/sync/pending`, `/api/sync/push`, `/api/sync/conflicts`, `/api/sync/retry`.
- Itens sincronizáveis exigem: `syncId` (UUID) e `clientTimestamp` (ISO 8601).
- `syncId` é gerado no frontend antes do envio e persistido no backend.

### RN-20 — Resolução de conflito

- Estratégia: **Last-Write-Wins** — o registro com `clientTimestamp` mais recente prevalece.
- Resposta do endpoint `push` retorna três listas: `success`, `conflicts`, `errors`.
- `conflicts` preserva ambas as versões para exibição opcional ao usuário.

---

## 8. LGPD e rastreabilidade

### RN-21 — Exclusão lógica

- O sistema prioriza exclusão lógica para preservar trilha operacional e auditoria.
- Uso de `deletedAt` (coluna) nas principais entidades; algumas usam `metadata.deletedAt`.
- Registros excluídos logicamente não aparecem nas listagens padrão.

### RN-22 — Minimização de dados sensíveis

- DTO de usuário (`UserDTO`) nunca expõe `senha` ou `refreshToken`.
- Exportações de dados removem campos de credenciais.
- Logs do Winston não devem registrar payloads com credenciais (prática configurada).