import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  validatePassword,
} from "@/lib/validate-password";

describe("validatePassword", () => {
  it("rejects empty password", () => {
    expect(validatePassword("")).toBe("Password is required.");
  });

  it("rejects below minimum length", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(
      PASSWORD_POLICY_MESSAGE,
    );
  });

  it("accepts minimum length", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it("accepts a normal password", () => {
    expect(validatePassword("correct-horse-battery")).toBeNull();
  });

  it("accepts maximum length", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_LENGTH))).toBeNull();
  });

  it("rejects above maximum length", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      PASSWORD_POLICY_MESSAGE,
    );
  });

  it("accepts unicode of sufficient length (no trim)", () => {
    // Measured with JS string.length (UTF-16 code units), same as Better Auth.
    expect(validatePassword("парольOK")).toBeNull(); // length 8
    expect(validatePassword("密码密码密码密码")).toBeNull(); // length 8
    expect(validatePassword("密码密码")).toBe(PASSWORD_POLICY_MESSAGE); // length 4
  });

  it("does not trim whitespace — leading/trailing spaces count toward length", () => {
    expect(validatePassword("  abcd  ")).toBeNull(); // length 8
    expect(validatePassword(" abcd  ")).toBe(PASSWORD_POLICY_MESSAGE); // length 7
  });

  it("never echoes the password in the error message", () => {
    const secret = `secret-${"x".repeat(200)}`;
    const message = validatePassword(secret);
    expect(message).toBe(PASSWORD_POLICY_MESSAGE);
    expect(message).not.toContain("secret");
    expect(message).not.toContain("xxx");
  });

  it("matches Better Auth default bounds", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });
});
