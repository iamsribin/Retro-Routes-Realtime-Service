import Redis from "ioredis";
const REDIS_URL = process.env.REDIS_URL as string;
console.log({ REDIS_URL });

export const redis = new Redis(REDIS_URL);
// export const GEO_KEY = "onlineDrivers:geo";
// export const GEO_KEY_RIDE = "rideDrivers:geo";
// export const HEARTBEAT_PREFIX = "driver:heartbeat:";
// export const LOCK_PREFIX = "lock:booking:";
// export const DRIVER_DETAILS_PREFIX = ":onlineDriver:details:";
// export const RIDE_DRIVER_DETAILS_PREFIX = ":rideDriver:details:";

// Keys & prefixes
export const GEO_KEY = "onlineDrivers:geo";
export const GEO_KEY_RIDE = "rideDrivers:geo";
export const HEARTBEAT_PREFIX = "driver:heartbeat:";
export const DRIVER_DETAILS_PREFIX = ":onlineDriver:details:";
export const RIDE_DRIVER_DETAILS_PREFIX = ":rideDriver:details:";
export const BOOKING_REQUEST_PREFIX = "booking:request:";
export const DRIVER_REQUEST_PREFIX = "driver:request:";
export const PROCESSED_PREFIX = "processed:";
export const LOCK_PREFIX = "lock:booking:";


export async function setHeartbeat(driverId: string, ttlSeconds = 120) {
  const key = `${HEARTBEAT_PREFIX}${driverId}`;
  await redis.set(key, Date.now().toString(), "EX", ttlSeconds);
}

export async function isDriverOnline(driverId: string) {
  const key = `${HEARTBEAT_PREFIX}${driverId}`;
  const val = await redis.get(key);
  return !!val;
}

export async function removeOnlineDriver(id: string, isRide: boolean = false) {
  try {
    let keyPrefix = DRIVER_DETAILS_PREFIX;
    if (isRide) keyPrefix = RIDE_DRIVER_DETAILS_PREFIX;

    const key = `${HEARTBEAT_PREFIX}${id}`;
    const detailsKey = `${keyPrefix}${id}`;
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
  isRide: boolean = false,
  ttlSeconds = 120,
) {
  let keyPrefix = DRIVER_DETAILS_PREFIX;
  if (isRide) keyPrefix = RIDE_DRIVER_DETAILS_PREFIX;

  const key = `${keyPrefix}${driverDetails.driverId}`;
  await redis.set(key, JSON.stringify(driverDetails), "EX", ttlSeconds);
  const data = await getDriverDetails(driverDetails.driverId);
  console.log("stored ride driverDetails", data);
}

export async function getDriverDetails(
  driverId: string,
  isRide: boolean = false
) {
  try {
    let keyPrefix = DRIVER_DETAILS_PREFIX;
    if (isRide) keyPrefix = RIDE_DRIVER_DETAILS_PREFIX;

    const key = `${keyPrefix}${driverId}`;
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error(`Failed to get driver details for driver ${driverId}:`, err);
    throw err;
  }
}

export async function addDriverGeo(
  driverId: string,
  lng: number,
  lat: number,
  isRide: boolean = false
) {
  let key = GEO_KEY;
  if (isRide) key = GEO_KEY_RIDE;
  await redis.geoadd(key, lng, lat, driverId);
}

export async function getDriverGeo(driverId: string, isRide: boolean = false) {
  let key = GEO_KEY;
  if (isRide) key = GEO_KEY_RIDE;

  const pos = await redis.geopos(key, driverId);
  if (!pos || !pos[0]) {
    return null;
  }
  const [lng, lat] = pos[0];
  return { latitude: parseFloat(lat), longitude: parseFloat(lng) };
}
