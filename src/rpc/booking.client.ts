import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../../proto/booking.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {});
const grpcObj = grpc.loadPackageDefinition(packageDef) as any;
const bookingPackage = grpcObj.booking;

const BOOKING_ADDR = process.env.   BOOKING_ADDR || 'localhost:50051';

export const bookingClient = new bookingPackage.BookingService(
  BOOKING_ADDR,
  grpc.credentials.createInsecure()
);

// small wrapper to call acceptBooking
export function acceptBooking(bookingId: string, driverId: string, cb: (err: any, res?: any) => void) {
  bookingClient.assignDriver({ bookingId, driverId }, cb);
}
