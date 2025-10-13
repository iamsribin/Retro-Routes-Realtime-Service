import { getIo } from "../../socket";
import { IPaymentService } from "../interfaces/i-payment-service";

export class PaymentService implements IPaymentService {
  notifyDriverAndUserPaymentCompleted(payload: any) {
    try {
      const io = getIo();
      const driverRoom = `driver:${payload.driverId}`;
      const userRoom = `user:${payload.userId}`;

      io.to(driverRoom).emit("payment:conformation", {data:payload,user:false});
      io.to(userRoom).emit("payment:conformation", {data:payload,user:true});
    } catch (error) {
      console.log("err", error);
    }
  }
}
