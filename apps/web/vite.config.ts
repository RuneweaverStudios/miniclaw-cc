import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: true, // Expose to network for testing on other devices
    strictPort: false, // Try next port if 3000 is in use
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
    minify: 'esbuild', // Fast minification with esbuild
    target: 'esnext', // Modern browsers for better performance
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    // Force optimization of common dependencies
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    // Exclude dependencies that cause issues
    exclude: [],
  },
  esbuild: {
    // Drop console logs in production for smaller bundle
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
