import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStore, faPlug, faKey, faRotate, faCircleCheck, faCode } from '@fortawesome/free-solid-svg-icons'

/**
 * Documentación de conexión de tiendas (Shopify / WooCommerce) lo más sencilla posible. Página pública
 * de la storefront. Explica el flujo: credenciales → conectar → sincronizar catálogo → recibir pedidos.
 */
type Tab = 'shopify' | 'woocommerce'

const STEPS: Record<Tab, { title: string; body: string }[]> = {
  shopify: [
    { title: '1. Pide tus credenciales', body: 'Desde tu panel de NX036, en "Integraciones", genera un client_id y client_secret (OAuth2). Estas credenciales identifican tu tienda y son secretas.' },
    { title: '2. Instala la conexión', body: 'En Shopify, ve a Apps → Desarrollar apps → crea una app privada y autoriza los permisos de productos y pedidos (read_products, write_orders). Pega ahí la URL de NX036 y tus credenciales.' },
    { title: '3. Sincroniza el catálogo', body: 'NX036 expone el catálogo en GET /api/v1/partner/catalog/products (con tu token Bearer). Los precios ya vienen como precio mayorista final, en la moneda que pidas (header X-Currency).' },
    { title: '4. Recibe los pedidos', body: 'Cuando un cliente compra en tu Shopify, tu tienda envía el pedido a POST /api/v1/integrations/shops (webhook firmado). NX036 lo procesa, lo abastece con el proveedor y te devuelve el seguimiento.' },
  ],
  woocommerce: [
    { title: '1. Pide tus credenciales', body: 'En tu panel de NX036, en "Integraciones", genera tu client_id y client_secret. Guárdalos de forma segura.' },
    { title: '2. Instala el conector', body: 'En WooCommerce (WordPress) instala el conector NX036 (o usa la REST API de Woo). Introduce la URL de NX036 y tus credenciales para autorizar el acceso a productos y pedidos.' },
    { title: '3. Sincroniza el catálogo', body: 'Importa productos desde GET /api/v1/partner/catalog/products. Los precios son el precio mayorista final y se calculan en tiempo real con la tasa del día en tu moneda (X-Currency).' },
    { title: '4. Recibe los pedidos', body: 'Configura el webhook de Woo para enviar los pedidos a POST /api/v1/integrations/shops. NX036 los recibe, los procesa y te devuelve el número de seguimiento.' },
  ],
}

export default function ConnectStorePage() {
  const [tab, setTab] = useState<Tab>('shopify')
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <header className="text-center space-y-2">
        <FontAwesomeIcon icon={faPlug} className="text-4xl text-primary" />
        <h1 className="text-2xl font-semibold">Conecta tu tienda en minutos</h1>
        <p className="text-ink-500">Sincroniza el catálogo de NX036 con tu Shopify o WooCommerce y deja que nosotros abastezcamos y enviemos cada pedido. Sin inventario.</p>
      </header>

      <div role="tablist" className="tabs tabs-boxed justify-center">
        <button role="tab" onClick={() => setTab('shopify')} className={`tab ${tab === 'shopify' ? 'tab-active' : ''}`}>
          <FontAwesomeIcon icon={faStore} className="mr-2" /> Shopify
        </button>
        <button role="tab" onClick={() => setTab('woocommerce')} className={`tab ${tab === 'woocommerce' ? 'tab-active' : ''}`}>
          <FontAwesomeIcon icon={faStore} className="mr-2" /> WooCommerce
        </button>
      </div>

      <ol className="space-y-3">
        {STEPS[tab].map((s) => (
          <li key={s.title} className="card bg-base-100 p-5 flex-row gap-4 items-start">
            <FontAwesomeIcon icon={faCircleCheck} className="text-success text-xl mt-0.5" />
            <div>
              <div className="font-medium">{s.title}</div>
              <p className="text-sm text-ink-500 mt-1">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card bg-base-100 p-4 text-sm"><FontAwesomeIcon icon={faKey} className="text-primary" /> <strong className="block mt-1">Autenticación</strong> OAuth2 (client_id/secret) → token Bearer con scope <code className="text-[12px]">shop.sync</code>.</div>
        <div className="card bg-base-100 p-4 text-sm"><FontAwesomeIcon icon={faRotate} className="text-primary" /> <strong className="block mt-1">Precios en vivo</strong> Precio mayorista final calculado con la tasa del día en tu moneda.</div>
        <div className="card bg-base-100 p-4 text-sm"><FontAwesomeIcon icon={faCode} className="text-primary" /> <strong className="block mt-1">API</strong> <code className="text-[12px]">/api/v1/partner/catalog</code>, <code className="text-[12px]">/api/v1/partner/orders</code>, webhooks <code className="text-[12px]">/api/v1/integrations/shops</code>.</div>
      </div>
    </div>
  )
}
