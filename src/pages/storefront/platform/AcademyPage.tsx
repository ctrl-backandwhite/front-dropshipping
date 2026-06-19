import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGraduationCap, faPlay, faCheckCircle, faXmark } from '@fortawesome/free-solid-svg-icons'
import { academyApi } from '../../../api/platform'
import { useT, useLocaleStore } from '../../../store/locale'
import { useState } from 'react'

// DROP-509: covers por slug. Si el backend no provee coverUrl o todos comparten
// la misma imagen, este mapping diversifica el aspecto visual del catálogo.
const COVER_BY_SLUG: Record<string, string> = {
  default: 'https://images.unsplash.com/photo-1488998427799-e3362cec87c3?w=800',
  sourcing: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
  branding: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800',
  shopify: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800',
  tiktok: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800',
  ads: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=800',
  logistics: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
  photo: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800',
}
function coverFor(c: any): string {
  if (c.coverUrl) return c.coverUrl
  const slug = (c.slug ?? '').toLowerCase()
  for (const k of Object.keys(COVER_BY_SLUG)) if (slug.includes(k)) return COVER_BY_SLUG[k]
  return COVER_BY_SLUG.default
}

export default function AcademyPage() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const qc = useQueryClient()
  const { data: courses = [] } = useQuery({ queryKey: ['courses', lang], queryFn: () => academyApi.courses(lang) })
  const { data: enrolled = [] } = useQuery({ queryKey: ['enrolled'], queryFn: academyApi.mine })
  const enrolledIds = new Set(enrolled.map((e) => e.courseId))
  // DROP-542: tras inscribirse, abrir el player inmediatamente con el enrollment
  // recién creado (el QA reportaba "academy.resume crudo, sin player" — pasaba
  // porque el primer render post-enrol todavía no tenía el enrollment cacheado).
  const enrol = useMutation({
    mutationFn: (input: { course: any }) =>
      academyApi.enrol(input.course.id).then((enrollment) => ({ enrollment, course: input.course })),
    onSuccess: ({ enrollment, course }) => {
      qc.invalidateQueries({ queryKey: ['enrolled'] })
      setPlaying({ course, enrollment })
    },
  })
  // DROP-509: player modal — cuando el user está inscrito, "Reanudar" abre un
  // panel con video stub y un slider que llama a setProgress en el backend.
  const [playing, setPlaying] = useState<any>(null)
  const progressMut = useMutation({
    mutationFn: ({ id, pct }: { id: string; pct: number }) => academyApi.setProgress(id, pct),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrolled'] }),
  })
  return (
    <div className="space-y-5">
      <header>
        <h1>{t('academy.title')}</h1>
        <p className="text-sm text-ink-500 mt-1">{t('academy.subtitle')}</p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {courses.map((c) => {
          const enrol_ = enrolledIds.has(c.id)
          // DROP-667: un curso al 100% debe mostrar "Completado", no "Reanudar".
          const enrollment = enrolled.find((e) => e.courseId === c.id)
          const done = !!enrollment && Number(enrollment.progressPct) >= 100
          return (
            <div key={c.id} className="card overflow-hidden">
              <div className="aspect-video bg-ink-100 relative">
                <img src={coverFor(c)} alt="" className="w-full h-full object-cover"
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                <span className="absolute top-2 left-2 badge bg-white/90 text-ink-700">{t(`academy.level.${c.level}`)}</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="text-[14px] font-medium line-clamp-2">{c.title}</div>
                <div className="text-[11px] text-ink-500">{c.instructor} · {c.durationMinutes}min</div>
                {c.description && <p className="text-[12px] text-ink-600 line-clamp-3">{c.description}</p>}
                {enrol_ ? (
                  <button onClick={() => { if (enrollment) setPlaying({ course: c, enrollment }) }}
                          className={`w-full text-[12px] ${done ? 'btn btn-outline border-emerald-300 text-emerald-700' : 'btn-primary'}`}>
                    <FontAwesomeIcon icon={done ? faCheckCircle : faPlay} /> {t(done ? 'academy.completed' : 'academy.resume')}
                  </button>
                ) : (
                  <button onClick={() => enrol.mutate({ course: c })} className="btn-primary w-full text-[12px]">
                    <FontAwesomeIcon icon={faCheckCircle} /> {t('academy.enroll')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* DROP-509: player modal con video stub + slider de progreso que persiste. */}
      {playing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPlaying(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-base-100 rounded-lg overflow-hidden w-full max-w-3xl">
            <div className="aspect-video bg-black relative">
              {playing.course.videoUrl ? (
                <video key={playing.course.id} controls autoPlay poster={coverFor(playing.course)}
                       className="w-full h-full object-contain bg-black">
                  <source src={playing.course.videoUrl} type="video/mp4" />
                </video>
              ) : (
                <>
                  <img src={coverFor(playing.course)} alt="" className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
                    {t('academy.no_video')}
                  </div>
                </>
              )}
              <button onClick={() => setPlaying(null)} className="absolute top-2 right-2 btn btn-ghost btn-sm btn-circle text-white bg-black/30 z-10" aria-label="close">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-medium text-lg">{playing.course.title}</h3>
              <div className="text-[12px] text-ink-500">{playing.course.instructor} · {playing.course.durationMinutes}min</div>
              {playing.course.description && <p className="text-[13px]">{playing.course.description}</p>}
              <div>
                <label className="text-xs text-ink-500">{t('academy.progress_label')}: {Math.round(Number(playing.enrollment.progressPct))}%</label>
                <input type="range" min={0} max={100} step={5}
                       defaultValue={Number(playing.enrollment.progressPct)}
                       onChange={(e) => {
                         const pct = Number(e.target.value)
                         setPlaying({ ...playing, enrollment: { ...playing.enrollment, progressPct: pct } })
                         progressMut.mutate({ id: playing.enrollment.id, pct })
                       }}
                       className="w-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {enrolled.length > 0 && (
        <section>
          <h2 className="text-lg mb-2 mt-6 flex items-center gap-2">
            <FontAwesomeIcon icon={faGraduationCap} className="text-brand-500" /> {t('academy.enrolled')}
          </h2>
          <div className="space-y-2">
            {enrolled.map((e) => (
              <div key={e.id} className="card p-3 text-[13px]">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{e.courseTitle}</span>
                  <span className="text-[11px] text-ink-500">{Number(e.progressPct).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-ink-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${Number(e.progressPct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
