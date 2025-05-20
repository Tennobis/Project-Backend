import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { serverLimit } from "./constants.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: serverLimit }));
app.use(express.urlencoded({ extended: true, limit: serverLimit }));
app.use(express.static("public"));
app.use(cookieParser());

//Import routes :

import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";
import subscriptionRouter from "./routes/suscription.routes.js";
import commentRouter from "./routes/comments.routes.js";

//route declarations:

app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/comments", commentRouter);
export { app };
