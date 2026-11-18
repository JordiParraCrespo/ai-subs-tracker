import { appConfig } from './app.config';
import { cloudflareEmailConfig } from './cloudflare-email.config';
import { databaseConfig } from './database.config';
import { emailConfig } from './email.config';
import { healthConfig } from './health.config';
import { redisConfig } from './redis.config';
import { storageConfig } from './storage.config';
// flama:plugins api-config-imports

/**
 * Every config section the API loads, in load order. A section a feature of
 * its own brings joins this list, and `app.module.ts` loads the list.
 */
export const configs = [
  appConfig,
  databaseConfig,
  redisConfig,
  healthConfig,
  emailConfig,
  cloudflareEmailConfig,
  storageConfig,
  // flama:plugins api-config
];
