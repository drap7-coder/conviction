import { describe, expect, it } from "vitest";
import { changeToneClass, heatTileColor, HEAT_NEUTRAL } from "@/lib/display/heat-color";

describe("heatTileColor", () => {
  it("returns neutral for missing or flat moves", () => {
    expect(heatTileColor(null)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(undefined)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(0)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(0.02)).toBe(HEAT_NEUTRAL);
  });

  it("uses mild tints for routine moves", () => {
    expect(heatTileColor(1.2)).toBe("#DCFCE7");
    expect(heatTileColor(-0.8)).toBe("#FEF2F2");
  });

  it("escalates past the strong threshold", () => {
    expect(heatTileColor(3)).toBe("#86EFAC");
    expect(heatTileColor(-3)).toBe("#FECACA");
  });
});

describe("changeToneClass", () => {
  it("returns neutral for missing or flat values", () => {
    expect(changeToneClass(null)).toBe("neutral");
    expect(changeToneClass(0)).toBe("neutral");
  });

  it("keeps ups positive and small downs mild", () => {
    expect(changeToneClass(0.4)).toBe("positive");
    expect(changeToneClass(-0.3)).toBe("negative-mild");
  });

  it("reserves full red for larger downs", () => {
    expect(changeToneClass(-1.5)).toBe("negative");
  });
});
