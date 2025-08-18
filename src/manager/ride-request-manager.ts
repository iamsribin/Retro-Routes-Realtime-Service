import { redis } from "../config/redis";
import { getIo } from "../socket";
import { RabbitMQPublisher } from "../config/rabbitmq";
import {
  BookingRequestPayload,
  DriverDetails,
  RideRequest,
  DriverTimeoutPayload,
  BookingStatusPayload,
  UserNotificationPayload,
  DriverAssignmentPayload,
  bookingState,
} from "../types/booking-types";

export class RideRequestManager {
  private static instance: RideRequestManager;
  private activeRequests = new Map<string, NodeJS.Timeout>();

  private constructor() {}

  static getInstance(): RideRequestManager {
    if (!this.instance) {
      this.instance = new RideRequestManager();
    }
    return this.instance;
  }

  async handleBookingRequest(payload: BookingRequestPayload): Promise<void> {
    try {      
      // Store booking state in Redis
      const bookingKey = `booking:request:${payload.bookingId}`;
      const bookingState = {
        ...payload,
        currentDriverIndex: 0,
        processedDrivers: [],
        status: "pending",
        createdAt: new Date(),
      };

      await redis.set(bookingKey, JSON.stringify(bookingState), "EX", 60 * 10); // 10 min TTL

      // Start processing drivers sequentially
      await this.processNextDriver(payload.bookingId);
    } catch (error) {
      console.error("❌ Error handling booking request:", error);
      throw error;
    }
  }

  private async processNextDriver(bookingId: string): Promise<void> {
    try {
      const bookingKey = `booking:request:${bookingId}`;
      const bookingStateStr = await redis.get(bookingKey);

      if (!bookingStateStr) {
        console.log(`⚠️  Booking ${bookingId} not found or expired`);
        return;
      }

      const bookingState = JSON.parse(bookingStateStr);
      const { drivers, currentDriverIndex, processedDrivers } = bookingState;

      // Check if all drivers have been processed
      if (currentDriverIndex >= drivers.length) {
        await this.handleNoDriversAvailable(bookingState);
        return;
      }

      const currentDriver = drivers[currentDriverIndex];

      // Check if driver is online
      const isOnline = await this.isDriverOnline(currentDriver.driverId);
      if (!isOnline) {
        console.log(
          `🔴 Driver ${currentDriver.driverId} is offline, skipping...`
        );
        await this.moveToNextDriver(bookingId);
        return;
      }

      // Send ride request to driver
      await this.sendRideRequestToDriver(currentDriver, bookingState);

      // Set timeout for driver response
      await this.setDriverTimeout(
        bookingId,
        currentDriver.driverId,
        bookingState.timeoutSeconds || 30
      );
    } catch (error) {
      console.error("❌ Error processing next driver:", error);
    }
  }

  private async sendRideRequestToDriver(
    driver: DriverDetails,
    bookingState: bookingState
  ): Promise<void> {
    const io = getIo();
    const driverRoom = `driver:${driver.driverId}`;

    const rideRequest: RideRequest = {
      customer: {
        userId: bookingState.user.userId,
        userName: bookingState.user.userName,
        userProfile: bookingState.user.userProfile,
        userNumber: bookingState.user.userNumber,
      },
      bookingDetails:{
        rideId:bookingState.rideId,
        bookingId:bookingState.bookingId,
        createdAt:bookingState.createdAt,
        dropoffLocation:bookingState.dropCoordinates,
        pickupLocation:bookingState.pickupCoordinates,
        estimatedDistance:bookingState.distance,
        estimatedDuration:bookingState.estimatedDuration,
        fareAmount:bookingState.price,
        securityPin:bookingState.pin,
        status:bookingState.status, 
        vehicleType:driver.vehicleModel,       
      },
      requestTimeout:bookingState.timeoutSeconds,
    };

    // Store current driver request
    const driverRequestKey = `driver:request:${driver.driverId}:${bookingState.bookingId}`;
    await redis.set(driverRequestKey, JSON.stringify(rideRequest), "EX", 60);

    // Emit to driver
    io.to(driverRoom).emit("ride:request", rideRequest);

    console.log(
      `📤 Sent ride request to driver ${driver.driverId} for booking ${bookingState.bookingId}`
    );
  }

