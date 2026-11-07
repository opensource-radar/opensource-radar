import { defineConfig } from 'vitest/config'

// Tests only: lets .jsx files use React's automatic JSX mode. The site's own
// build settings stay in vite.config.js.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
})
