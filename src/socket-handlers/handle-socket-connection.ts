import { AuthenticatedSocket } from "../middleware/authenticate-socket";
import { Server as SocketIOServer, Socket } from "socket.io";
import { handleDriverSocket } from "./driver-socket-handlers";
import { handleUserSocket } from "./user-socket-handler";

export const handleSocketConnection = (
  socket: AuthenticatedSocket,
  io: SocketIOServer
) => {  
  if (!socket.decoded) {
    console.error("Missing decoded token, disconnecting");
    socket.disconnect();
    return;
  }

  const { clientId: userId, role } = socket.decoded;
  console.log(`${role} connected: ${userId}`);
  const payload = {
    role,
    id: userId,
  };
  if (userId && role == "Driver") {
    handleDriverSocket(socket, payload, io);
  }

  if (userId && role == "Admin") {
    // handleUserSocket(socket, payload, io);
  }

  if (userId && role == "User") {
    handleUserSocket(socket, payload, io);
  }
};
