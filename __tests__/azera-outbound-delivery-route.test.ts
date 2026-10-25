import { beforeEach, describe, expect, it, vi } from "vitest";
type Row = {
  data: Record<string, unknown> | null;
  error?: { code: string } | null;
};
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  from: vi.fn(),
  dispatch: vi.fn(),
  replay: vi.fn(),
  saveThrows: false,
  summaryFails: false,
  rows: [] as Row[],
  queries: [] as {
    table: string;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("@/lib/admin-auth", () => ({
  getSession: mocks.session,
  hasPermission: () => true,
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/azera-channel-delivery", () => ({
  dispatchChannelText: mocks.dispatch,
  socialChannel: (channel: string) => channel !== "website",
}));
vi.mock("@/lib/azera-social-webhook", () => ({
  replayDeliveryReceipts: mocks.replay,
}));
import { POST } from "@/app/api/azera/conversations/[id]/messages/route";
const conversation = {
  id: "conversation-1",
  business_id: "business-1",
  channel: "whatsapp",
  external_id: "2348000000001",
  status: "open",
};
const saved = {
  id: "message-1",
  message: "Hello",
  conversation_id: conversation.id,
  author_type: "agent",
  author_id: "agent-1",
  direction: "outbound",
  delivery_status: "pending",
  delivery_attempts: 1,
};
const context = { params: Promise.resolve({ id: conversation.id }) };
const request = (body: object) =>
  new Request("https://example.test/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.length = 0;
  mocks.queries.length = 0;
  mocks.saveThrows = false;
  mocks.summaryFails = false;
  mocks.replay.mockResolvedValue(undefined);
  mocks.session.mockResolvedValue({ userId: "agent-1", role: "Admin" });
  mocks.dispatch.mockResolvedValue({
    status: "accepted",
    providerId: "provider-1",
  });
  mocks.from.mockImplementation((table) => {
    const q = { table } as Record<string, unknown>;
    for (const key of ["select", "insert", "update", "eq"] as const)
      q[key] = vi.fn(() => q);
    q.single = q.maybeSingle = vi.fn(
      async () => mocks.rows.shift() || { data: null, error: null },
    );
    q.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => {
      if (table === "azera_messages" && mocks.saveThrows)
        return Promise.reject(new Error("connection lost")).then(
          resolve,
          reject,
        );
      return Promise.resolve({
        data: null,
        error:
          table === "azera_conversations" && mocks.summaryFails
            ? { message: "summary unavailable" }
            : null,
      }).then(resolve, reject);
    };
    mocks.queries.push(q as (typeof mocks.queries)[number]);
    return q;
  });
});
describe("Unified inbox outbound delivery endpoint", () => {
  it("preserves an accepted reply when receipt synchronization fails", async () => {
    mocks.rows.push({ data: conversation }, { data: saved });
    mocks.replay.mockRejectedValueOnce(new Error("receipt unavailable"));
    const response = await POST(request({ message: "Hello" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      message: { id: saved.id, delivery_status: "accepted" },
      warning: expect.stringContaining("do not send it again"),
    });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
  it("preserves an accepted reply when updating the conversation summary fails", async () => {
    mocks.rows.push({ data: conversation }, { data: saved });
    mocks.summaryFails = true;
    const response = await POST(request({ message: "Hello" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      message: { id: saved.id, delivery_status: "accepted" },
      warning: expect.any(String),
    });
  });
  it("returns the stored message with an uncertain result when persisting acceptance throws", async () => {
    mocks.rows.push({ data: conversation }, { data: saved });
    mocks.saveThrows = true;
    const response = await POST(request({ message: "Hello" }), context);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      message: { id: saved.id, delivery_status: "unknown" },
      error: expect.stringContaining("Check the provider inbox"),
    });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
  it("binds author and direction to the authenticated agent, not browser-supplied impersonation", async () => {
    mocks.rows.push({ data: conversation }, { data: saved });
    const response = await POST(
      request({
        message: "Hello",
        author_type: "customer",
        author_id: "someone-else",
        direction: "inbound",
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(
      mocks.queries.find((q) => q.table === "azera_messages")!.insert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        author_type: "agent",
        author_id: "agent-1",
        direction: "outbound",
      }),
    );
    expect(mocks.dispatch).toHaveBeenCalledWith(conversation, "Hello");
    expect((await response.json()).message.delivery_status).toBe("accepted");
  });
  it("does not dispatch again when the same client reference has already been saved", async () => {
    mocks.rows.push(
      { data: conversation },
      { data: { ...saved, delivery_status: "accepted" } },
    );
    expect(
      (
        await POST(
          request({
            message: "Hello",
            metadata: { client_message_id: "optimistic-test" },
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("returns a failed persisted message, not a false successful delivery or a lost draft", async () => {
    mocks.rows.push({ data: conversation }, { data: saved });
    mocks.dispatch.mockResolvedValue({
      status: "failed",
      error: "Provider refused",
    });
    const response = await POST(request({ message: "Hello" }), context);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      message: { id: saved.id, delivery_status: "failed" },
      error: "Provider refused",
    });
  });
  it("requires explicit confirmation before retrying an uncertain send", async () => {
    mocks.rows.push(
      { data: conversation },
      { data: { ...saved, delivery_status: "unknown" } },
    );
    expect(
      (await POST(request({ retry_message_id: saved.id }), context)).status,
    ).toBe(409);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("atomically claims failed retries and reuses the stored message rather than injected replacement text", async () => {
    mocks.rows.push(
      { data: conversation },
      { data: { ...saved, delivery_status: "failed" } },
      { data: saved },
    );
    expect(
      (
        await POST(
          request({ retry_message_id: saved.id, message: "injected" }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(mocks.dispatch).toHaveBeenCalledWith(conversation, "Hello");
    expect(mocks.queries[2].eq).toHaveBeenCalledWith(
      "delivery_status",
      "failed",
    );
    expect(mocks.queries[2].update).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_message_id: null,
        delivery_attempts: 2,
      }),
    );
  });
  it("rejects closed chats and unauthenticated users before dispatch", async () => {
    mocks.rows.push({ data: { ...conversation, status: "closed" } });
    expect((await POST(request({ message: "Hello" }), context)).status).toBe(
      409,
    );
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ message: "Hello" }), context)).status).toBe(
      403,
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
