import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faGlobe, faUserTie } from '@fortawesome/free-solid-svg-icons'
import { mentorsApi } from '../../../api/platform'
import { useT, useLocaleStore } from '../../../store/locale'
import { useCurrencyStore } from '../../../store/currency'

// DROP-627: badge de estado de la reserva con color semántico (antes siempre brand).
const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-brand-50 text-brand-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
  canceled:  'bg-rose-100 text-rose-700',
}
function bookingStatusColor(status: string): string {
  return BOOKING_STATUS_COLOR[status?.toLowerCase()] ?? 'bg-ink-100 text-ink-700'
}

// DROP-510: mapping skill EN → idioma activo (hasta que el backend persista i18n).
const SKILL_MAP: Record<string, Record<string, string>> = {
  es: { sourcing: 'Sourcing', branding: 'Branding', logistics: 'Logística', marketing: 'Marketing',
        photography: 'Fotografía', design: 'Diseño', shopify: 'Shopify', tiktok: 'TikTok Ads',
        amazon: 'Amazon FBA', alibaba: 'Alibaba', china: 'China', dropshipping: 'Dropshipping',
        seo: 'SEO', ads: 'Anuncios', ppc: 'PPC', 'product-research': 'Investigación de producto' },
  pt: { sourcing: 'Sourcing', branding: 'Branding', logistics: 'Logística', marketing: 'Marketing',
        photography: 'Fotografia', design: 'Design', shopify: 'Shopify', tiktok: 'TikTok Ads',
        amazon: 'Amazon FBA', alibaba: 'Alibaba', china: 'China', dropshipping: 'Dropshipping',
        seo: 'SEO', ads: 'Anúncios', ppc: 'PPC', 'product-research': 'Pesquisa de produto' },
  fr: { sourcing: 'Sourcing', branding: 'Branding', logistics: 'Logistique', marketing: 'Marketing',
        photography: 'Photographie', design: 'Design', shopify: 'Shopify', tiktok: 'TikTok Ads',
        amazon: 'Amazon FBA', alibaba: 'Alibaba', china: 'Chine', dropshipping: 'Dropshipping',
        seo: 'SEO', ads: 'Publicités', ppc: 'PPC', 'product-research': 'Recherche de produits' },
  de: { sourcing: 'Sourcing', branding: 'Branding', logistics: 'Logistik', marketing: 'Marketing',
        photography: 'Fotografie', design: 'Design', shopify: 'Shopify', tiktok: 'TikTok Ads',
        amazon: 'Amazon FBA', alibaba: 'Alibaba', china: 'China', dropshipping: 'Dropshipping',
        seo: 'SEO', ads: 'Anzeigen', ppc: 'PPC', 'product-research': 'Produktrecherche' },
  it: { sourcing: 'Sourcing', branding: 'Branding', logistics: 'Logistica', marketing: 'Marketing',
        photography: 'Fotografia', design: 'Design', shopify: 'Shopify', tiktok: 'TikTok Ads',
        amazon: 'Amazon FBA', alibaba: 'Alibaba', china: 'Cina', dropshipping: 'Dropshipping',
        seo: 'SEO', ads: 'Annunci', ppc: 'PPC', 'product-research': 'Ricerca prodotti' },
  nl: { sourcing: 'Sourcing', branding: 'Branding', logistics: 'Logistiek', marketing: 'Marketing',
        photography: 'Fotografie', design: 'Design', shopify: 'Shopify', tiktok: 'TikTok Ads',
        amazon: 'Amazon FBA', alibaba: 'Alibaba', china: 'China', dropshipping: 'Dropshipping',
        seo: 'SEO', ads: 'Advertenties', ppc: 'PPC', 'product-research': 'Productonderzoek' },
  zh: { sourcing: '采购', branding: '品牌', logistics: '物流', marketing: '营销',
        photography: '摄影', design: '设计', shopify: 'Shopify', tiktok: 'TikTok 广告',
        amazon: '亚马逊 FBA', alibaba: '阿里巴巴', china: '中国', dropshipping: '一件代发',
        seo: 'SEO', ads: '广告', ppc: '按点击付费', 'product-research': '产品调研' },
}
function tSkill(skill: string, lang: string): string {
  const k = skill.toLowerCase().replace(/\s+/g, '-')
  return SKILL_MAP[lang]?.[k] ?? skill
}