  private async setDriverTimeout(
    bookingId: string,
    driverId: string,
    timeoutSeconds: number
  ): Promise<void> {
    const timeoutKey = `${bookingId}:${driverId}`;

    // Clear existing timeout if any
    if (this.activeRequests.has(timeoutKey)) {
      clearTimeout(this.activeRequests.get(timeoutKey)!);
    }

    // Set new timeout
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
    try {
      console.log(`⏰ Driver ${driverId} timeout for booking ${bookingId}`);

      // Publish timeout event to driver service
      const timeoutPayload: DriverTimeoutPayload = {
        driverId,
        bookingId,
        requestId: `timeout_${Date.now()}`,
        reason: "timeout",
        timestamp: new Date(),
      };

      await RabbitMQPublisher.publish("driver.timeout", timeoutPayload);

      // Move to next driver
      await this.moveToNextDriver(bookingId);
    } catch (error) {
      console.error("❌ Error handling driver timeout:", error);
    }
  }


  private async moveToNextDriver(bookingId: string): Promise<void> {
    const bookingKey = `booking:request:${bookingId}`;
    const bookingStateStr = await redis.get(bookingKey);

    if (!bookingStateStr) return;

    const bookingState = JSON.parse(bookingStateStr);
    bookingState.currentDriverIndex += 1;

    await redis.set(bookingKey, JSON.stringify(bookingState), "EX", 60 * 10);

    // Process next driver after a short delay
    setTimeout(() => this.processNextDriver(bookingId), 1000);
  }

  private async assignDriverToBooking(
    bookingState: any,
    driver: DriverDetails
  ): Promise<void> {
    // Call update function (placeholder - you mentioned you don't want implementation)
    await this.updateBookingWithDriver(bookingState.bookingId, driver);

    // Notify booking service
    const assignmentPayload: DriverAssignmentPayload = {
      bookingId: bookingState.bookingId,
      requestId: bookingState.requestId,
      driverId: driver.driverId,
      driver,
      timestamp: new Date(),
    };

    await RabbitMQPublisher.publish(
      "booking.driver.assigned",
      assignmentPayload
    );

    // Notify user via socket
    const io = getIo();
    const userRoom = `user:${bookingState.user.userId}`;

    io.to(userRoom).emit("booking:driver:assigned", {
      bookingId: bookingState.bookingId,
      rideId: bookingState.rideId,
      driver: {
        id: driver.driverId,
        name: driver.driverName || "Driver",
        photo: driver.driverPhoto,
        rating: driver.rating,
        vehicleModel: driver.vehicleModel,
        vehicleNumber: driver.vehicleNumber,
        phoneNumber: driver.phoneNumber,
        distance: driver.distance,
      },
      estimatedArrival: Math.ceil((driver.distance / 1000) * 3), // Rough estimate in minutes
    });

    // Also publish to user service queue
    const userNotification: UserNotificationPayload = {
      userId: bookingState.user.userId,
      bookingId: bookingState.bookingId,
      type: "driver_assigned",
      message: `Driver ${driver.driverName || "assigned"} is on the way!`,
      data: { driver, bookingState },
      timestamp: new Date(),
    };

    await RabbitMQPublisher.publish("user.notification", userNotification);
  }

