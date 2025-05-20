import mongoose from "mongoose";
import { Comment } from "../models/comments.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!videoId) {
    throw new ApiError(400, "Video Id is missing!");
  }

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);

  const skip = (pageNumber - 1) * limitNumber;

  const comments = await Comment.find({ video: videoId })
    .populate("owner", "username fullname avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber);

  const totalComments = await Comment.countDocuments({ video: videoId });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        comments,
        totalComments,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalComments / limitNumber),
      },
      "Comments fetched successfully"
    )
  );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;
  const userId = req.user?._id;
  if (!content?.trim()) {
    throw new ApiError(400, "You must write a comment to post it!");
  }
  if (!videoId) {
    throw new ApiError(400, "Video Id is Missing!");
  }
  if (!userId) {
    throw new ApiError(400, "User must be logged in to comments!");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: userId,
  });

  const newComment = await Comment.findById(comment._id).populate(
    "owner",
    "username fullname avatar"
  );

  if (!newComment) {
    throw new ApiError(500, "Failed to create comment");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newComment, "Comment created successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user?._id;

  if (!content?.trim()) {
    throw new ApiError(400, "Comment needs to have content");
  }
  if (!commentId) {
    throw new ApiError(400, "Comment Id is required!");
  }
  if (!userId) {
    throw new ApiError(400, "User Id is required!");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  // check if the is someone elses or not :

  if (comment.owner.toString() != userId.owner.toString()) {
    throw new ApiError(403, "Unauthorized: You can only update your comment");
  }

  comment.content = content;
  await comment.save();

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?._id;

  if (!commentId) {
    throw new ApiError(400, "Comment Id is required");
  }
  if (!userId) {
    throw new ApiError(400, "User Id is required");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  if (comment.owner.toString() != user.owner.toString()) {
    throw new ApiError(
      403,
      "Unauthorized: You can only delete your own comment"
    );
  }
  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
