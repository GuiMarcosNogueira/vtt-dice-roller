import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../app/page";

describe("Home page with selectable vision providers", () => {
  const originalFetch = global.fetch;

  const ok = (body: unknown = {}) =>
    Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
  const failure = (status: number, body: unknown) =>
    Promise.resolve({ ok: false, status, json: async () => body } as Response);

  const mockApi = (recognize: () => Promise<Response> = () => ok(RECOGNIZED)) => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes("/health")) return ok({ status: "ok" });
      if (urlStr.includes("/api/recognize")) return recognize();
      if (urlStr.includes("/api/rolls")) return ok();
      return Promise.reject(new Error(`Unhandled ${urlStr}`));
    });
  };

  const RECOGNIZED = { die_type: "d20", value: 17, confidence: 0.9 };

  const recognizeCall = () => {
    const call = vi
      .mocked(global.fetch)
      .mock.calls.find(([url]) => String(url).includes("/api/recognize"));
    expect(call).toBeDefined();
    const init = call![1] as RequestInit;
    return { headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
  };

  const capture = async () => {
    const captureBtn = screen.getByRole("button", { name: /Capturar Dado Agora/ });
    await waitFor(() => expect(captureBtn).not.toBeDisabled());
    fireEvent.click(captureBtn);
    await screen.findByText(/Resultado da Rolagem/);
  };

  beforeEach(() => {
    localStorage.clear();
    mockApi();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends the same request as before when the server default is used", async () => {
    render(<Home />);
    await capture();

    const { headers, body } = recognizeCall();
    expect(body).toEqual({ image_base64: "data:image/jpeg;base64,mock_canvas_frame" });
    expect(headers).not.toHaveProperty("X-Vision-Api-Key");
  });

  it("treats settings saved before providers existed as the server default", async () => {
    localStorage.setItem(
      "vtt_dice_settings",
      JSON.stringify({ playerName: "Legolas", apiUrl: "http://localhost:8000" })
    );

    render(<Home />);
    await capture();

    const { headers, body } = recognizeCall();
    expect(Object.keys(body)).toEqual(["image_base64"]);
    expect(headers).not.toHaveProperty("X-Vision-Api-Key");
  });

  it("sends provider, model and the user's key when a provider is selected", async () => {
    localStorage.setItem(
      "vtt_dice_settings",
      JSON.stringify({
        visionProvider: "deepseek",
        visionApiKey: "sk-user",
        visionModel: "deepseek-flash",
        apiToken: "token-da-mesa",
      })
    );

    render(<Home />);
    await capture();

    const { headers, body } = recognizeCall();
    expect(body).toMatchObject({ provider: "deepseek", model: "deepseek-flash" });
    expect(headers).toMatchObject({
      "X-Vision-Api-Key": "sk-user",
      Authorization: "Bearer token-da-mesa",
    });
  });

  it("omits the model when none was chosen so the backend uses the provider default", async () => {
    localStorage.setItem(
      "vtt_dice_settings",
      JSON.stringify({ visionProvider: "openrouter", visionApiKey: "sk-user" })
    );

    render(<Home />);
    await capture();

    const { body } = recognizeCall();
    expect(body.provider).toBe("openrouter");
    expect(body).not.toHaveProperty("model");
  });

  it("still sends the key header (empty) so the backend answers missing_api_key", async () => {
    localStorage.setItem("vtt_dice_settings", JSON.stringify({ visionProvider: "deepseek" }));
    mockApi(() => failure(422, { detail: { code: "missing_api_key", message: "x" } }));

    render(<Home />);
    await capture();

    expect(recognizeCall().headers["X-Vision-Api-Key"]).toBe("");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Falta a API key do provedor/);
  });

  it.each([
    [400, "provider_auth_error", /chave de API foi recusada pelo provedor/],
    [422, "unknown_provider", /não reconhece o provedor escolhido/],
  ])("shows a specific message for %i %s and allows manual correction", async (status, code, expected) => {
    localStorage.setItem(
      "vtt_dice_settings",
      JSON.stringify({ visionProvider: "deepseek", visionApiKey: "sk-user" })
    );
    mockApi(() => failure(status, { detail: { code, message: "x" } }));

    render(<Home />);
    await capture();

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    fireEvent.click(screen.getByRole("button", { name: "12" }));
    fireEvent.click(screen.getByText(/Confirmar & Enviar VTT/));
    await waitFor(() => {
      expect(screen.queryByText(/Resultado da Rolagem/)).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
  });
});
