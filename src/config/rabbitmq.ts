// import amqp from 'amqplib';

// const RABBIT_URL = process.env.RABBIT_URL;

// export async function createRabbit() {
//   const conn = await amqp.connect(RABBIT_URL);
//   const ch = await conn.createChannel();

//   // Exchanges & queues
//   await ch.assertExchange('retro.routes', 'topic', { durable: true });

//   // Realtime queues
//   await ch.assertQueue('realtime.bookingRequest', { durable: true });
//   await ch.assertQueue('realtime.driverDocExpired', { durable: true });

//   // Bindings
//   await ch.bindQueue('realtime.bookingRequest', 'retro.routes', 'booking.request');
//   await ch.bindQueue('realtime.driverDocExpired', 'retro.routes', 'driver.doc.expired');

//   // DLQ
//   await ch.assertQueue('realtime.dlq', { durable: true });

//   return { conn, ch };
// }

// config/rabbitmq.ts
import amqp from 'amqplib';

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

export async function createRabbit() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  // Main exchange for all routing
  await ch.assertExchange('retro.routes', 'topic', { durable: true });

  // Realtime service queues
  await ch.assertQueue('realtime.bookingRequest', { durable: true });
  await ch.assertQueue('realtime.driverDocExpired', { durable: true });

  // Driver service queues (for timeout and rejection handling)
  await ch.assertQueue('driver.timeout', { durable: true });
  await ch.assertQueue('driver.rejection', { durable: true });

  // Booking service queues (for booking status updates)
  await ch.assertQueue('booking.statusUpdate', { durable: true });
  await ch.assertQueue('booking.driverAssigned', { durable: true });

  // User service queues (for notifications)
  await ch.assertQueue('user.notification', { durable: true });

  // Bindings for realtime service
  await ch.bindQueue('realtime.bookingRequest', 'retro.routes', 'booking.request');
  await ch.bindQueue('realtime.driverDocExpired', 'retro.routes', 'driver.doc.expired');

  // Bindings for driver service
  await ch.bindQueue('driver.timeout', 'retro.routes', 'driver.timeout');
  await ch.bindQueue('driver.rejection', 'retro.routes', 'driver.rejection');

  // Bindings for booking service
  await ch.bindQueue('booking.statusUpdate', 'retro.routes', 'booking.status.update');
  await ch.bindQueue('booking.driverAssigned', 'retro.routes', 'booking.driver.assigned');

  // Bindings for user service
  await ch.bindQueue('user.notification', 'retro.routes', 'user.notification');

  // Dead Letter Queue
  await ch.assertQueue('realtime.dlq', { durable: true });

  return { conn, ch };
}

export class RabbitMQPublisher {
  private static ch: amqp.Channel;

  static async initialize(channel: amqp.Channel) {
    this.ch = channel;
  }

  static async publish(routingKey: string, data: any): Promise<void> {
    try {
      const message = Buffer.from(JSON.stringify(data));
      const published = this.ch.publish('retro.routes', routingKey, message, {
        persistent: true,
        messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      });

      if (!published) {
        throw new Error('Failed to publish message to RabbitMQ');
      }
      
      console.log(`✅ Published message to ${routingKey}:`, { 
        messageId: message.toString().slice(0, 100) + '...' 
      });
    } catch (error) {
      console.error(`❌ Failed to publish to ${routingKey}:`, error);
      throw error;
    }
  }
}
