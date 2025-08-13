import amqp from 'amqplib';

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

export async function createRabbit() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  // Exchanges & queues
  await ch.assertExchange('retro.routes', 'topic', { durable: true });

  // Realtime queues
  await ch.assertQueue('realtime.bookingRequest', { durable: true });
  await ch.assertQueue('realtime.driverDocExpired', { durable: true });

  // Bindings
  await ch.bindQueue('realtime.bookingRequest', 'retro.routes', 'booking.request');
  await ch.bindQueue('realtime.driverDocExpired', 'retro.routes', 'driver.doc.expired');

  // DLQ
  await ch.assertQueue('realtime.dlq', { durable: true });

  return { conn, ch };
}
