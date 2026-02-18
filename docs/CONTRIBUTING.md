# 🤝 Guia de Contribuição

Obrigado por considerar contribuir com o Sistema de Construção Civil! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Código de Conduta

Ao participar deste projeto, você concorda em manter um ambiente respeitoso e profissional.

## 🚀 Como Contribuir

### 1. Fork e Clone

```bash
# Fork o repositório no GitHub
# Clone seu fork
git clone https://github.com/Kariina0/Projeto-backend.git
cd Projeto-backend

# Adicione o repositório original como upstream
git remote add upstream https://github.com/Kariina0/Projeto-backend.git
```

### 2. Crie uma Branch

```bash
# Atualize sua branch main
git checkout master
git pull upstream master

# Crie uma nova branch para sua feature
git checkout -b feature/minha-feature
# ou para correção de bug
git checkout -b fix/meu-bug
```

### 3. Faça suas Alterações

- Escreva código limpo e bem documentado
- Siga os padrões de código existentes
- Adicione testes quando aplicável
- Atualize a documentação se necessário

### 4. Commit suas Alterações

Use mensagens de commit claras e descritivas:

```bash
# Boas mensagens de commit
git commit -m "Add: Endpoint de listagem de obras"
git commit -m "Fix: Corrige validação de CPF"
git commit -m "Update: Melhora performance de query de medições"
git commit -m "Docs: Atualiza README com novos endpoints"
```

### 5. Push e Pull Request

```bash
# Push para seu fork
git push origin feature/minha-feature

# Abra um Pull Request no GitHub
```

## 📝 Padrões de Código

### Nomenclatura

```javascript
// Classes: PascalCase
class MedicaoService {}

// Funções e variáveis: camelCase
const calcularValorTotal = () => {};
const valorTotal = 1000;

// Constantes: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5242880;

// Arquivos: PascalCase para classes, camelCase para outros
MedicaoController.js;
authValidator.js;
```

### Estrutura de Arquivos

```javascript
// Controllers
class MedicaoController {
  async create(req, res, next) {
    try {
      // lógica
    } catch (error) {
      next(error);
    }
  }
}

// Services
class MedicaoService {
  constructor() {
    this.medicaoRepository = new MedicaoRepository();
  }

  async create(data) {
    // lógica de negócio
  }
}

// Repositories
class MedicaoRepository extends BaseRepository {
  constructor() {
    super(Medicao);
  }

  async findByObra(obraId) {
    // query específica
  }
}
```

### Validação com Joi

```javascript
const schema = Joi.object({
  campo: Joi.string().required().messages({
    "string.empty": "Campo é obrigatório",
    "any.required": "Campo é obrigatório",
  }),
});
```

### Tratamento de Erros

```javascript
// Use classes de erro apropriadas
throw new ValidationError("Dados inválidos");
throw new NotFoundError("Recurso não encontrado");
throw new UnauthorizedError("Não autorizado");
```

## 🧪 Testes

### Executando Testes

```bash
# Todos os testes
npm test

# Testes específicos
npm test -- MedicaoController

# Com coverage
npm test -- --coverage
```

### Escrevendo Testes

```javascript
describe("MedicaoService", () => {
  describe("create", () => {
    it("deve criar uma medição válida", async () => {
      const data = {
        obra: "obraId",
        itens: [{ descricao: "Item 1" }],
      };

      const result = await medicaoService.create(data);

      expect(result).toBeDefined();
      expect(result.obra).toBe(data.obra);
    });

    it("deve lançar erro se obra não existe", async () => {
      await expect(medicaoService.create({ obra: "invalid" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
```

## 📚 Documentação

- Atualize o README.md se adicionar novas funcionalidades
- Documente endpoints da API no formato correto
- Adicione comentários JSDoc em funções complexas

```javascript
/**
 * Calcula o valor total de uma medição
 * @param {Array} itens - Array de itens da medição
 * @returns {Number} Valor total calculado
 */
const calcularValorTotal = (itens) => {
  return itens.reduce((total, item) => total + item.valorTotal, 0);
};
```

## 🐛 Reportando Bugs

Ao reportar bugs, inclua:

- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs atual
- Screenshots (se aplicável)
- Ambiente (OS, Node version, etc)

## 💡 Sugerindo Melhorias

Sugestões são bem-vindas! Abra uma issue descrevendo:

- O problema que a melhoria resolve
- Como você propõe resolver
- Exemplos de uso

## 📋 Checklist de Pull Request

Antes de submeter seu PR, verifique:

- [ ] O código segue os padrões do projeto
- [ ] Todos os testes passam
- [ ] Novos testes foram adicionados (se aplicável)
- [ ] A documentação foi atualizada
- [ ] O commit tem mensagens claras
- [ ] O código foi revisado por você mesmo
- [ ] Não há console.logs esquecidos

## 🎯 Áreas que Precisam de Contribuição

### Alta Prioridade

- [ ] Testes automatizados (Jest)
- [ ] Implementação de Diários de Obra
- [ ] Implementação de Solicitações de Compra
- [ ] Documentação Swagger/OpenAPI

### Média Prioridade

- [ ] Sistema de notificações em tempo real
- [ ] Relatórios e dashboards
- [ ] Melhorias de performance

### Baixa Prioridade

- [ ] Internacionalização (i18n)
- [ ] Dark mode na documentação
- [ ] Melhorias de UX

## 📞 Contato

Dúvidas? Entre em contato:

- **Issues:** https://github.com/Kariina0/Projeto-backend/issues
- **Discussions:** https://github.com/Kariina0/Projeto-backend/discussions

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma licença do projeto (MIT).

---

**Obrigado por contribuir! 🎉**
