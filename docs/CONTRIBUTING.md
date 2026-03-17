# Guia de contribuição

> Padroniza contribuições para manter coerência entre implementação, testes e documentação.

---

## Fluxo de trabalho

1. Atualize sua branch a partir da branch principal (`main`).
2. Crie uma branch descritiva:

```bash
git checkout -b feature/nome-curto
git checkout -b fix/nome-curto
git checkout -b docs/nome-curto
```

3. Desenvolva alterações pequenas e focadas em um único objetivo.
4. Execute as validações locais antes de commitar.
5. Atualize `docs/` se o comportamento funcional foi alterado.
6. Abra PR com contexto técnico claro e evidências de teste.

---

## Convenções técnicas

| Aspecto | Regra |
|---------|-------|
| Linguagem | JavaScript (Node.js `>=18`) |
| Validação de entrada | Joi — schemas em `src/validators/` |
| Regras de negócio | Camada `src/services/` |
| Acesso a dados | Camada `src/repositories/` (somente Knex, sem lógica de domínio) |
| Erros de domínio | `src/utils/errors.js` (AppError, NotFoundError, etc.) |
| Respostas HTTP | Helpers de `src/utils/helpers.js` (success/error padronizados) |
| Rotas novas | Sempre proteger com `authenticate` e `authorize` quando necessário |
| Novos campos obrigatórios | Adicionar migration + atualizar validator + atualizar DTO |

---

## Checklist antes do PR

- [ ] Testes passando: `npm test -- --runInBand`
- [ ] Lint sem erros: `npm run lint`
- [ ] Rotas novas protegidas com `authenticate` / `authorize`
- [ ] Payloads validados por schema Joi
- [ ] Migration criada para mudanças no schema
- [ ] DTO atualizado para não expor campos sensíveis
- [ ] `docs/` atualizado se o comportamento mudou
- [ ] Nenhuma funcionalidade fora do escopo da tarefa

---

## Padrão de commit (Conventional Commits)

```
<tipo>(<escopo>): <mensagem curta em português>
```

| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Alteração somente em documentação |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adiciona ou corrige testes |
| `chore` | Configuração, build, dependências |

**Exemplos:**

```bash
git commit -m "feat(medicoes): adiciona calculo de volume nas dimensoes"
git commit -m "fix(auth): corrige validacao de refresh token expirado"
git commit -m "docs: atualiza regras de negocio para fluxo de rejeicao"
git commit -m "test(solicitacoes): adiciona testes de aprovacao por supervisor"
```

---

## Alterações no frontend (pasta irmã)

- Garanta compatibilidade total com os endpoints existentes em `src/routes/`.
- Não crie contratos de API sem implementação correspondente no backend.
- Documente integrações novas em `docs/README.md` e `docs/REGRAS_NEGOCIO.md`.
- Atualize `docs/STRUCTURE.md` se novos serviços, hooks ou componentes foram adicionados.

---

## Adicionando uma nova entidade (passo a passo)

1. Criar migration em `migrations/` com o schema da tabela.
2. Criar `Repository` em `src/repositories/` estendendo `BaseRepository`.
3. Criar `Service` em `src/services/` com regras de negócio e autorização.
4. Criar `Controller` em `src/controllers/` (lê req, chama service, retorna DTO).
5. Criar `DTO` em `src/dtos/` para moldar a resposta sem campos sensíveis.
6. Criar `Validator` em `src/validators/` com schema Joi.
7. Criar `Route` em `src/routes/` e registrar em `src/routes/index.js`.
8. Adicionar testes de integração em `tests/integration/`.
9. Atualizar `docs/README.md`, `docs/STRUCTURE.md` e `docs/REGRAS_NEGOCIO.md`.

---

## Licença

Ao contribuir, você concorda com a licença MIT do projeto.
