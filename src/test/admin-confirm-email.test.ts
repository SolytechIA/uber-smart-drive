import { describe, expect, it, vi } from "vitest";
import { createConfirmEmailHandler } from "../../supabase/functions/admin-confirm-email/handler";

const userId = "11111111-1111-4111-8111-111111111111";
function setup(authenticated = true, authorized = true, confirmed = true) {
  const deps = {
    authenticate: vi.fn().mockResolvedValue(authenticated),
    authorizedTarget: vi.fn().mockResolvedValue(authorized),
    confirmEmail: vi.fn().mockResolvedValue(confirmed),
  };
  return { deps, handler: createConfirmEmailHandler(deps, {}) };
}
function request(body: unknown = { user_id: userId }, token = "test-token") {
  return new Request("http://localhost/admin-confirm-email", {
    method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  });
}
describe("admin email confirmation", () => {
  it("rejects missing authentication before any privileged action", async () => {
    const { handler, deps } = setup();
    expect((await handler(request(undefined, ""))).status).toBe(401);
    expect(deps.confirmEmail).not.toHaveBeenCalled();
  });
  it("rejects an invalid session", async () => {
    const { handler, deps } = setup(false);
    expect((await handler(request())).status).toBe(401);
    expect(deps.authorizedTarget).not.toHaveBeenCalled();
    expect(deps.confirmEmail).not.toHaveBeenCalled();
  });
  it("rejects non-administrators even if the request claims an admin role", async () => {
    const { handler, deps } = setup(true, false);
    expect((await handler(request({ user_id: userId, is_admin: true }))).status).toBe(403);
    expect(deps.confirmEmail).not.toHaveBeenCalled();
  });
  it("confirms only the selected user after server authorization", async () => {
    const { handler, deps } = setup();
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(deps.authorizedTarget).toHaveBeenCalledWith("test-token", userId);
    expect(deps.confirmEmail).toHaveBeenCalledExactlyOnceWith(userId);
    expect(await response.json()).toEqual({ success: true, user_id: userId });
  });
  it("rejects malformed user identifiers", async () => {
    const { handler, deps } = setup();
    expect((await handler(request({ user_id: "invalid" }))).status).toBe(400);
    expect(deps.confirmEmail).not.toHaveBeenCalled();
  });
  it("does not report success when confirmation fails", async () => {
    const { handler } = setup(true, true, false);
    expect((await handler(request())).status).toBe(500);
  });
});