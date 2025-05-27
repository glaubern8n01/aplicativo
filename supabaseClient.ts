
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@^2.44.4';
// FIX: Ensure EntregaDbRecord is imported if its definition is used for mapping
// FIX: Ensure InputType is imported as it's used in type casting
import type { User, PackageInfo, AddressInfo, EntregaDbRecord, InputType } from './types'; 

// Real Supabase Credentials
const supabaseUrl: string = 'https://zhjzqrddmigczdfxvfhp.supabase.co';
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoanpxcmRkbWlnY3pkZnh2ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNjM3MDMsImV4cCI6MjA2MjgzOTcwM30.U5l5VEIg4WI7aDS6QbsQRqMAWx6HGgkmDEOObWOnYc8';

// Basic check to ensure credentials are not obviously the old placeholders if copy-pasted.
if (supabaseUrl === 'https://exampleprojectid.supabase.co' || supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.warn(
    `Warning: Supabase URL might still be a placeholder or example ('${supabaseUrl}'). Please update it in supabaseClient.ts with your actual Supabase project URL for the app to function correctly.`
  );
}

if (supabaseAnonKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn(
    `Warning: Supabase Anon Key might still be a placeholder or example. Please update it in supabaseClient.ts with your actual Supabase project Anon Key for the app to function correctly.`
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// --- Status Mapping Functions ---
export const mapDBStatusToPackageStatus = (dbStatus: EntregaDbRecord['status']): PackageInfo['status'] => {
  switch (dbStatus) {
    case 'pendente': return 'pending';
    case 'em_rota': return 'in_transit';
    case 'entregue': return 'delivered';
    case 'cancelada': return 'cancelled';
    case 'nao_entregue': return 'undeliverable'; // Assuming 'nao_entregue' maps to 'undeliverable'
    default:
      // Log unhandled status and return a default or throw error
      console.warn(`Unhandled DB status: ${dbStatus}, defaulting to 'pending' for PackageInfo.`);
      return 'pending'; // Or handle as an error state like 'parsed' or 'error'
  }
};

export const mapPackageStatusToDBStatus = (packageStatus: PackageInfo['status']): EntregaDbRecord['status'] => {
  switch (packageStatus) {
    case 'pending': return 'pendente';
    case 'in_transit': return 'em_rota';
    case 'delivered': return 'entregue';
    case 'cancelled': return 'cancelada';
    case 'undeliverable': return 'nao_entregue'; // Assuming 'undeliverable' maps to 'nao_entregue'
    // 'parsed' and 'error' are frontend-only conceptual statuses before DB interaction or after AI error
    // They don't directly map to a typical persistent delivery status in the same way.
    // If they need to be persisted, the DB schema/logic would need to account for them.
    // For now, if 'parsed' or 'error' is passed, it implies it should become 'pendente' if being saved.
    case 'parsed': 
    case 'error':
        console.warn(`Package status ${packageStatus} mapped to 'pendente' for DB operation.`);
        return 'pendente';
    default:
      // Log unhandled status and return a default or throw error
      console.warn(`Unhandled PackageInfo status: ${packageStatus}, defaulting to 'pendente' for DB.`);
      return 'pendente';
  }
};


// Helper function to map a raw DB record to PackageInfo
// FIX: Correctly map fields with different names (e.g., full_address to fullAddress)
// and handle optional fields potentially being null from DB.
const mapDbRecordToPackageInfo = (dbRecord: EntregaDbRecord): PackageInfo => {
  const {
    full_address,   // to be mapped to fullAddress
    recipient_name, // to be mapped to recipientName
    original_input, // to be mapped to originalInput
    input_type,     // to be mapped to inputType
    status: dbStatus, // to be mapped by mapDBStatusToPackageStatus
    ...rest // all other fields that have matching names (id, street, number, etc.)
  } = dbRecord;

  return {
    ...rest, // Spread fields with matching names (id, street, number, bairro, complemento, cep, city, state, telefone, user_id, created_at, optimized_order, route_id, delivery_notes)
    fullAddress: full_address,
    recipientName: recipient_name ?? undefined, // Handle potential null from DB for optional TS field
    originalInput: original_input ?? undefined, // Handle potential null from DB for optional TS field
    inputType: input_type ? (input_type as InputType) : undefined, // Handle potential null and cast for optional TS field
    status: mapDBStatusToPackageStatus(dbStatus),
    // errorMessage is specific to PackageInfo and not in EntregaDbRecord, so it defaults to undefined if not set otherwise by other logic
    // It's optional in PackageInfo, so `undefined` is fine.
    // Other fields like user_id, route_id, delivery_notes, optimized_order, created_at are included via ...rest
  };
};


// Helper function to get user profile from 'usuarios_rotaspeed' table
export const getUserProfile = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error.message || JSON.stringify(error));
    if (error.code === 'PGRST116') { // Resource not found (expected if profile doesn't exist yet)
        return null; 
    }
    // For other errors, rethrow or handle as needed
    // For now, let's allow createUserProfile to be called by returning null on PGRST116
  }
  return data as User | null;
};

