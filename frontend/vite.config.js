import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Skip the gzip-size computation for the output table — it's purely
    // informational and noticeably slows large-chunk builds.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own cacheable vendor chunks so
        // they aren't re-bundled with app code on every change.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['chart.js', 'react-chartjs-2', 'recharts'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2pdf.js'],
        },
      },
    },
  },
})
