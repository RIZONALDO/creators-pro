import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false, // testes batem no mesmo banco Postgres de teste — evita corrida entre arquivos
  },
});
