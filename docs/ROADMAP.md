# Roadmap técnico (backend)

Direcionamento estratégico de evolução do backend com foco em segurança, previsibilidade e manutenção.

## Sumário

- [Contexto atual](#contexto-atual)
- [Prioridade alta](#prioridade-alta)
- [Prioridade média](#prioridade-média)
- [Prioridade evolutiva](#prioridade-evolutiva)

## Contexto atual

Estado já consolidado:

- módulos core implementados (auth, obras, medições, diário, solicitações, arquivos, sync, management);
- controle de acesso por perfil;
- sincronização para operação offline;
- exportações CSV operacionais;
- base de testes automatizados existente.

## Prioridade alta

1. **Segurança de sessão**
   - evoluir estratégia para reduzir exposição de tokens no cliente.

2. **Padronização completa de soft delete**
   - reduzir fallbacks e padronizar filtros por `deletedAt`.

3. **Cobertura de testes por domínio**
   - completar integração para domínios com lacunas.

## Prioridade média

1. **Exportação PDF de boletim**
   - implementar endpoint atualmente retornando `501`.

2. **Contrato OpenAPI**
   - publicar especificação formal para onboarding e integração.

3. **Observabilidade de sync**
   - métricas por obra/domínio para conflitos, erros e sucesso.

## Prioridade evolutiva

1. **CI obrigatório em PR**
   - lint + testes com bloqueio de merge em falha.

2. **Runbook e segurança operacional**
   - documentação de incidentes, recuperação e hardening.

3. **Governança de dados**
   - retenção e anonimização com trilha auditável.

Referências:

- [PLANO_EVOLUCAO_SISTEMA.md](PLANO_EVOLUCAO_SISTEMA.md)
- [RELATORIO_ANALISE_27022026.md](RELATORIO_ANALISE_27022026.md)
- [RELATORIO_TESTES.md](RELATORIO_TESTES.md)
