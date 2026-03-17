/**
 * Arquivo de setup do Jest — executado ANTES de cada módulo ser carregado.
 * Define variáveis de ambiente necessárias para os testes de integração.
 */

// Autenticação: usar modo legado (JWT customizado) em vez de Supabase Auth
process.env.AUTH_PROVIDER = "legacy";

// Segredos JWT (valores de teste)
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret";

// Supabase — valores fake para não lançar erro de inicialização
// Os testes de integração mockam o módulo supabaseClient inteiro
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "test-anon-key";

// Storage
process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "supabase";
process.env.SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "obras-arquivos";

// Email desabilitado nos testes (sem EMAIL_HOST definido)
// — EmailService lida com isso graciosamente
