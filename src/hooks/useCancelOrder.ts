import { useQueryClient } from '@tanstack/react-query'
import { orders } from '../api/orders'
import { dialog } from '../store/dialog'
import { useT, useLocaleStore } from '../store/locale'
import { apiErrorMessage } from '../lib/apiError'

/**
 * Flujo de cancelación de pedido REUTILIZABLE (usado por la lista y el detalle). Solo debe ofrecerse para
 * pedidos PAGADOS y aún no enviados a proveedor. Pasos:
 *   1. Confirmar la cancelación.
 *   2. Si se pagó con tarjeta/PayPal, elegir destino del reembolso (billetera inmediata o método original).
 *   3. Cancelar + reembolsar; invalidar queries y avisar en el idioma del usuario.
 */
export function useCancelOrder() {
  const t = useT()
  const lang = useLocaleStore((s) => s.locale)
  const qc = useQueryClient()

  async function cancelOrder(orderId: string, paymentMethod?: string) {
    if (!(await dialog.confirm({ message: t('order.detail.cancel_confirm'), variant: 'warning' }))) return
    let refundToWallet = true
    if (paymentMethod === 'CARD' || paymentMethod === 'PAYPAL') {
      const methodLabel = paymentMethod === 'CARD' ? t('order.detail.refund_card') : 'PayPal'
      refundToWallet = await dialog.confirm({
        message: t('order.detail.refund_choice').replace('{method}', methodLabel),
        confirmLabel: t('order.detail.refund_wallet'),
        cancelLabel: t('order.detail.refund_original').replace('{method}', methodLabel),
        variant: 'info',
      })
    }
    try {
      await orders.cancel(orderId, lang, refundToWallet)
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      dialog.alert({
        message: t(refundToWallet ? 'order.detail.cancel_ok' : 'order.detail.cancel_ok_original'),
        variant: 'success',
      })
    } catch (err) {
      dialog.alert({ message: apiErrorMessage(err, t), variant: 'error' })
    }
  }

  return { cancelOrder }
}
