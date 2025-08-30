import { IRideService } from "../interfaces/i-real-time-service";
import {
  BookingRequestPayload,
  DriverDetails,
  RideRequest,
  RideStatusData,
} from "../../types/booking-types";
import { IResponse, StatusCode } from "../../types/common";
import { RabbitMQPublisher } from "../../events/publisher";
import { getIo } from "../../socket";
import { IRedisRepository } from "../../repository/interfaces/i-redis-repository";
import { RealTimeResponseDTO } from "../../dto/real-time.dto";
import { createRideRequest } from "../../utils/real-time-utils";

export class RideService implements IRideService {
  private activeRequests = new Map<string, NodeJS.Timeout>();

  constructor(private _redisRepo: IRedisRepository) {}

  async handleBookingRequest(
    payload: BookingRequestPayload
  ): Promise<IResponse<null>> {
    try {
      if (!payload || !payload.requestId) {
        return {
          status: StatusCode.InternalServerError,
          message: "Invalid payload: missing requestId",
        };
      }

      const isFirstTime = await this._redisRepo.markProcessed(
        payload.requestId
      );
      if (!isFirstTime) {
        return {
          status: StatusCode.Accepted,
          message: `Duplicate booking request: ${payload.requestId}`,
        };
      }

      if (!payload.bookingId) {
        return {
          status: StatusCode.InternalServerError,
          message: "Invalid payload: missing bookingId",
        };
      }

      const bookingState = {
        ...payload,
        currentDriverIndex: 0,
        processedDrivers: [],
        status: "pending",
        createdAt: new Date(),
      };

      await this._redisRepo.storeBookingState(
        payload.bookingId,
        bookingState,
        60 * 10
      );
      await this.processNextDriver(payload.bookingId);

      return {
        status: StatusCode.Created,
        message: "Booking request processed",
      };
    } catch (error) {
      console.error("Error handling booking request:", error);
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to handle booking request: ${
          (error as Error).message
        }`,
      };
    }
  }

  async handleDriverAcceptance(
    bookingId: string,
    driverId: string
  ): Promise<IResponse<RealTimeResponseDTO>> {
    try {
      const bookingState = await this._redisRepo.getBookingState(bookingId);
      if (!bookingState) {
        return {
          status: StatusCode.NotFound,
          message: `Booking ${bookingId} not found or expired`,
          data: { success: false, bookingId, message: "Booking not found" },
        };
      }

      const driver = bookingState.drivers.find(
        (d: DriverDetails) => d.driverId === driverId
      );
      if (!driver) {
        return {
          status: StatusCode.NotFound,
          message: `Driver ${driverId} not found in booking ${bookingId}`,
          data: { success: false, bookingId, message: "Driver not found" },
        };
      }

      const timeoutKey = `${bookingId}:${driverId}`;
      if (this.activeRequests.has(timeoutKey)) {
        clearTimeout(this.activeRequests.get(timeoutKey)!);
        this.activeRequests.delete(timeoutKey);
      }

      await this.assignDriverToBooking(bookingState, driver);
      await this._redisRepo.deleteBookingState(bookingId);

      return {
        status: StatusCode.Accepted,
        message: `Driver ${driverId} accepted booking ${bookingId}`,
        data: {
          success: true,
          bookingId,
          message: "Ride accepted successfully",
        },
      };
    } catch (error) {
      console.error("Error handling driver acceptance:", error);
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to handle driver acceptance: ${
          (error as Error).message
        }`,
        data: {
          success: false,
          bookingId,
          message: "Server error while accepting booking",
        },
      };
    }
  }

  async handleDriverRejection(
    bookingId: string,
    driverId: string
  ): Promise<IResponse<null>> {
    try {
      const timeoutKey = `${bookingId}:${driverId}`;
      if (this.activeRequests.has(timeoutKey)) {
        clearTimeout(this.activeRequests.get(timeoutKey)!);
        this.activeRequests.delete(timeoutKey);
      }

      const rejectionPayload: any = {
        driverId,
        bookingId,
        requestId: `rejection_${Date.now()}`,
        reason: "rejection",
        timestamp: new Date(),
      };

      await RabbitMQPublisher.publish("driver.rejection", rejectionPayload);
      await this.processNextDriver(bookingId);

      return {
        status: StatusCode.Accepted,
        message: `Driver ${driverId} rejected booking ${bookingId}`,
      };
    } catch (error) {
      console.error("Error handling driver rejection:", error);
      return {
        status: StatusCode.InternalServerError,
        message: `Failed to handle driver rejection: ${
          (error as Error).message
        }`,
      };
    }
  }

  private async processNextDriver(bookingId: string): Promise<void> {
    try {
      const bookingState = await this._redisRepo.getBookingState(bookingId);
      if (!bookingState) {
        console.log(`Booking ${bookingId} not found or expired`);
        return;
      }

      if (bookingState.currentDriverIndex >= bookingState.drivers.length) {
        await this.handleNoDriversAvailable(bookingState);
        return;
      }

      const currentDriver =
        bookingState.drivers[bookingState.currentDriverIndex];
      const isOnline = await this._redisRepo.isDriverOnline(
        currentDriver.driverId
      );
      if (!isOnline) {
        console.log(`Driver ${currentDriver.driverId} is offline, skipping...`);
        await this.moveToNextDriver(bookingId);
        return;
      }

      const rideRequest = createRideRequest(currentDriver, bookingState);
      const io = getIo();
      const driverRoom = `driver:${currentDriver.driverId}`;
      // await redis.set(`driver:request:${currentDriver.driverId}:${bookingId}`, JSON.stringify(rideRequest), "EX", 60);
      io.to(driverRoom).emit("ride:request", rideRequest);
      await this.setDriverTimeout(
        bookingId,
        currentDriver.driverId,
        bookingState.timeoutSeconds || 30
      );
    } catch (error) {
      console.error("Error processing next driver:", error);
    }
  }

  private async setDriverTimeout(
    bookingId: string,
    driverId: string,
    timeoutSeconds: number
  ): Promise<void> {
    const timeoutKey = `${bookingId}:${driverId}`;
    if (this.activeRequests.has(timeoutKey)) {
      clearTimeout(this.activeRequests.get(timeoutKey)!);
    }

    const timeout = setTimeout(async () => {
      await this.handleDriverTimeout(bookingId, driverId);
      this.activeRequests.delete(timeoutKey);
    }, timeoutSeconds * 1000);

    this.activeRequests.set(timeoutKey, timeout);
  }

  private async handleDriverTimeout(
    bookingId: string,
    driverId: string
  ): Promise<void> {
    console.log(`Driver ${driverId} timeout for booking ${bookingId}`);
    const timeoutPayload: any = {
      driverId,
      bookingId,
      requestId: `timeout_${Date.now()}`,
      reason: "timeout",
      timestamp: new Date(),
    };

    await RabbitMQPublisher.publish("driver.rejection", timeoutPayload);
    await this.moveToNextDriver(bookingId);
  }

  private async moveToNextDriver(bookingId: string): Promise<void> {
    const bookingState = await this._redisRepo.getBookingState(bookingId);
    if (!bookingState) return;

    bookingState.currentDriverIndex += 1;
    await this._redisRepo.updateBookingState(bookingId, bookingState, 60 * 10);
    setTimeout(() => this.processNextDriver(bookingId), 1000);
  }

  private async assignDriverToBooking(
    bookingState: BookingRequestPayload,
    driver: DriverDetails
  ): Promise<void> {
    try {
      
      const coordinates = await this._redisRepo.getDriverGeo(driver.driverId);
      const driverDetails = await this._redisRepo.getDriverDetails(
        driver.driverId
      );

      if (coordinates && driverDetails) {
        await this._redisRepo.removeOnlineDriver(driver.driverId);
        await this._redisRepo.setDriverDetails(driverDetails, true);
        await this._redisRepo.addDriverGeo(
          driver.driverId,
          coordinates.latitude,
          coordinates.longitude,
          true
        );

        const assignmentPayload: any = {
          bookingId: bookingState.bookingId,
          rideId: bookingState.rideId,
          driver: {
            driverId: driver.driverId,
            driverName: driver.driverName,
            driverProfile: driver.driverPhoto,
            driverNumber: driver.phoneNumber,
          },
          driverCoordinates: coordinates,
        };

        await RabbitMQPublisher.publish("driver.acceptance", assignmentPayload);

        const io = getIo();

        const userRoom = `user:${bookingState.user.userId}`;
        const userRideAcceptData: RideStatusData = {
          ride_id: bookingState.rideId,
          userId: bookingState.user.userId,
          booking: {
            date: bookingState.createdAt,
            distance: bookingState.distance,
            pickupCoordinates: bookingState.pickupCoordinates,
            dropoffCoordinates: bookingState.dropCoordinates,
            pickupLocation: bookingState.pickupCoordinates.address,
            dropoffLocation: bookingState.dropCoordinates.address,
            duration: bookingState.estimatedDuration,
            pin: bookingState.pin,
            price: bookingState.price,
            ride_id: bookingState.rideId,
            status: "Accept",
            vehicleModel: driver.vehicleModel,
            _id: bookingState.bookingId,
          },
          status: "Accepted",
          message: "Driver has accepted your ride",
          chatMessages: [],
          driverCoordinates: coordinates,
          driverDetails: {
            driverId: driver.driverId,
            driverName: driver.driverName,
            driverPhoto: driver.driverPhoto,
            rating: driver.rating,
            vehicleModel: driver.vehicleModel,
            vehicleNumber: driver.vehicleNumber,
            phoneNumber: driver.phoneNumber,
            distance: driver.distance,
            cancelCount: driver.cancelCount,
            score: driver.score,
          },
        };

        io.to(userRoom).emit("booking:driver:assigned", userRideAcceptData);
      }else{
      throw new Error("something went wrong try again");

      }
    } catch (error) {
      console.log(error);

      throw new Error(error.message);
    }
  }

  private async handleNoDriversAvailable(
    bookingState: BookingRequestPayload
  ): Promise<void> {
    const io = getIo();
    const userRoom = `user:${bookingState.user.userId}`;

    io.to(userRoom).emit("booking:no_drivers", {
      bookingId: bookingState.bookingId,
      message: "Currently no drivers are available. Please try again later.",
    });

    await this._redisRepo.deleteBookingState(bookingState.bookingId);
  }
}
