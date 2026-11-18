import { startTestDatabase } from "../scripts/test-db.mjs";

let stop: (() => Promise<void>) | undefined;

export async function setup() {
  const { server } = await startTestDatabase();
  stop = () => server.stop();
}

export async function teardown() {
  await stop?.();
}
