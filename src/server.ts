import express from 'express';
import http from 'http';
import cors from 'cors';
import { initSocket } from './socket';
import { RealtimeService } from './services/realtime-service';
import "dotenv/config";
import { consumeDriverNotifications } from "./utils/rabbitmq.consumer";

const app = express();

// Add CORS middleware for HTTP requests
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);

const io = initSocket(server);
consumeDriverNotifications()
// Optional: Initialize realtime service
// const realtime = new RealtimeService();
// realtime.start().catch(err => {
//   console.error('Failed to start realtime service', err);
//   process.exit(1);
// });

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