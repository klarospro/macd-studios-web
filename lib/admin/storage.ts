import type { SupabaseClient } from '@supabase/supabase-js'

export type DocumentKind = 'invoices' | 'receipts' | 'contracts'

/** Sube un archivo al bucket privado "documents" bajo el prefijo indicado. Devuelve el path guardado. */
export async function uploadDocument(
  supabase: SupabaseClient,
  kind: DocumentKind,
  filename: string,
  file: Buffer | Blob,
  contentType: string
): Promise<string> {
  const path = `${kind}/${Date.now()}-${filename}`
  const { error } = await supabase.storage.from('documents').upload(path, file, {
    contentType,
    upsert: false,
  })
  if (error) throw new Error(`No se pudo subir el documento: ${error.message}`)
  return path
}

export async function getSignedDocumentUrl(supabase: SupabaseClient, path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresIn)
  if (error) throw new Error(`No se pudo firmar la URL: ${error.message}`)
  return data.signedUrl
}

export async function listDocuments(supabase: SupabaseClient, kind: DocumentKind) {
  const { data, error } = await supabase.storage.from('documents').list(kind, {
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw new Error(`No se pudo listar documentos: ${error.message}`)
  return (data ?? [])
    .filter((f) => f.id) // ignora placeholders de carpeta
    .map((f) => ({ ...f, kind, path: `${kind}/${f.name}` }))
}

export async function getSignedDocumentUrls(supabase: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>()
  const { data, error } = await supabase.storage.from('documents').createSignedUrls(paths, 3600)
  if (error) throw new Error(`No se pudieron firmar las URLs: ${error.message}`)
  const map = new Map<string, string>()
  data?.forEach((d, i) => {
    if (d.signedUrl) map.set(paths[i], d.signedUrl)
  })
  return map
}
