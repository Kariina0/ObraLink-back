# Guia de contribuição

## Objetivo

Padronizar contribuições para manter coerência entre implementação, testes e documentação.

## Fluxo sugerido

1. Atualize sua branch a partir da branch principal do trabalho.
2. Crie branch de feature/fix:

```bash
git checkout -b feature/nome-curto
# ou
git checkout -b fix/nome-curto
```

3. Desenvolva alterações pequenas e focadas.
4. Execute validações locais.
5. Atualize `docs/` quando alterar comportamento funcional.
6. Abra PR com contexto técnico e evidências de teste.

## Convenções técnicas

- Linguagem: JavaScript (Node.js)
- Validação de entrada: Joi
- Regras de negócio: camada `services`
- Acesso a dados: camada `repositories`
- Erros de domínio: `src/utils/errors.js`
- Resposta HTTP padronizada com helpers de sucesso/erro

## Checklist antes do PR

- [ ] Não introduziu funcionalidades não solicitadas
- [ ] Testes do backend passando
- [ ] Rotas protegidas com `authenticate`/`authorize` quando necessário
- [ ] Payloads validados por schema
- [ ] Documentação de `docs/` atualizada

## Comandos mínimos de validação

```bash
npm run lint
npm test -- --runInBand
```

## Padrão de commit

Use mensagens objetivas em português técnico, por exemplo:

```bash
git commit -m "fix(auth): corrige validação de refresh token"
git commit -m "feat(management): adiciona exportação CSV de medições"
git commit -m "docs: atualiza regras de negócio para fluxo real"
```

## Quando alterar frontend (pasta irmã)

- Garanta compatibilidade com os endpoints já existentes no backend.
- Evite criar contratos de API não suportados em `src/routes/`.
- Documente integrações novas em `docs/README.md` e `docs/REGRAS_NEGOCIO.md`.

## Licença

Ao contribuir, você concorda com a licença MIT do projeto.
