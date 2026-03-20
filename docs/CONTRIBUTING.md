# Guia de contribuição

Padrão de contribuição para manter consistência entre código, testes e documentação.

## Sumário

- [Fluxo recomendado](#fluxo-recomendado)
- [Padrões técnicos do backend](#padrões-técnicos-do-backend)
- [Checklist obrigatório de PR](#checklist-obrigatório-de-pr)
- [Padrão de commits](#padrão-de-commits)
- [Quando atualizar docs](#quando-atualizar-docs)

## Fluxo recomendado

1. Atualize branch local com base na principal de trabalho.
2. Crie branch temática (`feature/*`, `fix/*`, `docs/*`, `refactor/*`).
3. Faça alterações pequenas e focadas.
4. Execute lint e testes antes de abrir PR.
5. Atualize docs impactados na mesma entrega.

## Padrões técnicos do backend

- Preserve arquitetura em camadas descrita em [STRUCTURE.md](STRUCTURE.md).
- Toda entrada HTTP deve passar por schema Joi.
- Regra de negócio deve ficar em `services`.
- Repositórios não devem conter lógica de autorização.
- Rotas sensíveis devem usar `authenticate` e `authorize`.
- Evite alterações fora do escopo da tarefa.

## Checklist obrigatório de PR

- [ ] `npm run lint` sem erros.
- [ ] `npm test -- --runInBand` passando.
- [ ] Mudanças de schema com migration.
- [ ] Novas regras descritas em [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md).
- [ ] Novos comandos/variáveis refletidos em [COMMANDS.md](COMMANDS.md) e [INSTALL.md](INSTALL.md).
- [ ] Endpoints documentados quando houver alteração de contrato.

## Padrão de commits

Formato recomendado:

`tipo(escopo): descrição curta`

Tipos comuns: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

Exemplos:

- `feat(sync): adicionar validação de payload em retry`
- `fix(files): reforçar proteção de path traversal`
- `docs(commands): incluir endpoints de gestão`

## Quando atualizar docs

Atualize documentação sempre que houver mudança em:

- endpoint, payload, validação ou regra de acesso;
- variáveis de ambiente;
- scripts npm;
- comportamento operacional relevante.

Referências:

- [README.md](README.md)
- [INSTALL.md](INSTALL.md)
- [COMMANDS.md](COMMANDS.md)
- [REGRAS_NEGOCIO.md](REGRAS_NEGOCIO.md)
