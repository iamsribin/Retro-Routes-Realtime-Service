import { Socket } from "socket.io";
import { BookingRequestPayload, DriverDetails, RideRequest, DriverTimeoutPayload, DriverAssignmentPayload } from "../../types/booking-types";
import { IResponse, StatusCode } from "../../types/common";
import { RealTimeResponseDTO } from "../../dto/real-time.dto";

export interface IRideService {
  handleBookingRequest(payload: BookingRequestPayload): Promise<IResponse<null>>;
  handleDriverAcceptance(bookingId: string, driverId: string): Promise<IResponse<RealTimeResponseDTO>>;
  handleDriverRejection(bookingId: string, driverId: string): Promise<IResponse<null>>;
//   handleDriverLocationUpdate(socket: Socket, driverId: string, loc: { latitude: number; longitude: number }, isOnRide?: boolean): Promise<IResponse<null>>;
//   handleDriverHeartbeat(driverId: string): Promise<IResponse<null>>;
}