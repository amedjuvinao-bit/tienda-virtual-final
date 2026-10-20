// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared/instagram-selection': fileURLToPath(new URL('../shared/instagramSelection.cjs', import.meta.url)),
      '@shared/variant-key-authority': fileURLToPath(
        new URL('../shared/variantKeyAuthority.cjs', import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    include: ['@shared/variant-key-authority', '@shared/instagram-selection'],
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
