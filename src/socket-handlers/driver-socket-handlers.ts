import { Socket, Server } from 'socket.io';
import { setHeartbeat, addDriverGeo, getDriverDetails } from '../config/redis';
// import { bookingClient } from '../rpc/booking.client';

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

  // Listen for location updates: { lat, lng, ts }
  socket.on('location:update', async (loc) => {
    try {
      console.log("location:update",loc);
      
      if (!loc || typeof loc.longitude !== 'number' || typeof loc.longitude !== 'number') return;
      await addDriverGeo(id, loc.longitude, loc.latitude);
      await setHeartbeat(id, 120); 

      const data = await getDriverDetails(id)
      console.log("stored driver data",data);
      
      
      // broadcast to user rooms who are interested: if we store booking -> user room mapping, we can emit to that user
      // For simplicity, emit to `user:booking:{bookingId}` if provided
      if (loc.bookingId) {
        io.to(`user:booking:${loc.bookingId}`).emit('driver:location', { driverId: id, lat: loc.lat, lng: loc.lng });
      }
    } catch (err) {
      console.error('location:update err', err);
    }
  });

  // Listen for accept
  socket.on('booking:accept', async (payload) => {
    // payload: { bookingId, requestId }
    try {
      const { bookingId, requestId } = payload;
      if (!bookingId) return socket.emit('error', { message: 'bookingId required' });

      // call Booking Service via gRPC to assign driver
      // acceptDriver(bookingId, id, (err, res) => {
      //   if (err) {
      //     socket.emit('booking:accept:result', { success: false, error: err.message || err });
      //   } else {
      //     socket.emit('booking:accept:result', { success: true, booking: res });
      //   }
      // });
    } catch (err) {
      console.error('booking:accept err', err);
      socket.emit('booking:accept:result', { success: false, error: 'server_error' });
    }
  });

  // On disconnect
  socket.on('disconnect', (reason) => {
    // do not immediately mark offline; heartbeat TTL will expire
    console.log('socket disconnected', id, reason);
  });
}

// wrapper that calls booking service
// function acceptDriver(bookingId: string, driverId: string, cb: (err: any, res?: any) => void) {
//   bookingClient.assignDriver({ bookingId, driverId }, (err: any, res: any) => {
//     cb(err, res);
//   });
// }
