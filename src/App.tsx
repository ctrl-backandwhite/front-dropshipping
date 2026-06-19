import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import StorefrontLayout from './layouts/StorefrontLayout'
import AdminLayout from './layouts/AdminLayout'
import HomePage from './pages/storefront/HomePage'
import ProductListPage from './pages/storefront/ProductListPage'
import ProductDetailPage from './pages/storefront/ProductDetailPage'
import PlansPage from './pages/storefront/PlansPage'
import DevelopersPage from './pages/storefront/DevelopersPage'
import ConnectStorePage from './pages/storefront/ConnectStorePage'
import WalletPage from './pages/storefront/wallet/WalletPage'
import RechargePage from './pages/storefront/wallet/RechargePage'
import PaypalReturnPage from './pages/storefront/wallet/PaypalReturnPage'
import CartPage from './pages/storefront/cart/CartPage'
import CheckoutPage from './pages/storefront/cart/CheckoutPage'
import CheckoutReturnPage from './pages/storefront/cart/CheckoutReturnPage'
import OrdersPage from './pages/storefront/orders/OrdersPage'
import OrderDetailPage from './pages/storefront/orders/OrderDetailPage'
import ProfilePage from './pages/storefront/profile/ProfilePage'
import AddressesPage from './pages/storefront/profile/AddressesPage'
import ShopsPage from './pages/storefront/platform/ShopsPage'
import SourcingPage from './pages/storefront/platform/SourcingPage'
import IntelligencePage from './pages/storefront/platform/IntelligencePage'
import AdminMentorsPage from './pages/admin/AdminMentorsPage'
import SupportPage from './pages/storefront/platform/SupportPage'
import NotificationsPage from './pages/storefront/platform/NotificationsPage'
import PodPage from './pages/storefront/platform/PodPage'
import OdmPage from './pages/storefront/platform/OdmPage'
import AffiliatePage from './pages/storefront/platform/AffiliatePage'
import AdminAffiliatesPage from './pages/admin/AdminAffiliatesPage'
import AdminNewsletterPage from './pages/admin/AdminNewsletterPage'
import NewsletterUnsubscribePage from './pages/storefront/NewsletterUnsubscribePage'
import AdminWarehousesPage from './pages/admin/AdminWarehousesPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ActivatePage from './pages/auth/ActivatePage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminCatalogPage from './pages/admin/AdminCatalogPage'
import AdminProductDetailPage from './pages/admin/AdminProductDetailPage'
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage'
import AdminSuppliersPage from './pages/admin/AdminSuppliersPage'
import AdminPricingPage from './pages/admin/AdminPricingPage'
import AdminProductGroupsPage from './pages/admin/AdminProductGroupsPage'
import AdminLanguagesPage from './pages/admin/AdminLanguagesPage'
import AdminCurrenciesPage from './pages/admin/AdminCurrenciesPage'
import AdminTaxesPage from './pages/admin/AdminTaxesPage'
import AdminAcademyPage from './pages/admin/AdminAcademyPage'
import AdminOrdersPage from './pages/admin/AdminOrdersPage'
import AdminPartnersPage from './pages/admin/AdminPartnersPage'
import AdminBillingPage from './pages/admin/AdminBillingPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminProfilePage from './pages/admin/AdminProfilePage'
import AdminStyleguidePage from './pages/admin/AdminStyleguidePage'
import AdminWalletsPage from './pages/admin/AdminWalletsPage'
import AdminWalletDetailPage from './pages/admin/AdminWalletDetailPage'
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage'
import OperatorEarningsPage from './pages/admin/OperatorEarningsPage'
import AdminOperatorsPage from './pages/admin/AdminOperatorsPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuthStore } from './store/auth'
import { Toaster } from './components/Toaster'
import NotFoundPage from './pages/NotFoundPage'
import { CartDrawer } from './components/CartDrawer'
import { ScrollToTop } from './components/ScrollToTop'
import { ReferralCapture } from './components/ReferralCapture'
import { DialogHost } from './components/Dialog'
import { installNativeOverrides } from './store/dialog'

