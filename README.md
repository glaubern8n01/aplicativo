
# RotaSpeed App - README

Um painel web para entregadores organizarem e otimizarem suas entregas diárias, com reconhecimento de endereços e geração de rotas otimizadas usando IA do Gemini. Esta versão integra Supabase para gerenciamento de usuários, planos e limites de uso, além de novas funcionalidades.

## Funcionalidades Principais

*   **Autenticação de Usuários:** Login e cadastro seguros via Supabase Auth (Email/Senha e Google).
*   **Recuperação de Senha:** Funcionalidade "Esqueci minha senha".
*   **Plano Gratuito com Limite:** Novos usuários ganham 10 entregas grátis.
*   **Gerenciamento de Planos e Limites:**
    *   Controle de plano ativo.
    *   Limite diário de entregas (`entregas_dia_max`) conforme o plano do usuário.
    *   Contagem de entregas realizadas no dia (`entregas_hoje`).
    *   Reset diário automático de `entregas_hoje`.
*   **Entrada de Pacotes Flexível:** Adicione endereços via texto, foto, câmera, voz, PDF ou planilhas.
*   **Gerenciamento de Entregas no Supabase:**
    *   Pacotes/Entregas são salvos na tabela `entregas`.
    *   Status (`pendente`, `em_rota`, `entregue`, `cancelada`) atualizado no banco de dados.
*   **Reconhecimento Inteligente:** IA (Gemini) para extrair dados de endereços.
*   **Otimização de Rotas:** Automática (IA) ou manual.
*   **Acompanhamento de Entregas:** Marque pacotes como entregues ou cancelados.
*   **Navegação Fácil:** Abrir endereço no app de mapas preferido (Google Maps, Waze, Apple Maps).
*   **Estatísticas:** Visualização de desempenho, entregas por status, bairro e dia.
*   **Configurações do Usuário:** Personalizar nome, telefone, app de navegação e preferências de notificação.
*   **Página "Como Usar":** Instruções básicas sobre o app.

## Configuração e Execução

### Pré-requisitos

*   Node.js e npm/yarn (opcional, para desenvolvimento local se usar bundler)
*   Uma conta Supabase
*   Uma chave de API do Google Gemini

### 1. Configuração do Supabase

