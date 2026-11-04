import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCamera } from "../app/hooks/useCamera";

const getUserMedia = () => vi.mocked(navigator.mediaDevices.getUserMedia);

function fakeStream() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop } as unknown as MediaStreamTrack] } as MediaStream;
  return { stream, stop };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Monta o hook e espera o início automático da câmera terminar, para que as chamadas
// seguintes a startCamera() sejam as únicas em andamento.
async function mountSettled() {
  const hook = renderHook(() => useCamera());
  await act(async () => {});
  return hook;
}

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

  it.each([
    ["NotAllowedError", "Permissão da câmera foi negada"],
    ["PermissionDeniedError", "Permissão da câmera foi negada"],
    ["NotFoundError", "Nenhuma câmera encontrada"],
    ["DevicesNotFoundError", "Nenhuma câmera encontrada"],
  ])("maps %s to a friendly message", async (name, expected) => {
    const { result } = await mountSettled();
    const err = new Error("falha");
    err.name = name;
    getUserMedia().mockRejectedValueOnce(err);

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toContain(expected);
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
    const { result } = await mountSettled();
    getUserMedia().mockRejectedValueOnce(new Error("Hardware fault"));

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toContain("Hardware fault");
  });

  it("handles non-Error rejection", async () => {
    const { result } = await mountSettled();
    getUserMedia().mockRejectedValueOnce("string rejection");

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.error).toBe("Erro desconhecido ao acessar câmera.");
  });

  it("stops camera and cleans up stream tracks", async () => {
    const stopTrackMock = vi.fn();
    getUserMedia().mockResolvedValue({
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

  describe("overlapping starts (React dev double effect, camera switch)", () => {
    it("ignores the error of a start that was superseded by a newer one", async () => {
      const first = deferred<MediaStream>();
      const second = deferred<MediaStream>();
      getUserMedia().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useCamera());
      let secondStart!: Promise<void>;
      act(() => {
        secondStart = result.current.startCamera();
      });

      await act(async () => {
        first.reject(new DOMException("aborted", "AbortError"));
      });
      expect(result.current.error).toBeNull();

      await act(async () => {
        second.resolve(fakeStream().stream);
        await secondStart;
      });
      expect(result.current.error).toBeNull();
      errorSpy.mockRestore();
    });

    it("stops a stream that arrives after a newer start and keeps the newest one", async () => {
      const first = deferred<MediaStream>();
      const second = deferred<MediaStream>();
      const late = fakeStream();
      const current = fakeStream();
      getUserMedia().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      const { result } = renderHook(() => useCamera());
      const videoEl = document.createElement("video");
      result.current.videoRef.current = videoEl;
      let secondStart!: Promise<void>;
      act(() => {
        secondStart = result.current.startCamera();
      });

      await act(async () => {
        second.resolve(current.stream);
        await secondStart;
      });
      await act(async () => {
        first.resolve(late.stream);
      });

      expect(late.stop).toHaveBeenCalled();
      expect(current.stop).not.toHaveBeenCalled();
      expect(videoEl.srcObject).toBe(current.stream);
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("ignores the play() AbortError of an interrupted start", async () => {
      const { result } = await mountSettled();
      const videoEl = document.createElement("video");
      result.current.videoRef.current = videoEl;
      const interrupted = deferred<void>();
      videoEl.play = vi
        .fn()
        .mockReturnValueOnce(interrupted.promise)
        .mockResolvedValueOnce(undefined);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      let firstStart!: Promise<void>;
      let secondStart!: Promise<void>;
      act(() => {
        firstStart = result.current.startCamera();
      });
      await act(async () => {}); // a primeira chegou ao play() pendente
      act(() => {
        secondStart = result.current.startCamera();
      });
      await act(async () => {
        interrupted.reject(
          new DOMException(
            "The fetching process for the media resource was aborted by the user agent",
            "AbortError"
          )
        );
        await Promise.all([firstStart, secondStart]);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isStreaming).toBe(true);
      errorSpy.mockRestore();
    });

    it("discards a start that was still pending when the camera was stopped", async () => {
      const pending = deferred<MediaStream>();
      const late = fakeStream();
      getUserMedia().mockReturnValueOnce(pending.promise);

      const { result } = renderHook(() => useCamera());
      const videoEl = document.createElement("video");
      result.current.videoRef.current = videoEl;

      act(() => {
        result.current.stopCamera();
      });
      await act(async () => {
        pending.resolve(late.stream);
      });

      expect(late.stop).toHaveBeenCalled();
      expect(videoEl.srcObject).toBeNull();
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("does not mark streaming when the camera was stopped while play() was pending", async () => {
      const { result } = await mountSettled();
      const videoEl = document.createElement("video");
      result.current.videoRef.current = videoEl;
      const playing = deferred<void>();
      videoEl.play = vi.fn().mockReturnValueOnce(playing.promise);

      let start!: Promise<void>;
      act(() => {
        start = result.current.startCamera();
      });
      await act(async () => {});
      act(() => {
        result.current.stopCamera();
      });
      await act(async () => {
        playing.resolve();
        await start;
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });
});