  private async handleNoDriversAvailable(bookingState: any): Promise<void> {
    console.log(
      `😞 No drivers available for booking ${bookingState.bookingId}`
    );

    // Update booking status to cancelled
    const statusPayload: BookingStatusPayload = {
      bookingId: bookingState.bookingId,
      requestId: bookingState.requestId,
      status: "cancelled",
      reason: "no_drivers_available",
      timestamp: new Date(),
    };

    await RabbitMQPublisher.publish("booking.status.update", statusPayload);

    // Notify user via socket
    const io = getIo();
    const userRoom = `user:${bookingState.user.userId}`;

    io.to(userRoom).emit("booking:no_drivers", {
      bookingId: bookingState.bookingId,
      message: "Currently no drivers are available. Please try again later.",
    });

    // Also publish to user service queue
    const userNotification: UserNotificationPayload = {
      userId: bookingState.user.userId,
      bookingId: bookingState.bookingId,
      type: "no_drivers_available",
      message: "Currently no drivers are available. Please try again later.",
      data: { bookingState },
      timestamp: new Date(),
    };

    await RabbitMQPublisher.publish("user.notification", userNotification);

    // Clean up
    await this.cleanupBookingRequest(bookingState.bookingId);
  }

  private async isDriverOnline(driverId: string): Promise<boolean> {
    const heartbeat = await redis.get(`driver:heartbeat:${driverId}`);
    return !!heartbeat;
  }

  private async updateBookingWithDriver(
    bookingId: string,
    driver: DriverDetails
  ): Promise<void> {
    // Placeholder function - you mentioned you just want this called
    console.log(
      `🔄 Updating booking ${bookingId} with driver ${driver.driverId}`
    );
    // This is where you would call your actual update service
  }

  private async cleanupBookingRequest(bookingId: string): Promise<void> {
    const bookingKey = `booking:request:${bookingId}`;
    await redis.del(bookingKey);

    // Clear any remaining timeouts
    for (const [key, timeout] of this.activeRequests.entries()) {
      if (key.startsWith(bookingId)) {
        clearTimeout(timeout);
        this.activeRequests.delete(key);
      }
    }
  }

  
  async handleDriverAcceptance(
    bookingId: string,
    driverId: string
  ): Promise<boolean> {
    try {
      const bookingKey = `booking:request:${bookingId}`;
      const bookingStateStr = await redis.get(bookingKey);

      if (!bookingStateStr) {
        console.log(`⚠️  Booking ${bookingId} not found or expired`);
        return false;
      }

      const bookingState = JSON.parse(bookingStateStr);
      const driver = bookingState.drivers.find(
        (d: DriverDetails) => d.driverId === driverId
      );

      if (!driver) {
        console.log(
          `⚠️  Driver ${driverId} not found in drivers for booking ${bookingId}`
        );
        return false;
      }

      // Clear timeout
      const timeoutKey = `${bookingId}:${driverId}`;
      if (this.activeRequests.has(timeoutKey)) {
        clearTimeout(this.activeRequests.get(timeoutKey)!);
        this.activeRequests.delete(timeoutKey);
      }

      // Update booking status
      await this.assignDriverToBooking(bookingState, driver);

      // Clean up
      await this.cleanupBookingRequest(bookingId);

      console.log(`✅ Driver ${driverId} accepted booking ${bookingId}`);
      return true;
    } catch (error) {
      console.error("❌ Error handling driver acceptance:", error);
      return false;
    }
  }

  async handleDriverRejection(
    bookingId: string,
    driverId: string
  ): Promise<void> {
    try {
      console.log(`❌ Driver ${driverId} rejected booking ${bookingId}`);

      // Clear timeout
      const timeoutKey = `${bookingId}:${driverId}`;
      if (this.activeRequests.has(timeoutKey)) {
        clearTimeout(this.activeRequests.get(timeoutKey)!);
        this.activeRequests.delete(timeoutKey);
      }

      // Publish rejection event to driver service
      const rejectionPayload: DriverTimeoutPayload = {
        driverId,
        bookingId,
        requestId: `rejection_${Date.now()}`,
        reason: "rejection",
        timestamp: new Date(),
      };

      // await RabbitMQPublisher.publish('driver.rejection', rejectionPayload);

      // Move to next driver
      await this.moveToNextDriver(bookingId);
    } catch (error) {
      console.error("❌ Error handling driver rejection:", error);
    }
  }
}
