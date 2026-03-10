# TODO Prioridades — 2026-03-09

## Sprint 1 — Estabilidade de rotas e segurança de arquivos
- [x] Unificar rotas de medições e manter compatibilidade temporária (`/api/measurements` e alias legado `/api/medicoes`).
- [x] Ajustar cobertura de testes para garantir criação/listagem em ambas as rotas.
- [x] Corrigir IDOR de arquivos para impedir acesso/deleção por usuários sem permissão.
- [x] Adicionar testes de autorização para arquivos (GET e DELETE).
- [x] Executar testes de integração e corrigir regressões.

## Sprint 2 — Diário de Obra (entrega funcional)
- [x] Expor rotas REST de diário no backend (CRUD + validação).
- [x] Implementar camada controller/service/repository para diário com regras RN-018 a RN-020.
- [x] Implementar tela de Diário de Obra no frontend.
- [x] Garantir política de autorização por perfil e por obra.
- [x] Criar testes de integração do módulo de diário.

## Sprint 3 — Offline completo (medições e solicitações)
- [x] Implementar fila offline no frontend para medições.
- [x] Implementar fila offline no frontend para solicitações.
- [x] Integrar sincronização automática com `/api/sync/push` e retries.
- [x] Implementar fluxo de resolução de conflitos com `/api/sync/conflicts`.
- [ ] Adicionar testes de sincronização e cenários de reconexão.

## Sprint 4 — Notificações e usabilidade de medição
- [x] Implementar notificação de mudança de status para encarregado.
- [x] Exibir badge/indicador no dashboard com pendências de status.
- [x] Adicionar ação explícita de "Salvar rascunho" e "Enviar medição".
- [x] Bloquear edição após envio quando aplicável.
- [x] Adicionar tooltips e exemplos inline no formulário de medição.

## Sprint 5 — Gestão e relatórios
- [x] Implementar painel gerencial para supervisor/admin.
- [x] Exibir comparativo orçado vs. realizado por obra.
- [x] Exibir pendências e alertas de orçamento/prazo.
- [x] Implementar exportação de boletim de medição em PDF.
- [x] Implementar exportação de relatórios em planilha.

## Critérios de encerramento por sprint
- [ ] Testes automatizados da sprint executando sem falhas.
- [ ] Documentação da API/fluxo atualizada.
- [ ] Sem regressão nos fluxos críticos (auth, medições, solicitações, arquivos).
