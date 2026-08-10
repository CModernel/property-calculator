import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/property-calculator/',
  test: {
    environment: 'node',
    // TODO-117: default 5000ms timeout produces intermittent false
    // failures on jsdom-rendered App.*.test.jsx files under system load -
    // every affected test passes reliably in isolation. Extra headroom
    // costs nothing for a genuinely hung test, which would still fail.
    testTimeout: 15000,
  },
})
