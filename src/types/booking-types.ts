// types/booking-types.ts
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address: string;
}

export interface UserInfo {
  userId: string;
  userName: string;
  userNumber: string;
  userProfile: string;
}

export interface DriverDetails {
  driverId: string;
  distance: number;
  rating: number;
  cancelCount: number;
  score: number;
  vehicleModel?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhoto?: string;
  phoneNumber?: string;
}

export interface BookingRequestPayload {
  bookingId: string;
  rideId: string;
  requestId: string;
  user: UserInfo;
  pickupCoordinates: LocationCoordinates;
  dropCoordinates: LocationCoordinates;
  distance: string;
    estimatedDuration:string;

  price: number;
  pin: number;
  drivers: DriverDetails[];
  timeoutSeconds?: number;
  createdAt: Date;
}

export interface bookingState {
  bookingId: string;
  rideId: string;
  requestId: string;
  user: UserInfo;
  pickupCoordinates: LocationCoordinates;
  dropCoordinates: LocationCoordinates;
  distance: string;
    estimatedDuration:string;

  price: number;
  pin: number;
  drivers: DriverDetails[];
  timeoutSeconds?: number;
  createdAt: Date;
  currentDriverIndex: number;
  processedDrivers: [];
  status: string;
}
// interface RideDetails {
//   rideId: string;
//   estimatedDistance: string;
//   estimatedDuration: string;
//   fareAmount: number;
//   vehicleType: string;
//   securityPin: number;
// }

interface BookingDetails {
  bookingId: string;
  rideId: string;
  estimatedDistance: string;
  estimatedDuration: string;
  fareAmount: number;
  vehicleType: string;
  securityPin: number;
  pickupLocation: LocationCoordinates;
  dropoffLocation: LocationCoordinates;
  status: string;
  createdAt: Date;
}

export interface RideRequest {
  customer: UserInfo;
  bookingDetails: BookingDetails;
  requestTimeout: number;
}

export interface DriverTimeoutPayload {
  driverId: string;
  bookingId: string;
  requestId: string;
  reason: "timeout" | "rejection";
  timestamp: Date;
}

export interface BookingStatusPayload {
  bookingId: string;
  requestId: string;
  status: "cancelled" | "assigned" | "pending";
  driverId?: string;
  reason?: string;
  timestamp: Date;
}

export interface DriverAssignmentPayload {
  bookingId: string;
  requestId: string;
  driverId: string;
  driver: DriverDetails;
  timestamp: Date;
}

export interface UserNotificationPayload {
  userId: string;
  bookingId: string;
  type: "driver_assigned" | "no_drivers_available" | "booking_cancelled";
  message: string;
  data?: any;
  timestamp: Date;
}
