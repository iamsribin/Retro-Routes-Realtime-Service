import { IPaymentService } from "../../services/interfaces/i-payment-service";

export class PaymentController {
  constructor(private _paymentService: IPaymentService) {}

  async notifyDriverForPaymentConformation(data) {
    try {
      this._paymentService.notifyDriverAndUserPaymentCompleted(data);
    } catch (error) {
      console.log("====", error);
    }
  }
}