export default function MentorsPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  // DROP-510: precios horarios en USD canon → mostrar en moneda activa.
  const format = useCurrencyStore((s) => s.format)
  const qc = useQueryClient()
  const { data: mentors = [], isLoading: mentorsLoading } = useQuery({ queryKey: ['mentors'], queryFn: mentorsApi.list })
  const { data: bookings = [] } = useQuery({ queryKey: ['my-bookings'], queryFn: mentorsApi.mine })
  const [bookingMentor, setBookingMentor] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState('')
  const [topic, setTopic] = useState('')
  const book = useMutation({
    mutationFn: () => mentorsApi.book({ mentorId: bookingMentor!, startsAt: new Date(startsAt).toISOString(), topic }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-bookings'] }); setBookingMentor(null); setStartsAt(''); setTopic('') },
  })
  return (
    <div className="space-y-5">
      <header>
        <h1>{t('mentors.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('mentors.subtitle')}</p>
      </header>
      {mentorsLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-5 w-1/2 mt-2" />
              <div className="skeleton h-8 w-full mt-3" />
            </div>
          ))}
        </div>
      ) : mentors.length === 0 ? (
        <div className="card p-10 text-center text-ink-500">
          <FontAwesomeIcon icon={faUserTie} className="text-3xl text-ink-300 mb-2" />
          <p>{t('mentors.empty')}</p>
        </div>
      ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mentors.map((m) => (
          <div key={m.id} className="card p-4 transition-shadow hover:shadow-pastel-lg">
            <div className="font-medium">{m.displayName}</div>
            <div className="text-[12px] text-ink-600 mt-1 line-clamp-2">{m.headline}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {m.expertise.slice(0, 3).map((e) => <span key={e} className="badge bg-brand-50 text-brand-700">{tSkill(e, lang)}</span>)}
            </div>
            <div className="text-[11px] text-ink-500 mt-2 flex items-center gap-2">
              <FontAwesomeIcon icon={faGlobe} className="text-[10px]" /> {m.languages.join(', ')}
            </div>
            <div className="flex items-baseline justify-between mt-3">
              <span className="font-medium text-brand-700">{format(m.hourlyRateUsdCents/100, 'USD')}<span className="text-[11px] text-ink-500">{t('mentors.rate_hour')}</span></span>
              <button onClick={() => setBookingMentor(m.id)} className="btn btn-outline text-[12px]">
                <FontAwesomeIcon icon={faCalendarDays} /> {t('mentors.book')}
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
      {bookings.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-2 mt-6">{t('mentors.bookings')}</h2>
          <div className="space-y-2">
            {bookings.map((b) => (
              <div key={b.id} className="card p-3 flex items-center gap-3 text-[13px] transition-colors hover:bg-ink-50/50">
                <span className={`badge ${bookingStatusColor(b.status)}`}>{b.status}</span>
                <span className="flex-1 truncate">{b.mentorName} · {new Date(b.startsAt).toLocaleString()}</span>
                <span className="text-[11px] text-ink-500 whitespace-nowrap">{b.durationMin}min</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {bookingMentor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setBookingMentor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-md p-5">
            <h3>{t('mentors.book')}</h3>
            <form onSubmit={(e) => { e.preventDefault(); book.mutate() }} className="space-y-3 mt-3">
              {/* DROP-511 */}
              <div><label className="text-xs text-ink-500">{t('mentors.book.starts_at')}</label>
                <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input mt-1" /></div>
              <div><label className="text-xs text-ink-500">{t('mentors.book.topic')}</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} className="input mt-1" /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setBookingMentor(null)} className="btn btn-ghost">{t('common.cancel')}</button>
                <button type="submit" disabled={book.isPending} className="btn btn-primary">{t('mentors.book')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
