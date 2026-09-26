'use client'

import { useRef, useTransition } from 'react'
import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { Button } from '@/components/admin/ui'
import { attachCover, attachMedia, createUploadUrl } from './actions'

// Sube el archivo del navegador directo a Supabase Storage con una URL firmada.
// mode="media": el video del reel o las imágenes finales del carrusel.
// mode="cover": la portada del carrusel creada en Gemini (luego el renderer la integra).
export default function MediaUpload({
  itemId,
  format,
  mode = 'media',
}: {
  itemId: string
  format: 'reel' | 'carrusel'
  mode?: 'media' | 'cover'
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const cover = mode === 'cover'

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
        if (cover) await attachCover(itemId, urls[0])
        else await attachMedia(itemId, urls)
        toast.success(cover ? 'Portada subida: el carrusel se vuelve a generar' : `${urls.length} archivo(s) subido(s)`)
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
        multiple={!cover && format === 'carrusel'}
        accept={!cover && format === 'reel' ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp'}
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
      <Button type="button" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? 'Subiendo…' : cover ? 'Subir portada (Gemini)' : format === 'reel' ? 'Subir mi video' : 'Subir imágenes'}
      </Button>
    </>
  )
}
