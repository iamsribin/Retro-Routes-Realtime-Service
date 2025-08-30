import { 
  redis,
  GEO_KEY,
  GEO_KEY_RIDE,
  HEARTBEAT_PREFIX,
  DRIVER_DETAILS_PREFIX,
  RIDE_DRIVER_DETAILS_PREFIX,
  BOOKING_REQUEST_PREFIX,
  DRIVER_REQUEST_PREFIX,
  PROCESSED_PREFIX
} from "../../config/redis";
import { DriverDetails, BookingRequestPayload, RideRequest } from "../../types/booking-types";
import { IRedisRepository } from "../interfaces/i-redis-repository";

export class RedisRepository implements IRedisRepository {
  async addDriverGeo(driverId: string, latitude: number, longitude: number, isOnRide = false): Promise<void> {
    try {
      const key = isOnRide ? GEO_KEY_RIDE : GEO_KEY;
      await redis.geoadd(key, longitude, latitude, driverId);
      // await redis.set(`${key}:${driverId}`, JSON.stringify({ latitude, longitude }), "EX", 60 * 10);
    } catch (error) {
      console.error("Error adding driver geo:", error);
      throw new Error(`Failed to add driver geo: ${(error as Error).message}`);
    }
  }

  async setHeartbeat(driverId: string, ttl: number): Promise<void> {
    try {
      await redis.set(`${HEARTBEAT_PREFIX}${driverId}`, "1", "EX", ttl);
    } catch (error) {
      console.error("Error setting heartbeat:", error);
      throw new Error(`Failed to set heartbeat: ${(error as Error).message}`);
    }
  }

  async getDriverDetails(driverId: string, isOnRide = false): Promise<DriverDetails | null> {
    try {
      const prefix = isOnRide ? RIDE_DRIVER_DETAILS_PREFIX : DRIVER_DETAILS_PREFIX;
      const details = await redis.get(`${prefix}${driverId}`);
      return details ? JSON.parse(details) : null;
    } catch (error) {
      console.error("Error getting driver details:", error);
      throw new Error(`Failed to get driver details: ${(error as Error).message}`);
    }
  }

  async getDriverGeo(driverId: string, isOnRide = false): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const key = isOnRide ? GEO_KEY_RIDE : GEO_KEY;
  const pos = await redis.geopos(key, driverId);
  if (!pos || !pos[0]) {
    return null;
  }
  const [lng, lat] = pos[0];
  return { latitude: parseFloat(lat), longitude: parseFloat(lng) };
    } catch (error) {
      console.error("Error getting driver geo:", error);
      throw new Error(`Failed to get driver geo: ${(error as Error).message}`);
    }
  }

  async isDriverOnline(driverId: string): Promise<boolean> {
    try {
    const key = `${HEARTBEAT_PREFIX}${driverId}`;
  const val = await redis.get(key);
  return !!val;
    } catch (error) {
      console.error("Error checking driver online status:", error);
      throw new Error(`Failed to check driver online status: ${(error as Error).message}`);
    }
  }

  async removeOnlineDriver(id: string, isOnRide = false): Promise<void> {
    try {
      const keyPrefix = isOnRide ? GEO_KEY_RIDE : GEO_KEY;
     const key = `${HEARTBEAT_PREFIX}${id}`;
    const detailsKey = `${keyPrefix}${id}`;
    await redis.del([key, detailsKey]);
    await redis.zrem(GEO_KEY, id);
    } catch (error) {
      console.error("Error removing online driver:", error);
      throw new Error(`Failed to remove online driver: ${(error as Error).message}`);
    }
  }

  async setDriverDetails(details: DriverDetails, isOnRide = false,ttlSeconds=120): Promise<void> {
    try {
      const prefix = isOnRide ? RIDE_DRIVER_DETAILS_PREFIX : DRIVER_DETAILS_PREFIX;

  const key = `${prefix}${details.driverId}`;
  await redis.set(key, JSON.stringify(details), "EX", ttlSeconds);    } catch (error) {
      console.error("Error setting driver details:", error);
      throw new Error(`Failed to set driver details: ${(error as Error).message}`);
    }
  }

  async storeBookingState(bookingId: string, state: BookingRequestPayload, ttl: number): Promise<void> {
    try {
      await redis.set(`${BOOKING_REQUEST_PREFIX}${bookingId}`, JSON.stringify(state), "EX", ttl);
    } catch (error) {
      console.error("Error storing booking state:", error);
      throw new Error(`Failed to store booking state: ${(error as Error).message}`);
    }
  }

  async getBookingState(bookingId: string): Promise<BookingRequestPayload | null> {
    try {
      const state = await redis.get(`${BOOKING_REQUEST_PREFIX}${bookingId}`);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error("Error getting booking state:", error);
      throw new Error(`Failed to get booking state: ${(error as Error).message}`);
    }
  }

  async updateBookingState(bookingId: string, state: BookingRequestPayload, ttl: number): Promise<void> {
    try {
      await redis.set(`${BOOKING_REQUEST_PREFIX}${bookingId}`, JSON.stringify(state), "EX", ttl);
    } catch (error) {
      console.error("Error updating booking state:", error);
      throw new Error(`Failed to update booking state: ${(error as Error).message}`);
    }
  }

  async deleteBookingState(bookingId: string): Promise<void> {
    try {
      await redis.del(`${BOOKING_REQUEST_PREFIX}${bookingId}`);
    } catch (error) {
      console.error("Error deleting booking state:", error);
      throw new Error(`Failed to delete booking state: ${(error as Error).message}`);
    }
  }

  async storeDriverRequest(driverId: string, bookingId: string, request: RideRequest, ttl: number): Promise<void> {
    try {
      await redis.set(`${DRIVER_REQUEST_PREFIX}${driverId}:${bookingId}`, JSON.stringify(request), "EX", ttl);
    } catch (error) {
      console.error("Error storing driver request:", error);
      throw new Error(`Failed to store driver request: ${(error as Error).message}`);
    }
  }

  async markProcessed(requestId: string, ttlSeconds = 60 * 10): Promise<boolean> {
    if (!requestId) return false;
    const key = `${PROCESSED_PREFIX}${requestId}`;
    const added = await redis.setnx(key, "1");
    if (added === 1) {
      await redis.expire(key, ttlSeconds);
      return true;
    }
    return false;
  }
}
