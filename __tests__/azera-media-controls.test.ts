import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  token: vi.fn(),
  audit: vi.fn(),
  notify: vi.fn(),
  settings: vi.fn(),
  api: {
    room: {
      createRoom: vi.fn(),
      listParticipants: vi.fn(),
      updateParticipant: vi.fn(),
      removeParticipant: vi.fn(),
      deleteRoom: vi.fn(),
    },
  },
  call: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/admin-auth", () => ({
  getSession: mocks.session,
  hasPermission: () => true,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("@/lib/azera-media", () => ({
  mediaConfig: mocks.settings,
  mediaApi: () => mocks.api,
  mediaToken: mocks.token,
  mediaAudit: mocks.audit,
  whisperRoom: (id: string, agent: string) => `azera-private-${id}-${agent}`,
}));
vi.mock("@/lib/admin-notifications", () => ({ notifyAdminUser: mocks.notify }));
import { POST } from "@/app/api/azera/calls/[id]/media/route";
const context = { params: Promise.resolve({ id: "call-1" }) };
const request = (action: string) =>
  new Request("https://example.test/media", {
    method: "POST",
    body: JSON.stringify({ action }),
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates = [];
  mocks.call = {
    id: "call-1",
    webrtc_room: "private-customer-room",
    status: "active",
    agent_user_id: "owner",
    transfer_to_user_id: "receiver",
    transfer_expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  mocks.session.mockResolvedValue({
    userId: "supervisor",
    name: "Supervisor",
    role: "Admin",
  });
  mocks.settings.mockResolvedValue({ publicUrl: "wss://media.example.test" });
  mocks.token.mockResolvedValue("scoped-token");
  mocks.audit.mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.api.room.deleteRoom.mockResolvedValue(undefined);
  mocks.api.room.removeParticipant.mockResolvedValue(undefined);
  mocks.api.room.listParticipants.mockResolvedValue([
    { identity: "agent-receiver", tracks: [{ type: 0, muted: false }] },
  ]);
  mocks.from.mockImplementation(() => {
    const q = {} as Record<string, unknown>;
    for (const key of ["select", "eq", "update", "is", "in"])
      q[key] = vi.fn(() => q);
    q.update = vi.fn((value: Record<string, unknown>) => {
      mocks.updates.push(value);
      return q;
    });
    q.maybeSingle = vi.fn(async () => ({ data: mocks.call, error: null }));
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve);
    return q;
  });
});
describe("Live media permissions and handover", () => {
  it("does not let a supervisor hang up another agent's call", async () => {
    expect((await POST(request("end"), context)).status).toBe(403);
    expect(mocks.api.room.deleteRoom).not.toHaveBeenCalled();
  });
  it("refuses overlapping controls before touching live audio", async () => {
    mocks.call.media_control_claim = "another-control";
    expect((await POST(request("barge"), context)).status).toBe(409);
    expect(mocks.api.room.createRoom).not.toHaveBeenCalled();
  });
  it("does not mark a customer call ended when the media server cannot confirm shutdown", async () => {
    mocks.session.mockResolvedValue({
      userId: "owner",
      name: "Owner",
      role: "Tech",
    });
    mocks.api.room.deleteRoom.mockRejectedValueOnce(
      new Error("Media server unavailable"),
    );
    expect((await POST(request("end"), context)).status).toBe(503);
    expect(mocks.updates.some((value) => value.status === "ended")).toBe(false);
    expect(mocks.updates).toContainEqual({ media_control_claim: null });
  });
  it("holds the phone leg only after acquiring a control claim", async () => {
    mocks.session.mockResolvedValue({
      userId: "owner",
      name: "Owner",
      role: "Tech",
    });
    mocks.call.transfer_to_user_id = null;
    expect((await POST(request("hold"), context)).status).toBe(200);
    expect(mocks.api.room.updateParticipant).toHaveBeenCalledWith(
      "private-customer-room",
      "phone-call-1",
      expect.objectContaining({
        permission: expect.objectContaining({
          canPublish: false,
          canSubscribe: false,
        }),
      }),
    );
    expect(
      mocks.updates.some(
        (value) => typeof value.media_control_claim === "string",
      ),
    ).toBe(true);
  });
  it("never grants listen-only supervisors permission to speak into the customer call", async () => {
    expect((await POST(request("listen"), context)).status).toBe(200);
    expect(mocks.token).toHaveBeenCalledWith(
      expect.anything(),
      "private-customer-room",
      "supervisor-supervisor",
      "Supervisor",
      false,
    );
  });
  it("sends whisper audio only to a separate room for the assigned agent", async () => {
    const response = await POST(request("whisper"), context);
    expect(response.status).toBe(200);
    expect(mocks.token.mock.calls.map((call) => [call[1], call[4]])).toEqual([
      ["private-customer-room", false],
      ["azera-private-call-1-owner", true],
    ]);
    expect((await response.json()).privateRoom).toBe(
      "azera-private-call-1-owner",
    );
  });
  it("does not give ordinary support users supervisor access", async () => {
    mocks.session.mockResolvedValue({
      userId: "receiver",
      name: "Agent",
      role: "Tech",
    });
    expect((await POST(request("barge"), context)).status).toBe(403);
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("rejects a supervisor pretending to join as the assigned agent", async () => {
    expect((await POST(request("join"), context)).status).toBe(403);
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("keeps the original agent connected when a receiver has no live audio", async () => {
    mocks.session.mockResolvedValue({ userId: "receiver", role: "Sales" });
    mocks.api.room.listParticipants.mockResolvedValue([]);
    expect((await POST(request("accept"), context)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.api.room.removeParticipant).not.toHaveBeenCalled();
  });
  it("does not disconnect the original agent when the atomic claim fails", async () => {
    mocks.session.mockResolvedValue({ userId: "receiver", role: "Sales" });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request("accept"), context)).status).toBe(409);
    expect(mocks.api.room.removeParticipant).not.toHaveBeenCalled();
  });
  it("disables and removes original-agent audio only after the transfer was claimed", async () => {
    mocks.session.mockResolvedValue({ userId: "receiver", role: "Sales" });
    expect((await POST(request("accept"), context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("azera_accept_media_transfer", {
      p_call_id: "call-1",
      p_agent_id: "receiver",
    });
    expect(mocks.api.room.updateParticipant).toHaveBeenCalledWith(
      "private-customer-room",
      "agent-owner",
      expect.objectContaining({
        permission: expect.objectContaining({
          canPublish: false,
          canSubscribe: false,
        }),
      }),
    );
    expect(mocks.api.room.removeParticipant).toHaveBeenCalledWith(
      "private-customer-room",
      "agent-owner",
    );
  });
});
