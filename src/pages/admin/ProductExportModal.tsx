import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faDownload, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { admin } from '../../api/admin'
import { dialog } from '../../store/dialog'
import { useT } from '../../store/locale'

/**
 * Exporta los productos en el MISMO formato JSON del import masivo (re-importable), de forma
 * segmentada por rango (1-1000, 1001-2000, …). El archivo se nombra con el rango + la fecha.
 */
export function ProductExportModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [segSize, setSegSize] = useState(1000)
  const [busy, setBusy] = useState<string | null>(null)

  const { data: total = 0, isLoading } = useQuery({
    queryKey: ['export-product-count'],
    queryFn: () => admin.exportProductsCount(),
  })

  const size = Math.max(1, segSize)
  const segments: { from: number; to: number }[] = []
  for (let from = 1; from <= total; from += size) {
    segments.push({ from, to: Math.min(from + size - 1, total) })
  }

  async function download(from: number, to: number) {
    const key = `${from}-${to}`
    setBusy(key)
    try {
      const rows = await admin.exportProducts(from, to)
      const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `productos_${from}-${to}_${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      dialog.alert({ variant: 'error', message: e?.response?.data?.message ?? 'Error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-base-100 rounded-box shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{t('admin.export.title')}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-xs btn-square"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <p className="text-[12px] text-ink-500">{t('admin.export.help')}</p>

        <div className="flex items-end gap-3">
          <div>
            <label className="text-[12px] font-medium text-ink-600 mb-1 block">{t('admin.export.segment_size')}</label>
            <input type="number" min={1} value={segSize} onChange={(e) => setSegSize(Number(e.target.value))}
                   className="input input-bordered input-sm w-32" />
          </div>
          <div className="text-[12px] text-ink-500 pb-1.5">
            {isLoading ? '…' : t('admin.export.total').replace('{n}', String(total))}
          </div>
        </div>

        {total === 0 && !isLoading && (
          <div className="text-[12px] text-ink-400 text-center py-4">{t('admin.export.empty')}</div>
        )}

        {segments.length > 0 && (
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {segments.map(({ from, to }) => {
              const key = `${from}-${to}`
              return (
                <button key={key} onClick={() => download(from, to)} disabled={busy !== null}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-ink-100 hover:bg-ink-50 text-[13px] disabled:opacity-50">
                  <span className="font-mono">{from} – {to}</span>
                  <span className="flex items-center gap-2 text-ink-500">
                    {t('admin.export.products').replace('{n}', String(to - from + 1))}
                    <FontAwesomeIcon icon={busy === key ? faSpinner : faDownload} className={busy === key ? 'fa-spin' : ''} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
