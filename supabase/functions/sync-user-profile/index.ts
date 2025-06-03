/// <reference lib="esnext" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// Configurações de CORS - coloque o domínio do seu app hospedado na Vercel
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://app.rotaspeed.com.br", // Substitua pelo domínio real do seu app
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const { data: existingUser, error: fetchError } = await supabase
    .from("usuarios_rotaspeed")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    return new Response(JSON.stringify({ error: "Erro ao buscar usuário", detail: fetchError.message }), {
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
        status_plano: "ativo",
        entregas_max_diarias: 10,
        entregas_dia_corrente: 0,
        creditos_disponiveis: 0,
        entregas_gratis_utilizadas: 0,
        data_ultima_entrega_dia: new Date().toISOString().split("T")[0]
      }
    ]);

    if (insertError) {
      return new Response(JSON.stringify({ error: "Erro ao criar usuário", detail: insertError.message }), {
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
