import path from 'node:path';
import { defineConfig } from 'prisma/config';

// A Prisma config file disables the CLI's own dotenv loading, so load the local
// env file ourselves. Node's built-in loader keeps this dependency-free.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // File absent - fine, the variables may come from the real environment.
  }
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
