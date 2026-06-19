import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette, faWandMagicSparkles, faPlus, faTshirt, faMugSaucer, faCircleCheck,
  faRocket, faShoppingBag, faArrowRight, faPen, faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { podApi } from '../../../api/platform'
import { useT, useLocaleStore } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'
import { SafeImage } from '../../../components/Placeholder'
import { toast } from '../../../store/toast'
import { dialog } from '../../../store/dialog'

const PROMPT_TEMPLATES = [
  { key: 'pod.template.minimalist', prompt: 'Minimalist line-art mountain at sunset, single weight, off-white background' },
  { key: 'pod.template.streetwear', prompt: 'Bold Y2K streetwear graphic with neon gradients and chrome typography' },
  { key: 'pod.template.botanical', prompt: 'Vintage botanical illustration of monstera leaves, watercolor texture' },
  { key: 'pod.template.retro',     prompt: 'Retro 80s arcade sun and palm trees, magenta and cyan grid' },
]

export default function PodPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const format = useCurrencyStore((s) => s.format)
  const qc = useQueryClient()
  // DROP-540: incluir lang en queryKey + queryFn para titles traducidos.
  const { data: blanks = [], isLoading: blanksLoading } = useQuery({
    queryKey: ['pod-blanks', lang],
    queryFn: () => podApi.blanks(lang),
  })
  const { data: designs = [] } = useQuery({ queryKey: ['pod-designs'], queryFn: podApi.myDesigns })
  const [selProd, setSelProd] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')

  const selectedBlank = blanks.find((b: any) => b.id === selProd)

  const create = useMutation({
    mutationFn: () => podApi.createDesign({ productId: selProd!, name, aiPrompt: prompt || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pod-designs'] })
      toast.success(t('pod.toast.created'))
      setSelProd(null); setName(''); setPrompt('')
    },
  })
  const aiGen = useMutation({
    mutationFn: () => podApi.aiGenerate(prompt),
    onSuccess: () => toast.success(t('pod.toast.ai_done')),
  })
  // DROP-599: acciones sobre diseños (eliminar / renombrar).
  const delDesign = useMutation({
    mutationFn: (id: string) => podApi.deleteDesign(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pod-designs'] }); toast.success(t('pod.action.deleted')) },
    onError: () => toast.error(t('pod.action.error')),
  })
  const renameDesign = useMutation({
    mutationFn: ({ id, name: n }: { id: string; name: string }) => podApi.renameDesign(id, n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pod-designs'] }); toast.success(t('pod.action.renamed')) },
    onError: () => toast.error(t('pod.action.error')),
  })
  async function onDelete(d: any) {
    if (await dialog.confirm({ variant: 'error', message: t('pod.action.delete_confirm').replace('{name}', d.name) })) delDesign.mutate(d.id)
  }
  async function onRename(d: any) {
    const n = await dialog.prompt({ message: t('pod.action.rename_prompt'), defaultValue: d.name })
    if (n && n.trim() && n.trim() !== d.name) renameDesign.mutate({ id: d.id, name: n.trim() })
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-50 via-white to-amber-50 border border-ink-100 px-6 py-10 lg:px-12 lg:py-14 relative overflow-hidden">
        <div aria-hidden="true" className="absolute -top-12 -right-12 w-72 h-72 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="chip chip-active inline-flex items-center gap-1.5">
            <FontAwesomeIcon icon={faPalette} className="text-[11px]" /> {t('pod.hero.tag')}
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-medium tracking-tight">
            {t('pod.hero.title')}{' '}
            <span className="bg-gradient-to-r from-brand-600 to-amber-500 bg-clip-text text-transparent">
              {t('pod.hero.title_accent')}
            </span>
          </h1>
          <p className="mt-3 text-ink-600 max-w-xl">{t('pod.hero.body')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#blanks" className="btn btn-primary">{t('pod.hero.cta_pick')} <FontAwesomeIcon icon={faArrowRight} /></a>
            <a href="#designs" className="btn btn-outline">{t('pod.hero.cta_designs')}</a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ink-600">
            <Perk icon={faCircleCheck} labelKey="pod.hero.perk1" />
            <Perk icon={faShoppingBag} labelKey="pod.hero.perk2" />
            <Perk icon={faRocket}      labelKey="pod.hero.perk3" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-xl mb-4">{t('pod.how.title')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: faTshirt, key: 'pod.how.s1' },
            { icon: faWandMagicSparkles, key: 'pod.how.s2' },
            { icon: faPalette, key: 'pod.how.s3' },
            { icon: faRocket, key: 'pod.how.s4' },
          ].map((s, i) => (
            <div key={s.key} className="card p-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-[12px] font-medium">
                  {i + 1}
                </span>
                <FontAwesomeIcon icon={s.icon} className="text-brand-500" />
              </div>
              <h3 className="mt-3 font-medium">{t(`${s.key}.title`)}</h3>
              <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{t(`${s.key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Blanks catalog */}
      <section id="blanks">
        <header className="section-header">
          <h2 className="text-xl flex items-center gap-2">
            <FontAwesomeIcon icon={faTshirt} className="text-brand-500" /> {t('pod.blanks')}
          </h2>
          <span className="text-[12px] text-ink-500">{blanks.length} {t('pod.blanks_count')}</span>
        </header>

        {blanksLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card p-3"><div className="skeleton aspect-square w-full mb-2" /><div className="skeleton h-3 w-4/5" /></div>
            ))}
          </div>
        ) : blanks.length === 0 ? (
          <div className="card p-10 text-center">
            <FontAwesomeIcon icon={faMugSaucer} className="text-4xl text-ink-300 mb-3" />
            <p className="font-medium">{t('pod.empty.title')}</p>
            <p className="text-[12px] text-ink-500 mt-1">{t('pod.empty.body')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {blanks.map((b: any) => (
              <button key={b.id} onClick={() => setSelProd(b.id)}
                      className="card overflow-hidden text-left hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all">
                {/* DROP-540: backend ahora envía mainImage; mantenemos b.image como fallback legacy. */}
                <SafeImage src={b.mainImage ?? b.image} alt={b.title}
                           className="aspect-square w-full object-cover"
                           fallbackClassName="aspect-square w-full" />
                <div className="p-3">
                  <div className="text-[12px] font-medium line-clamp-2 min-h-[2.5rem]">{b.title}</div>
                  <div className="text-[12px] text-brand-700 mt-1">{format(Number(b.price ?? 0), b.currency ?? 'USD')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* My designs */}
      <section id="designs">
        <header className="section-header">
          <h2 className="text-xl flex items-center gap-2">
            <FontAwesomeIcon icon={faPalette} className="text-brand-500" /> {t('pod.designs')}
          </h2>
        </header>
        {designs.length === 0 ? (
          <div className="card p-10 text-center">
            <FontAwesomeIcon icon={faPalette} className="text-4xl text-ink-300 mb-3" />
            <p className="font-medium">{t('pod.designs_empty.title')}</p>
            <p className="text-[12px] text-ink-500 mt-1">{t('pod.designs_empty.body')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {designs.map((d) => (
              <div key={d.id} className="card overflow-hidden group relative">
                <SafeImage src={d.mockupUrl} alt={d.name}
                           className="aspect-square w-full object-cover"
                           fallbackClassName="aspect-square w-full" />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onRename(d)} title={t('pod.action.rename')}
                          className="btn btn-xs btn-square bg-base-100/90 border-base-200"><FontAwesomeIcon icon={faPen} className="text-[10px]" /></button>
                  <button onClick={() => onDelete(d)} title={t('pod.action.delete')}
                          className="btn btn-xs btn-square bg-base-100/90 border-base-200 text-error"><FontAwesomeIcon icon={faTrash} className="text-[10px]" /></button>
                </div>
                <div className="p-3">
                  <div className="text-[12px] font-medium line-clamp-1">{d.name}</div>
                  <div className="text-[11px] text-ink-500 line-clamp-1">{d.productTitle}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create design modal */}
      {selProd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelProd(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <header className="mb-4">
              <h3 className="text-lg font-medium">{t('pod.create_for')} <strong>{selectedBlank?.title}</strong></h3>
              <p className="text-[12px] text-ink-500 mt-1">{t('pod.create_body')}</p>
            </header>

            <form onSubmit={(e) => { e.preventDefault(); create.mutate() }} className="space-y-4">
              <div>
                <label className="text-[12px] text-ink-500">{t('pod.field.name')}</label>
                <input required value={name} onChange={(e) => setName(e.target.value)}
                       className="input mt-1" placeholder={t('pod.field.name_placeholder')} />
              </div>
              <div>
                <label className="text-[12px] text-ink-500">{t('pod.field.prompt')}</label>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                          className="input mt-1" rows={3}
                          placeholder={t('pod.field.prompt_placeholder')} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PROMPT_TEMPLATES.map((p) => (
                    <button key={p.key} type="button" onClick={() => setPrompt(p.prompt)}
                            className="chip text-[11px]">{t(p.key)}</button>
                  ))}
                </div>
              </div>
              {prompt && (
                <button type="button" onClick={() => aiGen.mutate()} disabled={aiGen.isPending}
                        className="btn btn-outline w-full text-[12px]">
                  <FontAwesomeIcon icon={faWandMagicSparkles} /> {aiGen.isPending ? t('pod.ai_generating') : t('pod.ai_generate')}
                </button>
              )}
              {aiGen.data?.mockupUrl && (
                <SafeImage src={aiGen.data.mockupUrl} alt={name || 'preview'}
                           className="w-full aspect-square object-cover rounded-md border border-ink-100"
                           fallbackClassName="w-full aspect-square rounded-md" />
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelProd(null)} className="btn btn-outline text-[12px]">{t('actions.cancel')}</button>
                <button type="submit" disabled={create.isPending || !name} className="btn btn-primary text-[12px]">
                  <FontAwesomeIcon icon={faPlus} /> {create.isPending ? t('common.saving') : t('pod.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Perk({ icon, labelKey }: { icon: any; labelKey: string }) {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1.5">
      <FontAwesomeIcon icon={icon} className="text-emerald-500" /> {t(labelKey)}
    </span>
  )
}
