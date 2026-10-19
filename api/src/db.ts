import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | undefined;

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (mongoose.connection.readyState === 1) return;

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
