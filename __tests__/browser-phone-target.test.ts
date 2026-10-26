import { describe, expect, it } from "vitest";
import { normalizeDialNumber } from "@/lib/browser-phone-target";
describe("Header dial-pad numbers", () => {
  it.each([["08012345678", "+2348012345678"], ["+44 20 7946 0123", "+442079460123"], ["002348012345678", "+2348012345678"], ["2348012345678", "+2348012345678"]])("normalizes %s", (input, output) => expect(normalizeDialNumber(input)).toBe(output));
  it.each(["", "911", "*123#", "sip:agent@example.test", "javascript:alert(1)", "+1234567890123456", "08012345678;123"])("rejects non-phone target %s", input => expect(normalizeDialNumber(input)).toBeNull());
});
