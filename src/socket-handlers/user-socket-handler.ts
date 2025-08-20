import { Socket, Server } from 'socket.io';
import { setHeartbeat, addDriverGeo, getDriverDetails } from '../config/redis';
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
  socket.on('disconnect', (reason) => {
    console.log('socket disconnected', id, reason);
  });
}


