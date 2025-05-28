import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zhjzqrddmigczdfxvfhp.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("usuarios_rotaspeed")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("❌ Erro ao buscar perfil do usuário:", error.message);
    return null;
  }

  console.log("✅ Perfil encontrado:", data);
  return data;
}

export async function createUserProfile(userId: string, email: string) {
  const { error } = await supabase.from("usuarios_rotaspeed").insert([
    {
      id: userId,
      nome: "Entregador RotaSpeed",
      plano_nome: "Start",
      plano_ativo: true,
      entregas_dia_max: 10,
      entregas_hoje: 0,
      ultima_atualizacao: new Date().toISOString(),
      saldo_creditos: 0,
      ultima_reset: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("❌ Erro ao criar perfil do usuário:", error.message);
    throw error;
  } else {
    console.log("✅ Perfil do usuário criado com sucesso.");
  }
}
// Criação de perfil no Supabase
export async function createUserProfile(user: User) {
  const { error } = await supabase.from('usuarios_rotaspeed').insert([user]);
  if (error) throw error;
}

// Busca do perfil do usuário logado
export async function getUserProfile(id: string) {
  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}
