import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../app/page";
import * as motionDetectorModule from "../app/hooks/useMotionDetector";
import * as cameraModule from "../app/hooks/useCamera";

describe("Home Page Integration Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default fetch mock
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/health")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "ok" }),
        } as Response);
      }
      if (urlStr.includes("/api/recognize")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            die_type: "d20",
            value: 17,
            confidence: 0.94,
            raw_explanation: "Face 17 para cima.",
          }),
        } as Response);
      }
      if (urlStr.includes("/api/rolls")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: "broadcasted" }),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders main page and checks API health as connected", async () => {
    render(<Home />);

    expect(screen.getByText("VTT DICE ROLLER")).toBeInTheDocument();
    expect(screen.getByText("Leitor Óptico IA")).toBeInTheDocument();
    expect(screen.getByText("Capturar Dado Agora")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("VTT Conectado")).toBeInTheDocument();
    });
  });

  it("handles disconnected API health status when health check fails or returns not ok", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/health")) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      return Promise.reject(new Error("Network error"));
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    // Also test fetch rejecting completely
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));
    render(<Home />);

    await waitFor(() => {
      expect(screen.getAllByText("Offline").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("loads corrupted localStorage without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("vtt_dice_settings", "invalid-json{{");

    render(<Home />);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("loads valid saved settings from localStorage", () => {
    localStorage.setItem(
      "vtt_dice_settings",
      JSON.stringify({
        playerName: "Legolas",
        apiUrl: "http://192.168.1.50:8000",
      })
    );

    render(<Home />);
    const gearBtn = screen.getByRole("button", { name: "⚙️" });
    fireEvent.click(gearBtn);

    const input = screen.getByDisplayValue("Legolas");
    expect(input).toBeInTheDocument();
  });

  it("opens settings modal, modifies settings, and saves to localStorage", async () => {
    render(<Home />);

    const gearBtn = screen.getByRole("button", { name: "⚙️" });
    fireEvent.click(gearBtn);

    expect(screen.getByText(/Configurações/)).toBeInTheDocument();

    const playerInput = screen.getByPlaceholderText("Jogador");
    fireEvent.change(playerInput, { target: { value: "Gimli" } });

    const saveBtn = screen.getByText("Salvar");
    fireEvent.click(saveBtn);

    expect(screen.queryByText(/Configurações/)).not.toBeInTheDocument();

    const saved = JSON.parse(localStorage.getItem("vtt_dice_settings") || "{}");
    expect(saved.playerName).toBe("Gimli");
  });

  it("displays camera error message when useCamera reports an error", () => {
    vi.spyOn(cameraModule, "useCamera").mockReturnValue({
      videoRef: { current: null },
      isStreaming: false,
      error: "Câmera não permitida pelo usuário",
      facingMode: "environment",
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      switchCamera: vi.fn(),
    });

    render(<Home />);

    expect(screen.getByText("Câmera não permitida pelo usuário")).toBeInTheDocument();
  });

  it("switches camera when switch button is clicked", () => {
    const switchMock = vi.fn();
    vi.spyOn(cameraModule, "useCamera").mockReturnValue({
      videoRef: { current: null },
      isStreaming: true,
      error: null,
      facingMode: "environment",
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      switchCamera: switchMock,
    });

    render(<Home />);

    const switchBtn = screen.getByTitle("Trocar Câmera");
    fireEvent.click(switchBtn);

    expect(switchMock).toHaveBeenCalledTimes(1);
  });

  it("executes manual capture and successful roll confirmation flow", async () => {
    render(<Home />);

    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
    fireEvent.click(captureBtn);

    // Aguarda o resultado da IA ser exibido no modal
    await waitFor(() => {
      expect(screen.getByText(/Face 17 para cima/)).toBeInTheDocument();
    });

    expect(screen.getByText("d20")).toBeInTheDocument();
    expect(screen.getAllByText("17").length).toBeGreaterThanOrEqual(1);

    // Confirma envio para VTT
    const confirmBtn = screen.getByText(/Confirmar & Enviar VTT/);
    fireEvent.click(confirmBtn);

    // Modal fecha e rolagem aparece em 'Últimas Rolagens'
    await waitFor(() => {
      expect(screen.queryByText(/Resultado da Rolagem/)).not.toBeInTheDocument();
    });

    expect(screen.getByText("Últimas Rolagens")).toBeInTheDocument();
    expect(screen.getAllByText("17").length).toBeGreaterThanOrEqual(1);
  });

  it("handles recognize API error with fallback result allowing manual correction", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/health")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "ok" }) } as Response);
      }
      if (urlStr.includes("/api/recognize")) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      if (urlStr.includes("/api/rolls")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
      }
      return Promise.reject(new Error("Unknown"));
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Home />);

    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
    fireEvent.click(captureBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Não foi possível conectar à IA. Selecione o valor manualmente./)
      ).toBeInTheDocument();
    });

    // Seleciona número 12 manualmente
    const num12Btn = screen.getByRole("button", { name: "12" });
    fireEvent.click(num12Btn);

    // Confirma
    const confirmBtn = screen.getByText(/Confirmar & Enviar VTT/);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Resultado da Rolagem/)).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
    errorSpy.mockRestore();
  });

  it("handles roll broadcast failure gracefully without crashing", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/health")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
      }
      if (urlStr.includes("/api/recognize")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ die_type: "d6", value: 4, confidence: 0.99 }),
        } as Response);
      }
      if (urlStr.includes("/api/rolls")) {
        return Promise.reject(new Error("Failed to send roll"));
      }
      return Promise.reject(new Error("Unknown"));
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Home />);

    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
    fireEvent.click(captureBtn);

    await waitFor(() => {
      expect(screen.getByText("d6")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText(/Confirmar & Enviar VTT/);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Resultado da Rolagem/)).not.toBeInTheDocument();
    });

    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(1);
    errorSpy.mockRestore();
  });

  it("cancels roll review when cancel button is clicked", async () => {
    render(<Home />);

    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
    fireEvent.click(captureBtn);

    const discardBtn = await screen.findByText("Descartar");
    fireEvent.click(discardBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Resultado da Rolagem/)).not.toBeInTheDocument();
      expect(screen.queryByText("Últimas Rolagens")).not.toBeInTheDocument();
    });
  });

  it("renders badges for ROLLING, STABILIZING, and CAPTURING states and high motion level", () => {
    const states = ["ROLLING", "STABILIZING", "CAPTURING"] as const;
    const expectedLabels = ["Dado Rolando...", "Estabilizando...", "Capturando..."];

    states.forEach((state, idx) => {
      const spy = vi.spyOn(motionDetectorModule, "useMotionDetector").mockReturnValue({
        detectionState: state,
        motionLevel: 80, // high motion > sensitivity
        triggerManualCapture: vi.fn(),
        resetDetector: vi.fn(),
      });

      const { unmount } = render(<Home />);
      expect(screen.getByText(expectedLabels[idx])).toBeInTheDocument();
      unmount();
      spy.mockRestore();
    });
  });
});
