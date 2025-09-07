import { Socket } from "socket.io";
import { BookingRequestPayload, DriverDetails, RideRequest, DriverTimeoutPayload, DriverAssignmentPayload, DriverRideStartPayload, cancelRideReq } from "../../types/booking-types";
import { IResponse, StatusCode } from "../../types/common";
import { RealTimeResponseDTO } from "../../dto/real-time.dto";

export interface IRideService {
  driverStartRideNotify(payload:DriverRideStartPayload):Promise<void>
  handleBookingRequest(payload: BookingRequestPayload): Promise<IResponse<null>>;
  handleDriverAcceptance(bookingId: string, driverId: string): Promise<IResponse<RealTimeResponseDTO>>;
  handleDriverRejection(bookingId: string, driverId: string): Promise<IResponse<null>>;
  cancelRide(cancelData:cancelRideReq) : Promise<void>
  //   handleDriverLocationUpdate(socket: Socket, driverId: string, loc: { latitude: number; longitude: number }, isOnRide?: boolean): Promise<IResponse<null>>;
//   handleDriverHeartbeat(driverId: string): Promise<IResponse<null>>;
}