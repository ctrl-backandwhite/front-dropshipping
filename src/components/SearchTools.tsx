import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faLink, faCamera, faXmark, faSpinner, faCircleCheck, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import {
  importProductByUrl, searchByImage, ImportUrlResponse, ImageSearchResult,
} from '../api/catalog'
import { useT, useLocaleStore } from '../store/locale'

/**
 * Two compact tools mounted in the navbar:
 *  - URL import (DROP-15) — paste a 1688/Taobao/AliExpress/eBay URL, resolve to a product
 *  - Image search (DROP-16) — drop or paste an image, get visually similar products (mock-scored)
 */
export function SearchTools() {
  const [tool, setTool] = useState<'url' | 'image' | null>(null)
  const t = useT()
  return (
    <>
      <button
        onClick={() => setTool('url')}
        className="btn btn-ghost p-2"
        title={t('catalog.import_url.title')}
      >
        <FontAwesomeIcon icon={faLink} />
      </button>
      <button
        onClick={() => setTool('image')}
        className="btn btn-ghost p-2"
        title={t('catalog.image_search.title')}
      >
        <FontAwesomeIcon icon={faCamera} />
      </button>
      {tool === 'url' && <UrlImportModal onClose={() => setTool(null)} />}
      {tool === 'image' && <ImageSearchModal onClose={() => setTool(null)} />}
    </>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="!m-0">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost p-2"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function UrlImportModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const [url, setUrl] = useState('')
  const m = useMutation<ImportUrlResponse, Error, string>({
    mutationFn: (u) => importProductByUrl(u, lang),
  })
  return (
    <ModalShell title={t('catalog.import_url.title')} onClose={onClose}>
      <p className="text-[12px] text-ink-500 mb-3">{t('catalog.import_url.hint')}</p>
      <form onSubmit={(e) => { e.preventDefault(); if (url.trim()) m.mutate(url.trim()) }} className="flex gap-2">
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('catalog.import_url.placeholder')}
          className="input flex-1"
        />
        <button type="submit" disabled={m.isPending} className="btn btn-primary">
          {m.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : t('catalog.import_url.go')}
        </button>
      </form>
      {m.data && (
        <div className={`mt-4 card p-4 text-[13px] ${m.data.matched ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 font-medium mb-1">
            <FontAwesomeIcon icon={m.data.matched ? faCircleCheck : faTriangleExclamation}
              className={m.data.matched ? 'text-emerald-600' : 'text-amber-600'} />
            {m.data.matched ? t('catalog.import_url.matched') : t('catalog.import_url.unmatched')}
          </div>
          {m.data.product && (
            <Link to={`/catalog/${m.data.product.slug}`} onClick={onClose}
              className="flex items-center gap-3 text-ink-700 hover:text-brand-700 mt-2">
              {m.data.product.mainImage && (
                <img src={m.data.product.mainImage} className="w-12 h-12 object-cover rounded" alt="" />
              )}
              <div className="flex-1 min-w-0">
                <div className="line-clamp-1">{m.data.product.title}</div>
                <div className="text-[11px] text-ink-500 font-mono">
                  {m.data.source} · {m.data.externalId}
                </div>
              </div>
            </Link>
          )}
          {!m.data.matched && m.data.resolveHint && (
            <p className="text-[12px] text-ink-600 mt-2">{m.data.resolveHint}</p>
          )}
        </div>
      )}
    </ModalShell>
  )
}

function ImageSearchModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const m = useMutation<ImageSearchResult[], Error, string>({
    mutationFn: (base64) => searchByImage({ imageBase64: base64, limit: 12 }, lang),
  })

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = String(reader.result).split(',')[1] // strip data: prefix
      setPreview(String(reader.result))
      m.mutate(b64)
    }
    reader.readAsDataURL(file)
  }

  // accept paste from clipboard
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.items ?? [])]
        .find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (file) readFile(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  return (
    <ModalShell title={t('catalog.image_search.title')} onClose={onClose}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) readFile(file)
        }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-ink-200 rounded-md p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-ink-50 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="" className="mx-auto max-h-40 object-contain rounded" />
        ) : (
          <>
            <FontAwesomeIcon icon={faCamera} className="text-2xl text-ink-400 mb-2" />
            <p className="text-[13px] text-ink-600">{t('catalog.image_search.drop')}</p>
          </>
        )}
        <input
          ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }}
        />
      </div>
      {m.isPending && (
        <p className="text-[12px] text-ink-500 mt-3 flex items-center gap-2">
          <FontAwesomeIcon icon={faSpinner} spin /> {t('catalog.image_search.scoring')}
        </p>
      )}
      {m.data && m.data.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {m.data.map((r) => (
            <Link key={r.product.id} to={`/catalog/${r.product.slug}`} onClick={onClose}
              className="block group">
              {r.product.mainImage && (
                <img src={r.product.mainImage} alt="" className="w-full aspect-square object-cover rounded" />
              )}
              <div className="text-[10px] text-ink-500 mt-1 font-mono">{(r.score * 100).toFixed(0)}%</div>
              <div className="text-[11px] line-clamp-2 group-hover:text-brand-700">{r.product.title}</div>
            </Link>
          ))}
        </div>
      )}
      {!m.data && !m.isPending && !preview && (
        <p className="text-[12px] text-ink-500 mt-3">{t('catalog.image_search.empty')}</p>
      )}
    </ModalShell>
  )
}
