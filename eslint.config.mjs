import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    // The Cloudflare Worker is deployed separately with its own toolchain and
    // follows Worker conventions (anonymous default export), not Next's.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'worker/**'],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // The domain layer must stay pure: no framework, no I/O, no Prisma.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', '@prisma/*', 'react', 'server-only'],
              message: 'Domain layer must stay free of framework and infrastructure imports.',
            },
            {
              group: ['@/infrastructure/*', '@/app/*', '@/components/*'],
              message: 'Domain layer must not depend on outer layers.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
