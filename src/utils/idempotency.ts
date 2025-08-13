import { redis } from '../config/redis';

// save a processed requestId for short time to avoid duplicate processing
export async function markProcessed(requestId: string, ttlSeconds = 60 * 10) {
  if (!requestId) return false;
  const key = `processed:${requestId}`;
  const added = await redis.setnx(key, '1');
  if (added === 1) {
    await redis.expire(key, ttlSeconds);
    return true; // first time
  }
  return false; // already processed
}
