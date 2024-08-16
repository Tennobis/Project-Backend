import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n MongoDB connected successfully! at: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.error("ERROR connecting to database: ", error);
    throw error;
  }
};

export default connectDB;
