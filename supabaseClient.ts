import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// Tipo para as entregas
export type EntregaData = {
  id?: string;
  user_id: string;
  endereco: string;
  bairro: string;
  cep: string;
  status?: string;
  created_at?: string;
};

// Buscar perfil do usuário
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erro ao obter perfil do usuário:', error.message);
    return null;
  }

  return data;
}

// Criar perfil de usuário
export async function createUserProfile(userId: string, email: string) {
  const { error } = await supabase.from('usuarios_rotaspeed').insert([
    {
      id: userId,
      email: email,
      entregas_realizadas: 0,
      entregas_disponiveis: 10,
      plano: 'Start',
      creditos: 0
    }
  ]);

  if (error) {
    console.error('Erro ao criar perfil do usuário:', error.message);
    throw error;
  }
}

// Adicionar nova entrega
export async function addEntrega(entrega: EntregaData) {
  const { error } = await supabase.from('entregas').insert([entrega]);

  if (error) {
    console.error('Erro ao adicionar entrega:', error.message);
    throw error;
  }
}

// Buscar entregas do usuário
export async function getEntregasByUserId(userId: string) {
  const { data, error } = await supabase
    .from('entregas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar entregas:', error.message);
    throw error;
  }

  return data;
}

// Excluir entrega
export async function deleteEntrega(entregaId: string) {
  const { error } = await supabase.from('entregas').delete().eq('id', entregaId);

  if (error) {
    console.error('Erro ao excluir entrega:', error.message);
    throw error;
  }
}

// Atualizar status da entrega
export async function updateEntregaStatus(entregaId: string, status: string) {
  const { error } = await supabase
    .from('entregas')
    .update({ status })
    .eq('id', entregaId);

  if (error) {
    console.error('Erro ao atualizar status da entrega:', error.message);
    throw error;
  }
}

// ⚠️ Função que estava faltando!
export async function updateUserProfileSettings(userId: string, updates: any) {
  const { error } = await supabase
    .from('usuarios_rotaspeed')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error("Erro ao atualizar configurações do perfil:", error.message);
    throw error;
  }
}
