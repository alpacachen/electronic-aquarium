import { playwright } from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.tsx'],
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
})
