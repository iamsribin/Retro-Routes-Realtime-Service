import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { authenticateSocket } from './middleware/authenticate-socket';
import { handleSocketConnection } from './socket-handlers/handle-socket-connection';

let io: SocketIOServer;

export const initSocket = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  console.log(`Socket.IO initialized with CORS origin: ${process.env.CORS_ORIGIN}`);

  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    console.log("connetion....");
    
    handleSocketConnection(socket, io);
  });

  return io;
};

export function getIo() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
