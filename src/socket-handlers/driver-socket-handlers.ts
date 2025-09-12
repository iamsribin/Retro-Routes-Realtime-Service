import { Socket, Server } from "socket.io";
import { RideService } from "../services/implementation/ride-service";
import { RedisRepository } from "../repository/implementation/redis-repository";
import { RideController } from "../controller/implementation/ride-controller";
import { StatusCode } from "../types/common";
import { DriverLocationController } from "../controller/implementation/driver-location-controller";
import { DriverLocationService } from "../services/implementation/driver-location-service";

export function handleDriverSocket(socket: Socket, payload: any, io: Server) {
  const redisRepo = new RedisRepository();

  const realTimeService = new RideService(redisRepo);
  const driverLocationService = new DriverLocationService(redisRepo);

  const rideController = new RideController(realTimeService);
  const driverLocationController = new DriverLocationController(
    driverLocationService
  );

  const { role, id } = payload || {};

  if (!role || !id) {
    socket.disconnect(true);
    return;
  }

  const driverRoom = `driver:${id}`;
  socket.join(driverRoom);
  socket.data = { id, role };

  console.log(`🚗 Driver ${id} connected and joined room: ${driverRoom}`);

  socket.on(
    "location:update",
    async (loc: { latitude: number; longitude: number; userId: string }) => {
      const response =
        await driverLocationController.handleDriverLocationUpdate(
          socket,
          id,
          loc
        );
      if (response.status !== StatusCode.Accepted) {
        socket.emit("error", { success: false, error: response.message });
      }
    }
  );

  socket.on(
    "location:update:ride_driver",
    async (data: { latitude: number; longitude: number; userId: string }) => {
      const response =
        await driverLocationController.handleDriverLocationUpdate(
          socket,
          id,
          data,
          true
        );
      if (response.status !== StatusCode.Accepted) {
        socket.emit("error", { success: false, error: response.message });
      }
    }
  );

  socket.on("booking:reject", async (data: { bookingId: string }) => {
    const response = await rideController.handleDriverRejection(
      data.bookingId,
      id
    );
    socket.emit("booking:reject:result", {
      success: response.status === StatusCode.Accepted,
      bookingId: data.bookingId,
      message: response.message,
    });
  });

  socket.on("ping", async () => {
    const response = await driverLocationController.handleDriverHeartbeat(id);
    if (response.status !== StatusCode.Accepted) {
      socket.emit("error", { success: false, error: response.message });
    }
  });

  socket.on(
    "booking:accept",
    async (data: { bookingId: string; requestId: string }) => {
      const response = await rideController.handleDriverAcceptance(
        data.bookingId,
        id
      );
      socket.emit(
        "booking:accept:result",
        response.data || {
          success: false,
          bookingId: data.bookingId,
          message: response.message,
        }
      );
    }
  );

  socket.on(
    "sendMessage",
    async (data: {
      rideId: string;
      sender: "driver" | "user";
      message: string;
      timestamp: string;
      driverId?: string;
      userId?: string;
      type?: "text" | "image";
      fileUrl?: string;
    }) => {
      console.log("New chat message received diver:", data);

      try {
        const recipientId =
          data.sender === "driver" ? data.userId : data.driverId;
        if (!recipientId) {
          console.error("Missing recipient ID");
          return;
        }

        const userRoom = `user:${data.userId}`;
        io.to(userRoom).emit("receiveMessage", {
          sender: data.sender,
          message: data.message,
          timestamp: data.timestamp,
          type: data.type || "text",
          fileUrl: data.fileUrl || undefined,
        });

        console.log(`Message forwarded from ${data.sender} to ${recipientId}`);
      } catch (error) {
        console.error("Error processing chat message:", error);
      }
    }
  );

  socket.on("disconnect", (reason) => {
    console.log(`🔴 Driver ${id} disconnected: ${reason}`);
  });
}
