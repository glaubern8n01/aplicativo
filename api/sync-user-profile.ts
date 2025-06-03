import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { userId, email, nome } = req.body

  if (!userId || !email) {
    return res.status(400).json({ error: 'userId e email são obrigatórios' })
  }

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('usuarios_rotaspeed')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error('Erro ao buscar usuário:', fetchError.message)
      return res.status(500).json({ error: fetchError.message })
    }

    if (!existingUser) {
      const { error: insertError } = await supabase.from('usuarios_rotaspeed').insert([
        {
          id: userId,
          email,
          nome: nome ?? 'Entregador',
          plano_nome: 'Start',
          plano_ativo: true,
          entregas_dia_max: 10,
          entregas_hoje: 0,
          ultima_atualizacao: new Date().toISOString(),
          saldo_creditos: 0,
          entregas_gratis_utilizadas: 0
        }
      ])

      if (insertError) {
        console.error('Erro ao criar usuário:', insertError.message)
        return res.status(500).json({ error: insertError.message })
      }
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Erro inesperado:', err)
    return res.status(500).json({ error: 'Erro interno', detail: err.message })
  }
}
