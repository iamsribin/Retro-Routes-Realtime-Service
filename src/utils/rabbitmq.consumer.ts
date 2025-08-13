import amqp from "amqplib";

export async function consumeDriverNotifications() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  const queue = "driver_notifications";

  await channel.assertQueue(queue, { durable: true });

  console.log(`[RabbitMQ] Waiting for messages in ${queue}`);
  channel.consume(queue, (msg) => {
    if (msg !== null) {
      const data = JSON.parse(msg.content.toString());
      console.log("📩 Received driver notification payload:", data);
      // You can now trigger socket.io emit or push notification here
      channel.ack(msg);
    }
  });
}
