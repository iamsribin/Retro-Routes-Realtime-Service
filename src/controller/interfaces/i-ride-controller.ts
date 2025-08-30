import { Socket } from "socket.io";
import { IResponse } from "../../types/common";
import { BookingRequestPayload } from "../../types/booking-types";
import { RealTimeResponseDTO } from "../../dto/real-time.dto";

export interface IRideController {
  handleBookingRequest(payload: BookingRequestPayload): Promise<IResponse<null>>;
  handleDriverAcceptance(bookingId: string, driverId: string): Promise<IResponse<RealTimeResponseDTO>>;
  handleDriverRejection(bookingId: string, driverId: string): Promise<IResponse<null>>;
//   handleDriverLocationUpdate(socket: Socket, driverId: string, loc: { latitude: number; longitude: number }, isOnRide?: boolean): Promise<IResponse<null>>;
//   handleDriverHeartbeat(driverId: string): Promise<IResponse<null>>;
}