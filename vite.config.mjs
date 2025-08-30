import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // 👈 important if deploying to subfolder
  publicDir: 'public', // default, but good to be explicit
})
