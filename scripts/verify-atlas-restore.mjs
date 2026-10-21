import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { BSON, MongoClient } from "mongodb";

// backup-atlas.ps1 invokes this file through Node rather than a JS import;
// knip.json lists it as an entry point so it is not mistaken for an unused file.
// Receive the credential through stdin, never command-line arguments or logs.
let uri = "";
for await (const chunk of process.stdin) {
  uri += chunk;
}
const client = new MongoClient(uri.trim(), { serverSelectionTimeoutMS: 10000 });
const source = client.db("sari_prod");
const target = client.db("sari_restore_verify");

async function digest(collection) {
  const hash = createHash("sha256");
  let count = 0;
  for await (const document of collection.find().sort({ _id: 1 })) {
    hash.update(BSON.EJSON.stringify(document, { relaxed: false }));
    count++;
  }
  return { count, sha256: hash.digest("hex") };
}

function indexDefinitions(indexes) {
  return indexes
    .map(({ ns: _namespace, ...definition }) => definition)
    .sort((a, b) => a.name.localeCompare(b.name));
}

try {
  await client.connect();
  const collections = await source
    .listCollections({}, { nameOnly: false })
    .toArray();
  const restored = await target
    .listCollections({}, { nameOnly: true })
    .toArray();
  assert.deepEqual(
    restored.map((c) => c.name).sort(),
    collections.map((c) => c.name).sort(),
  );
  for (const collection of collections) {
    const original = source.collection(collection.name);
    const copy = target.collection(collection.name);
    const expected = await digest(original);
    assert.deepEqual(
      await digest(copy),
      expected,
      `${collection.name}: restored documents differ`,
    );
    assert.deepEqual(
      indexDefinitions(await copy.listIndexes().toArray()),
      indexDefinitions(await original.listIndexes().toArray()),
      `${collection.name}: restored indexes differ`,
    );
    const options = await target
      .listCollections({ name: collection.name })
      .next();
    assert.deepEqual(
      options.options,
      collection.options,
      `${collection.name}: collection options differ`,
    );
    console.info(
      JSON.stringify({
        collection: collection.name,
        documents: expected.count,
        dataAndIndexesVerified: true,
      }),
    );
  }
  console.info(
    "Restore verified against production documents, BSON types, collection options, and indexes.",
  );
} catch (error) {
  // Avoid printing connection details or document contents on comparison failure.
  console.error(
    `Restore verification failed (${error instanceof Error ? error.name : "unknown error"}). Verify during a quiet period; a live export is not a point-in-time snapshot.`,
  );
  process.exitCode = 1;
} finally {
  try {
    for (const collection of await target
      .listCollections({}, { nameOnly: true })
      .toArray()) {
      await target.dropCollection(collection.name);
    }
    console.info("Disposable restore database removed.");
  } catch {
    console.error("Could not remove the disposable restore database.");
    process.exitCode = 1;
  }
  await client.close();
}
