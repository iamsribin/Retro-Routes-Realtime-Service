import Redis from "ioredis";
const REDIS_URL = (process.env.REDIS_URL) as string
console.log({REDIS_URL});

export const redis = new Redis(REDIS_URL);
export const GEO_KEY = "onlineDrivers:geo";
export const HEARTBEAT_PREFIX = "driver:heartbeat:";
export const LOCK_PREFIX = "lock:booking:";
export const DRIVER_DETAILS_PREFIX = ":onlineDriver:details:";

export async function setHeartbeat(driverId: string, ttlSeconds = 120) {
  const key = `${HEARTBEAT_PREFIX}${driverId}`;
  await redis.set(key, Date.now().toString(), "EX", ttlSeconds);
} 

export async function isDriverOnline(driverId: string) {
  const key = `${HEARTBEAT_PREFIX}${driverId}`;
  const val = await redis.get(key);
  return !!val;
}

export async function removeOnlineDriver(id: string) {
  try {
    const key = `${HEARTBEAT_PREFIX}${id}`;
    const detailsKey = `${DRIVER_DETAILS_PREFIX}${id}`;
    await redis.del([key, detailsKey]);
    await redis.zrem(GEO_KEY, id);
  } catch (err) {
    console.error(`Failed to remove online driver ${id}:`, err);
    throw err;
  }
}

export async function setDriverDetails(
  driverDetails: {
    driverId: string;
    driverNumber: string;
    name: string;
    cancelledRides: number;
    rating: number;
    vehicleModel: string; 
  },
  ttlSeconds = 120
) {
  
  const key = `${DRIVER_DETAILS_PREFIX}${driverDetails.driverId}`;
  await redis.set(key, JSON.stringify(driverDetails), "EX", ttlSeconds);
const data = await getDriverDetails(driverDetails.driverId);
console.log("stored driverDetails",data);

}


export async function getDriverDetails(driverId: string) {
  try {
    const key = `${DRIVER_DETAILS_PREFIX}${driverId}`;
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error(`Failed to get driver details for driver ${driverId}:`, err);
    throw err;
  }
}

export async function addDriverGeo(driverId: string, lng: number, lat: number) {
  await redis.geoadd(GEO_KEY, lng, lat, driverId);
}

export async function getDriverGeo(driverId: string) {
  const pos = await redis.geopos(GEO_KEY, driverId);
  if (!pos || !pos[0]) {
    return null; 
  }
  const [lng, lat] = pos[0]; 
  return { latitude: parseFloat(lng), longitude: parseFloat(lat) };
}