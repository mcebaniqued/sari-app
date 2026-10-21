import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | undefined;

/** Share connection attempts across requests; clear settled attempts so failures can retry. */
export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }

  connectionPromise ??= mongoose
    .connect(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    })
    .finally(() => {
      connectionPromise = undefined;
    });

  await connectionPromise;
}
