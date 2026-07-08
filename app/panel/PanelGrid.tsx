'use client'

import { useState } from 'react'

interface ContentItem {
  id: string
  type: string
  platform: string
  content: string
  status: string
  created_at: string
  products: { title: string; image_url: string | null; category: string } | null
}

const TYPE_LABEL: Record<string, string> = {
  caption: 'Caption Instagram',
  video_script: 'Script TikTok',
  image_prompt: 'Prompt imagen'
}

export default function PanelGrid({ items, token }: { items: ContentItem[]; token: string }) {
  const [list, setList] = useState(items)

  function remove(id: string) {
    setList(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {list.map(item => (
        <ContentCard key={item.id} item={item} token={token} onDone={() => remove(item.id)} />
      ))}
    </div>
  )
}

function ContentCard({ item, token, onDone }: { item: ContentItem; token: string; onDone: () => void }) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [copied, setCopied] = useState(false)

  async function approve() {
    setLoading('approve')
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: item.id, image_url: imageUrl || undefined, token })
    })
    setLoading(null)
    onDone()
  }

  async function reject() {
    setLoading('reject')
    await fetch('/api/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: item.id, token })
    })
    setLoading(null)
    onDone()
  }

  function copy() {
    navigator.clipboard.writeText(item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-5">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <span className="text-xs bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-zinc-400">
            {TYPE_LABEL[item.type] || item.type}
          </span>
          <span className="text-xs bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-zinc-500">
            {item.platform}
          </span>
        </div>
        <span className="text-xs text-zinc-600">
          {new Date(item.created_at).toLocaleDateString('es-ES')}
        </span>
      </div>

      {item.products?.title && (
        <p className="text-[#D4AF37] text-xs font-medium mb-2">
          Producto: {item.products.title}
        </p>
      )}

      <div className="relative bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-4 mb-4">
        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
          {item.content}
        </p>
        <button
          onClick={copy}
          className={`absolute top-2 right-2 text-xs px-3 py-1 rounded transition-colors ${
            copied
              ? 'bg-[#D4AF37] text-black font-semibold'
              : 'bg-[#222] text-zinc-500 hover:text-white'
          }`}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        {item.type === 'caption' && (
          <input
            type="url"
            placeholder="URL de la imagen (para publicar en IG)"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            className="flex-1 min-w-48 bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#D4AF37]/50"
          />
        )}
        <button
          onClick={approve}
          disabled={loading !== null}
          className="bg-[#D4AF37] text-black font-semibold text-sm px-5 py-2 rounded-lg hover:bg-[#E8C766] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'approve' ? 'Aprobando...' : '✓ Aprobar'}
        </button>
        <button
          onClick={reject}
          disabled={loading !== null}
          className="border border-red-900/50 text-red-400 text-sm px-4 py-2 rounded-lg hover:border-red-700 transition-colors disabled:opacity-50"
        >
          {loading === 'reject' ? '...' : '✗ Rechazar'}
        </button>
      </div>
    </div>
  )
}
