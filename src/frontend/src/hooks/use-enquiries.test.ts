import { enquiryErrorMessage } from "@/hooks/use-enquiries";
import { describe, expect, it } from "vitest";

/**
 * The enquiry error-message mapping.
 *
 * The accepted request adds the purchase-enquiry surfaces, and every one of
 * them reports a register refusal through this one mapping. The register's
 * `EnquiryError` variants are stable tags, so the mapping must turn each into a
 * plain-language message a reader can act on, and must never leak a raw tag or
 * fall silent on an unrecognised one.
 *
 * This is a pure-function test: no actor, no network, no canister.
 */
describe("Enquiry error messages", () => {
  it("maps each register refusal to a plain-language message", () => {
    expect(enquiryErrorMessage("notAuthenticated")).toMatch(/sign in/i);
    expect(enquiryErrorMessage("notAuthorized")).toMatch(/administrator/i);
    expect(enquiryErrorMessage("unknownEnquiry")).toMatch(/no longer/i);
  });

  it("surfaces the register's own detail for an invalid input", () => {
    // The backend's `invalidInput` carries a human-readable detail; the mapping
    // must show it rather than a generic fallback.
    expect(enquiryErrorMessage("invalidInput", "consent is required")).toBe(
      "consent is required",
    );
  });

  it("falls back to a generic message when an invalid input carries no detail", () => {
    const message = enquiryErrorMessage("invalidInput");
    expect(message).toMatch(/incomplete|required/i);
    expect(message).not.toContain("invalidInput");
  });

  it("never leaks a raw variant tag for an unrecognised refusal", () => {
    const message = enquiryErrorMessage("somethingNew");
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain("somethingNew");
  });
});
