import { supabase } from './supabase'
import { decode } from 'base64-arraybuffer'

export async function uploadPhoto(base64: string, path: string): Promise<string> {
  const arrayBuffer = decode(base64)

  const { error } = await supabase.storage
    .from('checkin-evidence')
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (error) throw error

  // Bucket privado — usar path como referencia, la URL se genera al leer
  return path
}
