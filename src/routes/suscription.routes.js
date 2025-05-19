import { Router } from "express";
import {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // middleware to all routes

router
  .route("/c/:channelId")
  .get(getSubscribedChannels)
  .post(toggleSubscription);

router.route("/u/:suscriberId").get(getUserChannelSubscribers);

export default router;
