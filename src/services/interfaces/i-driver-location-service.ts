import { Socket } from "socket.io";
import { IResponse } from "../../types/common";

export interface IDriverLocationService {
//   updateDriverLocationChangeToUser(data: {
//     userId: string;
//     driverId: string;
//     latitude: number;
//     longitude: number;
//   }): Promise<IResponse<null>>;
  handleDriverHeartbeat(driverId: string): Promise<IResponse<null>>;
  handleDriverLocationUpdate(
    socket: Socket,
    driverId: string,
    loc: { latitude: number; longitude: number },
    isOnRide: boolean,
  ): Promise<IResponse<null>>;
}
