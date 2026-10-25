import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  receipts: [] as { status: string; occurred_at: string }[],
  queries: [] as {
    table: string;
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/omnichannel-notifications", () => ({
  notifySupportAgents: vi.fn(),
}));
import { replayDeliveryReceipts } from "@/lib/azera-social-webhook";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.receipts = [];
  mocks.queries.length = 0;
  mocks.from.mockImplementation((table) => {
    const q = { table } as Record<string, unknown>;
    for (const key of ["select", "update", "eq", "in"]) q[key] = vi.fn(() => q);
    q.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data:
          table === "azera_delivery_receipts"
            ? mocks.receipts
            : [{ id: "conversation-1" }],
        error: null,
      }).then(resolve);
    mocks.queries.push(q as (typeof mocks.queries)[number]);
    return q;
  });
});
const receipt = (status: string) => ({
  status,
  occurred_at: "2026-10-25T12:00:00Z",
});
const messageQuery = () =>
  mocks.queries.find((q) => q.table === "azera_messages")!;

describe("Provider receipt precedence", () => {
  it("allows failed delivery to supersede sent, without overwriting delivered or read", async () => {
    mocks.receipts = [receipt("sent"), receipt("failed")];
    await replayDeliveryReceipts("business-1", "provider-1");
    expect(messageQuery().update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: "failed" }),
    );
    expect(messageQuery().in).toHaveBeenCalledWith("delivery_status", [
      "pending",
      "accepted",
      "unknown",
      "sent",
    ]);
  });
  it("keeps positive read proof above all other out-of-order receipts", async () => {
    mocks.receipts = [
      receipt("failed"),
      receipt("read"),
      receipt("sent"),
      receipt("delivered"),
    ];
    await replayDeliveryReceipts("business-1", "provider-1");
    expect(messageQuery().update).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_status: "read",
        delivery_error: null,
      }),
    );
    expect(messageQuery().in).toHaveBeenCalledWith(
      "delivery_status",
      expect.arrayContaining(["failed", "delivered"]),
    );
  });
  it("allows proven delivery to replace a failed state, but never regresses read", async () => {
    mocks.receipts = [receipt("delivered"), receipt("failed")];
    await replayDeliveryReceipts("business-1", "provider-1");
    expect(messageQuery().update).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_status: "delivered" }),
    );
    const allowed = messageQuery().in.mock.calls.find(
      ([field]) => field === "delivery_status",
    )![1];
    expect(allowed).toContain("failed");
    expect(allowed).not.toContain("read");
  });
  it("scopes provider references to the sending business and its conversations", async () => {
    mocks.receipts = [receipt("sent")];
    await replayDeliveryReceipts("business-1", "provider-1");
    expect(mocks.queries[0].eq).toHaveBeenCalledWith(
      "business_id",
      "business-1",
    );
    expect(mocks.queries[1].eq).toHaveBeenCalledWith(
      "business_id",
      "business-1",
    );
    expect(messageQuery().eq).toHaveBeenCalledWith(
      "provider_message_id",
      "provider-1",
    );
    expect(messageQuery().in).toHaveBeenCalledWith("conversation_id", [
      "conversation-1",
    ]);
  });
});
