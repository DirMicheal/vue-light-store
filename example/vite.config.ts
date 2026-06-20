import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'vue-light-store': resolve(__dirname, '../src/index.ts'),
      '@': resolve(__dirname, 'src')
    }
  }
})
