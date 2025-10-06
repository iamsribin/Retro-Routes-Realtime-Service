import { IRideController } from "../interfaces/i-ride-controller";
import { IRideService } from "../../services/interfaces/i-real-time-service";
import { IResponse, StatusCode } from "../../types/common";
import {
  BookingRequestPayload,
  cancelRideReq,
  rideCompletedReq,
} from "../../types/booking-types";
import { RealTimeResponseDTO } from "../../dto/real-time.dto";

export class RideController implements IRideController {
  constructor(private _rideService: IRideService) {}

  async driverStartRideNotify(payload) {
    try {
      this._rideService.driverStartRideNotify(payload);
    } catch (error) {
      console.log("error==", error);
    }
  }

  async handleBookingRequest(
    payload: BookingRequestPayload
  ): Promise<IResponse<null>> {
    try {
      const response = await this._rideService.handleBookingRequest(payload);
      return response;
    } catch (error) {
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to record booking request: ${
          (error as Error).message
        }`,
      };
    }
  }

  async handleDriverAcceptance(
    bookingId: string,
    driverId: string
  ): Promise<IResponse<RealTimeResponseDTO>> {
    try {
      const response = await this._rideService.handleDriverAcceptance(
        bookingId,
        driverId
      );

      return response;
    } catch (error) {
      console.log(error);

      return {
        status: StatusCode.InternalServerError,
        message: `Failed to record driver acceptance: ${
          (error as Error).message
        }`,
      };
    }
  }

  async handleDriverRejection(
    bookingId: string,
    driverId: string
  ): Promise<IResponse<null>> {
    try {
      const response = await this._rideService.handleDriverRejection(
        bookingId,
        driverId
      );

      return response;
    } catch (error) {
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to record driver rejection: ${
          (error as Error).message
        }`,
      };
    }
  }

  async cancelRide(data: cancelRideReq) {
    try {
      this._rideService.cancelRide(data);
    } catch (error) {
      console.log(error);
    }
  }

  async rideCompleted(rideCompletedPayload: rideCompletedReq) {
    try {
      this._rideService.rideCompleted(rideCompletedPayload);
    } catch (err) {
      console.log(err);
    }
  }
}
