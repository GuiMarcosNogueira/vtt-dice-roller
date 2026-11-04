import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../app/page";
import * as motionDetectorModule from "../app/hooks/useMotionDetector";

describe("Home page automatic AI submission toggle", () => {
  const originalFetch = global.fetch;

  const ok = (body: unknown = {}) =>
    Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

  const recognizeCalls = () =>
    vi.mocked(global.fetch).mock.calls.filter(([url]) => String(url).includes("/api/recognize"));

  const toggle = () => screen.getByRole("switch", { name: /Envio automático à IA/ });

  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/recognize")) {
        return ok({ die_type: "d6", value: 4, confidence: 0.9 });
      }
      return ok({ status: "ok" });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("is on by default and lets the motion detector run", () => {
    const spy = vi.spyOn(motionDetectorModule, "useMotionDetector");

    render(<Home />);

    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(toggle()).toHaveTextContent("Ligado");
    expect(spy.mock.calls.at(-1)?.[0].enabled).toBe(true);
    expect(screen.getByText(/A detecção automática dispara/)).toBeInTheDocument();
  });

  it("turns the detector off, saves the choice and resets the detector when toggled", () => {
    const resetDetector = vi.fn();
    const spy = vi.spyOn(motionDetectorModule, "useMotionDetector").mockReturnValue({
      detectionState: "STABILIZING",
      setDetectionState: vi.fn(),
      motionLevel: 3,
      triggerManualCapture: vi.fn(),
      resetDetector,
      captureHighResFrame: vi.fn(),
    });

    render(<Home />);
    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(toggle()).toHaveTextContent("Desligado");
    expect(spy.mock.calls.at(-1)?.[0].enabled).toBe(false);
    expect(resetDetector).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("vtt_dice_settings") || "{}").autoCapture).toBe(false);
    expect(screen.getByText("Captura manual")).toBeInTheDocument();
    expect(screen.queryByText("Estabilizando...")).not.toBeInTheDocument();
    expect(screen.getByText(/Envio automático desligado/)).toBeInTheDocument();

    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(spy.mock.calls.at(-1)?.[0].enabled).toBe(true);
    expect(resetDetector).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Estabilizando...")).toBeInTheDocument();
  });

  it("starts turned off when the saved settings say so", () => {
    localStorage.setItem("vtt_dice_settings", JSON.stringify({ autoCapture: false }));
    const spy = vi.spyOn(motionDetectorModule, "useMotionDetector");

    render(<Home />);

    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(spy.mock.calls.at(-1)?.[0].enabled).toBe(false);
  });

  it("treats settings saved before the toggle existed as automatic on", () => {
    localStorage.setItem("vtt_dice_settings", JSON.stringify({ playerName: "Legolas" }));

    render(<Home />);

    expect(toggle()).toHaveAttribute("aria-checked", "true");
  });

  it("keeps the manual button sending to the AI while automatic submission is off", async () => {
    localStorage.setItem("vtt_dice_settings", JSON.stringify({ autoCapture: false }));

    render(<Home />);
    expect(recognizeCalls()).toHaveLength(0);

    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => expect(captureBtn).not.toBeDisabled());
    fireEvent.click(captureBtn);

    await screen.findByText(/Resultado da Rolagem/);
    expect(recognizeCalls()).toHaveLength(1);
  });
});
