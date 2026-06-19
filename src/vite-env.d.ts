/// <reference types="vite/client" />

// Tipado de las variables de entorno propias (VITE_*) para que `import.meta.env`
// esté disponible en el typecheck (tsc) además de en tiempo de build de Vite.
interface ImportMetaEnv {
  readonly VITE_ENABLE_DEMO_ORDERS?: string
  readonly VITE_SHOW_DEMO_CREDENTIALS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
