
# RotaSpeed — App de Entregas com IA e Rotas Otimizadas

O RotaSpeed é um painel leve para entregadores cadastrarem pacotes por voz, imagem, texto, PDF ou planilhas, com extração automática de endereço via IA (Gemini) e roteirização otimizada com Google Maps.

---

## ✅ FUNCIONALIDADES

- Login com e-mail e senha via Supabase
- 10 entregas grátis no primeiro cadastro
- Upload de pacotes por:
  - Foto (OCR)
  - Áudio (ditado nativo)
  - Texto digitado
  - PDF e planilhas
- IA do Gemini para extrair endereço de cada entrada
- Geração de rota otimizada com links do Google Maps
- Controle diário de entregas com limite por plano
- Botão "Próxima Entrega" para confirmar e seguir

---

## 🛠 COMO INSTALAR LOCALMENTE

```bash
git clone https://github.com/glaubern8n01/aplicativo.git
cd aplicativo
npm install
npm run dev
```

---

### 4. Configure as variáveis de ambiente

Para o app funcionar corretamente, ele precisa saber onde está seu banco de dados Supabase.

➡️ Crie um arquivo chamado `.env.local` dentro da pasta do projeto (onde está o `package.json`)

Depois, cole dentro do arquivo:

```
VITE_SUPABASE_URL=https://zhjzqrddmigczdfxvfhp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoanpxcmRkbWlnY3pkZnh2ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNjM3MDMsImV4cCI6MjA2MjgzOTcwM30.U5l5VEIg4WI7aDS6QbsQRqMAWx6HGgkmDEOObWOnYc8
```

Essa é sua chave `anon public` que permite conexão segura do frontend com o Supabase.

---

## 🌐 PUBLICAÇÃO

Esse app está publicado na Vercel:  
🔗 https://aplicativo-iota.vercel.app

---

## 📞 SUPORTE

Criado por Glauber Correia  
🌐 glaubermarketing.com  
📲 @glauber.correia
.
