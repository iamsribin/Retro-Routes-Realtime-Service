import cron from "node-cron";
import { redis, GEO_KEY, HEARTBEAT_PREFIX, removeOnlineDriver } from "../config/redis";

cron.schedule("*/2 * * * *", async () => {
  try {
    // Get all heartbeat keys
    const keys = await redis.keys(`${HEARTBEAT_PREFIX}*`);
    const activeDrivers = keys.map((k) => k.replace(HEARTBEAT_PREFIX, ""));

    // Get all drivers in GEO set
    const geoDrivers = await redis.zrange(GEO_KEY, 0, -1);

    // If a driver exists in GEO but not in heartbeat -> remove
    for (const driverId of geoDrivers) {
      if (!activeDrivers.includes(driverId)) {
        await removeOnlineDriver(driverId);
        console.log(`🗑 Removed stale driver ${driverId} from Redis`);
      }
    }
  } catch (err) {
    console.error("❌ Error in driver cleanup:", err);
  }
});
