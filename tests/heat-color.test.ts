import { describe, expect, it } from "vitest";
import {
  changeToneClass,
  heatBand,
  heatChipColors,
  heatTileColor,
  HEAT_NEUTRAL,
  HEAT_TEAL,
  HEAT_TEAL_MID,
  HEAT_TEAL_SOFT,
  HEAT_RED_SOFT_BG,
  HEAT_RED_MID,
  HEAT_RED_STRONG,
} from "@/lib/display/heat-color";

describe("heatBand / heatTileColor", () => {
  it("returns flat/neutral for missing or flat moves", () => {
    expect(heatBand(null)).toBe("flat");
    expect(heatTileColor(0)).toBe(HEAT_NEUTRAL);
    expect(heatTileColor(0.02)).toBe(HEAT_NEUTRAL);
  });

  it("uses mild fills under the strong threshold", () => {
    expect(heatBand(1.2)).toBe("up-mild");
    expect(heatTileColor(1.2)).toBe(HEAT_TEAL_SOFT);
    expect(heatBand(-0.8)).toBe("down-mild");
    expect(heatTileColor(-0.8)).toBe(HEAT_RED_SOFT_BG);
  });

  it("escalates past ±2.5% and ±8%", () => {
    expect(heatBand(3)).toBe("up-strong");
    expect(heatTileColor(3)).toBe(HEAT_TEAL_MID);
    expect(heatBand(-3)).toBe("down-strong");
    expect(heatTileColor(-3)).toBe(HEAT_RED_MID);
    expect(heatBand(15.2)).toBe("up-extreme");
    expect(heatTileColor(15.2)).toBe(HEAT_TEAL);
    expect(heatBand(-12)).toBe("down-extreme");
    expect(heatTileColor(-12)).toBe(HEAT_RED_STRONG);
  });
});

describe("heatChipColors", () => {
  it("returns contrast-matched chip colors per band", () => {
    expect(heatChipColors(0.4)).toEqual({ background: "#0f6e66", color: "#d5f6f1" });
    expect(heatChipColors(6.9)).toEqual({ background: "#14b8a6", color: "#04121a" });
    expect(heatChipColors(-8.8)).toEqual({ background: "#f0665e", color: "#04121a" });
    expect(heatChipColors(0)).toEqual({ background: "#2c3646", color: "#edf1f5" });
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
