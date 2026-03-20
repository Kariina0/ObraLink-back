# Estrutura técnica do backend

Descrição completa das pastas e responsabilidades, alinhada ao código existente.

## Sumário

- [Árvore de diretórios](#árvore-de-diretórios)
- [Responsabilidade por camada](#responsabilidade-por-camada)
- [Fluxo de requisição](#fluxo-de-requisição)
- [Fluxo de erro](#fluxo-de-erro)
- [Guia para novo módulo](#guia-para-novo-módulo)

## Árvore de diretórios

```text
backend/
├── docs/
├── data/
├── logs/
├── migrations/
├── scripts/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── dtos/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── validators/
└── tests/
    ├── integration/
    ├── unit/
    └── helpers/
```

## Responsabilidade por camada

| Camada | Faz | Não faz |
|---|---|---|
| `routes` | endpoint, middlewares de acesso/validação | regra de negócio |
| `middleware` | auth, authorize, validação, tratamento de erro | query de domínio |
| `controllers` | interface HTTP para service | regra pesada/persistência |
| `services` | política de domínio e autorização contextual | acoplamento de transporte |
| `repositories` | persistência/consulta | validação de negócio |
| `dtos` | serialização/normalização de resposta | acesso a banco |

## Fluxo de requisição

`HTTP -> app.js -> routes/index.js -> auth/validate -> controller -> service -> repository -> DTO -> response`

## Fluxo de erro

- validações Joi e erros de domínio disparam exceções tipadas;
- `middleware/errorHandler.js` converte para resposta HTTP consistente;
- logs são emitidos via `utils/logger.js`.

## Guia para novo módulo

1. Criar migration em `migrations/`.
2. Criar validator em `src/validators/`.
3. Criar repository em `src/repositories/`.
4. Criar service em `src/services/`.
5. Criar controller em `src/controllers/`.
6. Criar route em `src/routes/` e registrar em `src/routes/index.js`.
7. Criar DTO em `src/dtos/`.
8. Adicionar testes em `tests/integration/` e/ou `tests/unit/`.
9. Atualizar [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md) e [COMMANDS.md](COMMANDS.md).
