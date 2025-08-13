import { redis } from '../config/redis';

// very small wrapper for SETNX lock
export async function acquireLock(lockKey: string, ttlMs = 35000) {
  const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const acquired = await (redis as any).set(lockKey, token, { NX: true, PX: ttlMs });
  return acquired ? token : null;
}

export async function releaseLock(lockKey: string, token: string) {
  // Use Lua to avoid releasing someone else's lock
  const lua = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end`;
  return await redis.eval(lua, 1, lockKey, token);
}
