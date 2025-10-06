import amqp from 'amqplib';

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
