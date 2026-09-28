import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// относительный base: проект живёт в подпапке GitHub Pages
// (https://<nik>.github.io/<repo>/), абсолютные пути к ассетам ломались бы
export default defineConfig({
  base: './',
  plugins: [react()],
})
