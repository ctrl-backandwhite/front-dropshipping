import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCopy, faCheck, faBolt, faShieldHalved, faStore, faTruckFast,
  faSatelliteDish, faTriangleExclamation, faHandshake, faCircleNodes,
  faRocket, faMagnifyingGlass, faKey, faGaugeHigh, faClockRotateLeft,
  faLink, faAngleRight, faFolderTree, faBoxesStacked, faSwatchbook,
  faSliders, faTruck, faShop, faPlug, faRotate,
} from '@fortawesome/free-solid-svg-icons'
import { useT } from '../../store/locale'

const BASE_URL = 'https://api.nx036.local'
const SANDBOX_URL = 'https://sandbox.nx036.local'

type Lang = 'curl' | 'node' | 'python' | 'php'

interface TocItem { id: string; labelKey: string; icon: any; depth?: number }

const TOC: TocItem[] = [
  { id: 'quickstart', labelKey: 'docs.intro.heading',      icon: faRocket },
  { id: 'overview',   labelKey: 'docs.toc.overview',       icon: faCircleNodes },
  { id: 'auth',       labelKey: 'docs.toc.auth',           icon: faShieldHalved },
  { id: 'integrations', labelKey: 'docs.toc.integrations', icon: faPlug },
  { id: 'int-shopify',     labelKey: 'docs.int.shopify.title',     icon: faStore, depth: 1 },
  { id: 'int-woocommerce', labelKey: 'docs.int.woocommerce.title', icon: faStore, depth: 1 },
  { id: 'catalog',    labelKey: 'docs.cat.heading',        icon: faStore },
  { id: 'cat-categories', labelKey: 'docs.cat.categories.title', icon: faFolderTree,   depth: 1 },
  { id: 'cat-products',   labelKey: 'docs.cat.products.title',   icon: faBoxesStacked, depth: 1 },
  { id: 'cat-variants',   labelKey: 'docs.cat.variants.title',   icon: faSwatchbook,   depth: 1 },
  { id: 'cat-attrs',      labelKey: 'docs.cat.attrs.title',      icon: faSliders,      depth: 1 },
  { id: 'cat-shipping',   labelKey: 'docs.cat.shipping.title',   icon: faTruck,        depth: 1 },
  { id: 'cat-suppliers',  labelKey: 'admin.suppliers.title',     icon: faShop,         depth: 1 },
  { id: 'checkout',   labelKey: 'docs.toc.checkout',       icon: faBolt },
  { id: 'tracking',   labelKey: 'docs.toc.tracking',       icon: faTruckFast },
  { id: 'webhooks',   labelKey: 'docs.toc.webhooks',       icon: faSatelliteDish },
  { id: 'errors',     labelKey: 'docs.toc.errors',         icon: faTriangleExclamation },
  { id: 'scopes',     labelKey: 'docs.scopes.heading',     icon: faKey },
  { id: 'limits',     labelKey: 'docs.rate_limit.heading', icon: faGaugeHigh },
  { id: 'changelog',  labelKey: 'docs.changelog.heading',  icon: faClockRotateLeft },
  { id: 'support',    labelKey: 'docs.toc.support',        icon: faHandshake },
]