#### a. Crie seu Projeto Supabase
   Se ainda não tiver um, crie um projeto em [supabase.com](https://supabase.com).

#### b. Configuração da Autenticação
   *   No seu painel Supabase, vá para "Authentication" -> "Providers".
   *   **Email:** Certifique-se de que "Email" está habilitado.
   *   **Google:** Habilite o provedor "Google". Você precisará configurar as credenciais do OAuth do Google Cloud Console. Siga as [instruções do Supabase para OAuth com Google](https://supabase.com/docs/guides/auth/social-login/auth-google). Adicione `https://<SEU-PROJECT-ID>.supabase.co/auth/v1/callback` como URI de redirecionamento autorizado no seu projeto Google Cloud.
   *   Em "Authentication" -> "Settings":
        *   **Site URL:** Defina como a URL onde seu aplicativo será hospedado (ex: `http://localhost:3000` para desenvolvimento, ou sua URL de produção).
        *   **Additional Redirect URLs:** Adicione a URL base da sua aplicação (ex: `http://localhost:3000/*` ou `https://seudominio.com/*`) para permitir redirecionamentos após login ou recuperação de senha.
        *   Você pode configurar "Disable email confirmations" (para facilitar testes de cadastro por email) ou personalizar templates de e-mail.

#### c. Configuração do Banco de Dados

##### Tabela `usuarios_rotaspeed`
   Modifique a tabela `usuarios_rotaspeed` para incluir os novos campos. Se você já criou a tabela, use `ALTER TABLE`.

   ```sql
   -- Se a tabela já existe, adicione as novas colunas:
   ALTER TABLE public.usuarios_rotaspeed
     ADD COLUMN IF NOT EXISTS driver_name text,
     ADD COLUMN IF NOT EXISTS driver_phone text,
     ADD COLUMN IF NOT EXISTS navigation_preference text DEFAULT 'google',
     ADD COLUMN IF NOT EXISTS notification_sender_preference text DEFAULT 'driver';

   -- Script completo para criar a tabela (se ainda não existir com todos os campos)
   CREATE TABLE IF NOT EXISTS public.usuarios_rotaspeed (
       id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
       email character varying,
       plano_nome character varying DEFAULT 'Grátis'::character varying,
       entregas_dia_max integer DEFAULT 10,
       entregas_hoje integer DEFAULT 0,
       saldo_creditos integer DEFAULT 0,
       plano_ativo boolean DEFAULT true,
       entregas_gratis_utilizadas integer DEFAULT 0,
       driver_name text,
       driver_phone text,
       navigation_preference text DEFAULT 'google', -- 'google', 'waze', 'apple'
       notification_sender_preference text DEFAULT 'driver', -- 'driver', 'system'
       created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
       updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
       CONSTRAINT usuarios_rotaspeed_pkey PRIMARY KEY (id),
       CONSTRAINT usuarios_rotaspeed_email_key UNIQUE (email)
   );

   -- Políticas RLS (se ainda não configuradas ou se precisar recriar)
   DROP POLICY IF EXISTS "Permitir leitura para proprietário" ON public.usuarios_rotaspeed;
   CREATE POLICY "Permitir leitura para proprietário"
   ON public.usuarios_rotaspeed
   FOR SELECT
   USING (auth.uid() = id);

   DROP POLICY IF EXISTS "Permitir atualização para proprietário" ON public.usuarios_rotaspeed;
   CREATE POLICY "Permitir atualização para proprietário"
   ON public.usuarios_rotaspeed
   FOR UPDATE
   USING (auth.uid() = id)
   WITH CHECK (auth.uid() = id);
   
   -- Trigger para 'updated_at' (se ainda não configurado)
   CREATE OR REPLACE FUNCTION public.handle_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = timezone('utc'::text, now());
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   DROP TRIGGER IF EXISTS on_usuarios_rotaspeed_updated_at ON public.usuarios_rotaspeed;
   CREATE TRIGGER on_usuarios_rotaspeed_updated_at
   BEFORE UPDATE ON public.usuarios_rotaspeed
   FOR EACH ROW
   EXECUTE FUNCTION public.handle_updated_at();

   -- Trigger para criar perfil (se ainda não configurado e se desejar que o DB o crie)
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY DEFINER SET search_path = public
   AS $$
   begin
     insert into public.usuarios_rotaspeed (id, email, driver_name, driver_phone, navigation_preference, notification_sender_preference)
     values (new.id, new.email, '', '', 'google', 'driver'); -- Adiciona valores padrão para novos campos
     return new;
   end;
   $$;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
   ```

##### Tabela `entregas`
   Crie uma nova tabela chamada `entregas` para armazenar os detalhes de cada pacote/entrega.

   ```sql
   CREATE TABLE IF NOT EXISTS public.entregas (
       id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
       user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
       created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
       updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
       status text DEFAULT 'pendente'::text NOT NULL, -- pendente, em_rota, entregue, cancelada
       full_address text NOT NULL,
       street text,
       number text,
       bairro text,
       complemento text,
       cep text,
       city text,
       state text,
       recipient_name text,
       telefone text,
       original_input text,
       input_type text, -- text, photo, voice, pdf, sheet, camera
       optimized_order integer,
       route_id uuid, -- Para agrupar entregas de uma mesma otimização de rota
       delivery_notes text -- Notas do entregador sobre a entrega específica
   );

   -- Políticas RLS para 'entregas'
   ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Permitir CRUD completo para proprietário das entregas"
   ON public.entregas
   FOR ALL
   USING (auth.uid() = user_id)
   WITH CHECK (auth.uid() = user_id);

   -- Trigger para 'updated_at' na tabela 'entregas'
   DROP TRIGGER IF EXISTS on_entregas_updated_at ON public.entregas;
   CREATE TRIGGER on_entregas_updated_at
   BEFORE UPDATE ON public.entregas
   FOR EACH ROW
   EXECUTE FUNCTION public.handle_updated_at(); 
   ```

#### d. Supabase Edge Function (`gemini-proxy`)
   (Siga as instruções anteriores para implantar `gemini-proxy` e configurar `GEMINI_API_KEY` como segredo).

#### e. Supabase Edge Function (`reset-daily-counts`)
   (Siga as instruções anteriores para implantar `reset-daily-counts` e configurar seus segredos `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).

#### f. Cron Job (Agendador) para Reset Diário
   (Siga as instruções anteriores para configurar o cron job que chama `reset-daily-counts`).

### 2. Configuração do Frontend

#### a. Atualize as Configurações do Cliente Supabase
   Abra `supabaseClient.ts`.
   Substitua as credenciais pelos valores do seu projeto Supabase (Configurações do Projeto -> API):
   ```typescript
   // Em supabaseClient.ts
   const supabaseUrl = 'https://zhjzqrddmigczdfxvfhp.supabase.co';
   const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoanpxcmRkbWlnY3pkZnh2ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNjM3MDMsImV4cCI6MjA2MjgzOTcwM30.U5l5VEIg4WI7aDS6QbsQRqMAWx6HGgkmDEOObWOnYc8';
   ```

#### b. Atualize a URL do Proxy Gemini
   Abra `geminiService.ts`.
   Substitua `YOUR_SUPABASE_FUNCTION_URL_HERE/gemini-proxy` pela URL da sua função `gemini-proxy` implantada:
   ```typescript
   // Em geminiService.ts
   const SUPABASE_GEMINI_PROXY_URL = 'https://zhjzqrddmigczdfxvfhp.supabase.co/functions/v1/gemini-proxy';
   ```

### 3. Executando o Frontend
1.  Sirva `index.html` usando um servidor HTTP local (ex: "Live Server" no VS Code, ou `npx serve .`).
2.  Acesse o aplicativo no seu navegador.

## Estrutura do Projeto (Frontend)

*   `index.html`: Ponto de entrada.
*   `index.tsx`: Renderiza o App React.
*   `App.tsx`: Componente raiz, estado principal, roteamento, lógica de plano e autenticação.
*   `types.ts`: Interfaces TypeScript.
*   `uiComponents.tsx`: Componentes de UI.
*   `geminiService.ts`: Comunicação com o backend proxy (`gemini-proxy`).
*   `speechService.ts`: Hook para API de Reconhecimento de Voz.
*   `fileProcessingService.ts`: Utilitários para arquivos.
*   `supabaseClient.ts`: Inicializa o cliente Supabase e helpers.
*   `metadata.json`: Metadados da aplicação.
*   **Novos Componentes de Página:**
    *   `SettingsPage.tsx`
    *   `StatisticsPage.tsx`
    *   `HowToUsePage.tsx`
    *   `ResetPasswordPage.tsx`
*   `supabase/functions/gemini-proxy/index.ts`: Edge Function proxy para API Gemini.
*   `supabase/functions/reset-daily-counts/index.ts`: Edge Function para resetar contagens diárias.

## Como Usar (Resumido)

1.  **Login/Cadastro:** Use email/senha ou Google. Recupere senha se necessário.
2.  **Configurar Entregas:** Informe a quantidade de pacotes.
3.  **Adicionar Pacotes:** Use texto, arquivos, câmera ou voz. Pacotes são salvos no Supabase.
4.  **Otimizar Rota:** Escolha otimização automática ou manual.
5.  **Realizar Entregas:** Navegue, marque como "Entregue" ou "Cancelada" (atualiza no Supabase).
6.  **Configurações:** Personalize suas preferências.
7.  **Estatísticas:** Acompanhe seu progresso.
8.  **Como Usar:** Consulte as instruções no app.

## Considerações

*   **Chaves Supabase:** Mantenha `SUPABASE_SERVICE_ROLE_KEY` segura. `SUPABASE_ANON_KEY` é pública.
*   **Políticas RLS:** As políticas de Row Level Security são cruciais para a segurança dos dados. Certifique-se de que estão corretamente aplicadas.
*   **Limites da API Gemini:** Monitore o uso.
*   **CORS:** As Edge Functions estão configuradas com CORS. Ajuste se necessário para produção.

Boas entregas!
