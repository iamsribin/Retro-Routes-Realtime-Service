import { getIo } from "../../socket";
import { IDriverLocationService } from "../interfaces/i-driver-location-service";
import { IResponse, StatusCode } from "../../types/common";
import { Socket } from "socket.io";
import { IRedisRepository } from "../../repository/interfaces/i-redis-repository";

export class DriverLocationService implements IDriverLocationService {
    constructor(private _realTimeRepo: IRedisRepository){}

//   async updateDriverLocationChangeToUser(data: {
//     userId: string;
//     driverId: string;
//     latitude: number;
//     longitude: number;
//   }): Promise<IResponse<null>> {
//     try {
//       const io = getIo();
//       const userRoom = `user:${data.userId}`;
//       const driverData = {
//         driverId: data.driverId,
//         coordinates: {
//           latitude: data.latitude,
//           longitude: data.longitude,
//         },
//       };
//       console.log("driver:location:change user:", driverData);
//       io.to(userRoom).emit("driver:location:change", driverData);
//       return {
//         status: StatusCode.Accepted,
//         message: "Driver location change emitted to user",
//       };
//     } catch (error) {
//       console.error("Error updating driver location to user:", error);
//       return {
//         status: StatusCode.InternalServerError,
//         message: `Failed to update driver location to user: ${
//           (error as Error).message
//         }`,
//       };
//     }
//   }

 async handleDriverHeartbeat(driverId: string): Promise<IResponse<null>> {
    try {
      await this._realTimeRepo.setHeartbeat(driverId, 120);
      return {
        status: StatusCode.Accepted,
        message: "Driver heartbeat recorded",
      };
    } catch (error) {
      console.error("Error handling driver heartbeat:", error);
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to record driver heartbeat: ${(error as Error).message}`,
      };
    }
  }

    async handleDriverLocationUpdate(
    socket: Socket,
    driverId: string,
    loc: { latitude: number; longitude: number },
    isOnRide: boolean = false
  ): Promise<IResponse<null>> {
    try {
      await this._realTimeRepo.addDriverGeo(driverId, loc.latitude, loc.longitude, isOnRide);
      if (isOnRide) {
        const io = getIo();
        const userRoom = `user:${socket.data.userId || ""}`;
        const driverData = {
          driverId,
          coordinates: loc,
        };
        io.to(userRoom).emit("driver:location:change", driverData);
      }
      return {
        status: StatusCode.Accepted,
        message: "Driver location updated",
      };
    } catch (error) {
      console.error("Error handling driver location update:", error);
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to update driver location: ${(error as Error).message}`,
      };
    }
  }
}
