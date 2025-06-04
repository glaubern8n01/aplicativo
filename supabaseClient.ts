import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@^2.44.4';
import type { User, PackageInfo, AddressInfo, EntregaDbRecord, InputType } from './types'; 

// ✅ Usa agora as variáveis de ambiente configuradas no Vercel
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// --- Status Mapping Functions ---
export const mapDBStatusToPackageStatus = (dbStatus: EntregaDbRecord['status']): PackageInfo['status'] => {
  switch (dbStatus) {
    case 'pendente': return 'pending';
    case 'em_rota': return 'in_transit';
    case 'entregue': return 'delivered';
    case 'cancelada': return 'cancelled';
    case 'nao_entregue': return 'undeliverable';
    default:
      console.warn(`Unhandled DB status: ${dbStatus}, defaulting to 'pending' for PackageInfo.`);
      return 'pending';
  }
};

export const mapPackageStatusToDBStatus = (packageStatus: PackageInfo['status']): EntregaDbRecord['status'] => {
  switch (packageStatus) {
    case 'pending': return 'pendente';
    case 'in_transit': return 'em_rota';
    case 'delivered': return 'entregue';
    case 'cancelled': return 'cancelada';
    case 'undeliverable': return 'nao_entregue';
    case 'parsed': 
    case 'error':
        console.warn(`Package status ${packageStatus} mapped to 'pendente' for DB operation.`);
        return 'pendente';
    default:
      console.warn(`Unhandled PackageInfo status: ${packageStatus}, defaulting to 'pendente' for DB.`);
      return 'pendente';
  }
};

const mapDbRecordToPackageInfo = (dbRecord: EntregaDbRecord): PackageInfo => {
  const {
    full_address,
    recipient_name,
    original_input,
    input_type,
    status: dbStatus,
    ...rest
  } = dbRecord;

  return {
    ...rest,
    fullAddress: full_address,
    recipientName: recipient_name ?? undefined,
    originalInput: original_input ?? undefined,
    inputType: input_type ? (input_type as InputType) : undefined,
    status: mapDBStatusToPackageStatus(dbStatus),
  };
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
        console.log(`Profile not found for user ${userId}. This is expected if it's a new user.`);
        return null;
    }
    console.error('Error fetching user profile:', error.message || JSON.stringify(error));
  }
  return data as User | null;
};

export const invokeSyncUserProfile = async (
    userId: string, 
    email?: string, 
    userMetadata?: { full_name?: string; [key: string]: any }
): Promise<User | null> => {
    try {
        const { data, error } = await supabase.functions.invoke('sync-user-profile', {
            body: { 
                userId, 
                email, 
                nome: userMetadata?.full_name 
            }
        });

        if (error) {
            console.error('Error invoking sync-user-profile Edge Function:', error);
            if (error.message.includes("Function not found")) {
                 throw new Error("Função de sincronização de perfil não encontrada. Contate o suporte.");
            }
            throw error;
        }

        if (data && data.profile) {
            return data.profile as User;
        } else if (data && data.message && !data.profile) {
            console.warn('sync-user-profile function returned a message:', data.message);
            return await getUserProfile(userId);
        }
        console.error('sync-user-profile Edge Function did not return a profile or known error structure:', data);
        return null;
    } catch (e) {
        console.error("Exception while invoking sync-user-profile:", e);
        if (e instanceof Error && e.message.includes("Failed to fetch")) {
            throw new Error("Erro de rede ao tentar sincronizar perfil. Verifique sua conexão.");
        }
        throw e;
    }
};

// --- 'entregas' table functions ---

export interface EntregaData extends Omit<PackageInfo, 'id' | 'status' | 'order' | 'created_at' | 'optimized_order' | 'updated_at'> {
  user_id: string;
  status: EntregaDbRecord['status'];
  optimized_order?: number | null;
  route_id?: string | null;
  delivery_notes?: string | null;
}

export const addEntrega = async (entregaData: EntregaData): Promise<PackageInfo | null> => {
  const { data, error } = await supabase
    .from('entregas')
    .insert([entregaData])
    .select()
    .single();

  if (error) {
    console.error('Error adding entrega:', error.message || JSON.stringify(error));
    throw error;
  }
  return data ? mapDbRecordToPackageInfo(data as EntregaDbRecord) : null;
};

export const addMultipleEntregas = async (entregasData: EntregaData[]): Promise<PackageInfo[]> => {
    if (entregasData.length === 0) return [];
    const { data, error } = await supabase
        .from('entregas')
        .insert(entregasData)
        .select();

    if (error) {
        console.error('Error adding multiple entregas:', error.message || JSON.stringify(error));
        throw error;
    }
    return data ? data.map(d => mapDbRecordToPackageInfo(d as EntregaDbRecord)) : [];
};

export const getEntregasByUserId = async (userId: string): Promise<PackageInfo[]> => {
  const { data, error } = await supabase
    .from('entregas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching entregas:', error.message || JSON.stringify(error));
    throw error;
  }
  return data ? data.map(d => mapDbRecordToPackageInfo(d as EntregaDbRecord)) : [];
};

export const updateEntregaStatus = async (entregaId: string, status: EntregaDbRecord['status'], order?: number): Promise<PackageInfo | null> => {
  const updatePayload: { status: string; optimized_order?: number } = { status };
  if (order !== undefined) {
    updatePayload.optimized_order = order;
  }
  
  const { data, error } = await supabase
    .from('entregas')
    .update(updatePayload)
    .eq('id', entregaId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating entrega ${entregaId} to status ${status}:`, error.message || JSON.stringify(error));
    throw error;
  }
  return data ? mapDbRecordToPackageInfo(data as EntregaDbRecord) : null;
};

export const updateMultipleEntregasOptimization = async (
    updates: Array<{ id: string; optimized_order: number; route_id: string; status: EntregaDbRecord['status'] }>
): Promise<PackageInfo[]> => {
    if (updates.length === 0) return [];
    const results = [];
    for (const update of updates) {
        const { data, error } = await supabase
            .from('entregas')
            .update({ optimized_order: update.optimized_order, route_id: update.route_id, status: update.status })
            .eq('id', update.id)
            .select()
            .single();
        if (error) {
            console.error(`Error updating optimized order for entrega ${update.id}:`, error.message || JSON.stringify(error));
        } else if (data) {
            results.push(mapDbRecordToPackageInfo(data as EntregaDbRecord));
        }
    }
    return results;
};

export const deleteEntrega = async (entregaId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('entregas')
    .delete()
    .eq('id', entregaId);

  if (error) {
    console.error(`Error deleting entrega ${entregaId}:`, error.message || JSON.stringify(error));
    throw error;
  }
  return true;
};

export const updateUserProfileSettings = async (userId: string, settings: Partial<User>): Promise<User | null> => {
    const payload = settings;
    const { data, error } = await supabase
        .from('usuarios_rotaspeed')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user profile settings:', error.message || JSON.stringify(error));
        throw error;
    }
    return data as User | null;
};
