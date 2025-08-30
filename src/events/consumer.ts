import { createRabbit } from "../config/rabbitmq";
import { RideController } from "../controller/implementation/ride-controller";
import { BookingRequestPayload } from "../types/booking-types";
import { RabbitMQPublisher } from "./publisher";

export class Consumer {
  ch: any;
  constructor(private _rideController: RideController) {}

  async start() {
    const { conn, ch } = await createRabbit();
    this.ch = ch;

    // Initialize RabbitMQ publisher
    await RabbitMQPublisher.initialize(ch);

    console.log("🚀 Realtime service started with RabbitMQ consumers");

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
