import 'dotenv/config';
import { buildApp } from './app.js';
import { env } from './config/env.js';

const banner = `
  ╔═══════════════════════════════════════╗
  ║           🔐 GEARBIT API              ║
  ╚═══════════════════════════════════════╝
`;

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  console.log(banner);
  app.log.info(`🚀 Server running at http://localhost:${env.PORT}`);
  app.log.info(`📦 Environment: ${env.NODE_ENV}`);
  app.log.info(`📚 Docs running at http://localhost:${env.PORT}/docs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
