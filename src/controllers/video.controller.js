import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/users.models.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    
    // Parse page and limit to numbers
    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    
    // Create the pipeline for aggregation
    const pipeline = []
    
    // Match stage for query search
    if (query) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } }
                ]
            }
        })
    }
    
    // Match stage for user filter
    if (userId && isValidObjectId(userId)) {
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(String(userId))
            }
        })
    }
    
    // Sort stage
    const sortCriteria = {}
    if (sortBy) {
        sortCriteria[sortBy] = sortType === "desc" ? -1 : 1
        pipeline.push({ $sort: sortCriteria })
    } else {
        pipeline.push({ $sort: { createdAt: -1 } }) // Default sort by newest
    }
    
    // Add pagination stages
    pipeline.push(
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber }
    )
    
    // Execute aggregation
    const videos = await Video.aggregate(pipeline)
    
    if (!videos || videos.length === 0) {
        throw new ApiError(404, "No videos found")
    }
    
    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    
    if (!title || !description) {
        throw new ApiError(400, "Title and description are required")
    }
    
    // Get video and thumbnail files
    const videoFileLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path
    
    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required")
    }
    
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required")
    }
    
    // Upload to Cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    
    if (!videoFile) {
        throw new ApiError(400, "Video file upload failed")
    }
    
    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail upload failed")
    }
    
    // Create video in database
    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            publicId: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            publicId: thumbnail.public_id
        },
        owner: req.user._id,
        isPublished: true
    })
    
    if (!video) {
        throw new ApiError(500, "Failed to publish video")
    }
    
    return res.status(201).json(
        new ApiResponse(201, video, "Video published successfully")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    // Find video and increment views
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: { views: 1 }
        },
        {
            new: true
        }
    ).populate("owner", "username fullName avatar")
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    
    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    if (!title && !description) {
        throw new ApiError(400, "Title or description is required")
    }
    
    const video = await Video.findById(videoId)
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    
    // Check if the user is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video")
    }
    
    // Check if thumbnail is being updated
    const thumbnailLocalPath = req.file?.path
    let thumbnail
    
    if (thumbnailLocalPath) {
        // Delete old thumbnail from Cloudinary
        if (video.thumbnail?.publicId) {
            await deleteFromCloudinary(video.thumbnail.publicId)
        }
        
        // Upload new thumbnail
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
        if (!thumbnail) {
            throw new ApiError(400, "Thumbnail upload failed")
        }
    }
    
    // Update video details
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title || video.title,
                description: description || video.description,
                ...(thumbnail && {
                    thumbnail: {
                        url: thumbnail.url,
                        publicId: thumbnail.public_id
                    }
                })
            }
        },
        { new: true }
    )
    
    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video updated successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    const video = await Video.findById(videoId)
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    
    // Check if the user is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video")
    }
    
    // Delete video and thumbnail from Cloudinary
    if (video.videoFile?.publicId) {
        await deleteFromCloudinary(video.videoFile.publicId, "video")
    }
    
    if (video.thumbnail?.publicId) {
        await deleteFromCloudinary(video.thumbnail.publicId)
    }
    
    // Delete video from database
    await Video.findByIdAndDelete(videoId)
    
    return res.status(200).json(
        new ApiResponse(200, {}, "Video deleted successfully")
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    const video = await Video.findById(videoId)
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    
    // Check if the user is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to toggle publish status of this video")
    }
    
    // Toggle publish status
    video.isPublished = !video.isPublished
    await video.save({ validateBeforeSave: false })
    
    return res.status(200).json(
        new ApiResponse(200, video, `Video ${video.isPublished ? "published" : "unpublished"} successfully`)
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}