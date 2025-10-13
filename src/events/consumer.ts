import { createRabbit } from "../config/rabbitmq";
import { PaymentController } from "../controller/implementation/payment-controllet";
import { RideController } from "../controller/implementation/ride-controller";
import {
  BookingRequestPayload,
  cancelRideReq,
  rideCompletedReq,
} from "../types/booking-types";
import { RabbitMQPublisher } from "./publisher";

export class Consumer {
  ch: any;
  constructor(private _rideController: RideController, private _paymentController: PaymentController) {}

  async start() {
    const { conn, ch } = await createRabbit();
    this.ch = ch;

    // Initialize RabbitMQ publisher
    await RabbitMQPublisher.initialize(ch);

    console.log("🚀 Realtime service started with RabbitMQ consumers");

    await ch.consume("realtime.payment_completed", async (msg) => {
      if (!msg) return;
      try {
        const raw = msg.content.toString();
        const payload = JSON.parse(raw);
        console.log("realtime.payment_completed", payload);

        await this._paymentController.notifyDriverForPaymentConformation(payload)
        ch.ack(msg);
      } catch (err) {
        console.error("❌ pending_confirmation handler error:", err);
        ch.nack(msg, false, false); // DLQ
      }
    });

    await ch.consume("realtime.bookingRequest", async (msg) => {
      if (!msg) return;
      try {
        const raw = msg.content.toString();
        const payload: BookingRequestPayload = JSON.parse(raw);
        console.log("realtime.bookingRequest payload:", payload);
        await this._rideController.handleBookingRequest(payload);
        ch.ack(msg);
      } catch (err) {
        console.error("❌ BookingRequest handler error:", err);
        ch.nack(msg, false, false); // Send to DLQ
      }
    });

    await ch.consume("realtime.driverStartRide", async (msg) => {
      if (!msg) return;
      try {
        const raw = msg.content.toString();
        const payload: BookingRequestPayload = JSON.parse(raw);
        console.log("realtime.driverStartRide payload:", payload);
        await this._rideController.driverStartRideNotify(payload);
        ch.ack(msg);
      } catch (err) {
        console.error("❌ BookingRequest handler error:", err);
        ch.nack(msg, false, false); // Send to DLQ
      }
    });

    await ch.consume("realtime.cancelRide", async (msg) => {
      if (!msg) return;
      const raw = msg.content.toString();
      const payload: cancelRideReq = JSON.parse(raw);
      console.log("cancel ride msg:", payload);
      this._rideController.cancelRide(payload);
      try {
        ch.ack(msg);
      } catch (err) {
        console.error("❌ cancel ride error:", err);
        ch.nack(msg, false, false);
      }
    });
    // realtime.rideCompleted
    await ch.consume("realtime.rideCompleted", async (msg) => {
      if (!msg) return;
      const raw = msg.content.toString();
      const payload: rideCompletedReq = JSON.parse(raw);
      console.log("rideCompleted ride msg:", payload);
      this._rideController.rideCompleted(payload);
      try {
        ch.ack(msg);
      } catch (err) {
        console.error("❌ cancel ride error:", err);
        ch.nack(msg, false, false);
      }
    });
    // DriverDocExpired consumer - handles driver document expiration
    await ch.consume("realtime.driverDocExpired", async (msg) => {
      if (!msg) return;
      try {
        ch.ack(msg);
      } catch (err) {
        console.error("❌ DriverDocExpired handler error:", err);
        ch.nack(msg, false, false);
      }
    });
  }

  // Graceful shutdown
  async stop() {
    try {
      if (this.ch) {
        await this.ch.close();
        console.log("✅ RabbitMQ channel closed");
      }
    } catch (error) {
      console.error("❌ Error stopping realtime service:", error);
    }
  }
}
