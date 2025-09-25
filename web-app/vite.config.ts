import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    fs: {
      // Allow serving files from the WebZjs submodule
      allow: [
        // Current project directory
        '.',
        // Parent directory to access the deps folder
        '..',
        // Specifically allow the WebZjs packages
        '../deps/WebZjs/packages'
      ]
    }
  },
  // Ensure WASM files are handled correctly
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@chainsafe/webzjs-wallet']
  },
  plugins: [
    {
        name: "configure-response-headers",
        configureServer: (server) => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            next();
          });
        },
      }
  ]
})
