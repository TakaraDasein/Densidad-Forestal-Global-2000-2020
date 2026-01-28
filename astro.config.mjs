import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [
    react()
  ],
  vite: {
    ssr: {
      noExternal: ['d3', 'd3-geo', 'd3-array', 'd3-scale', 'd3-interpolate']
    }
  }
});
