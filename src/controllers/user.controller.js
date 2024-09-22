import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
const generateAccessAndRefreshToken = asyncHandler(async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken =  user.generateAccessToken();
    const refreshToken=  user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating access token and refresh token"
    );
  }
});
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, username, email, password } = req.body;
  // console.log(req.body);

  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existedUser) {
    throw new ApiError(409, "User or email already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    username: username.toLowerCase(),
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }
  const user =await  User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User not found or email not found");
  }
  const passwordValidity = await user.isPasswordCorrect(password)
  if (!passwordValidity) {
    throw new ApiError(401, "Password incorrect");
  }
  //generate access and refresh token next step
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In successfully "
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User logged Out successfully"));
});

const refreshAccessToken= asyncHandler(async(req, res)=>{
  const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401, "unauthorized request")
  }
  
 try {
  const decodedToken= jwt.verify(
     incomingRefreshToken,
     process.env.REFRESH_TOKEN_SECRET
   )
 
    const user= await User.findById(decodedToken?._id)
 
    if(!user){
     throw new ApiError(401, "Invalid refresh token")
    }
 
    if(incomingRefreshToken !== user.refreshToken){
     throw new ApiError(401, "Refresh token is expired or used ")
    }
 
    const options={
     httpOnly: true,
     secure: true
    }
 
   const {accessToken, newRefreshToken} =await generateAccessAndRefreshToken(user._id)
 
    return res
    .status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",newRefreshToken, options)
    .json(
     new ApiResponse(200,{
       accessToken,
       refreshToken: newRefreshToken,
       message:"Access token refreshed successfully"
     })
    )
 } catch (error) {
    throw new ApiError(401, error?.message||"Invalid refresh token")
 }
})

const changeCurrentPassword=asyncHandler(async(req, res)=>{
  const {oldPassword, newPassword}= req.body 

  const user= await User.findById(req.user?._id)
  
  const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(401, "Incorrect password")
  }

  user.password= newPassword
  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(new ApiResponse(200, {}, "Password updated successfully"))
})

const getCurrentUser= asyncHandler(async(req, res)=>{
  return res
  .status(200)
  .json(new ApiResponse(200, req.user,"Current User fetched successfully"))
})

const updateAccountDetails= asyncHandler(async(req, res)=>{
    const {fullname,email}=req.body

    if(!(fullname|| email)){
      throw new ApiError(401, "Invalid fullname or email ")
    }
    const user= await User.findByIdAndUpdate(req._id ,
      {
        $set:{
          fullname, 
          email
        },
      },
      {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar=asyncHandler(async(req, res)=>{
  const avatarLocalPath=req.file?.path 
  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar File is Missing")
  }

  const avatar= uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400,"Something went wrong file uploading Avatar")
  }

 const user= await User.findByIdAndUpdate(req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
  ).select("-password")

  //delete the previously uploader avatar

  return res
  .status(200)
  .json(new ApiResponse, user,"Avatar updated successfully")
})

const updateUserCoverImage=asyncHandler(async(req, res)=>{
  const coverImageLocaPath=req.file?.path
  
  if(!coverImageLocaPath){
    throw new ApiError(400,"Cover Image File is missing ")
  }

  const coverImage=uploadOnCloudinary(coverImageLocaPath)

  if(!coverImage.url){
    throw new ApiError(400,"Something Went Wrong file Uploading Cover image")
  }

  const user= await User.findByIdAndUpdate(req.user?._id,
    {
      $set:{
        coverImage: coverImage.url
      }
    },
    {new:true}
  ).select("-password")
  //delete the previously uploader cover image


  return res
  .status(200)
  .json(new ApiResponse, user,"Cover Image updated successfully")
})


export { 
  registerUser, 
  loginUser, 
  logoutUser ,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
