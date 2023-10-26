import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  minify: true,
  target: 'es2022',
  format: ['cjs', 'esm'],
});
