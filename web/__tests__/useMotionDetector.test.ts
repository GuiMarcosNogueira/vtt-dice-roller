import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMotionDetector } from "../app/hooks/useMotionDetector";

describe("useMotionDetector hook", () => {
  let videoEl: HTMLVideoElement;
  let onFrameCapturedMock: ReturnType<typeof vi.fn>;
  let pixelDataVal = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    videoEl = document.createElement("video");
    Object.defineProperty(videoEl, "readyState", { value: 4, configurable: true });
    Object.defineProperty(videoEl, "videoWidth", { value: 1280, configurable: true });
    Object.defineProperty(videoEl, "videoHeight", { value: 720, configurable: true });

    onFrameCapturedMock = vi.fn();
    pixelDataVal = 0;

    // Customiza getContext para permitir simulação de movimento variando pixels
    HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
      if (contextId === "2d") {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn((_x, _y, w, h) => {
            const arr = new Uint8ClampedArray(w * h * 4);
            arr.fill(pixelDataVal);
            return { data: arr };
          }),
          putImageData: vi.fn(),
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("initializes in IDLE state with 0 motion", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
      })
    );

    expect(result.current.detectionState).toBe("IDLE");
    expect(result.current.motionLevel).toBe(0);
  });

  it("handles manual capture trigger", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
        onFrameCaptured: onFrameCapturedMock,
      })
    );

    act(() => {
      result.current.triggerManualCapture();
    });

    expect(result.current.detectionState).toBe("CAPTURING");
    expect(onFrameCapturedMock).toHaveBeenCalledWith(expect.stringContaining("data:image/jpeg;base64,"));
  });

  it("resets detector back to IDLE state", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
      })
    );

    act(() => {
      result.current.setDetectionState("ROLLING");
    });
    expect(result.current.detectionState).toBe("ROLLING");

    act(() => {
      result.current.resetDetector();
    });
    expect(result.current.detectionState).toBe("IDLE");
    expect(result.current.motionLevel).toBe(0);
  });

  it("captures high resolution frame correctly", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
      })
    );

    let frame: string | null = null;
    act(() => {
      frame = result.current.captureHighResFrame();
    });

    expect(frame).toContain("data:image/jpeg;base64,");
  });

  it("returns null if video element is not ready", () => {
    const unreadyVideo = document.createElement("video");
    Object.defineProperty(unreadyVideo, "readyState", { value: 0, configurable: true });

    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: unreadyVideo },
        isStreaming: true,
      })
    );

    const frame = result.current.captureHighResFrame();
    expect(frame).toBeNull();
  });

  it("transitions IDLE -> ROLLING -> STABILIZING -> CAPTURING on motion change and stability", async () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
        sensitivity: 10,
        stabilizeMs: 500,
        onFrameCaptured: onFrameCapturedMock,
      })
    );

    // 1. Frame inicial: pixels = 0
    pixelDataVal = 0;
    act(() => {
      vi.advanceTimersByTime(70);
    });

    // 2. Movimento brusco: pixels mudam para 100 (diff grande > 10)
    pixelDataVal = 100;
    act(() => {
      vi.advanceTimersByTime(70);
    });

    expect(result.current.detectionState).toBe("ROLLING");
    expect(result.current.motionLevel).toBeGreaterThan(10);

    // 3. Estabilização: pixels param de mudar (permanecem 100, diff = 0 < 10)
    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(result.current.detectionState).toBe("STABILIZING");

    // 3.1. Permanece em STABILIZING se tempo decorrido for menor que stabilizeMs (100ms < 500ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.detectionState).toBe("STABILIZING");

    // 4. Aguarda passar o tempo de estabilização (500ms)
    act(() => {
      vi.advanceTimersByTime(600);
      vi.runOnlyPendingTimers();
    });

    expect(result.current.detectionState).toBe("CAPTURING");
    expect(onFrameCapturedMock).toHaveBeenCalled();
  });

  it("returns null if videoRef.current is null", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: null },
        isStreaming: true,
      })
    );
    expect(result.current.captureHighResFrame()).toBeNull();
  });

  it("returns null if canvas 2d context fails", () => {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
      })
    );

    expect(result.current.captureHighResFrame()).toBeNull();
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  it("handles triggerManualCapture without onFrameCaptured", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
      })
    );

    act(() => {
      result.current.triggerManualCapture();
    });
    expect(result.current.detectionState).toBe("CAPTURING");
  });

  it("handles triggerManualCapture when captureHighResFrame returns null", () => {
    const unreadyVideo = document.createElement("video");
    Object.defineProperty(unreadyVideo, "readyState", { value: 0, configurable: true });

    const mockCallback = vi.fn();
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: unreadyVideo },
        isStreaming: true,
        onFrameCaptured: mockCallback,
      })
    );

    act(() => {
      result.current.triggerManualCapture();
    });
    expect(result.current.detectionState).toBe("CAPTURING");
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it("cancels animation frame and skips processing when disabled or in active states", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useMotionDetector({
          videoRef: { current: videoEl },
          isStreaming: true,
          enabled,
        }),
      { initialProps: { enabled: true } }
    );

    rerender({ enabled: false });
    expect(cancelSpy).toHaveBeenCalled();

    act(() => {
      result.current.setDetectionState("CAPTURING");
    });
    expect(cancelSpy).toHaveBeenCalled();

    act(() => {
      result.current.setDetectionState("REVIEWING");
    });
    expect(cancelSpy).toHaveBeenCalled();

    act(() => {
      result.current.setDetectionState("SENDING");
    });
    expect(cancelSpy).toHaveBeenCalled();

    cancelSpy.mockRestore();
  });

  it("handles automatic stabilization capture without onFrameCaptured callback", () => {
    const { result } = renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
        sensitivity: 10,
        stabilizeMs: 300,
      })
    );

    pixelDataVal = 0;
    act(() => {
      vi.advanceTimersByTime(70);
    });
    pixelDataVal = 100;
    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(result.current.detectionState).toBe("ROLLING");

    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(result.current.detectionState).toBe("STABILIZING");

    act(() => {
      vi.advanceTimersByTime(400);
      vi.runOnlyPendingTimers();
    });
    expect(result.current.detectionState).toBe("CAPTURING");
  });

  it("returns early if lowRes canvas context cannot be acquired", () => {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

    renderHook(() =>
      useMotionDetector({
        videoRef: { current: videoEl },
        isStreaming: true,
      })
    );

    act(() => {
      vi.advanceTimersByTime(70);
    });

    HTMLCanvasElement.prototype.getContext = origGetContext;
  });
});
