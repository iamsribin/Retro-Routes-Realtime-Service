import { getDriverDetails, getDriverGeo, isDriverOnline, redis } from "../config/redis";
import { RabbitMQPublisher } from "../events/publisher";
import { getIo } from "../socket";
import {
  BookingRequestPayload,
  DriverDetails,
  RideRequest,
  DriverTimeoutPayload,
  UserNotificationPayload,
  DriverAssignmentPayload,
  bookingState,
  RideStatusData,
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
      const isOnline = await isDriverOnline(currentDriver.driverId);
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
      bookingDetails: {
        rideId: bookingState.rideId,
        bookingId: bookingState.bookingId,
        createdAt: bookingState.createdAt,
        dropoffLocation: bookingState.dropCoordinates,
        pickupLocation: bookingState.pickupCoordinates,
        estimatedDistance: bookingState.distance,
        estimatedDuration: bookingState.estimatedDuration,
        fareAmount: bookingState.price,
        securityPin: bookingState.pin,
        status: bookingState.status,
        vehicleType: driver.vehicleModel,
      },
      requestTimeout: bookingState.timeoutSeconds,
    };

    // Store current driver request
    const driverRequestKey = `driver:request:${driver.driverId}:${bookingState.bookingId}`;
    await redis.set(driverRequestKey, JSON.stringify(rideRequest), "EX", 60);

    // Emit to driver
    io.to(driverRoom).emit("ride:request", rideRequest);
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

      await RabbitMQPublisher.publish("driver.rejection", timeoutPayload);

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
    bookingState: BookingRequestPayload,
    driver: DriverDetails
  ): Promise<void> {
    try {
      const coordinates = await getDriverGeo(driver.driverId);
    // update booking service
    const assignmentPayload: DriverAssignmentPayload = {
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

    // Notify user via socket
    const io = getIo();
    const userRoom = `user:${bookingState.user.userId}`;

    const userRideAcceptData: RideStatusData = {
      ride_id: bookingState.rideId,
      userId:bookingState.user.userId,
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
    } catch (error) {
      console.log("error",error);
    }
    
  }

  private async handleNoDriversAvailable(bookingState: any): Promise<void> {
    console.log(
      `😞 No drivers available for booking ${bookingState.bookingId}`
    );

    // Notify user via socket
    const io = getIo();
    const userRoom = `user:${bookingState.user.userId}`;

    io.to(userRoom).emit("booking:no_drivers", {
      bookingId: bookingState.bookingId,
      message: "Currently no drivers are available. Please try again later.",
    });

    // Clean up
    await this.cleanupBookingRequest(bookingState.bookingId);
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

      await RabbitMQPublisher.publish('driver.rejection', rejectionPayload);

      // Move to next driver
      await this.moveToNextDriver(bookingId);
    } catch (error) {
      console.error("❌ Error handling driver rejection:", error);
    }
  }
}


  //   const setupSocketListeners = () => {
  //     if (!socket || !isConnected) return;

  //     socket.on("rideStatus", (data: RideStatusData) => {
  //       console.log("RideStatusData", data);

  //       setIsSearching(false);
  //       setShowVehicleSheet(false);
  //       setRideStatus(data);
  //       const notificationType = getNotificationType(data.status);
  //       const navigateTo =
  //         data.status === "Accepted" ? "/ride-tracking" : undefined;

  //       dispatch(
  //         showNotification({
  //           type: notificationType,
  //           message: data.message || `Ride status: ${data.status}`,
  //           data: {
  //             rideId: data.ride_id,
  //             driverId:
  //               data.status === "Accepted" ? data.driverDetails.driverId : null,
  //           },
  //           navigate: navigateTo,
  //         })
  //       );

  //       if (
  //         data.status === "Accepted" &&
  //         data.driverCoordinates &&
  //         data.booking?.pickupCoordinates
  //       ) {
  //         dispatch(showRideMap(data));
  //         // fetchDriverRoute(data.driverCoordinates, {
  //         //   lat: data.booking.pickupCoordinates.latitude,
  //         //   lng: data.booking.pickupCoordinates.longitude,
  //         // });
  //       }
  //     });

  //     socket.on("error", (error: { message: string; code: string }) => {
  //       setNotification({
  //         open: true,
  //         type: "error",
  //         title: "Error",
  //         message: error.message,
  //       });
  //     });
  //   };

  //     const getNotificationType = (
  //   status: RideStatusData["status"]
  // ): "success" | "error" | "info" => {
  //   switch (status) {
  //     case "Accepted":
  //       return "success";
  //     case "Failed":
  //       return "error";
  //     default:
  //       return "info";
  //   }
  // };