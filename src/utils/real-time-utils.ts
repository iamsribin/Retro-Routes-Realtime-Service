import { redis } from "../config/redis";
import { DriverDetails, RideRequest, BookingRequestPayload } from "../types/booking-types";
import { getIo } from "../socket";

export function createRideRequest(driver: DriverDetails, bookingState: BookingRequestPayload): RideRequest {
  return {
    customer: {
      userId: bookingState.user.userId,
      userName: bookingState.user.userName,
      userProfile: bookingState.user.userProfile,
      userNumber: bookingState.user.userNumber,
    },
    bookingDetails: {
      rideId: bookingState.rideId,
      bookingId: bookingState.bookingId,
      createdAt: bookingState.createdAt,
      dropoffLocation: bookingState.dropCoordinates,
      pickupLocation: bookingState.pickupCoordinates,
      estimatedDistance: bookingState.distance,
      estimatedDuration: bookingState.estimatedDuration,
      fareAmount: bookingState.price,
      securityPin: bookingState.pin,
      status: bookingState.status,
      vehicleType: driver.vehicleModel,
    },
    requestTimeout: bookingState.timeoutSeconds,
  };
}

export async function sendRideRequestToDriver(driverId: string, bookingId: string, rideRequest: RideRequest): Promise<void> {
  const io = getIo();
  const driverRoom = `driver:${driverId}`;
  await redis.set(`driver:request:${driverId}:${bookingId}`, JSON.stringify(rideRequest), "EX", 60);
  io.to(driverRoom).emit("ride:request", rideRequest);
}