/// <reference types="vite/client" />

interface ImportMetaEnv {
  // базовый url GREEN-API, если не задан — дефолт из src/api/config.ts
  readonly VITE_GREEN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
