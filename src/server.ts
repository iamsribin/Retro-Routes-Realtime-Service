import express from 'express';
import http from 'http';
import { initSocket } from './socket';
import { Consumer } from './events/consumer';
// import { RealtimeService } from './services/realtime-service';
import "dotenv/config";
// import { RideController } from './controller/ride-controller';
import "../src/utils/monitor-online-driver"
import { RideController } from './controller/implementation/ride-controller';
import { RedisRepository } from './repository/implementation/redis-repository';
import { RabbitMQPublisher } from './events/publisher';
import { RideService } from './services/implementation/ride-service';


  const redisRepo = new RedisRepository();

  const realTimeService = new RideService(redisRepo);
  const rideController = new RideController(realTimeService);

const app = express();


app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

const io = initSocket(server);
// const realtime = new RealtimeService();
const consumer = new Consumer(rideController)
consumer.start().catch(err => {
  console.error('Failed to start realtime service', err);
  process.exit(1);
});

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`Realtime service listening on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});