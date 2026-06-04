import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Build config for ComfyUI Frontend 1.33.9+ (matches the ComfyUI-ETK pattern).
 *
 * The frontend NO LONGER exposes `vue` / `vue-i18n` / `primevue` as resolvable
 * bare specifiers, so every framework dependency MUST be bundled inline. Only
 * the comfy runtime shims the host serves at fixed relative paths may be
 * externalised — we import them as `@comfy/app` (for types) and Rollup
 * `output.paths` rewrites them to `../../../scripts/app.js` at emit time.
 */
const COMFY_RUNTIME_MODULES: Record<string, string> = {
  '@comfy/app': '../../../scripts/app.js',
  '@comfy/api': '../../../scripts/api.js',
}

/**
 * ComfyUI's extension loader picks up .js from WEB_DIRECTORY but ignores
 * companion .css. Concatenate the CSS Vite emits and prepend a self-executing
 * injector to main.js so styles load with the bundle.
 */
function inlineCssPlugin(): Plugin {
  return {
    name: 'ideogram-inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let css = ''
      const cssFiles: string[] = []
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && asset.type === 'asset') {
          css += String(asset.source)
          cssFiles.push(fileName)
        }
      }
      if (!css) return
      const jsFile = Object.keys(bundle).find(
        (f) => f === 'main.js' || (f.endsWith('.js') && f.startsWith('main')),
      )
      if (!jsFile) return
      const jsAsset = bundle[jsFile]
      if (!jsAsset || jsAsset.type !== 'chunk') return
      const injector =
        `(function(){var s=document.createElement('style');` +
        `s.setAttribute('data-extension','comfyui-ideogramhelper');` +
        `s.textContent=${JSON.stringify(css)};` +
        `document.head.appendChild(s);})();`
      jsAsset.code = injector + jsAsset.code
      for (const f of cssFiles) delete bundle[f]
    },
  }
}

export default defineConfig({
  plugins: [vue(), inlineCssPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    target: 'es2022',
    outDir: 'js',
    emptyOutDir: true,
    sourcemap: false, // shipped build is committed to git; flip to true to debug
    cssCodeSplit: false,
    assetsInlineLimit: Infinity,
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: (id) => id in COMFY_RUNTIME_MODULES,
      output: {
        paths: COMFY_RUNTIME_MODULES,
        assetFileNames: 'assets/[name].[ext]',
        entryFileNames: 'main.js',
        inlineDynamicImports: true,
      },
    },
  },
})
