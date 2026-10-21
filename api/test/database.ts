import mongoose from "mongoose";

/** Select a suite-specific database only from an explicit URI ending in _test. */
export function testDatabaseUri(
  uri: string | undefined,
  suite: "auth" | "pantry" | "barcode",
): string {
  if (
    !uri ||
    !/^mongodb(?:\+srv)?:\/\/[^/]+\/[\w-]+_test(?:\?[^#]*)?$/.test(uri)
  ) {
    throw new Error(
      "TEST_MONGODB_URI must explicitly name a database ending in _test.",
    );
  }

  return uri.replace(/_test(?=\?|$)/, `_${suite}_test`);
}

/** Remove only authentication records for users registered by the calling suite. */
export async function removeTestUsers(userIds: string[]) {
  const ids = userIds.map((id) => new mongoose.Types.ObjectId(id));
  const database = mongoose.connection.db;

  await database?.collection("session").deleteMany({ userId: { $in: ids } });
  await database?.collection("account").deleteMany({ userId: { $in: ids } });
  await database?.collection("user").deleteMany({ _id: { $in: ids } });
}
