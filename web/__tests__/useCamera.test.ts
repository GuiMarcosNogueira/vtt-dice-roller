import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCamera } from "../app/hooks/useCamera";

describe("useCamera hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts camera successfully and updates streaming state", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.facingMode).toBe("environment");
    expect(result.current.error).toBeNull();
  });

  it("handles videoRef assignment and plays video", async () => {
    const { result } = renderHook(() => useCamera());

    const videoEl = document.createElement("video");
    result.current.videoRef.current = videoEl;

    await act(async () => {
      await result.current.startCamera();
    });

    expect(videoEl.srcObject).toBeDefined();
    expect(videoEl.getAttribute("playsinline")).toBe("true");
    expect(result.current.isStreaming).toBe(true);
  });

  it("switches camera between environment and user", async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      result.current.switchCamera();
    });

    expect(result.current.facingMode).toBe("user");

    await act(async () => {
      result.current.switchCamera();
    });

    expect(result.current.facingMode).toBe("environment");
  });

  it("handles NotAllowedError permission denial", async () => {
    const permError = new Error("Permission denied");
    permError.name = "NotAllowedError";
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(permError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toContain("Permissão da câmera foi negada");
  });

  it("handles PermissionDeniedError", async () => {
    const permError = new Error("Permission denied alternate");
    permError.name = "PermissionDeniedError";
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(permError);

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toContain("Permissão da câmera foi negada");
  });

  it("handles NotFoundError when no camera is present", async () => {
    const notFoundError = new Error("Not found");
    notFoundError.name = "NotFoundError";
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(notFoundError);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toContain("Nenhuma câmera encontrada");
  });

  it("handles DevicesNotFoundError", async () => {
    const notFoundError = new Error("Devices not found");
    notFoundError.name = "DevicesNotFoundError";
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(notFoundError);

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toContain("Nenhuma câmera encontrada");
  });

  it("handles missing getUserMedia support", async () => {
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toContain("Seu navegador não suporta acesso à câmera");

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("handles generic Error", async () => {
    const genericErr = new Error("Hardware fault");
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(genericErr);

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toContain("Hardware fault");
  });

  it("handles non-Error rejection", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce("string rejection");

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toBe("Erro desconhecido ao acessar câmera.");
  });

  it("stops camera and cleans up stream tracks", async () => {
    const stopTrackMock = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
      getTracks: () => [{ stop: stopTrackMock } as unknown as MediaStreamTrack],
    } as MediaStream);

    const { result } = renderHook(() => useCamera());
    const videoEl = document.createElement("video");
    result.current.videoRef.current = videoEl;

    await act(async () => {
      await result.current.startCamera();
    });

    act(() => {
      result.current.stopCamera();
    });

    expect(stopTrackMock).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
    expect(videoEl.srcObject).toBeNull();
  });
});
