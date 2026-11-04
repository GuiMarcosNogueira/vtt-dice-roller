import { describe, it, expect } from "vitest";
import {
  BLOCK_COUNT,
  GLOBAL_CHANGED_RATIO,
  MIN_CHANGED_RATIO,
  blockMeans,
  changedRatio,
  meanDifference,
} from "../app/lib/motion";
import { makeFrame } from "./frames";

describe("motion analysis", () => {
  it("averages the gray level of each 8x8 block", () => {
    const means = blockMeans(makeFrame({ base: 100, texture: 40 }));

    expect(means).toHaveLength(BLOCK_COUNT);
    expect(new Set(Array.from(means))).toEqual(new Set([100, 140]));
  });

  it("reports no change between identical frames", () => {
    const a = blockMeans(makeFrame());
    const b = blockMeans(makeFrame());

    expect(changedRatio(a, b, 5)).toBe(0);
    expect(meanDifference(a, b)).toBe(0);
  });

  it("sees a small object as a small fraction of the frame", () => {
    const empty = blockMeans(makeFrame());
    const withDie = blockMeans(makeFrame({ blobs: [{ x: 40, y: 40 }] }));

    const ratio = changedRatio(empty, withDie, 15);
    expect(ratio).toBeGreaterThanOrEqual(MIN_CHANGED_RATIO);
    expect(ratio).toBeLessThan(GLOBAL_CHANGED_RATIO);
  });

  it("sees a shaken camera (textured background shifted) as a global change", () => {
    const still = blockMeans(makeFrame());
    const shaken = blockMeans(makeFrame({ shiftX: 4 }));

    expect(changedRatio(still, shaken, 15)).toBeGreaterThanOrEqual(GLOBAL_CHANGED_RATIO);
  });

  it("sees a lighting jump as a global change", () => {
    const still = blockMeans(makeFrame());
    const brighter = blockMeans(makeFrame({ brightness: 50 }));

    expect(changedRatio(still, brighter, 15)).toBe(1);
    expect(meanDifference(still, brighter)).toBeCloseTo(50);
  });

  it("ignores changes below the sensitivity threshold", () => {
    const still = blockMeans(makeFrame());
    const slightly = blockMeans(makeFrame({ brightness: 10 }));

    expect(changedRatio(still, slightly, 15)).toBe(0);
    expect(changedRatio(still, slightly, 5)).toBe(1);
  });
});
