import { Socket, Server } from "socket.io";
import { setHeartbeat, addDriverGeo, getDriverDetails } from "../config/redis";
// import { bookingClient } from '../rpc/booking.client';

export function handleUserSocket(socket: Socket, payload: any, io: Server) {
  const { role, id } = payload || {};

  if (!role || !id) {
    socket.disconnect(true);
    return;
  }

  // Join driver to a driver room
  const userRoom = `user:${id}`;
  socket.join(userRoom);
  socket.data = { id, role };

  // On disconnect
  socket.on("disconnect", (reason) => {
    console.log("socket disconnected", id, reason);
  });

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
      console.log("New chat message received user:", data);

      try {
        const recipientId =
          data.sender === "driver" ? data.userId : data.driverId;
        if (!recipientId) {
          console.error("Missing recipient ID");
          return;
        }

        const driverRoom = `driver:${data.driverId}`;
        io.to(driverRoom).emit("receiveMessage", {
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

  socket.on("user:payment:conformation", async (data) => {
    try {
      console.log("user:payment:conformation",data);
      const driverRoom = `driver:${data.driverId}`;      
      io.to(driverRoom).emit("driver:payment:conformation",data);
    } catch (error) {
      console.log(error);
    }
  });
}
