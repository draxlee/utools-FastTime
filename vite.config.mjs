import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Keep the development cache writable when dependencies were installed by root.
  cacheDir: '.vite-cache',
  base: './'
})
