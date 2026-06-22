/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PACKIKO_API_BASE_URL: string
  readonly VITE_PACKIKO_PUBLIC_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
