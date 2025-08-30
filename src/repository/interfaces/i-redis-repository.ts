import { DriverDetails, BookingRequestPayload, RideRequest} from "../../types/booking-types";

export interface IRedisRepository {
  addDriverGeo(driverId: string, latitude: number, longitude: number, isOnRide?: boolean): Promise<void>;
  setHeartbeat(driverId: string, ttl: number): Promise<void>;
  getDriverDetails(driverId: string): Promise<DriverDetails | null>;
  getDriverGeo(driverId: string): Promise<{ latitude: number; longitude: number } | null>;
  isDriverOnline(driverId: string): Promise<boolean>;
  removeOnlineDriver(driverId: string): Promise<void>;
  setDriverDetails(details: DriverDetails, isOnRide: boolean): Promise<void>;
  storeBookingState(bookingId: string, state: BookingRequestPayload, ttl: number): Promise<void>;
  getBookingState(bookingId: string): Promise<BookingRequestPayload | null>;
  updateBookingState(bookingId: string, state: BookingRequestPayload, ttl: number): Promise<void>;
  deleteBookingState(bookingId: string): Promise<void>;
  storeDriverRequest(driverId: string, bookingId: string, request: RideRequest, ttl: number): Promise<void>;
  markProcessed(requestId: string, ttlSeconds?:number):Promise<boolean>
}