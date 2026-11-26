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
  base: process.env.VITE_BASE || '/Astra-CRM/',
  server: {
    port: 3000,
    open: false
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/app-[hash].js`,
        chunkFileNames: `assets/chunk-[hash].js`,
        assetFileNames: `assets/asset-[hash].[ext]`,
        // Screens load on demand (React.lazy in App.jsx). Icons go in one shared file; otherwise Rollup
        // splits them into dozens of tiny files, one request each.
        manualChunks: (id) => (id.includes('node_modules/lucide-react') ? 'icons' : undefined)
      }
    }
  }
})
