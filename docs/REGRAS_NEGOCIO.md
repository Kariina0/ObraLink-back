# Regras de negócio (backend)

Catálogo de regras implementadas nas camadas de validação e serviço.

## Sumário

- [Autenticação e sessão](#autenticação-e-sessão)
- [Obras](#obras)
- [Medições](#medições)
- [Diário de obra](#diário-de-obra)
- [Solicitações de compra](#solicitações-de-compra)
- [Arquivos](#arquivos)
- [Sincronização](#sincronização)
- [Gestão e exportações](#gestão-e-exportações)

## Autenticação e sessão

- Perfis válidos: `admin`, `supervisor`, `encarregado`.
- Cadastro via `/auth/register` permite `supervisor` e `encarregado` como alvo de `perfil`.
- Política de senha: mínimo 8 caracteres, ao menos 1 maiúscula e 1 número.
- Login, refresh, recuperação e reset possuem rate-limits dedicados.
- Refresh token é rotacionado e armazenado em hash.

## Obras

- Criação, edição, remoção e mudança de status são ações administrativas.
- Código da obra deve ser único.
- Vínculo obra-encarregado é N:N.
- Encarregado enxerga somente obras vinculadas.
- Há regra de bloqueio de remoção quando existem vínculos operacionais.

## Medições

- Campos obrigatórios de contexto: `obra` e `itens` (>=1).
- `area` e `tipoServico` são obrigatórios quando status não é `rascunho`.
- Dimensões aceitas: `comprimento`, `largura`, `altura`.
- Fluxo de status: `rascunho`, `enviada`, `aprovada`, `rejeitada`.
- Aprovar/rejeitar exige `supervisor` ou `admin`.
- Endpoints dedicados para `minhas`, `rascunhos` e por obra.

## Diário de obra

- Requer `obra`, `data` e `atividades` (>=1 item).
- `data` não pode ser futura.
- `clima` válido: `ensolarado`, `nublado`, `chuvoso`, `ventania`, `instavel`.
- Campos estruturados: `atividades`, `equipamentos`, `maoDeObra`, `materiais`, `ocorrencias`, `visitantes`, `fotos`.
- Endpoint `/diarios/check` verifica duplicidade de diário por obra+data.

## Solicitações de compra

- Requer pelo menos um item com descrição, quantidade e unidade.
- `valorTotal` é calculado no backend pela soma `quantidade * valorUnitario`.
- Status inicial controlado pelo sistema: `pendente`.
- Aprovação/rejeição exige `supervisor` ou `admin`.
- Encarregado acessa as próprias solicitações.

## Arquivos

- Upload único e múltiplo (`upload-multiple` com máximo 10 arquivos).
- Tipos e tamanho de arquivo são configuráveis por variável de ambiente.
- Arquivos locais podem ser servidos via `/files/raw/:tipo/:filename`.
- A rota raw aplica validação de caminho e proteção contra path traversal.
- Suporte a storage local ou Supabase.

## Sincronização

- Endpoints: `pending`, `push`, `conflicts`, `retry`.
- Payloads exigem estrutura validada por schemas de sync.
- Fluxos suportam itens com `syncId` e `clientTimestamp`.
- Estratégia de conflito segue abordagem `Last-Write-Wins`.

## Gestão e exportações

- `overview` consolida métricas por período (`periodo` em dias).
- Alerta por orçamento >= 80% e por prazo <= 30 dias.
- Exportações CSV: `obras.csv` e `medicoes.csv`.
- CSV possui escape anti-injection para planilhas.
- Exportação `boletim.pdf` está mapeada, mas retorna `501`.

Referências:

- [COMMANDS.md](COMMANDS.md)
- [STRUCTURE.md](STRUCTURE.md)
- [README.md](README.md)
