import mongoose from "mongoose";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`Sari API listening on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();

  server.close(() => {
    void mongoose.disconnect().then(
      () => {
        clearTimeout(timeout);
        process.exit(0);
      },
      () => process.exit(1),
    );
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
