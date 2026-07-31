import { describe, expect, it } from "vitest";
import {
  changeToneClass,
  heatTileColor,
  HEAT_NEUTRAL,
  HEAT_TEAL,
  HEAT_TEAL_MID,
  HEAT_TEAL_SOFT,
  HEAT_RED_SOFT_BG,
  HEAT_RED_MID,
  HEAT_RED_STRONG,
} from "@/lib/display/heat-color";

describe("heatTileColor", () => {
  it("returns neutral for missing or flat moves", () => {
    expect(heatTileColor(null)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(undefined)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(0)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(0.02)).toBe(HEAT_NEUTRAL);
  });

  it("uses soft teal/red for routine moves", () => {
    expect(heatTileColor(1.2)).toBe(HEAT_TEAL_SOFT);
    expect(heatTileColor(-0.8)).toBe(HEAT_RED_SOFT_BG);
  });

  it("escalates past ±2.5%", () => {
    expect(heatTileColor(3)).toBe(HEAT_TEAL_MID);
    expect(heatTileColor(-3)).toBe(HEAT_RED_MID);
  });

  it("uses solid teal for extreme ups like +15.2%", () => {
    expect(heatTileColor(15.2)).toBe(HEAT_TEAL);
    expect(heatTileColor(-12)).toBe(HEAT_RED_STRONG);
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
