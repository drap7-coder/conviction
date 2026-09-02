import { describe, expect, it } from "vitest";
import { changeToneClass } from "@/lib/display/heat-color";

describe("changeToneClass", () => {
  it("returns neutral for null/zero", () => {
    expect(changeToneClass(null)).toBe("neutral");
    expect(changeToneClass(0)).toBe("neutral");
  });

  it("returns positive for gains", () => {
    expect(changeToneClass(0.4)).toBe("positive");
  });

  it("softens small downs and keeps larger downs red", () => {
    expect(changeToneClass(-0.3)).toBe("negative-mild");
    expect(changeToneClass(-1.5)).toBe("negative");
  });
});
