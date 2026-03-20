# ObraLink Backend

Backend Node.js/Express do ObraLink, responsável por autenticação, obras, medições, diários, solicitações de compra, arquivos e sincronização offline.

## Sumário

- [Escopo](#escopo)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Módulos e responsabilidades](#módulos-e-responsabilidades)
- [Endpoints principais](#endpoints-principais)
- [Perfis e acesso](#perfis-e-acesso)
- [Decisões técnicas relevantes](#decisões-técnicas-relevantes)
- [Limitações atuais](#limitações-atuais)
- [Leituras complementares](#leituras-complementares)

## Escopo

Este backend atende o fluxo operacional de obra com:

- autenticação JWT com refresh token;
- controle de acesso por perfil (`admin`, `supervisor`, `encarregado`);
- gestão de obras e vínculo com encarregados;
- registro e aprovação de medições;
- diário de obra estruturado;
- solicitações de compra com cálculo de valor total;
- upload de arquivos local ou Supabase Storage;
- sincronização para cenários offline.

## Stack

| Camada | Tecnologias |
|---|---|
| Runtime/API | Node.js >= 18, Express |
| Segurança | JWT, bcrypt, helmet, express-rate-limit, CORS controlado |
| Validação | Joi |
| Dados | Supabase/PostgreSQL (runtime), Knex (migrations e scripts) |
| Arquivos | Multer, Sharp, Supabase Storage/local disk |
| Logs | Winston |
| Testes | Jest, Supertest |

## Arquitetura

Padrão principal aplicado:

`Route -> Middleware -> Controller -> Service -> Repository -> DTO/Response`

- `routes`: definição de contratos HTTP e proteção por acesso.
- `middleware`: autenticação, autorização, validação e tratamento de erro.
- `controllers`: adaptação HTTP (`req/res`).
- `services`: regras de negócio.
- `repositories`: acesso a dados.
- `dtos`: formatação da resposta para cliente.

## Módulos e responsabilidades

| Módulo | Funções centrais |
|---|---|
| Auth | login, refresh, logout, me, cadastro (admin), recuperação/troca de senha |
| Obras | CRUD, status da obra, vínculo com encarregados |
| Medições | criação, edição, listagem, rascunho, aprovação/rejeição |
| Diários | criação, listagem, consulta por duplicidade, edição/exclusão |
| Solicitações | criação/listagem/consulta e aprovação/rejeição |
| Arquivos | upload único/múltiplo, consulta e remoção, rota raw local |
| Sync | pendências, push em lote, conflitos, retry |
| Management | overview e exportações CSV |

## Endpoints principais

Base local: `http://localhost:5000/api`

| Grupo | Rotas |
|---|---|
| Health | `GET /api/health`, `GET /api/stats` |
| Auth | `/auth/*` |
| Obras | `/obras/*` |
| Medições | `/measurements/*` |
| Diários | `/diarios/*` |
| Solicitações | `/solicitacoes/*` |
| Arquivos | `/files/*` |
| Sync | `/sync/*` |
| Gestão | `/management/*` |

Catálogo completo de rotas: [COMMANDS.md](COMMANDS.md).

## Perfis e acesso

| Perfil | Acesso típico |
|---|---|
| `admin` | Acesso total administrativo e aprovação |
| `supervisor` | Visão gerencial e aprovações |
| `encarregado` | Operação de campo e dados próprios/vinculados |

## Decisões técnicas relevantes

- `server.js` valida variáveis obrigatórias antes de subir aplicação.
- `health` usa consulta em Supabase para validar conectividade real.
- Rate limit global ignora rotas `/api/auth/*` (que têm limites específicos) e chamadas autenticadas com Bearer token.
- Rota `GET /api/files/raw/:tipo/:filename` usa `optionalAuth` e proteção dupla contra path traversal.
- Exportações CSV aplicam escape anti-injection para compatibilidade com planilhas.

## Limitações atuais

- `GET /api/management/exports/boletim.pdf` retorna `501 Not Implemented`.
- Há uso de fallback para colunas `deletedAt` em consultas legadas.

## Leituras complementares

- [INDEX.md](INDEX.md)
- [INSTALL.md](INSTALL.md)
- [COMMANDS.md](COMMANDS.md)
- [STRUCTURE.md](STRUCTURE.md)
- [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md)
- [RELATORIO_TESTES.md](RELATORIO_TESTES.md)
- [ROADMAP.md](ROADMAP.md)
