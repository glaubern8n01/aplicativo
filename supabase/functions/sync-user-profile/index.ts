/// <reference lib="esnext" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// Configuração Supabase
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// CORS fixo para o domínio correto do seu frontend
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://aplicativo-iota.vercel.app", // ← SEU DOMÍNIO ATUAL
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: corsHeaders
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const { userId, email, nome } = body;

  if (!userId || !email) {
    return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
      status: 400,
      headers: corsHeaders
    });
  }

  console.log("✅ sync_user_profile INICIADA");
  console.log("📦 Payload recebido:", body);

  const { data: existingUser, error: fetchError } = await supabase
    .from("usuarios_rotaspeed")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("❌ Erro ao buscar usuário:", fetchError.message);
    return new Response(JSON.stringify({ error: "Erro ao buscar usuário" }), {
      status: 500,
      headers: corsHeaders
    });
  }

  if (!existingUser) {
    const { error: insertError } = await supabase.from("usuarios_rotaspeed").insert([
      {
        id: userId,
        email,
        nome: nome ?? "Entregador",
        plano_nome: "Start",
        plano_ativo: true,
        entregas_dia_max: 10,
        entregas_hoje: 0,
        saldo_creditos: 0,
        entregas_gratis_utilizadas: 0,
        ultima_atualizacao: new Date().toISOString().split("T")[0]
      }
    ]);

    if (insertError) {
      console.error("❌ Erro ao criar usuário:", insertError.message);
      return new Response(JSON.stringify({ error: "Erro ao criar usuário" }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  return new Response(JSON.stringify({ message: "Perfil sincronizado com sucesso" }), {
    status: 200,
    headers: corsHeaders
  });
});
