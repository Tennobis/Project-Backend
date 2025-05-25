import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweets.models.js";
import { User } from "../models/users.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const userId = req.user?._id;

  if (!content?.trim()) {
    throw new ApiError(400, "Content is required!");
  }

  const tweet = await Tweet.create({
    content,
    owner: userId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(400, "User Id is required!");
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const tweets = await Tweet.aggregatePaginate(
    [
      {
        $match: {
          owner: userId
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner"
        }
      },
      {
        $unwind: "$owner"
      },
      {
        $project: {
          content: 1,
          owner: {
            _id: 1,
            fullname: 1,
            username: 1,
            avatar: 1
          },
          createdAt: 1
        }
      },
      {
        $sort: {
          createdAt: -1
        }
      }
    ],
    { page, limit }
  );

  if (!tweets.docs || tweets.docs.length === 0) {
    throw new ApiError(404, "Tweets not found!");
  }

  return res.status(200).json(
    new ApiResponse(200, tweets, "Tweets fetched successfully")
  );
});

const updateTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const tweetId = req.params._id;

  if(!content?.trim()){
    throw new ApiError(400,"Content is required!");
  }

  const tweet = await Tweet.findByIdAndUpdate(tweetId,{content},{new:true});

  if(!tweet){
    throw new ApiError(404,"Tweet not found!");
  }
 return res.status(200).json(
  new ApiResponse(200,tweet,"Tweet updated successfully")
 )
});

const deleteTweet = asyncHandler(async (req, res) => {
  const tweetId = req.params._id;
  if(!isValidObjectId(tweetId)){
    throw new ApiError(400,"Invalid tweet id!!")
  }
  const tweet = await Tweet.findByIdAndDelete(tweetId)
  if(!tweet){
    throw new ApiError(404,"Tweet not found!")
  }
  return res.status(200).json(
    new ApiResponse(200,{},"Tweet deleted successfully!")
  )
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