export default function App() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => {
    init()
    // Reemplaza window.alert / confirm con nuestro UI custom.
    installNativeOverrides()
  }, [init])

  return (
    <>
    <ScrollToTop />
    <Toaster />
    <CartDrawer />
    <DialogHost />
    <ReferralCapture />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/activate" element={<ActivatePage />} />
      <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribePage />} />

      <Route element={<StorefrontLayout />}>
        <Route index element={<HomePage />} />
        {/* El listado COMPLETO del catálogo es interno: requiere login (la home solo muestra el teaser).
            Tras autenticarte puedes ver todos los productos. La ficha individual (PDP) sigue siendo
            pública para enlaces compartidos/SEO de productos concretos. */}
        <Route path="catalog" element={<ProtectedRoute><ProductListPage /></ProtectedRoute>} />
        <Route path="catalog/:slug" element={<ProductDetailPage />} />
        <Route path="pricing" element={<PlansPage />} />
        <Route path="precios" element={<Navigate to="/pricing" replace />} />
        <Route path="prices"  element={<Navigate to="/pricing" replace />} />
        <Route path="planes"  element={<Navigate to="/pricing" replace />} />
        <Route path="plans"   element={<Navigate to="/pricing" replace />} />
        <Route path="developers" element={<DevelopersPage />} />
        <Route path="connect" element={<ConnectStorePage />} />
        <Route path="conectar" element={<Navigate to="/connect" replace />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="checkout/return" element={<ProtectedRoute><CheckoutReturnPage /></ProtectedRoute>} />
        <Route path="wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="wallet/recharge" element={<ProtectedRoute><RechargePage /></ProtectedRoute>} />
        <Route path="wallet/paypal-return" element={<ProtectedRoute><PaypalReturnPage /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="addresses" element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
        {/* Platform modules moved to /admin/* (see admin Route group below).
            These redirects keep legacy bookmarks working. */}
        <Route path="shops"         element={<Navigate to="/admin/shops" replace />} />
        <Route path="sourcing"      element={<Navigate to="/admin/sourcing" replace />} />
        <Route path="intelligence"  element={<Navigate to="/admin/intelligence" replace />} />
        <Route path="academy"       element={<Navigate to="/admin/academy" replace />} />
        <Route path="mentors"       element={<Navigate to="/admin/mentors" replace />} />
        <Route path="support"       element={<Navigate to="/admin/support" replace />} />
        <Route path="notifications" element={<Navigate to="/admin/notifications" replace />} />
        <Route path="pod"           element={<Navigate to="/admin/pod" replace />} />
        <Route path="odm"           element={<Navigate to="/admin/odm" replace />} />
        {/* Panel de afiliado del usuario normal (su dashboard de referidos), no del back-office. */}
        <Route path="affiliate"     element={<ProtectedRoute><AffiliatePage /></ProtectedRoute>} />
        <Route path="warehouses"    element={<Navigate to="/admin/warehouses" replace />} />
        <Route path="platform"      element={<Navigate to="/admin" replace />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN', 'OPERATOR']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        {/* DROP-543: alias /admin/dashboard → /admin (dashboard). El sidebar
            usaba esta ruta y devolvía 404. */}
        <Route path="dashboard" element={<Navigate to="/admin" replace />} />
        <Route path="catalog" element={<AdminCatalogPage />} />
        <Route path="catalog/:id" element={<AdminProductDetailPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="suppliers" element={<AdminSuppliersPage />} />
        <Route path="pricing" element={<AdminPricingPage />} />
        <Route path="product-groups" element={<AdminProductGroupsPage />} />
        <Route path="languages" element={<AdminLanguagesPage />} />
        <Route path="currencies" element={<AdminCurrenciesPage />} />
        <Route path="taxes" element={<AdminTaxesPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        {/* Área del operador (su acumulado + histórico) y reporte admin de operadores. */}
        <Route path="operator/earnings" element={<OperatorEarningsPage />} />
        <Route path="operators" element={<AdminOperatorsPage />} />
        <Route path="partners" element={<AdminPartnersPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="wallets" element={<AdminWalletsPage />} />
        <Route path="wallets/:userId" element={<AdminWalletDetailPage />} />
        {/* Internal catalog browse (same UX as the public /catalog) */}
        <Route path="browse"           element={<ProductListPage />} />
        <Route path="browse/:slug"     element={<ProductDetailPage />} />
        {/* Platform modules (moved from storefront) */}
        <Route path="shops"         element={<ShopsPage />} />
        <Route path="sourcing"      element={<SourcingPage />} />
        <Route path="intelligence"  element={<IntelligencePage />} />
        <Route path="academy"       element={<AdminAcademyPage />} />
        <Route path="mentors"       element={<AdminMentorsPage />} />
        <Route path="support"       element={<SupportPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="pod"           element={<PodPage />} />
        <Route path="odm"           element={<OdmPage />} />
        <Route path="affiliate"     element={<AffiliatePage />} />
        <Route path="affiliates"    element={<AdminAffiliatesPage />} />
        <Route path="newsletter"    element={<AdminNewsletterPage />} />
        <Route path="warehouses"    element={<AdminWarehousesPage />} />
        <Route path="productos" element={<Navigate to="/admin/catalog" replace />} />
        <Route path="products"  element={<Navigate to="/admin/catalog" replace />} />
        <Route path="categorias" element={<Navigate to="/admin/categories" replace />} />
        <Route path="proveedores" element={<Navigate to="/admin/suppliers" replace />} />
        <Route path="ordenes" element={<Navigate to="/admin/orders" replace />} />
        <Route path="facturacion" element={<Navigate to="/admin/billing" replace />} />
        <Route path="usuarios" element={<Navigate to="/admin/users" replace />} />
        <Route path="precios"  element={<Navigate to="/admin/pricing" replace />} />
        <Route path="perfil"   element={<Navigate to="/admin/profile" replace />} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="styleguide" element={<AdminStyleguidePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  )
}
