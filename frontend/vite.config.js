// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import instagramSelectionSource from './vitePlugins/instagramSelectionSource.js'

const instagramSelectionPath = fileURLToPath(new URL('../shared/instagramSelection.cjs', import.meta.url))

export default defineConfig({
  plugins: [instagramSelectionSource(instagramSelectionPath), react()],
  resolve: {
    alias: {
      '@shared/instagram-selection': instagramSelectionPath,
      '@shared/variant-key-authority': fileURLToPath(
        new URL('../shared/variantKeyAuthority.cjs', import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    include: ['@shared/variant-key-authority'],
    exclude: ['@shared/instagram-selection'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'legged-hacker-unworldly.ngrok-free.dev',
    ],
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
  preview: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'legged-hacker-unworldly.ngrok-free.dev',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            'keen-slider',
            'lucide-react',
            'react-range',
            'react-toastify',
          ],
          'vendor-http': ['axios'],
        },
      },
    },
  },
})
