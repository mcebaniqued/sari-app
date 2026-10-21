import { spawn } from "node:child_process";

import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

// A disposable, randomly named database; never reads api/.env or an Atlas URI.
const database = await MongoMemoryServer.create({
  instance: { dbName: "sari_auth_test", ip: "127.0.0.1" },
});

try {
  const client = new MongoClient(database.getUri("sari_auth_test"));

  try {
    await client.connect();
    await client.db().command({ ping: 1 });
  } finally {
    await client.close();
  }

  for (const command of ["test", "test:e2e"]) {
    const code = await new Promise((resolve, reject) => {
      const windows = process.platform === "win32";
      const child = spawn(
        windows ? (process.env.ComSpec ?? "cmd.exe") : "npm",
        windows ? ["/d", "/s", "/c", `npm run ${command}`] : ["run", command],
        {
          stdio: "inherit",
          windowsHide: true,
          env: {
            ...process.env,
            TEST_MONGODB_URI: database.getUri("sari_auth_test"),
          },
        },
      );
      child.on("error", reject);
      child.on("exit", resolve);
    });
    if (code !== 0) {
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await database.stop();
}
