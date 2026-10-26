import { describe, it, expect } from "vitest";

describe("Smoke Test Environment", () => {
  it("has navigator.mediaDevices mocked", () => {
    expect(navigator.mediaDevices).toBeDefined();
    expect(navigator.mediaDevices.getUserMedia).toBeDefined();
  });

  it("has canvas 2d context mocked", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    expect(ctx).toBeDefined();
    expect(ctx?.getImageData(0, 0, 10, 10)).toBeDefined();
  });
});
