import { getIo } from "../../socket";
import { IPaymentService } from "../interfaces/i-payment-service";

export class PaymentService implements IPaymentService {
  notifyDriverForPaymentConformation(payload: any) {
    try {
      const io = getIo();
      const driverRoom = `driver:${payload.driverId}`;
      console.log("driverRoom",driverRoom,"==", payload);

      io.to(driverRoom).emit("driver:payment:conformation", payload);
    } catch (error) {
      console.log("err", error);
    }
  }
}
