import { Socket } from "socket.io";
import { IResponse, StatusCode } from "../../types/common";
import { IDriverLocationController } from "../interfaces/i-driver-location-controller";
import { IDriverLocationService } from "../../services/interfaces/i-driver-location-service";

export class DriverLocationController implements IDriverLocationController {
  constructor(private _driverLocationService: IDriverLocationService) {}

  async handleDriverHeartbeat(driverId: string): Promise<IResponse<null>> {
    try {
      const response = await this._driverLocationService.handleDriverHeartbeat(
        driverId
      );

      return response;
    } catch (error) {
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to record driver heartbeat: ${
          (error as Error).message
        }`,
      };
    }
  }

  async handleDriverLocationUpdate(
    socket: Socket,
    driverId: string,
    loc: { latitude: number; longitude: number; userId:string},
    isOnRide?: boolean
  ): Promise<IResponse<null>> {
    try {
      const response = await this._driverLocationService.handleDriverLocationUpdate(
          socket,
          driverId,
          loc,
          isOnRide
        );

      return response;
    } catch (error) {
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to updated driver location: ${
          (error as Error).message
        }`,
      };
    }
  }
}
