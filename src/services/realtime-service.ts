// import { createRabbit, RabbitMQPublisher } from "../config/rabbitmq";
// import { getIo } from "../socket";
// import { markProcessed } from "../utils/idempotency";
// import { RideRequestManager } from "../manager/ride-request-manager";
// import { BookingRequestPayload } from "../types/booking-types";

// export class RealtimeService {
//   ch: any;
//   private rideRequestManager: RideRequestManager;

//   constructor() {
//     this.rideRequestManager = RideRequestManager.getInstance();
//   }

//   async start() {
//     const { conn, ch } = await createRabbit();
//     this.ch = ch;

//     // Initialize RabbitMQ publisher
//     await RabbitMQPublisher.initialize(ch);

//     console.log("🚀 Realtime service started with RabbitMQ consumers");

//     // BookingRequest consumer - handles new ride requests
//     await ch.consume("realtime.bookingRequest", async (msg) => {
//       if (!msg) return;
//       try {
//         console.log("realtime.bookingRequest msg:", msg);

//         const raw = msg.content.toString();
//         const payload: BookingRequestPayload = JSON.parse(raw);
//         console.log("realtime.bookingRequest payload:", payload);

//         await this.handleBookingRequest(payload);
//         ch.ack(msg);
//       } catch (err) {
//         console.error("❌ BookingRequest handler error:", err);
//         ch.nack(msg, false, false); // Send to DLQ
//       }
//     });

//     // DriverDocExpired consumer - handles driver document expiration
//     await ch.consume("realtime.driverDocExpired", async (msg) => {
//       if (!msg) return;
//       try {
//         const payload = JSON.parse(msg.content.toString());
//         await this.handleDriverDocExpired(payload);
//         ch.ack(msg);
//       } catch (err) {
//         console.error("❌ DriverDocExpired handler error:", err);
//         ch.nack(msg, false, false);
//       }
//     });
//   }

//   async handleBookingRequest(payload: BookingRequestPayload) {
//     try {
//       // Idempotency check
//       if (!payload || !payload.requestId) {
//         throw new Error("Invalid payload: missing requestId");
//       }

//       const isFirstTime = await markProcessed(payload.requestId);
//       if (!isFirstTime) {
//         console.log(`⚠️  Duplicate booking request: ${payload.requestId}`);
//         return;
//       }

//       console.log(
//         `📥 Received booking request: ${payload.bookingId} with ${payload.drivers.length} drivers`
//       );

//       // Validate payload
//       if (!payload.bookingId) {
//         throw new Error("Invalid payload: missing bookingId");
//       }

//       // if (
//       //   !Array.isArray(payload.drivers) ||
//       //   payload.drivers.length === 0
//       // ) {
//       //   console.log(`😞 No driver drivers for booking ${payload.bookingId}`);

//       //   // Immediately notify booking service about no drivers
//       //   await RabbitMQPublisher.publish("booking.status.update", {
//       //     bookingId: payload.bookingId,
//       //     requestId: payload.requestId,
//       //     status: "cancelled",
//       //     reason: "no_drivers_available",
//       //     timestamp: new Date(),
//       //   });

//       //   // Notify user
//       //   const io = getIo();
//       //   const userRoom = `user:${payload.user.userId}`;
//       //   io.to(userRoom).emit("booking:no_drivers", {
//       //     bookingId: payload.bookingId,
//       //     message:
//       //       "Currently no drivers are available. Please try again later.",
//       //   });

//       //   return;
//       // }

//       // Transform the payload to include proper structure

//       const bookingRequestPayload: BookingRequestPayload = {
//         bookingId: payload.bookingId,
//         rideId: payload.rideId,
//         requestId: payload.requestId,
//         user: payload.user,
//         pickupCoordinates: payload.pickupCoordinates,
//         dropCoordinates: payload.dropCoordinates,
//         distance: payload.distance,
//         price: payload.price,
//         pin: payload.pin,
//         drivers: payload.drivers,
//         estimatedDuration: payload.estimatedDuration,
//         timeoutSeconds: payload.timeoutSeconds || 30,
//         createdAt: new Date(),
//       };

//       // Delegate to ride request managerd
//       await this.rideRequestManager.handleBookingRequest(bookingRequestPayload);
//     } catch (error) {
//       console.error("❌ Error handling booking request:", error);
//       throw error;
//     }
//   }

//   async handleDriverDocExpired(payload: any) {
//     try {
//       if (!payload || !payload.requestId) {
//         throw new Error("Invalid payload: missing requestId");
//       }

//       const isFirstTime = await markProcessed(payload.requestId);
//       if (!isFirstTime) {
//         console.log(`⚠️  Duplicate driver doc expired: ${payload.requestId}`);
//         return;
//       }

//       console.log(`📄 Driver document expired: ${payload.driverId}`);

//       const io = getIo();
//       const driverRoom = `driver:${payload.driverId}`;

//       // Emit doc expired notification to driver
//       io.to(driverRoom).emit("driver:doc:expired", {
//         driverId: payload.driverId,
//         expiredFields: payload.expiredFields || [],
//         message:
//           "One or more documents expired. Please update to continue receiving ride requests.",
//         severity: "warning",
//         timestamp: new Date(),
//       });

//       // Optionally notify admin
//       io.to("admin").emit("driver:doc:expired", {
//         driverId: payload.driverId,
//         expiredFields: payload.expiredFields || [],
//         timestamp: new Date(),
//       });

//       console.log(
//         `✅ Notified driver ${payload.driverId} about expired documents`
//       );
//     } catch (error) {
//       console.error("❌ Error handling driver doc expired:", error);
//       throw error;
//     }
//   }

//   // Method to handle driver acceptance from socket
//   async handleDriverAcceptance(
//     bookingId: string,
//     driverId: string
//   ): Promise<boolean> {
//     return await this.rideRequestManager.handleDriverAcceptance(
//       bookingId,
//       driverId
//     );
//   }

//   // Method to handle driver rejection from socket
//   async handleDriverRejection(
//     bookingId: string,
//     driverId: string
//   ): Promise<void> {
//     await this.rideRequestManager.handleDriverRejection(bookingId, driverId);
//   }

//   // Graceful shutdown
//   async stop() {
//     try {
//       if (this.ch) {
//         await this.ch.close();
//         console.log("✅ RabbitMQ channel closed");
//       }
//     } catch (error) {
//       console.error("❌ Error stopping realtime service:", error);
//     }
//   }
// }
