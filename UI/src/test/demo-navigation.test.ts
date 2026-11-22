import { describe, expect, it } from "vitest";
import { showDemoRoleSwitcher } from "@/lib/demo-navigation";

describe("Development-only role navigation", () => {
  it("permits the role switcher in development", () => {
    expect(showDemoRoleSwitcher(true)).toBe(true);
  });
  it("disables the role switcher in production", () => {
    expect(showDemoRoleSwitcher(false)).toBe(false);
  });
});