'use client'

import { useRef, useTransition } from 'react'
import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { Button } from '@/components/admin/ui'
import { attachMedia, createUploadUrl } from './actions'

// Sube el archivo del navegador directo a Supabase Storage con una URL firmada.
export default function MediaUpload({ itemId, format }: { itemId: string; format: 'reel' | 'carrusel' }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()

  const upload = (files: FileList) =>
    start(async () => {
      try {
        const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).storage
        const urls: string[] = []
        for (const file of Array.from(files)) {
          const { path, token, publicUrl } = await createUploadUrl(itemId, file.name)
          const { error } = await storage.from('content-media').uploadToSignedUrl(path, token, file, { contentType: file.type })
          if (error) throw error
          urls.push(publicUrl)
        }
        await attachMedia(itemId, urls)
        toast.success(`${urls.length} archivo(s) subido(s)`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo subir')
      }
    })

  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        multiple={format === 'carrusel'}
        accept={format === 'reel' ? 'video/mp4' : 'image/jpeg,image/png'}
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
      <Button type="button" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? 'Subiendo…' : format === 'reel' ? 'Subir video (MP4)' : 'Subir imágenes (JPG)'}
      </Button>
    </>
  )
}
