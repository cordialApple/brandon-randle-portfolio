import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://brandon-randle-portfolio.pages.dev',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
});
