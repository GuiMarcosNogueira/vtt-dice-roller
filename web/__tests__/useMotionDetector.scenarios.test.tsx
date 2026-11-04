import { StrictMode, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMotionDetector } from "../app/hooks/useMotionDetector";
import { Blob, installFrameSource, makeFrame, readyVideo } from "./frames";

// O `next dev` roda o React em modo estrito (funções de estado executadas duas vezes).
// Uma captura automática não pode depender disso.
const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

const STABILIZE_MS = 500;
const COOLDOWN_MS = 1500;
const STEP_MS = 70; // um quadro analisado por passo

describe("useMotionDetector scenarios", () => {
  let source: ReturnType<typeof installFrameSource>;
  let onFrameCaptured: ReturnType<typeof vi.fn>;
  let video: HTMLVideoElement;

  const show = (frame: Uint8ClampedArray, steps = 1) => {
    source.current = frame;
    for (let i = 0; i < steps; i++) {
      act(() => {
        vi.advanceTimersByTime(STEP_MS);
      });
    }
  };

  const waitMs = (ms: number) => show(source.current, Math.ceil(ms / STEP_MS));

  const table = (blobs: Blob[] = [], extra = {}) => makeFrame({ blobs, ...extra });

  // Dado entrando na cena, rolando e parando em `rest`
  const rollTo = (rest: Blob, scene = {}) => {
    show(table([{ x: rest.x - 50, y: rest.y - 30 }], scene), 1);
    show(table([{ x: rest.x - 25, y: rest.y - 15 }], scene), 1);
    show(table([{ x: rest.x - 10, y: rest.y - 5 }], scene), 1);
    show(table([rest], scene), 1);
    waitMs(STABILIZE_MS + 400);
  };

  const mount = (props: Partial<Parameters<typeof useMotionDetector>[0]> = {}, wrapper?: typeof strict) =>
    renderHook(
      () =>
        useMotionDetector({
          videoRef: { current: video },
          isStreaming: true,
          sensitivity: 15,
          stabilizeMs: STABILIZE_MS,
          onFrameCaptured,
          ...props,
        }),
      { wrapper }
    );

  beforeEach(() => {
    vi.useFakeTimers();
    source = installFrameSource();
    onFrameCaptured = vi.fn();
    video = readyVideo();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("a die rolling into the scene", () => {
    it("captures exactly once when the scene settles with a new object", () => {
      const { result } = mount();
      show(table(), 8); // cena vazia: forma a referência

      rollTo({ x: 80, y: 60 });

      expect(result.current.detectionState).toBe("CAPTURING");
      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
      expect(onFrameCaptured).toHaveBeenCalledWith(expect.stringContaining("data:image/jpeg"));
    });

    it("goes through ROLLING and STABILIZING before capturing", () => {
      const { result } = mount();
      show(table(), 8);

      show(table([{ x: 30, y: 30 }]), 1);
      show(table([{ x: 55, y: 45 }]), 1);
      expect(result.current.detectionState).toBe("ROLLING");

      show(table([{ x: 80, y: 60 }]), 1);
      show(table([{ x: 80, y: 60 }]), 1);
      expect(result.current.detectionState).toBe("STABILIZING");
      expect(onFrameCaptured).not.toHaveBeenCalled();

      waitMs(STABILIZE_MS + 200);
      expect(result.current.detectionState).toBe("CAPTURING");
    });

    it("captures once in React strict mode too", () => {
      const { result } = mount({}, strict);
      show(table(), 8);

      rollTo({ x: 80, y: 60 });

      expect(result.current.detectionState).toBe("CAPTURING");
      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
    });

    it("does not capture again while the capture is being reviewed", () => {
      mount({}, strict);
      show(table(), 8);
      rollTo({ x: 80, y: 60 });

      show(table([{ x: 100, y: 20 }]), 2);
      waitMs(3000);

      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
    });

    it("works without an onFrameCaptured callback", () => {
      const { result } = mount({ onFrameCaptured: undefined });
      show(table(), 8);

      rollTo({ x: 80, y: 60 });

      expect(result.current.detectionState).toBe("CAPTURING");
    });

    it("ignores a single glitchy frame", () => {
      const { result } = mount();
      show(table(), 8);

      show(table([{ x: 60, y: 60 }]), 1);
      show(table(), 1);
      waitMs(3000);

      expect(result.current.detectionState).toBe("IDLE");
      expect(onFrameCaptured).not.toHaveBeenCalled();
    });
  });

  describe("camera shake and lighting changes", () => {
    it("does not capture when the camera is shaken", () => {
      const { result } = mount();
      show(table(), 8);

      show(table([], { shiftX: 4 }), 1); // balançou
      waitMs(3000);

      expect(result.current.detectionState).toBe("IDLE");
      expect(onFrameCaptured).not.toHaveBeenCalled();
    });

    it("does not capture on repeated shaking", () => {
      mount();
      show(table(), 8);

      for (const shiftX of [4, 0, 4, 2, 6, 0]) {
        show(table([], { shiftX }), 2);
      }
      waitMs(3000);

      expect(onFrameCaptured).not.toHaveBeenCalled();
    });

    it("does not capture when the whole image brightens (exposure or lighting)", () => {
      mount();
      show(table(), 8);

      show(table([], { brightness: 50 }), 1);
      waitMs(3000);

      expect(onFrameCaptured).not.toHaveBeenCalled();
    });

    it("drops a roll in progress when the camera moves in the middle of it", () => {
      const { result } = mount();
      show(table(), 8);
      show(table([{ x: 30, y: 30 }]), 1);
      show(table([{ x: 55, y: 45 }]), 1);
      expect(result.current.detectionState).toBe("ROLLING");

      show(table([{ x: 55, y: 45 }], { shiftX: 4 }), 1);
      waitMs(3000);

      expect(result.current.detectionState).toBe("IDLE");
      expect(onFrameCaptured).not.toHaveBeenCalled();
    });

    it("still captures a die that lands after the camera was shaken and settled", () => {
      mount();
      show(table(), 8);
      show(table([], { shiftX: 4 }), 1);
      show(table([], { shiftX: 4 }), 8); // nova referência com a câmera na posição nova

      rollTo({ x: 80, y: 60 }, { shiftX: 4 });

      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
    });

    it("follows slow lighting drift without treating it as a roll", () => {
      mount();
      show(table(), 8);

      for (let brightness = 3; brightness <= 30; brightness += 3) {
        show(table([], { brightness }), 3);
      }
      waitMs(3000);
      expect(onFrameCaptured).not.toHaveBeenCalled();

      // com a luz já na nova faixa, um dado de verdade ainda é capturado
      rollTo({ x: 80, y: 60 }, { brightness: 30 });
      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
    });
  });

  describe("after a capture", () => {
    it("does not capture again when the die is picked up", () => {
      const { result } = mount();
      show(table(), 8);
      rollTo({ x: 80, y: 60 });
      expect(onFrameCaptured).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.resetDetector(); // o jogador confirmou
      });
      waitMs(COOLDOWN_MS + 500);

      // a mão pega o dado e a cena volta a ficar vazia
      show(table([{ x: 82, y: 58 }]), 1);
      show(table([{ x: 90, y: 40 }]), 1);
      show(table([{ x: 100, y: 20 }]), 1);
      show(table(), 1);
      waitMs(STABILIZE_MS + 500);

      expect(result.current.detectionState).toBe("IDLE");
      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
    });

    it("captures again for the next roll", () => {
      const { result } = mount();
      show(table(), 8);
      rollTo({ x: 80, y: 60 });
      act(() => {
        result.current.resetDetector();
      });
      waitMs(COOLDOWN_MS + 500);

      rollTo({ x: 30, y: 70 });

      expect(onFrameCaptured).toHaveBeenCalledTimes(2);
    });

    it("ignores movement during the cooldown right after a review", () => {
      const { result } = mount();
      show(table(), 8);
      rollTo({ x: 80, y: 60 });
      act(() => {
        result.current.resetDetector();
      });

      // a mão saindo da cena logo depois de confirmar
      show(table([{ x: 82, y: 58 }]), 1);
      show(table([{ x: 90, y: 40 }]), 1);
      show(table([{ x: 100, y: 20 }]), 1);
      expect(result.current.detectionState).toBe("IDLE");
    });
  });

  describe("manual control", () => {
    it("never captures on its own when disabled, but the manual trigger still sends", () => {
      const { result } = mount({ enabled: false });
      show(table(), 8);

      rollTo({ x: 80, y: 60 });
      expect(onFrameCaptured).not.toHaveBeenCalled();
      expect(result.current.detectionState).toBe("IDLE");

      act(() => {
        result.current.triggerManualCapture();
      });
      expect(onFrameCaptured).toHaveBeenCalledTimes(1);
    });

    it("does not capture on startup when a die was already on the table", () => {
      mount();

      show(table([{ x: 80, y: 60 }]), 12);
      waitMs(3000);

      expect(onFrameCaptured).not.toHaveBeenCalled();
    });

    it("rebuilds the reference instead of capturing when a roll starts before one exists", () => {
      const { result } = mount();

      show(table(), 1);
      show(table([{ x: 30, y: 30 }]), 1);
      show(table([{ x: 55, y: 45 }]), 1);
      expect(result.current.detectionState).toBe("ROLLING");
      show(table([{ x: 80, y: 60 }]), 1);
      waitMs(STABILIZE_MS + 400);

      expect(onFrameCaptured).not.toHaveBeenCalled();
      expect(result.current.detectionState).toBe("IDLE");
    });
  });

  describe("sensitivity", () => {
    it("treats a faint change as motion only with a more sensitive setting", () => {
      const faint = (sensitivity: number) => {
        onFrameCaptured.mockClear();
        const { result, unmount } = mount({ sensitivity });
        show(table(), 8);
        const dim = { x: 80, y: 60, value: 125 }; // quase da cor da mesa
        show(table([{ ...dim, x: 40, y: 30 }]), 1);
        show(table([{ ...dim, x: 60, y: 45 }]), 1);
        const state = result.current.detectionState;
        unmount();
        return state;
      };

      expect(faint(15)).toBe("IDLE");
      expect(faint(5)).toBe("ROLLING");
    });
  });
});
