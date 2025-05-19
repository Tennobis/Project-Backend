import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/users.models.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscribeId = req.user._id;
  const channel = User.findById(channelId);
  if (!channel) {
    throw new ApiError(404, "Channel not found!");
  }
  // to check if user is trying to subscribe their own channel:
  if (channelId === subscribeId.toString()) {
    throw new ApiError(400, "You cannot subscribe to yourself");
  }
  // check if subscription already exists:
  const existingSubscription = Subscription.findOne({
    subscriber: subscribeId,
    channel: channelId,
  });
  let subscription;
  let isSubscribed;
  if (existingSubscription) {
    // unsubscribe
    subscription = Subscription.deleteOne({ _id: existingSubscription._id });
    isSubscribed = false;
  } else {
    subscription = Subscription.create({
      subscriber: subscribeId,
      channel: channelId,
    });
    isSubscribed = true;
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isSubscribed },
        isSubscribed ? "Subscribed Successfully" : "Unsuscribed Successfully"
      )
    );
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscribers = await Subscription.find({ channel: channelId }).populate(
    "subscriber",
    "username fullname avatar"
  );
  return res
    .status(200)
    .json(new ApiResponse(200, subscribers, "Suscribers fetched Successfully"));
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const channels = await Subscription.find({
    subscriber: subscriberId,
  }).populate("channel", "username fullname avatar");

  return res
    .status(200)
    .json(
      new ApiResponse(200, channels, "Suscribed channels fetched successfully")
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
