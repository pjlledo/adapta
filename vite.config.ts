import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Rutas relativas: el sitio funciona igual en un subdominio que en una subcarpeta.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        componentes: resolve(import.meta.dirname, 'componentes.html'),
      },
    },
  },
});