export default function DevelopersPage() {
  const t = useT()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return TOC
    const n = search.toLowerCase()
    return TOC.filter((s) => t(s.labelKey).toLowerCase().includes(n))
  }, [search, t])

  return (
    <div className="grid lg:grid-cols-[16rem_1fr] xl:grid-cols-[16rem_1fr_18rem] gap-8 xl:gap-10">
      {/* === Left: TOC === */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-4">
          <div className="relative">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder={t('docs.search_placeholder')}
                   className="input pl-7 h-9 text-[12px]" />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">
            {t('docs.toc.heading')}
          </div>
          <nav className="space-y-0.5">
            {filtered.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                 className={`flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-ink-700 hover:bg-ink-50 hover:text-brand-700 group ${
                   s.depth === 1 ? 'pl-6 text-[12px] text-ink-600' : ''
                 }`}>
                <FontAwesomeIcon icon={s.icon} className="w-4 text-ink-400 group-hover:text-brand-600" />
                {t(s.labelKey)}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* === Center: article === */}
      <article className="max-w-3xl min-w-0">
        <header className="mb-8">
          <div className="text-[11px] uppercase tracking-wider text-brand-700 font-medium mb-2">v1 · API Reference</div>
          <h1 className="text-3xl">{t('docs.title')}</h1>
          <p className="text-ink-700 mt-2 text-[15px] leading-relaxed">{t('docs.subtitle')}</p>
        </header>

        <section className="card p-5 mb-8 bg-brand-50 border-brand-100">
          <h3 className="mt-0! flex items-center gap-2 text-brand-700">
            <FontAwesomeIcon icon={faHandshake} /> {t('docs.mission.heading')}
          </h3>
          <p className="text-[14px] text-ink-700 leading-relaxed mt-2">{t('docs.mission.body')}</p>
        </section>

        <Section id="quickstart" icon={faRocket} title={t('docs.intro.heading')}>
          <ol className="space-y-2 text-[14px] text-ink-700">
            <li>{t('docs.intro.step1')}</li>
            <li>{t('docs.intro.step2')}</li>
            <li>{t('docs.intro.step3')}</li>
          </ol>
          <EnvironmentTable />
        </Section>

        <Section id="overview" icon={faCircleNodes} title={t('docs.section.overview')}>
          <p>{t('docs.overview.body')}</p>
        </Section>

        <Section id="auth" icon={faShieldHalved} title={t('docs.section.auth')}>
          <p>{t('docs.auth.intro')}</p>
          <Endpoint method="POST" url="/oauth2/token" />
          <Sample
            request={{
              curl: `curl -X POST ${BASE_URL}/oauth2/token \\
  -u "your-client-id:your-client-secret" \\
  -d "grant_type=client_credentials&scope=catalog.read orders.write"`,
              node: `const basic = Buffer.from('client-id:client-secret').toString('base64')
const r = await fetch('${BASE_URL}/oauth2/token', {
  method: 'POST',
  headers: { Authorization: \`Basic \${basic}\`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=client_credentials&scope=catalog.read orders.write',
})
const { access_token, expires_in } = await r.json()`,
              python: `import requests
r = requests.post("${BASE_URL}/oauth2/token",
    auth=("client-id", "client-secret"),
    data={"grant_type": "client_credentials", "scope": "catalog.read orders.write"})
token = r.json()["access_token"]`,
              php: `$ch = curl_init('${BASE_URL}/oauth2/token');
curl_setopt_array($ch, [
  CURLOPT_USERPWD       => 'client-id:client-secret',
  CURLOPT_POST          => true,
  CURLOPT_POSTFIELDS    => 'grant_type=client_credentials&scope=catalog.read orders.write',
  CURLOPT_RETURNTRANSFER=> true,
]);
$token = json_decode(curl_exec($ch), true)['access_token'];`,
            }}
            response={`{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type":   "Bearer",
  "expires_in":   3600,
  "scope":        "catalog.read orders.write"
}`}
          />
          <p className="text-[12px] text-ink-500">{t('docs.auth.notes')}</p>
        </Section>

        {/* ============== INTEGRACIONES (Shopify / WooCommerce) ============== */}
        <Section id="integrations" icon={faPlug} title={t('docs.toc.integrations')}>
          <p>
            Vende nuestros productos en tu tienda <strong>Shopify</strong> o <strong>WooCommerce</strong> sin
            inventario: importas nuestro catálogo, tus clientes compran en tu tienda y nosotros nos encargamos
            de abastecer y enviar cada pedido con seguimiento. Los precios ya llegan como precio mayorista
            final, en la moneda de tu tienda. Sigue el paso a paso de tu plataforma.
          </p>
          <div className="card p-4 bg-brand-50 border-brand-100 text-[13px]">
            <strong className="text-brand-700">Lo que necesitas (5 min):</strong> una cuenta en NX036, tu tienda
            Shopify o WooCommerce, y permisos de administrador en ella.
          </div>

          {/* ---- Shopify ---- */}
          <SubSection id="int-shopify" icon={faStore} title={t('docs.int.shopify.title')}>
            <ol className="space-y-3 text-[14px]">
              <li><strong>1. Crea tu cuenta en NX036</strong> y entra al panel. En el menú <em>Integraciones → Conectar tienda</em>, elige <strong>Shopify</strong> y pulsa <em>Generar credenciales</em>. Copia tu <code>client_id</code> y <code>client_secret</code> (guárdalos, son secretos).</li>
              <li><strong>2. Conecta tu tienda Shopify.</strong> En Shopify ve a <em>Configuración → Apps y canales de venta → Desarrollar apps</em>, crea una app y dale permisos de <code>read_products</code> y <code>write_orders</code>. Pega ahí la URL de NX036 y tus credenciales para autorizar la conexión.</li>
              <li><strong>3. Importa los productos.</strong> Desde el panel de NX036 elige qué productos o categorías quieres vender y pulsa <em>Sincronizar a Shopify</em>. Aparecerán en tu tienda con fotos, descripción, variantes y <strong>precio mayorista final</strong> en tu moneda.</li>
              <li><strong>4. Pon tu precio de venta (opcional).</strong> El precio importado es tu precio mayorista; fija por encima tu precio de venta al público en Shopify para tu beneficio de revendedor.</li>
              <li><strong>5. Vende. Nosotros enviamos.</strong> Cuando un cliente compra en tu Shopify, el pedido nos llega automáticamente, lo abastecemos con el proveedor y lo enviamos. Shopify recibe el número de seguimiento y tu cliente puede rastrearlo. Tú no tocas inventario.</li>
            </ol>
            <p className="text-[12px] text-ink-500 mt-2">El stock y los precios se sincronizan solos; si un producto se agota, se marca como no disponible en tu tienda.</p>
          </SubSection>

          {/* ---- WooCommerce ---- */}
          <SubSection id="int-woocommerce" icon={faStore} title={t('docs.int.woocommerce.title')}>
            <ol className="space-y-3 text-[14px]">
              <li><strong>1. Crea tu cuenta en NX036</strong> y entra al panel. En <em>Integraciones → Conectar tienda</em>, elige <strong>WooCommerce</strong> y pulsa <em>Generar credenciales</em>. Copia tu <code>client_id</code> y <code>client_secret</code>.</li>
              <li><strong>2. Instala el conector en WordPress.</strong> En tu WordPress (WooCommerce) instala el plugin <em>NX036 Dropshipping</em> (o usa la REST API de WooCommerce). En sus ajustes pega la URL de NX036 y tus credenciales, y autoriza el acceso a productos y pedidos.</li>
              <li><strong>3. Importa los productos.</strong> Desde el panel de NX036 elige los productos o categorías y pulsa <em>Sincronizar a WooCommerce</em>. Se crearán en tu tienda con imágenes, descripción, variantes y <strong>precio mayorista final</strong> en tu moneda.</li>
              <li><strong>4. Ajusta tu precio de venta (opcional)</strong> en WooCommerce si quieres añadir tu propio margen de revendedor.</li>
              <li><strong>5. Vende sin inventario.</strong> Cada pedido de tu WooCommerce nos llega por webhook; lo procesamos, lo enviamos y devolvemos el seguimiento a tu tienda automáticamente.</li>
            </ol>
            <p className="text-[12px] text-ink-500 mt-2">Compatible con WooCommerce vía plugin o REST API. El conector mantiene stock y precios al día.</p>
          </SubSection>

          <h4 className="text-[14px] font-medium mt-6 mb-2 flex items-center gap-2">
            <FontAwesomeIcon icon={faRotate} className="text-brand-500" /> Cómo funciona por dentro (resumen técnico)
          </h4>
          <ul className="text-[13px] text-ink-700 list-disc pl-5 space-y-1">
            <li>Autenticación: OAuth2 con tu <code>client_id/secret</code> → token Bearer (scope <code>shop.sync</code>).</li>
            <li>Catálogo: <code>GET /api/v1/partner/catalog/products</code> (precio mayorista final + tasa del día, en tu moneda con <code>X-Currency</code>).</li>
            <li>Pedidos entrantes: tu tienda envía el pedido a <code>POST /api/v1/integrations/shops</code> (webhook firmado).</li>
            <li>Pedidos salientes / seguimiento: <code>GET /api/v1/partner/orders/&#123;id&#125;</code>.</li>
          </ul>
          <p className="text-[13px] mt-3">
            Guía resumida también en <a href="/connect" className="text-brand-700 hover:underline">/connect</a>.
          </p>
        </Section>

        {/* ============== CATALOG ============== */}
        <Section id="catalog" icon={faStore} title={t('docs.cat.heading')}>
          <p>{t('docs.cat.intro')}</p>
        </Section>

        {/* --- Categories --- */}
        <SubSection id="cat-categories" icon={faFolderTree} title={t('docs.cat.categories.title')}>
          <p>{t('docs.cat.categories.intro')}</p>

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/categories"
            intro={t('docs.cat.categories.ep_flat')}
            params={[
              { name: 'lang', type: 'string', req: false, desc: 'Translation locale (es, en, pt, zh). Default: es.' },
            ]}
            request={{
              curl: `curl ${BASE_URL}/api/v1/storefront/catalog/categories?lang=es`,
              node: `const r = await fetch('${BASE_URL}/api/v1/storefront/catalog/categories?lang=es')`,
              python: `r = requests.get("${BASE_URL}/api/v1/storefront/catalog/categories", params={"lang": "es"})`,
              php: `$cats = json_decode(file_get_contents('${BASE_URL}/api/v1/storefront/catalog/categories?lang=es'), true);`,
            }}
            response={`[
  {
    "id":          "9c3d…",
    "slug":        "consumer-electronics",
    "name":        "Electrónica de consumo",
    "nameZh":      "数码电子",
    "parentId":    null,
    "position":    1,
    "icon":        "microchip",
    "directProductCount": 10,
    "children":    []
  }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/categories/tree"
            intro={t('docs.cat.categories.ep_tree')}
            params={[{ name: 'lang', type: 'string', req: false, desc: 'Translation locale.' }]}
            request={{
              curl: `curl ${BASE_URL}/api/v1/storefront/catalog/categories/tree`,
              node: `const tree = await (await fetch('${BASE_URL}/api/v1/storefront/catalog/categories/tree')).json()`,
              python: `tree = requests.get("${BASE_URL}/api/v1/storefront/catalog/categories/tree").json()`,
              php: `$tree = json_decode(file_get_contents('${BASE_URL}/api/v1/storefront/catalog/categories/tree'), true);`,
            }}
            response={`[
  {
    "id": "9c3d…",
    "slug": "consumer-electronics",
    "name": "Consumer Electronics",
    "children": [
      { "id": "abcd…", "slug": "audio", "name": "Audio", "children": [] }
    ]
  }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/categories/{idOrSlug}"
            intro={t('docs.cat.categories.ep_detail')}
            params={[
              { name: 'idOrSlug', type: 'uuid|slug', req: true, desc: 'Either internal UUID or storefront slug.' },
              { name: 'lang',     type: 'string',   req: false, desc: 'Locale.' },
            ]}
            request={{
              curl: `curl ${BASE_URL}/api/v1/storefront/catalog/categories/consumer-electronics`,
              node: `const cat = await (await fetch('${BASE_URL}/api/v1/storefront/catalog/categories/consumer-electronics')).json()`,
              python: `cat = requests.get("${BASE_URL}/api/v1/storefront/catalog/categories/consumer-electronics").json()`,
              php: `$cat = json_decode(file_get_contents('${BASE_URL}/api/v1/storefront/catalog/categories/consumer-electronics'), true);`,
            }}
            response={`{ "id": "9c3d…", "slug": "consumer-electronics", "directProductCount": 10, "children": [ … ] }`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/categories/{idOrSlug}/children"
            intro={t('docs.cat.categories.ep_children')} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/categories/{idOrSlug}/breadcrumb"
            intro={t('docs.cat.categories.ep_breadcrumb')}
            response={`[
  { "id": "root", "slug": "consumer-electronics", "name": "Electrónica" },
  { "id": "child", "slug": "audio",               "name": "Audio" }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/categories/{idOrSlug}/products"
            intro={t('docs.cat.categories.ep_products')}
            params={[
              { name: 'page', type: 'int',    req: false, desc: 'Default 0.' },
              { name: 'size', type: 'int',    req: false, desc: 'Default 24.' },
              { name: 'sort', type: 'string', req: false, desc: 'trending | sales | newest | price_asc | price_desc | rating' },
            ]} />
        </SubSection>

        {/* --- Products --- */}
        <SubSection id="cat-products" icon={faBoxesStacked} title={t('docs.cat.products.title')}>
          <p>{t('docs.cat.products.intro')}</p>

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products"
            intro={t('docs.cat.products.ep_list')}
            params={[
              { name: 'q',          type: 'string',  req: false, desc: 'Free text on title / SKU / external id.' },
              { name: 'categoryId', type: 'uuid',    req: false, desc: 'Restrict to one category.' },
              { name: 'supplierId', type: 'uuid',    req: false, desc: 'Restrict to one supplier.' },
              { name: 'minPrice',   type: 'decimal', req: false, desc: 'Minimum unit price (USD).' },
              { name: 'maxPrice',   type: 'decimal', req: false, desc: 'Maximum unit price (USD).' },
              { name: 'sort',       type: 'string',  req: false, desc: 'trending | sales | newest | price_asc | price_desc | rating' },
              { name: 'page',       type: 'int',     req: false, desc: 'Default 0.' },
              { name: 'size',       type: 'int',     req: false, desc: 'Default 24, max 100.' },
              { name: 'lang',       type: 'string',  req: false, desc: 'Locale.' },
            ]}
            request={{
              curl: `curl '${BASE_URL}/api/v1/storefront/catalog/products?q=auriculares&sort=sales&page=0&size=24'`,
              node: `const url = '${BASE_URL}/api/v1/storefront/catalog/products?'
  + new URLSearchParams({ q: 'auriculares', sort: 'sales', size: '24' })
const page = await (await fetch(url)).json()`,
              python: `r = requests.get("${BASE_URL}/api/v1/storefront/catalog/products",
    params={"q": "auriculares", "sort": "sales", "size": 24})
items = r.json()["items"]`,
              php: `$page = json_decode(file_get_contents('${BASE_URL}/api/v1/storefront/catalog/products?q=auriculares&sort=sales'), true);`,
            }}
            response={`{
  "items": [
    {
      "id":          "d023e7b5-…",
      "slug":        "auriculares-bluetooth-tws-x-pro",
      "title":       "Auriculares Bluetooth TWS X-Pro ANC",
      "mainImage":   "https://cdn.nx036.local/p/d023e7b5/1.webp",
      "basePrice":   "9.43",
      "currency":    "USD",
      "monthlySales": 4820,
      "trendScore":   0.892
    }
  ],
  "page": 0, "size": 24, "totalElements": 50, "totalPages": 3
}`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{slug}"
            intro={t('docs.cat.products.ep_by_slug')} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/by-id/{id}"
            intro={t('docs.cat.products.ep_by_id')}
            response={`{
  "id":             "d023e7b5-…",
  "slug":           "auriculares-bluetooth-tws-x-pro",
  "title":          "Auriculares Bluetooth TWS X-Pro ANC",
  "description":    "Active noise cancelling, IPX5, dual-call, 30h battery, USB-C.",
  "brand":          "NX036 Generic",
  "moq":            1,
  "basePrice":      "9.43",
  "currency":       "USD",
  "weightGrams":    230,
  "lengthMm":       180, "widthMm": 80, "heightMm": 50,
  "leadTimeDays":   4,
  "warrantyMonths": 12,
  "certifications": ["CE","FCC","RoHS"],
  "countryOfOrigin":"CN",
  "images": [ … ],
  "variants": [ … ],
  "variantOptions": [ … ],
  "priceTiers": [ … ]
}`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/by-external/{source}/{externalId}"
            intro={t('docs.cat.products.ep_by_external')}
            params={[
              { name: 'source',     type: 'string', req: true, desc: 'Upstream source slug (e.g. "supplier").' },
              { name: 'externalId', type: 'string', req: true, desc: 'Offer id at the source.' },
            ]} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/bestsellers"
            intro={t('docs.cat.products.ep_bestsellers')}
            params={[
              { name: 'categoryId', type: 'uuid', req: false, desc: 'Optional — restrict to one category.' },
              { name: 'page',       type: 'int',  req: false, desc: 'Default 0.' },
              { name: 'size',       type: 'int',  req: false, desc: 'Default 20.' },
            ]} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/trending"
            intro={t('docs.cat.products.ep_trending')} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/newest"
            intro={t('docs.cat.products.ep_newest')} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{id}/related"
            intro={t('docs.cat.products.ep_related')}
            params={[{ name: 'limit', type: 'int', req: false, desc: 'Default 8, max 100.' }]} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{id}/specifications"
            intro={t('docs.cat.products.ep_specs')}
            params={[{ name: 'lang', type: 'string', req: false, desc: 'Locale. Falls back to en.' }]}
            response={`[
  { "key": "Marca",           "value": "NX036 Generic",        "position": 0 },
  { "key": "Material",        "value": "ABS + Aluminum",       "position": 1 },
  { "key": "Modelo",          "value": "OFFER-01003",          "position": 2 },
  { "key": "País de origen",  "value": "CN",                   "position": 3 },
  { "key": "Peso neto",       "value": "230 g",                "position": 4 },
  { "key": "Garantía",        "value": "12 meses",             "position": 5 },
  { "key": "Voltaje",         "value": "100-240V AC, 50/60Hz", "position": 7 },
  { "key": "Certificaciones", "value": "CE, FCC, RoHS",        "position": 8 }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{id}/attributes"
            intro={t('docs.cat.products.ep_attrs')}
            response={`[
  { "key": "brand",     "value": "NX036 Generic" },
  { "key": "origin",    "value": "CN" },
  { "key": "season",    "value": "all_season" },
  { "key": "age_group", "value": "adult" },
  { "key": "category",  "value": "consumer-electronics" }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{id}/tags"
            intro={t('docs.cat.products.ep_tags')}
            response={`["wireless", "bluetooth", "gadget", "trending"]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{id}/images"
            intro={t('docs.cat.products.ep_images')}
            response={`[
  { "id": "img-1", "sourceUrl": "https://supplier/img1.jpg", "cdnUrl": "https://cdn.nx036.local/p/abc/1.webp", "position": 0, "role": "MAIN" },
  { "id": "img-2", "sourceUrl": "https://supplier/img2.jpg", "cdnUrl": "https://cdn.nx036.local/p/abc/2.webp", "position": 1, "role": "GALLERY" }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{id}/price-tiers"
            intro={t('docs.cat.products.ep_tiers')}
            response={`[
  { "minQty": 1,   "maxQty": 49,  "unitPrice": "9.43", "currency": "USD" },
  { "minQty": 50,  "maxQty": 199, "unitPrice": "8.64", "currency": "USD" },
  { "minQty": 200, "maxQty": null,"unitPrice": "7.84", "currency": "USD" }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/suggest"
            intro={t('docs.cat.products.ep_suggest')}
            params={[
              { name: 'q',     type: 'string', req: true,  desc: 'Partial query (≥1 char).' },
              { name: 'lang',  type: 'string', req: false, desc: 'Locale.' },
              { name: 'limit', type: 'int',    req: false, desc: 'Default 8.' },
            ]}
            response={`[
  { "type": "product", "text": "Auriculares Bluetooth TWS X-Pro ANC", "slug": "auriculares-bluetooth-tws-x-pro" }
]`} />
        </SubSection>

        {/* --- Variants --- */}
        <SubSection id="cat-variants" icon={faSwatchbook} title={t('docs.cat.variants.title')}>
          <p>{t('docs.cat.variants.intro')}</p>

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{productId}/variants"
            intro={t('docs.cat.variants.ep_list')}
            response={`[
  {
    "id":         "f12…",
    "sku":        "XPRO-BLK",
    "externalId": "XPRO-BLK",
    "title":      "Negro mate",
    "price":      "8.83",
    "stock":      540,
    "imageUrl":   "https://cdn.nx036.local/v/f12.webp",
    "options":    { "颜色": "黑色" },
    "active":     true
  }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/variants/{id}"
            intro={t('docs.cat.variants.ep_by_id')} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/products/{productId}/variants/by-sku/{sku}"
            intro={t('docs.cat.variants.ep_by_sku')}
            params={[{ name: 'sku', type: 'string', req: true, desc: 'Internal SKU or supplier external id (case-insensitive).' }]} />

          <EndpointDoc method="POST" path="/api/v1/storefront/catalog/products/{productId}/variants/match"
            intro={t('docs.cat.variants.ep_match')}
            request={{
              curl: `curl -X POST ${BASE_URL}/api/v1/storefront/catalog/products/d023e7b5-…/variants/match \\
  -H 'Content-Type: application/json' \\
  -d '{ "颜色": "黑色" }'`,
              node: `const matches = await (await fetch(\`${BASE_URL}/api/v1/storefront/catalog/products/\${id}/variants/match\`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ '颜色': '黑色' }),
})).json()`,
              python: `r = requests.post(f"${BASE_URL}/api/v1/storefront/catalog/products/{id}/variants/match",
    json={"颜色": "黑色"})`,
              php: `$ch = curl_init("${BASE_URL}/api/v1/storefront/catalog/products/$id/variants/match");
curl_setopt_array($ch, [
  CURLOPT_POST       => true,
  CURLOPT_POSTFIELDS => json_encode(['颜色' => '黑色']),
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_RETURNTRANSFER => true,
]);
$matches = json_decode(curl_exec($ch), true);`,
            }} />
        </SubSection>

        {/* --- Specs & Attributes --- */}
        <SubSection id="cat-attrs" icon={faSliders} title={t('docs.cat.attrs.title')}>
          <p>{t('docs.cat.attrs.intro')}</p>

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/attributes/keys"
            intro={t('docs.cat.attrs.ep_keys')}
            response={`[
  { "key": "brand",     "usage": 50 },
  { "key": "origin",    "usage": 50 },
  { "key": "category",  "usage": 50 },
  { "key": "season",    "usage": 50 },
  { "key": "age_group", "usage": 50 }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/attributes/{key}/values"
            intro={t('docs.cat.attrs.ep_values')}
            response={`["NX036 Generic", "Sony", "Apple", "Generic"]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/tags"
            intro={t('docs.cat.attrs.ep_tags_all')}
            response={`["bluetooth", "casual", "eco", "gym", "kbeauty", "trending", "wireless"]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/tags/{tag}/products"
            intro={t('docs.cat.attrs.ep_tags_products')}
            params={[
              { name: 'tag',   type: 'string', req: true,  desc: 'Tag string, case-insensitive.' },
              { name: 'limit', type: 'int',    req: false, desc: 'Default 24.' },
            ]} />
        </SubSection>

        {/* --- Shipping --- */}
        <SubSection id="cat-shipping" icon={faTruck} title={t('docs.cat.shipping.title')}>
          <p>{t('docs.cat.shipping.intro')}</p>

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/shipping/zones"
            intro={t('docs.cat.shipping.ep_zones')}
            params={[{ name: 'supplierId', type: 'uuid', req: true, desc: 'Supplier whose zones to list.' }]}
            response={`[
  { "supplierId": "abc…", "supplierName": "Shenzhen TechNova Co.", "countryCode": "US", "region": "NORTH_AMERICA", "active": true },
  { "supplierId": "abc…", "supplierName": "Shenzhen TechNova Co.", "countryCode": "ES", "region": "EUROPE",        "active": true }
]`} />

          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/shipping/rates"
            intro={t('docs.cat.shipping.ep_rates')}
            params={[
              { name: 'supplierId', type: 'uuid',   req: true, desc: 'Supplier.' },
              { name: 'country',    type: 'string', req: true, desc: 'ISO 3166-1 alpha-2 destination code.' },
            ]}
            response={`[
  { "method": "STANDARD", "carrier": "CJPacket",       "transitDaysMin": 7,  "transitDaysMax": 14, "baseCost": "3.50", "perKgCost": "8.00" },
  { "method": "EXPRESS",  "carrier": "DHL Express",    "transitDaysMin": 3,  "transitDaysMax": 6,  "baseCost": "12.00","perKgCost": "25.00" },
  { "method": "AIR",      "carrier": "China Post Air", "transitDaysMin": 5,  "transitDaysMax": 10, "baseCost": "7.00", "perKgCost": "15.00" },
  { "method": "SEA",      "carrier": "Sea LCL",        "transitDaysMin": 25, "transitDaysMax": 45, "baseCost": "15.00","perKgCost": "4.00" }
]`} />

          <EndpointDoc method="POST" path="/api/v1/storefront/catalog/shipping/quote"
            intro={t('docs.cat.shipping.ep_quote')}
            request={{
              curl: `curl -X POST ${BASE_URL}/api/v1/storefront/catalog/shipping/quote \\
  -H 'Content-Type: application/json' \\
  -d '{ "productId":"d023e7b5-…", "quantity": 3, "country": "ES" }'`,
              node: `const quote = await (await fetch('${BASE_URL}/api/v1/storefront/catalog/shipping/quote', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId, quantity: 3, country: 'ES' }),
})).json()`,
              python: `r = requests.post("${BASE_URL}/api/v1/storefront/catalog/shipping/quote",
    json={"productId": product_id, "quantity": 3, "country": "ES"})`,
              php: `$ch = curl_init('${BASE_URL}/api/v1/storefront/catalog/shipping/quote');
curl_setopt_array($ch, [
  CURLOPT_POST          => true,
  CURLOPT_HTTPHEADER    => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS    => json_encode(['productId' => $id, 'quantity' => 3, 'country' => 'ES']),
  CURLOPT_RETURNTRANSFER=> true,
]);
$quote = json_decode(curl_exec($ch), true);`,
            }}
            response={`[
  { "supplierId": "abc…", "method": "STANDARD", "carrier": "CJPacket",    "transitDaysMin": 7, "transitDaysMax": 14, "cost":  "9.10", "currency": "USD" },
  { "supplierId": "abc…", "method": "AIR",      "carrier": "China Post",  "transitDaysMin": 5, "transitDaysMax": 10, "cost": "17.80", "currency": "USD" },
  { "supplierId": "abc…", "method": "EXPRESS",  "carrier": "DHL Express", "transitDaysMin": 3, "transitDaysMax": 6,  "cost": "30.90", "currency": "USD" }
]`} />
        </SubSection>

        {/* --- Suppliers --- */}
        <SubSection id="cat-suppliers" icon={faShop} title={t('admin.suppliers.title')}>
          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/suppliers"
            intro="Lista pública de proveedores verificados." />
          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/suppliers/{id}"
            intro="Detalle del proveedor con conteo total de productos." />
          <EndpointDoc method="GET" path="/api/v1/storefront/catalog/suppliers/{id}/products"
            intro="Productos del proveedor (mismos filtros que /products)." />
        </SubSection>

        {/* ============== CHECKOUT ============== */}
        <Section id="checkout" icon={faBolt} title={t('docs.section.checkout')}>
          <p>{t('docs.checkout.intro')}</p>
          <Endpoint method="POST" url="/api/v1/partner/orders" idempotent />
          <Sample
            request={{
              curl: `curl -X POST ${BASE_URL}/api/v1/partner/orders \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: po-2026-00042" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalOrderId": "PO-2026-00042",
    "shippingAddress": { "fullName": "Lucía", "line1": "C/ Mayor 12", "city": "Madrid", "country": "ES" },
    "items": [{ "productId": "d023e7b5-…", "quantity": 2 }]
  }'`,
              node: `const order = await (await fetch('${BASE_URL}/api/v1/partner/orders', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${token}\`, 'Idempotency-Key': 'po-2026-00042', 'Content-Type': 'application/json' },
  body: JSON.stringify({ externalOrderId: 'PO-2026-00042', shippingAddress: {…}, items: [{ productId, quantity: 2 }] }),
})).json()`,
              python: `r = requests.post("${BASE_URL}/api/v1/partner/orders",
    headers={"Authorization": f"Bearer {token}", "Idempotency-Key": "po-2026-00042"},
    json={"externalOrderId": "PO-2026-00042", "shippingAddress": {…}, "items": [{"productId": id, "quantity": 2}]})`,
              php: `$ch = curl_init('${BASE_URL}/api/v1/partner/orders');
curl_setopt_array($ch, [
  CURLOPT_POST       => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer $token","Idempotency-Key: po-2026-00042","Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode([ 'externalOrderId' => 'PO-2026-00042', 'shippingAddress' => […], 'items' => [['productId' => $id, 'quantity' => 2]] ]),
  CURLOPT_RETURNTRANSFER=> true,
]);
$order = json_decode(curl_exec($ch), true);`,
            }}
            response={`{
  "id":          "0f17fc26-…",
  "orderNumber": "NX-1779236757-8302",
  "status":      "PAID",
  "total":       "18.86",
  "currency":    "USD",
  "placedAt":    "2026-05-20T07:25:57Z"
}`}
          />
          <h4 className="text-[14px] font-medium mt-8 mb-3 flex items-center gap-2">
            <FontAwesomeIcon icon={faAngleRight} className="text-brand-500" /> {t('docs.checkout.flow.title')}
          </h4>
          <Pipeline />
        </Section>

        <Section id="tracking" icon={faTruckFast} title={t('docs.section.tracking')}>
          <p>{t('docs.tracking.intro')}</p>
          <Endpoint method="GET" url="/api/v1/partner/orders/{id}" />
          <Sample
            request={{
              curl: `curl ${BASE_URL}/api/v1/partner/orders/0f17fc26-… -H "Authorization: Bearer $TOKEN"`,
              node: `const o = await (await fetch(\`${BASE_URL}/api/v1/partner/orders/\${id}\`, { headers: { Authorization: \`Bearer \${token}\` } })).json()`,
              python: `o = requests.get(f"${BASE_URL}/api/v1/partner/orders/{order_id}", headers={"Authorization": f"Bearer {token}"}).json()`,
              php: `$ch = curl_init("${BASE_URL}/api/v1/partner/orders/$id");
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token"],
  CURLOPT_RETURNTRANSFER => true,
]);
$o = json_decode(curl_exec($ch), true);`,
            }}
            response={`{
  "orderNumber":     "NX-1779236757-8302",
  "status":          "SHIPPED",
  "trackingCarrier": "DHL",
  "trackingNumber":  "JD0145020XYZ",
  "shippedAt":       "2026-05-22T08:14:00Z"
}`} />
        </Section>

        <Section id="webhooks" icon={faSatelliteDish} title={t('docs.section.webhooks')}>
          <p>{t('docs.webhooks.intro')}</p>
          <h4 className="text-[14px] font-medium mt-6 mb-3">{t('docs.webhooks.events')}</h4>
          <EventsTable />
          <h4 className="text-[14px] font-medium mt-8 mb-3">{t('docs.webhooks.verify_label')}</h4>
          <CodeTabs samples={{
            node: `import crypto from 'node:crypto'
export function verify(rawBody, headerSig, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerSig))
}`,
            python: `import hashlib, hmac
def verify(raw_body, header_sig, secret):
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header_sig)`,
            php: `function nx036_verify($body, $sig, $secret) {
  return hash_equals(hash_hmac('sha256', $body, $secret), $sig);
}`,
            curl: `# Headers received on your endpoint:
# X-NX036-Signature: 4f0a3c…  (hex HMAC-SHA256 of raw body)
# X-NX036-Event:      order.shipped
# X-NX036-Event-Id:   evt-3c8d…
# X-NX036-Attempt:    1`,
          }} />
        </Section>

        <Section id="errors" icon={faTriangleExclamation} title={t('docs.section.errors')}>
          <p>{t('docs.errors.intro')}</p>
          <CodeBlock label="json">{`{
  "code":      "BUSINESS_ERROR",
  "message":   "Insufficient wallet balance",
  "timestamp": "2026-05-20T07:25:33.124Z",
  "fields":    null
}`}</CodeBlock>
          <h4 className="text-[14px] font-medium mt-6 mb-3">{t('docs.errors.codes')}</h4>
          <ErrorsTable t={t} />
        </Section>

        <Section id="scopes" icon={faKey} title={t('docs.scopes.heading')}>
          <ul className="space-y-1.5 text-[13px] text-ink-700 list-disc pl-5">
            <li><code>catalog.read</code> — {strip(t('docs.scope.catalog_read'))}</li>
            <li><code>orders.read</code> — {strip(t('docs.scope.orders_read'))}</li>
            <li><code>orders.write</code> — {strip(t('docs.scope.orders_write'))}</li>
            <li><code>webhooks.manage</code> — {strip(t('docs.scope.webhooks_manage'))}</li>
          </ul>
        </Section>

        <Section id="limits" icon={faGaugeHigh} title={t('docs.rate_limit.heading')}>
          <p>{t('docs.rate_limit.body')}</p>
        </Section>

        <Section id="changelog" icon={faClockRotateLeft} title={t('docs.changelog.heading')}>
          <div className="border-l-2 border-brand-200 pl-4 space-y-2">
            <div className="text-[13px] font-medium">{t('docs.changelog.v1')}</div>
            <p className="text-[13px] text-ink-700 leading-relaxed">{t('docs.changelog.v1.body')}</p>
          </div>
        </Section>

        <Section id="support" icon={faHandshake} title={t('docs.section.support')}>
          <p>{t('docs.support.body')}</p>
          <p className="mt-4">
            <a href="/swagger-ui.html" className="text-brand-700 hover:underline text-[14px]">
              <FontAwesomeIcon icon={faLink} className="mr-1 text-[11px]" />
              OpenAPI · /swagger-ui.html
            </a>
          </p>
        </Section>
      </article>

      {/* === Right rail === */}
      <aside className="hidden xl:block">
        <div className="sticky top-20 space-y-4 text-[12px]">
          <div className="card p-4">
            <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-2">
              {t('docs.base_url')}
            </div>
            <UrlBlock url={`${BASE_URL}/api/v1`} />
            <div className="mt-3 text-[11px] uppercase tracking-wider text-ink-500 font-medium">
              {t('docs.env.sandbox')}
            </div>
            <UrlBlock url={`${SANDBOX_URL}/api/v1`} />
          </div>
          <div className="card p-4">
            <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-2">
              {t('docs.environments')}
            </div>
            <table className="w-full text-[12px]">
              <thead className="text-ink-500 text-left">
                <tr><th className="font-medium py-1">{t('docs.col.name')}</th><th className="font-medium py-1 text-right">{t('docs.col.status')}</th></tr>
              </thead>
              <tbody>
                <tr><td className="py-1">{t('docs.env.sandbox')}</td><td className="py-1 text-right"><span className="badge bg-emerald-100 text-emerald-700">OK</span></td></tr>
                <tr><td className="py-1">{t('docs.env.production')}</td><td className="py-1 text-right"><span className="badge bg-amber-100 text-amber-700">Beta</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* =============================================================================
 * Components
 * ===========================================================================*/

function strip(s: string) { const i = s.indexOf('—'); return i >= 0 ? s.slice(i + 1).trim() : s }

function Section({ id, icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 mb-14">
      <h2 className="text-xl mb-3 flex items-center gap-2">
        <FontAwesomeIcon icon={icon} className="text-brand-500 text-[16px]" />
        {title}
      </h2>
      <div className="space-y-3 text-[14px] text-ink-700 leading-relaxed">{children}</div>
    </section>
  )
}

function SubSection({ id, icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 mb-10 pl-3 border-l-2 border-brand-100">
      <h3 className="text-[16px] mb-3 flex items-center gap-2 text-ink-900">
        <FontAwesomeIcon icon={icon} className="text-brand-500 text-[14px]" />
        {title}
      </h3>
      <div className="space-y-3 text-[14px] text-ink-700 leading-relaxed">{children}</div>
    </section>
  )
}

function Endpoint({ method, url, idempotent }: { method: string; url: string; idempotent?: boolean }) {
  const color: Record<string, string> = {
    GET:    'bg-brand-100 text-brand-800',
    POST:   'bg-emerald-100 text-emerald-700',
    PUT:    'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
  }
  return (
    <div className="flex items-center gap-2 my-3">
      <span className={`badge ${color[method] ?? 'bg-ink-100 text-ink-700'} text-[11px]`}>{method}</span>
      <UrlBlock url={url} compact />
      {idempotent && <span className="badge bg-ink-100 text-ink-700 text-[10px]">idempotent</span>}
    </div>
  )
}

interface EndpointDocProps {
  method: string
  path: string
  intro?: string
  params?: { name: string; type: string; req: boolean; desc: string }[]
  request?: Partial<Record<Lang, string>>
  response?: string
}
function EndpointDoc({ method, path, intro, params, request, response }: EndpointDocProps) {
  return (
    <div className="border border-ink-100 rounded-md p-4 my-4 bg-white">
      <Endpoint method={method} url={path} />
      {intro && <p className="text-[13px] text-ink-700 mt-1 mb-2">{intro}</p>}
      {params && params.length > 0 && <ParamsTable rows={params} />}
      {request && <Sample request={request} response={response} />}
      {!request && response && (
        <>
          <Label>response</Label>
          <CodeBlock label="json">{response}</CodeBlock>
        </>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium mb-1.5 mt-3">
      {children}
    </div>
  )
}

function UrlBlock({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div className={`flex items-center gap-2 bg-ink-50 border border-ink-100 rounded-md px-2.5 py-1.5 ${compact ? 'flex-1 min-w-0' : ''}`}>
      <code className="font-mono text-[12px] text-ink-900 flex-1 truncate">{url}</code>
      <button onClick={copy} className="text-ink-400 hover:text-ink-900 shrink-0" aria-label="Copy URL">
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="text-[11px]" />
      </button>
    </div>
  )
}

function ParamsTable({ rows }: { rows: { name: string; type: string; req: boolean; desc: string }[] }) {
  const t = useT()
  return (
    <div className="my-3 overflow-hidden rounded-md border border-ink-100">
      <table className="w-full text-[12px]">
        <thead className="bg-ink-50 text-ink-500 text-left">
          <tr>
            <th className="px-3 py-1.5 font-medium">{t('docs.col.name')}</th>
            <th className="px-3 py-1.5 font-medium">{t('docs.col.type')}</th>
            <th className="px-3 py-1.5 font-medium">{t('docs.required')}</th>
            <th className="px-3 py-1.5 font-medium">{t('docs.col.description')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-ink-100">
              <td className="px-3 py-1.5 font-mono">{r.name}</td>
              <td className="px-3 py-1.5 text-ink-500">{r.type}</td>
              <td className="px-3 py-1.5">{r.req
                ? <span className="badge bg-red-50 text-red-700">{t('docs.required')}</span>
                : <span className="badge bg-ink-100 text-ink-600">{t('docs.optional')}</span>}
              </td>
              <td className="px-3 py-1.5 text-ink-700">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventsTable() {
  const t = useT()
  const events = [
    { name: 'order.created',   key: 'docs.webhooks.event.created' },
    { name: 'order.paid',      key: 'docs.webhooks.event.paid' },
    { name: 'order.forwarded', key: 'docs.webhooks.event.forwarded' },
    { name: 'order.shipped',   key: 'docs.webhooks.event.shipped' },
    { name: 'order.delivered', key: 'docs.webhooks.event.delivered' },
    { name: 'order.cancelled', key: 'docs.webhooks.event.cancelled' },
  ]
  return (
    <div className="overflow-hidden rounded-md border border-ink-100 my-3">
      <table className="w-full text-[12px]">
        <thead className="bg-ink-50 text-ink-500 text-left">
          <tr><th className="px-3 py-1.5 font-medium">{t('docs.col.event')}</th><th className="px-3 py-1.5 font-medium">{t('docs.col.description')}</th></tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.name} className="border-t border-ink-100">
              <td className="px-3 py-1.5 font-mono">{e.name}</td>
              <td className="px-3 py-1.5 text-ink-700">{strip(t(e.key))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ErrorsTable({ t }: { t: (k: string) => string }) {
  const rows = [
    { code: 'UNAUTHORIZED',   status: 401, key: 'docs.errors.code.unauth' },
    { code: 'FORBIDDEN',      status: 403, key: 'docs.errors.code.forbidden' },
    { code: 'NOT_FOUND',      status: 404, key: 'docs.errors.code.not_found' },
    { code: 'BUSINESS_ERROR', status: 422, key: 'docs.errors.code.business' },
    { code: 'RATE_LIMITED',   status: 429, key: 'docs.errors.code.rate' },
    { code: 'INTERNAL_ERROR', status: 500, key: 'docs.errors.code.server' },
  ]
  return (
    <div className="overflow-hidden rounded-md border border-ink-100 my-3">
      <table className="w-full text-[12px]">
        <thead className="bg-ink-50 text-ink-500 text-left">
          <tr><th className="px-3 py-1.5 font-medium">{t('docs.col.code')}</th><th className="px-3 py-1.5 font-medium w-16">HTTP</th><th className="px-3 py-1.5 font-medium">{t('docs.col.meaning')}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-ink-100">
              <td className="px-3 py-1.5 font-mono">{r.code}</td>
              <td className="px-3 py-1.5 text-ink-500">{r.status}</td>
              <td className="px-3 py-1.5 text-ink-700">{strip(t(r.key))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pipeline() {
  const t = useT()
  const steps = [
    { name: 'placed',     key: 'docs.checkout.flow.placed' },
    { name: 'paid',       key: 'docs.checkout.flow.paid' },
    { name: 'forwarded',  key: 'docs.checkout.flow.forwarded' },
    { name: 'shipped',    key: 'docs.checkout.flow.shipped' },
    { name: 'delivered',  key: 'docs.checkout.flow.delivered' },
  ]
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s.name} className="flex items-start gap-3 text-[13px]">
          <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-medium inline-flex items-center justify-center text-[11px]">{i + 1}</span>
          <div>
            <code className="text-brand-700">{s.name}</code>
            <span className="text-ink-700 ml-2">{strip(t(s.key))}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function EnvironmentTable() {
  const t = useT()
  return (
    <div className="overflow-hidden rounded-md border border-ink-100 my-4">
      <table className="w-full text-[12px]">
        <thead className="bg-ink-50 text-ink-500 text-left">
          <tr>
            <th className="px-3 py-1.5 font-medium">{t('docs.environments')}</th>
            <th className="px-3 py-1.5 font-medium">{t('docs.base_url')}</th>
            <th className="px-3 py-1.5 font-medium">{t('common.status')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-ink-100">
            <td className="px-3 py-1.5 font-medium">{t('docs.env.sandbox')}</td>
            <td className="px-3 py-1.5"><code>{SANDBOX_URL}</code></td>
            <td className="px-3 py-1.5"><span className="badge bg-emerald-100 text-emerald-700">OK</span></td>
          </tr>
          <tr className="border-t border-ink-100">
            <td className="px-3 py-1.5 font-medium">{t('docs.env.production')}</td>
            <td className="px-3 py-1.5"><code>{BASE_URL}</code></td>
            <td className="px-3 py-1.5"><span className="badge bg-amber-100 text-amber-700">Beta</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Request and Response stacked vertically (request first, then response). */
function Sample({ request, response }: { request: Partial<Record<Lang, string>>; response?: string }) {
  const t = useT()
  return (
    <div className="my-3 space-y-3">
      <div>
        <Label>{t('docs.example_request')}</Label>
        <CodeTabs samples={request} />
      </div>
      {response && (
        <div>
          <Label>{t('docs.example_response')}</Label>
          <CodeBlock label="json">{response}</CodeBlock>
        </div>
      )}
    </div>
  )
}

const LANG_LABELS: Record<Lang, string> = {
  curl: 'cURL', node: 'Node.js', python: 'Python', php: 'PHP',
}

function CodeTabs({ samples }: { samples: Partial<Record<Lang, string>> }) {
  const t = useT()
  const langs = Object.keys(samples) as Lang[]
  const [active, setActive] = useState<Lang>(langs[0])
  const [copied, setCopied] = useState(false)
  const code = samples[active] ?? ''
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div className="rounded-md overflow-hidden border border-ink-900/10">
      <div className="bg-ink-900 text-ink-50 flex items-center justify-between text-[11px] px-2">
        <div className="flex">
          {langs.map((l) => (
            <button key={l} onClick={() => setActive(l)}
              className={`px-3 py-1.5 transition-colors ${
                l === active ? 'text-white border-b-2 border-brand-400'
                             : 'text-ink-300 hover:text-white border-b-2 border-transparent'
              }`}>
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
        <button onClick={copy} className="text-ink-300 hover:text-white px-2 py-1 flex items-center gap-1">
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="text-[10px]" />
          {copied ? t('docs.copied') : t('docs.copy')}
        </button>
      </div>
      <pre className="bg-ink-900 text-ink-50 p-3.5 overflow-x-auto text-[12px] leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function CodeBlock({ label, children }: { label: string; children: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <div className="rounded-md overflow-hidden border border-ink-900/10">
      <div className="bg-ink-900 text-ink-50 flex items-center justify-between text-[11px] px-3 py-1.5">
        <span className="font-mono text-ink-400">{label}</span>
        <button onClick={copy} className="text-ink-300 hover:text-white flex items-center gap-1">
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="text-[10px]" />
          {copied ? t('docs.copied') : t('docs.copy')}
        </button>
      </div>
      <pre className="bg-ink-900 text-ink-50 p-3.5 overflow-x-auto text-[12px] leading-relaxed font-mono">
        <code>{children}</code>
      </pre>
    </div>
  )
}
