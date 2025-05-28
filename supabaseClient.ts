
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zhjzqrddmigczdfxvfhp.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Criação de perfil no Supabase
export async function createUserProfile(user: User) {
  const { error } = await supabase.from('usuarios_rotaspeed').insert([user]);
  if (error) {
    console.error("❌ Erro ao criar perfil do usuário:", error.message);
    throw error;
  } else {
    console.log("✅ Perfil do usuário criado com sucesso.");
  }
}

// Busca do perfil do usuário logado
export async function getUserProfile(id: string) {
  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("❌ Erro ao buscar perfil do usuário:", error.message);
    throw error;
  }

  console.log("✅ Perfil encontrado:", data);
  return data;
}
