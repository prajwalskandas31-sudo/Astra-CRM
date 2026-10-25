import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/Astra-CRM/',
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api-leegality': {
        target: 'https://app1.leegality.com',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/api-leegality/, '')
      },
      '/sign-proxy': {
        target: 'https://app1.leegality.com',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/sign-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
          });
        }
      }
    }
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/app-[hash].js`,
        chunkFileNames: `assets/chunk-[hash].js`,
        assetFileNames: `assets/asset-[hash].[ext]`
      }
    }
  }
})
