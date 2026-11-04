import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

  const mockApi = (handlers: { recognize?: () => Promise<Response>; rolls?: () => Promise<Response> }) => {
    const ok = (body: unknown = {}) =>
      Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes("/health")) return ok({ status: "ok" });
      if (urlStr.includes("/api/recognize")) return (handlers.recognize ?? (() => ok()))();
      if (urlStr.includes("/api/rolls")) return (handlers.rolls ?? (() => ok()))();
      return Promise.reject(new Error("Unknown"));
    });
  };

  const recognizeOk = (die_type: string, value: number) => () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ die_type, value, confidence: 0.9 }),
    } as Response);

  const errorResponse = (status: number, body?: unknown) =>
    Promise.resolve({
      ok: false,
      status,
      json: async () => {
        if (body === undefined) throw new Error("sem corpo");
        return body;
      },
    } as Response);

  const apiCalls = (path: string) =>
    vi.mocked(global.fetch).mock.calls.filter(([url]) => String(url).includes(path));

  const captureNow = async () => {
    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => {
      expect(captureBtn).not.toBeDisabled();
    });
    fireEvent.click(captureBtn);
  };

  it.each([
    [422, { detail: { code: "no_die_detected", message: "x" } }, /Nenhum dado foi identificado/],
    [504, { detail: { code: "upstream_timeout", message: "x" } }, /demorou demais/],
    [502, { detail: { code: "upstream_error", message: "x" } }, /serviço de IA falhou/],
    [401, { detail: { code: "unauthorized", message: "x" } }, /Token de acesso inválido ou ausente/],
    [401, undefined, /Token de acesso inválido ou ausente/],
    [500, undefined, /serviço de IA falhou/],
    [422, { detail: [{ msg: "campo inválido" }] }, /serviço de IA falhou/],
  ])("shows a specific message for recognize HTTP %i", async (status, body, expected) => {
    mockApi({ recognize: () => errorResponse(status, body) });

    render(<Home />);
    await captureNow();

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });

  it("shows the network error message when recognize cannot reach the server", async () => {
    mockApi({ recognize: () => Promise.reject(new Error("Network down")) });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Home />);
    await captureNow();

    expect(await screen.findByRole("alert")).toHaveTextContent(/conectar ao servidor/);
    errorSpy.mockRestore();
  });

  it("allows manual correction after a recognition error and sends the chosen value", async () => {
    mockApi({
      recognize: () => errorResponse(422, { detail: { code: "no_die_detected", message: "x" } }),
    });

    render(<Home />);
    await captureNow();
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "12" }));
    fireEvent.click(screen.getByText(/Confirmar & Enviar VTT/));

    await waitFor(() => {
      expect(screen.queryByText(/Resultado da Rolagem/)).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(apiCalls("/api/rolls")).toHaveLength(1);
    });
    const body = (apiCalls("/api/rolls")[0][1] as RequestInit).body as string;
    expect(JSON.parse(body)).toMatchObject({ die_type: "d20", value: 12 });
  });

  it("does not auto-send a failed recognition even with autoSend enabled", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem(
      "vtt_dice_settings",
      JSON.stringify({ autoSend: true, autoSendDelayMs: 500 })
    );
    mockApi({
      recognize: () => errorResponse(504, { detail: { code: "upstream_timeout", message: "x" } }),
    });

    render(<Home />);
    await captureNow();
    await screen.findByRole("alert");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/Resultado da Rolagem/)).toBeInTheDocument();
    expect(apiCalls("/api/rolls")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("sends the Authorization header only when a token is configured", async () => {
    mockApi({ recognize: recognizeOk("d6", 4) });

    render(<Home />);
    await captureNow();
    fireEvent.click(await screen.findByText(/Confirmar & Enviar VTT/));

    await waitFor(() => {
      expect(apiCalls("/api/rolls")).toHaveLength(1);
    });
    [...apiCalls("/api/recognize"), ...apiCalls("/api/rolls")].forEach(([, init]) => {
      expect((init as RequestInit).headers).not.toHaveProperty("Authorization");
    });
  });

  it("sends the Bearer token to recognize and rolls when configured", async () => {
    localStorage.setItem("vtt_dice_settings", JSON.stringify({ apiToken: "segredo-da-mesa" }));
    mockApi({ recognize: recognizeOk("d6", 4) });

    render(<Home />);
    await captureNow();
    fireEvent.click(await screen.findByText(/Confirmar & Enviar VTT/));

    await waitFor(() => {
      expect(apiCalls("/api/rolls")).toHaveLength(1);
    });
    [...apiCalls("/api/recognize"), ...apiCalls("/api/rolls")].forEach(([, init]) => {
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: "Bearer segredo-da-mesa",
      });
    });
  });

  it("persists the access token entered in settings", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "⚙️" }));
    fireEvent.change(screen.getByPlaceholderText("Em branco se o servidor não exigir"), {
      target: { value: "novo-token" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    const saved = JSON.parse(localStorage.getItem("vtt_dice_settings") || "{}");
    expect(saved.apiToken).toBe("novo-token");
  });

  it("warns about the token and drops the roll when the roll POST returns 401", async () => {
    mockApi({
      recognize: recognizeOk("d6", 4),
      rolls: () => errorResponse(401, { detail: { code: "unauthorized", message: "x" } }),
    });

    render(<Home />);
    await captureNow();
    fireEvent.click(await screen.findByText(/Confirmar & Enviar VTT/));

    expect(await screen.findByRole("alert")).toHaveTextContent(/a rolagem não foi enviada ao VTT/);
    expect(screen.queryByText("Últimas Rolagens")).not.toBeInTheDocument();

    // O aviso some ao salvar novas configurações
    fireEvent.click(screen.getByRole("button", { name: "⚙️" }));
    fireEvent.click(screen.getByText("Salvar"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not carry a previous recognition error into the next capture", async () => {
    mockApi({
      recognize: () => errorResponse(422, { detail: { code: "no_die_detected", message: "x" } }),
    });

    render(<Home />);
    await captureNow();
    await screen.findByRole("alert");

    fireEvent.click(screen.getByText("Descartar"));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    mockApi({ recognize: recognizeOk("d8", 5) });
    await captureNow();
    expect(await screen.findByText("d8")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
