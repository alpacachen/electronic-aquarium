import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * GitHub Pages serves the site from the repository's own subpath, so a built
 * bundle has to ask for its assets there rather than at the domain root.
 *
 * The build and `vite preview` use it, so a preview reproduces the deployed
 * layout and a missing asset shows up locally. The dev server and the browser
 * tests keep serving from the root, which is where they are reachable.
 */
const PAGES_BASE = '/electronic-aquarium/'

export default defineConfig(({ command, isPreview, mode }) => ({
  base: mode === 'netlify' ? '/' : command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react(), tailwindcss()],
  /**
   * `@/` points at src/, which is the alias shadcn's components import through.
   * A URL relative to this file rather than to the process's working directory,
   * so it resolves the same however vite was launched.
   */
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    /**
     * Every test lives in src/tests/ and drives the whole app through a real
     * browser. There is no second suite: see AGENTS.md for why the project does
     * not keep function-level unit tests.
     */
    include: ['src/tests/**/*.test.tsx'],
    /**
     * One test file at a time. Every file drives its own WebGL canvas through the
     * same software rasteriser, and running them at once makes each one slower
     * than its timeout — they pass individually and time out together.
     */
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright({
        launchOptions: {
          // Headless Chromium rasterises WebGL in software, so it has to be
          // allowed explicitly.
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      }),
      screenshotFailures: false,
      /**
       * A software rasteriser is fill-rate bound, and the aquarium behaves the
       * same at any size, so the viewport stays small to keep the frame rate
       * high enough for the fish to actually swim during a test.
       */
      viewport: { height: 400, width: 600 },
    },
  },
}))
