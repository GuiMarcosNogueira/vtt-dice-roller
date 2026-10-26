import "@testing-library/jest-dom";
import { vi, afterEach } from "vitest";

// Mock para HTMLMediaElement (vídeo)
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
  configurable: true,
  get: () => 1280,
});

Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
  configurable: true,
  get: () => 720,
});

Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
  configurable: true,
  get: () => 4,
});

// Mock para HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn((contextId: string) => {
    if (contextId === "2d") {
      return {
        drawImage: vi.fn(),
        getImageData: vi.fn((_x, _y, w, h) => ({
          data: new Uint8ClampedArray(w * h * 4),
        })),
        putImageData: vi.fn(),
      };
    }
    return null;
  }),
});

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  configurable: true,
  value: vi.fn(() => "data:image/jpeg;base64,mock_canvas_frame"),
});

// Mock para navigator.mediaDevices
const mockMediaStream = {
  getTracks: vi.fn(() => [
    {
      stop: vi.fn(),
    },
  ]),
};

Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
  },
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
