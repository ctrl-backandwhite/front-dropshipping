import { useEffect } from 'react'
import { useAuthStore } from '../store/auth'
import { affiliate, rememberRef, pendingRef, visitorToken } from '../api/affiliate'

/**
 * DROP-645: referral attribution capture (client side). On any page load with a
 * {@code ?ref=CODE} param it records the click against a persistent visitor token (last-click
 * cookie). Once the visitor is authenticated it binds that token to the customer so a later
 * order can be attributed. Renders nothing.
 */
export function ReferralCapture() {
  const user = useAuthStore((s) => s.user)

  // 1) capture ?ref=CODE on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (!ref) return
    rememberRef(ref)
    affiliate.track(ref, visitorToken()).catch(() => { /* ignore */ })
    // strip ?ref from the URL without reloading
    params.delete('ref')
    const qs = params.toString()
    const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
    window.history.replaceState({}, '', url)
  }, [])

  // 2) bind the visitor token to the customer once logged in (and there is a pending ref)
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'OPERATOR' && pendingRef()) {
      affiliate.bind(visitorToken()).catch(() => { /* ignore */ })
    }
  }, [user])

  return null
}
