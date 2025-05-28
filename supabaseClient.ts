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

// Busca de perfil pelo ID
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

// Busca de perfil por email
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

// Atualiza preferências do usuário
export async function updateUserProfileSettings(id: string, updates: any) {
  const { error } = await supabase
    .from('usuarios_rotaspeed')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

// Adiciona uma entrega
export async function addEntrega(entrega: any) {
  const { error } = await supabase.from('entregas').insert([entrega]);
  if (error) throw error;
}

// Adiciona múltiplas entregas
export async function addMultipleEntregas(entregas: any[]) {
  const { error } = await supabase.from('entregas').insert(entregas);
  if (error) throw error;
}

// Atualiza otimização em múltiplas entregas
export async function updateMultipleEntregasOptimization(ids: string[], dados: any) {
  const { error } = await supabase
    .from('entregas')
    .update(dados)
    .in('id', ids);

  if (error) throw error;
}

// Lista entregas por usuário
export async function getEntregasByUserId(userId: string) {
  const { data, error } = await supabase
    .from('entregas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Deleta entrega
export async function deleteEntrega(id: string) {
  const { error } = await supabase.from('entregas').delete().eq('id', id);
  if (error) throw error;
}

// Atualiza status
export async function updateEntregaStatus(id: string, status: string) {
  const { error } = await supabase
    .from('entregas')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

// Reset diário de entregas
export async function resetEntregasDiariasSeNecessario(userId: string) {
  const { error } = await supabase.rpc('reset_entregas_diarias', { uid: userId });
  if (error) throw error;
}

// Primeira entrega gratuita
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

// Converte status do banco para status visual
export function mapDBStatusToPackageStatus(status: string) {
  switch (status) {
    case 'pendente': return 'Pendente';
    case 'confirmado': return 'Confirmado';
    case 'em_rota': return 'Em rota';
    case 'entregue': return 'Entregue';
    default: return 'Desconhecido';
  }
}
