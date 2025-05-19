import { Router } from "express";
import {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
} from "../controllers/video.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/get-all-videos").get(getAllVideos);
router.route("/publish-video").post(
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  publishAVideo
);
router.route("/get-video").get(getVideoById);
router.route("/update-video").post(updateVideo);
router.route("/delete-video").delete(deleteVideo);
router.route("toggle-status").post(togglePublishStatus);


export default router