import { RideRequestManager } from "../manager/ride-request-manager";
import { getIo } from "../socket";
import { BookingRequestPayload } from "../types/booking-types";
import { markProcessed } from "../utils/idempotency";

export class RideController {
  private _rideRequestManager: RideRequestManager;

  constructor() {
    this._rideRequestManager = RideRequestManager.getInstance();
  }
  async handleBookingRequest(payload: BookingRequestPayload) {
    try {
      // Idempotency check
      if (!payload || !payload.requestId) {
        throw new Error("Invalid payload: missing requestId");
      }

      const isFirstTime = await markProcessed(payload.requestId);
      if (!isFirstTime) {
        console.log(`⚠️  Duplicate booking request: ${payload.requestId}`);
        return;
      }

      // Validate payload
      if (!payload.bookingId) {
        throw new Error("Invalid payload: missing bookingId");
      }

      await this._rideRequestManager.handleBookingRequest(payload);
    } catch (error) {
      console.error("❌ Error handling booking request:", error);
      throw error;
    }
  }

    // Method to handle driver acceptance from socket
  async handleDriverAcceptance(
    bookingId: string,
    driverId: string
  ): Promise<boolean> {
    return await this._rideRequestManager.handleDriverAcceptance(
      bookingId,
      driverId
    );
  }

  // Method to handle driver rejection from socket
  async handleDriverRejection(
    bookingId: string,
    driverId: string
  ): Promise<void> {
    await this._rideRequestManager.handleDriverRejection(bookingId, driverId);
  }

//     async handleDriverDocExpired(payload: any) {
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
}
