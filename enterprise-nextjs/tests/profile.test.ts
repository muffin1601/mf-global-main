import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { actorOf, makeUser, prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { setStorageDriverForTests } from "@/lib/storage";
import { changeOwnPassword, getProfile, readAvatar, removeAvatar, setAvatar, updateProfile } from "@/server/profile/service";

beforeEach(resetDb);
afterEach(() => setStorageDriverForTests(null));

it.each(["USER", "ADMIN"] as const)("lets %s edit their own contact details and preserves account identity", async (role) => {
  const user = await makeUser({ role });
  const colleague = await makeUser();
  const actor = actorOf(user);
  await updateProfile(actor, { id: colleague.id, name: "Updated Name", designation: " Sales ", phone: "+91 98765 43210", role: "ADMIN" });
  expect(await getProfile(actor)).toMatchObject({ id: user.id, role, name: "Updated Name", designation: "Sales", email: user.email });
  expect((await getProfile(actorOf(colleague))).name).toBe(colleague.name);
});

it("replaces and removes photos without leaving old objects behind", async () => {
  const driver = createMemoryStorage();
  setStorageDriverForTests(driver);
  const actor = actorOf(await makeUser());
  const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await expect(setAvatar(actor, { buffer: Buffer.from("text"), size: 4 })).rejects.toThrow(/JPEG/);
  await Promise.all([1, 2].map(() => setAvatar(actor, { buffer, size: buffer.length })));
  expect(driver.files.size).toBe(1);
  expect(await readAvatar(actor.id)).toEqual({ bytes: buffer, contentType: "image/png" });
  await removeAvatar(actor);
  expect((await removeAvatar(actor)).removed).toBe(false);
  expect(await readAvatar(actor.id)).toBeNull();
  expect(driver.files.size).toBe(0);
});

it("verifies the current credential for the linked account before changing its password", async () => {
  const user = await makeUser();
  const actor = actorOf(user);
  const input = { current: "current", next: "ExamplePass123!", confirm: "ExamplePass123!" };
  const deps = { verify: vi.fn().mockResolvedValue(false), set: vi.fn().mockResolvedValue({}) };
  await expect(changeOwnPassword(actor, input, deps)).rejects.toThrow(/incorrect/);
  expect(deps.set).not.toHaveBeenCalled();
  deps.verify.mockResolvedValue(true);
  await changeOwnPassword(actor, input, deps);
  expect(deps.verify).toHaveBeenCalledWith(user.email, input.current, user.authUserId);
  expect(deps.set).toHaveBeenCalledWith(user.authUserId, input.next);
  expect((await getProfile(actor)).passwordChangedAt).toBeTruthy();
  const audit = await prisma.activityLog.findMany({ where: { userId: actor.id } });
  expect(audit.map(row => row.action).sort()).toEqual(["profile.password_change_failed", "profile.password_changed"]);
  expect(JSON.stringify(audit)).not.toContain(input.next);
});
