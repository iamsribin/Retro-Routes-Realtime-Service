import { createRabbit } from '../config/rabbitmq';
import { getIo } from '../socket';
import { markProcessed } from '../utils/idempotency';
import { acquireLock, releaseLock } from '../utils/locks';
import { redis } from '../config/redis';

export class RealtimeService {
  ch: any;

  async start() {
    const { conn, ch } = await createRabbit();
    this.ch = ch;

    // BookingRequest consumer
    await ch.consume('realtime.bookingRequest', async (msg) => {
      if (!msg) return;
      try {
        const raw = msg.content.toString();
        const payload = JSON.parse(raw);
        await this.handleBookingRequest(payload);
        ch.ack(msg);
      } catch (err) {
        console.error('bookingRequest handler error', err);
        // on error — NACK and route to DLQ after retries (simple approach: NACK without requeue)
        ch.nack(msg, false, false);
      }
    });

    // DriverDocExpired consumer
    await ch.consume('realtime.driverDocExpired', async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await this.handleDriverDocExpired(payload);
        ch.ack(msg);
      } catch (err) {
        console.error('driverDocExpired handler error', err);
        ch.nack(msg, false, false);
      }
    });
  }

  async handleBookingRequest(payload: any) {
    // idempotency
    if (!payload || !payload.requestId) throw new Error('invalid payload');
    const first = await markProcessed(payload.requestId);
    if (!first) {
      console.log('Duplicate bookingRequest', payload.requestId);
      return;
    }

    // Validate
    if (!Array.isArray(payload.candidates) || payload.candidates.length === 0) {
      // Inform booking service (optionally) or just end
      console.log('no drivers candidates');
      return;
    }

    // We'll chunk and emit to drivers
    const io = getIo();
    const CHUNK = 20;
    const chunks = [];
    for (let i = 0; i < payload.candidates.length; i += CHUNK) {
      chunks.push(payload.candidates.slice(i, i + CHUNK));
    }

    // For each candidate chunk emit and start accept timers
    for (const chunk of chunks) {
      // Emit a single message for that chunk - compact
      const message = {
        bookingId: payload.bookingId,
        requestId: payload.requestId,
        candidates: chunk,
        timeoutSeconds: payload.timeoutSeconds || 30
      };

      // For each driver in chunk, emit - drivers are in rooms like `driver:{id}`
      for (const driver of chunk) {
        const room = `driver:${driver.driverId}`;
        // check if driver is online via heartbeat quick check
        const hb = await redis.get(`driver:heartbeat:${driver.driverId}`);
        if (!hb) {
          // driver offline — skip
          console.log('driver offline skip', driver.driverId);
          continue;
        }
        io.to(room).emit('ride:request', message);
      }
    }

    // Optionally store bookingRequest state in Redis to track which drivers were pinged
    const key = `booking:request:${payload.bookingId}`;
    await redis.set(key, JSON.stringify({ requestId: payload.requestId, candidates: payload.candidates }), 'EX', 60 * 5);
  }

  async handleDriverDocExpired(payload: any) {
    if (!payload || !payload.requestId) throw new Error('invalid payload');
    const first = await markProcessed(payload.requestId);
    if (!first) return;

    const io = getIo();
    const room = `driver:${payload.driverId}`;
    // Emit doc expired notification to driver UI
    io.to(room).emit('driver:doc:expired', {
      driverId: payload.driverId,
      expiredFields: payload.expiredFields || [],
      message: 'One or more documents expired. Please update.'
    });
    // Optionally broadcast to admin: io.to('admin').emit('driver:doc:expired', ...)
  }
}
