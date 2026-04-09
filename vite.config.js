import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/turtle-editor-forkids/', // Ganti <nama-repo-anda> dengan nama repository Anda
})