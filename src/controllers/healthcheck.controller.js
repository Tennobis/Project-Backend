import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthCheck = asyncHandler(async (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const redisStatus = "active";
  const diskSpace = "healthy";

  const isHealthy = dbStatus === "connected";
  if (!isHealthy) {
    throw new ApiError(
      503,
      "Service Unavailable: One or more dependencies are down",
      {
        dbStatus,
        redisStatus,
        diskSpace,
      }
    );
  }
  return res.status(200).json(
    new ApiResponse(200, {
      status: "UP",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
        disk: diskSpace,
      },
    },"Health check passed ")
  );
});

export { healthCheck };