// Helper function to create a new user profile for 'usuarios_rotaspeed' table
export const createUserProfile = async (userId: string, email?: string): Promise<User | null> => {
  const normalizedEmail = email?.toLowerCase();
  const isAdminEmail = normalizedEmail === 'glaubercontatos@outlook.com';
  let userPlanSettings: Partial<User>;

  if (isAdminEmail) {
    userPlanSettings = {
      id: userId,
      email: email, 
      plano_nome: 'Admin Ilimitado',
      entregas_dia_max: 99999,
      entregas_hoje: 0,
      saldo_creditos: 99999,
      plano_ativo: true,
      entregas_gratis_utilizadas: 0, 
      driver_name: 'Glauber (Admin)', // Admin specific name
      driver_phone: '',
      navigation_preference: 'google',
      notification_sender_preference: 'driver',
    };
  } else {
    // Defaults based on user's request:
    // nome: "Entregador RotaSpeed" -> driver_name
    // plano_nome: "Start"
    // plano_ativo: true
    // entregas_dia_max: 10
    // entregas_hoje: 0
    // saldo_creditos: 0
    userPlanSettings = {
      id: userId,
      email: email,
      driver_name: "Entregador RotaSpeed", // User specified default name
      plano_nome: "Start",                 // User specified default plan name
      plano_ativo: true,
      entregas_dia_max: 10,
      entregas_hoje: 0,
      saldo_creditos: 0,
      entregas_gratis_utilizadas: 0,       // Assuming 0 for new users on "Start" plan too
      driver_phone: '',                    // Default empty
      navigation_preference: 'google',     // Default
      notification_sender_preference: 'driver', // Default
    };
  }

  const { data, error } = await supabase
    .from('usuarios_rotaspeed')
    .insert([userPlanSettings as User]) 
    .select()
    .single();
  
  if (error) {
    console.error('Error creating user profile:', error.message || JSON.stringify(error));
    if (error.code === '23505') { // Unique violation, profile might already exist
        const existingProfile = await getUserProfile(userId);
        if (isAdminEmail && existingProfile && existingProfile.plano_nome !== 'Admin Ilimitado') {
            // If admin logged in and profile existed but wasn't admin, update it
            const { data: updatedAdminProfile, error: updateError } = await supabase
                .from('usuarios_rotaspeed')
                .update({
                    plano_nome: 'Admin Ilimitado',
                    entregas_dia_max: 99999,
                    saldo_creditos: 99999,
                    plano_ativo: true,
                    driver_name: userPlanSettings.driver_name || 'Glauber (Admin)',
                 })
                .eq('id', userId)
                .select()
                .single();
            if (updateError) {
                 console.error('Error updating existing profile to admin plan:', updateError.message || JSON.stringify(updateError));
                 return existingProfile; 
            }
            return updatedAdminProfile as User | null;
        }
        return existingProfile;
    }
    throw error;
  }
  return data as User | null;
};

// --- 'entregas' table functions ---

// EntregaData expects DB-compatible status
export interface EntregaData extends Omit<PackageInfo, 'id' | 'status' | 'order' | 'created_at' | 'optimized_order'> {
  user_id: string;
  status: EntregaDbRecord['status']; // Use DB status type
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
  // Adapt the returned Supabase data to PackageInfo structure
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
    .order('created_at', { ascending: false }); // Or order by 'optimized_order' if relevant

  if (error) {
    console.error('Error fetching entregas:', error.message || JSON.stringify(error));
    throw error;
  }
  return data ? data.map(d => mapDbRecordToPackageInfo(d as EntregaDbRecord)) : [];
};

// This function expects a DB-compatible status
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
    // This function expects DB-compatible status
    updates: Array<{ id: string; optimized_order: number; route_id: string; status: EntregaDbRecord['status'] }>
): Promise<PackageInfo[]> => {
    if (updates.length === 0) return [];
    // Supabase bulk update needs careful handling. It's often easier to loop or use a stored procedure for complex bulk updates.
    // For simplicity, let's loop through updates. For large numbers, consider a Postgres function.
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
            // Continue trying other updates
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

// --- User Profile Settings Update ---
export const updateUserProfileSettings = async (userId: string, settings: Partial<User>): Promise<User | null> => {
    const { data, error } = await supabase
        .from('usuarios_rotaspeed')
        .update(settings)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user profile settings:', error.message || JSON.stringify(error));
        throw error;
    }
    return data as User | null;
};
