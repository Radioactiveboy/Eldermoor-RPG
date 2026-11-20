import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { PHASER_SOURCE, setPhaserFlags } from './tools/phaserFlags';

export default defineConfig({
  base: './',
  resolve: {
    // A slimmer Phaser built from its own source (see src/vendor/phaser.js). Only the bare
    // `phaser` import is redirected: the slim entry's own `phaser/src/...` imports are not.
    alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/vendor/phaser.js', import.meta.url)) }],
  },
  // Phaser's build flags (see tools/phaserFlags.ts): set in its source for the build...
  plugins: [
    {
      name: 'phaser-flags',
      enforce: 'pre',
      transform(code, id) {
        if (!PHASER_SOURCE.test(id) || !code.includes('typeof ')) return null;
        return { code: setPhaserFlags(code), map: null };
      },
    },
  ],
  optimizeDeps: {
    esbuildOptions: {
      // ...and for the dev server, which pre-bundles Phaser's source with esbuild.
      plugins: [
        {
          name: 'phaser-flags',
          setup(build) {
            build.onLoad({ filter: PHASER_SOURCE }, async (args) => ({
              contents: setPhaserFlags(await readFile(args.path, 'utf8')),
              loader: 'js',
            }));
          },
        },
      ],
    },
  },
  build: {
    // Phaser's chunk is about 1 MB (250 kB gzipped); the game's own code stays well under this.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Phaser in a chunk of its own: it changes far less often than the game, so a browser
        // that has it cached only downloads the game's own code after an update.
        manualChunks(id) {
          if (id.includes('/node_modules/')) return 'phaser';
        },
      },
    },
  },
});
