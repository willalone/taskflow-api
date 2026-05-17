import { Redis } from 'ioredis';
import { loadEnv } from '../../config/env.js';

const env = loadEnv();

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const REFRESH_BLACKLIST_PREFIX = 'refresh:blacklist:';
