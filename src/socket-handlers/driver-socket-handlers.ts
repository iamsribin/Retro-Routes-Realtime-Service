// socket-handlers/driver-socket-handlers.ts
import { Socket, Server } from "socket.io";
import { setHeartbeat, addDriverGeo, getDriverDetails } from "../config/redis";
import { RideController } from "../controller/ride-controller";
// import { RealtimeService } from "../services/realtime-service";

export function handleDriverSocket(socket: Socket, payload: any, io: Server) {
  const { role, id } = payload || {};

  if (!role || !id) {
    socket.disconnect(true);
    return;
  }

  // Join driver to a driver room
  const driverRoom = `driver:${id}`;
  socket.join(driverRoom);
  socket.data = { id, role };

  console.log(`🚗 Driver ${id} connected and joined room: ${driverRoom}`);

  // Get realtime service instance (you'll need to pass this or make it singleton)
  // const realtimeService = new RealtimeService();
  const rideController = new RideController();

  // Listen for location updates
  socket.on("location:update", async (loc) => {
    try {
      console.log("📍 Location update from driver:", id, loc);

      if (
        !loc ||
        typeof loc.latitude !== "number" ||
        typeof loc.longitude !== "number"
      ) {
        socket.emit("booking:accept:result", {
          success: false,
          error: "Booking no longer available or already assigned",
        });
      }
    } catch (err) {
      console.error("❌ Booking accept error:", err);
      socket.emit("booking:accept:result", {
        success: false,
        error: "Server error while accepting booking",
      });
    }
  });

  // Listen for ride rejection
  socket.on("booking:reject", async (data) => {
    try {
      const { bookingId, requestId, reason } = data;
      console.log(
        `❌ Driver ${id} rejected booking ${bookingId}, reason: ${
          reason || "not specified"
        }`
      );

      if (!bookingId) {
        socket.emit("booking:reject:result", {
          success: false,
          error: "bookingId is required",
        });
        return;
      }

      // Use realtime service to handle rejection
      await rideController.handleDriverRejection(bookingId, id);

      socket.emit("booking:reject:result", {
        success: true,
        bookingId,
        message: "Ride rejected successfully",
      });

      console.log(`✅ Driver ${id} successfully rejected booking ${bookingId}`);
    } catch (err) {
      console.error("❌ Booking reject error:", err);
      socket.emit("error", {
        success: false,
        error: "Server error while rejecting booking",
      });
    }
  });

  // Listen for driver status updates
  socket.on("driver:status", async (status) => {
    try {
      const validStatuses = ["online", "offline", "busy", "break"];
      if (!validStatuses.includes(status)) {
        socket.emit("error", { message: "Invalid status" });
        return;
      }

      // Store driver status in Redis
      await setHeartbeat(id, status === "online" ? 120 : 0);

      // You can store more detailed status if needed
      // await redis.set(`driver:status:${id}`, status, 'EX', 300);

      socket.emit("driver:status:ack", {
        success: true,
        status,
        timestamp: new Date(),
      });

      console.log(`📊 Driver ${id} status updated to: ${status}`);
    } catch (err) {
      console.error("❌ Driver status update error:", err);
      socket.emit("driver:status:ack", {
        success: false,
        error: "Failed to update status",
      });
    }
  });

  // Listen for heartbeat/ping
  socket.on("ping", async () => {
    try {
      await setHeartbeat(id, 120);
      socket.emit("pong", { timestamp: new Date() });
    } catch (err) {
      console.error("❌ Heartbeat error:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log(`🔴 Driver ${id} disconnected:`, reason);

    // Note: We don't immediately mark as offline since heartbeat TTL will handle it
    // This allows for brief network interruptions without affecting availability

    // Optional: Log disconnect reason for analytics
    // logDriverDisconnect(id, reason);
  });

  // }error', { message: 'Invalid location data' });
  //         return;
  //       }

  // Store driver location
  //     await addDriverGeo(id, loc.longitude, loc.latitude);
  //     await setHeartbeat(id, 120); // 2 minutes heartbeat

  //     const driverData = await getDriverDetails(id);
  //     console.log("📊 Stored driver data:", driverData);

  //     // Broadcast to users who are tracking this booking
  //     if (loc.bookingId) {
  //       io.to(`user:booking:${loc.bookingId}`).emit('driver:location', {
  //         driverId: id,
  //         latitude: loc.latitude,
  //         longitude: loc.longitude,
  //         timestamp: new Date(),
  //         bookingId: loc.bookingId
  //       });
  //     }

  //     // Acknowledge location update
  //     socket.emit('location:update:ack', {
  //       success: true,
  //       timestamp: new Date()
  //     });

  //   } catch (err) {
  //     console.error('❌ Location update error:', err);
  //     socket.emit('location:update:ack', {
  //       success: false,
  //       error: 'Failed to update location'
  //     });
  //   }
  // });

  // Listen for ride acceptance
  socket.on("booking:accept", async (data) => {
    try {
      const { bookingId, requestId } = data;
      console.log(`✅ Driver ${id} attempting to accept booking ${bookingId}`);

      if (!bookingId) {
        socket.emit("booking:accept:result", {
          success: false,
          error: "bookingId is required",
        });
        return;
      }

      // Use realtime service to handle acceptance
      const success = await rideController.handleDriverAcceptance(
        bookingId,
        id
      );

      if (success) {
        socket.emit("booking:accept:result", {
          success: true,
          bookingId,
          message:
            "Ride accepted successfully! Please navigate to pickup location.",
        });

        // Update driver status
        await setHeartbeat(id, 120);

        console.log(
          `🎉 Driver ${id} successfully accepted booking ${bookingId}`
        );
      } else {
      }
    } catch (err) {
      console.log("error", err);
    }
  });
}
