import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zhjzqrddmigczdfxvfhp.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Criação de perfil no Supabase
export async function createUserProfile(user: any) {
  const { error } = await supabase.from('usuarios_rotaspeed').insert([user]);
  if (error) {
    console.error("❌ Erro ao criar perfil do usuário:", error.message);
    throw error;
  }
  console.log("✅ Perfil do usuário criado com sucesso.");
}

// Busca de perfil pelo ID (UID do Supabase Auth)
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

  return data;
}

// Atualização de perfil (a função que o Vercel tá pedindo!)
export async function updateUserProfileSettings(userId: string, updates: any) {
  const { error } = await supabase
    .from('usuarios_rotaspeed')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error("❌ Erro ao atualizar perfil:", error.message);
    throw error;
  }
}

// Busca por email
export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error("❌ Erro ao buscar usuário por email:", error.message);
    throw error;
  }

  return data;
}

// Entregas
export async function addEntrega(entrega: any) {
  const { error } = await supabase.from('entregas').insert([entrega]);
  if (error) throw error;
}

export async function addMultipleEntregas(entregas: any[]) {
  const { error } = await supabase.from('entregas').insert(entregas);
  if (error) throw error;
}

export async function updateMultipleEntregasOptimization(entregas: { id: string; rota_ordenada: string }[]) {
  const updates = entregas.map(({ id, rota_ordenada }) =>
    supabase.from('entregas').update({ rota_ordenada }).eq('id', id)
  );

  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}

export function mapDBStatusToPackageStatus(status: string): string {
  const map: { [key: string]: string } = {
    'confirmado': 'Confirmado',
    'em_rota': 'Em Rota',
    'entregue': 'Entregue'
  };
  return map[status] || status;
}

export async function getEntregasByUserId(userId: string) {
  const { data, error } = await supabase
    .from('entregas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteEntrega(id: string) {
  const { error } = await supabase.from('entregas').delete().eq('id', id);
  if (error) throw error;
}

export async function updateEntregaStatus(id: string, status: string) {
  const { error } = await supabase
    .from('entregas')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function resetEntregasDiariasSeNecessario(userId: string) {
  const { error } = await supabase.rpc('reset_entregas_diarias', { uid: userId });
  if (error) {
    console.error("❌ Erro ao resetar entregas diárias:", error.message);
    throw error;
  }
}

export async function criarEntregaInicialGratuita(userId: string) {
  const entregaGratuita = {
    user_id: userId,
    endereco: 'Primeira entrega gratuita',
    status: 'confirmado',
    gratuito: true
  };

  const { error } = await supabase.from('entregas').insert([entregaGratuita]);
  if (error) throw error;
}
