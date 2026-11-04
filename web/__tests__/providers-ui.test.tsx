import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { ModelPicker } from "../app/components/ModelPicker";
import { SettingsModal } from "../app/components/SettingsModal";
import { ReviewModal } from "../app/components/ReviewModal";
import { DEFAULT_SETTINGS, AppSettings, VisionProvider } from "../app/types";

const PROVIDERS: VisionProvider[] = [
  { id: "server", name: "Padrão do servidor", default_model: "m", requires_user_key: false },
  { id: "deepseek", name: "DeepSeek", default_model: "deepseek-flash", requires_user_key: true },
  {
    id: "openrouter",
    name: "OpenRouter",
    default_model: "google/gemini-2.5-flash",
    requires_user_key: true,
  },
];

const MODELS = [
  { id: "deepseek-flash", name: "DeepSeek-V4.1-Flash" },
  { id: "deepseek-lite", name: "DeepSeek-Lite" },
];

describe("ModelPicker", () => {
  const models = [
    { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash" },
    { id: "anthropic/claude-vision", name: "Anthropic: Claude Vision" },
    { id: "semnome", name: "semnome" },
  ];

  it("lists models, marks the selected one and reports clicks", () => {
    const onSelect = vi.fn();
    render(<ModelPicker models={models} selectedId="semnome" onSelect={onSelect} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("option", { name: /semnome/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("option", { name: /Claude Vision/ })).toHaveAttribute(
      "aria-selected",
      "false"
    );

    fireEvent.click(screen.getByRole("option", { name: /Claude Vision/ }));
    expect(onSelect).toHaveBeenCalledWith("anthropic/claude-vision");
  });

  it("shows the id below the name only when they differ", () => {
    render(<ModelPicker models={models} selectedId="" onSelect={vi.fn()} />);

    expect(screen.getByText("anthropic/claude-vision")).toBeInTheDocument();
    expect(screen.getAllByText("semnome")).toHaveLength(1);
  });

  it("filters by name or id, ignoring case and surrounding spaces", () => {
    render(<ModelPicker models={models} selectedId="" onSelect={vi.fn()} />);
    const search = screen.getByLabelText("Buscar modelo");

    fireEvent.change(search, { target: { value: "  GEMINI " } });
    expect(screen.getAllByRole("option")).toHaveLength(1);

    fireEvent.change(search, { target: { value: "anthropic/" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Claude Vision/ })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("shows an empty state when nothing matches", () => {
    render(<ModelPicker models={models} selectedId="" onSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Buscar modelo"), { target: { value: "zzz" } });

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nenhum modelo encontrado.")).toBeInTheDocument();
  });
});

describe("SettingsModal provider selection", () => {
  const originalFetch = global.fetch;
  let modelsResponse: () => Promise<Response>;
  let providersResponse: () => Promise<Response>;

  const json = (body: unknown, ok = true, status = 200) =>
    Promise.resolve({ ok, status, json: async () => body } as Response);

  const renderModal = (overrides: Partial<AppSettings> = {}) => {
    const onSave = vi.fn();
    render(
      <SettingsModal
        settings={{ ...DEFAULT_SETTINGS, ...overrides }}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    return onSave;
  };

  const flush = (ms = 0) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  const chooseProvider = async (id: string) => {
    await flush();
    fireEvent.change(screen.getByLabelText("Provedor de IA"), { target: { value: id } });
  };

  const typeKey = async (key: string) => {
    fireEvent.change(screen.getByLabelText("API key do provedor"), { target: { value: key } });
    await flush(700);
  };

  const modelsCalls = () =>
    vi.mocked(global.fetch).mock.calls.filter(([url]) => String(url).includes("/api/models"));

  beforeEach(() => {
    vi.useFakeTimers();
    providersResponse = () => json(PROVIDERS);
    modelsResponse = () => json({ provider: "deepseek", models: MODELS });
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/providers")) return providersResponse();
      if (String(url).includes("/api/models")) return modelsResponse();
      return Promise.reject(new Error(`Unhandled ${url}`));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("starts on the server default with no key or model fields and no model lookups", async () => {
    renderModal();
    await flush(2000);

    expect(screen.getByLabelText("Provedor de IA")).toHaveValue("server");
    expect(screen.queryByLabelText("API key do provedor")).not.toBeInTheDocument();
    expect(screen.queryByText(/Modelo \(com suporte a imagem\)/)).not.toBeInTheDocument();
    expect(modelsCalls()).toHaveLength(0);
  });

  it("lists the catalog returned by the backend", async () => {
    renderModal();
    await flush();

    const options = within(screen.getByLabelText("Provedor de IA")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Padrão do servidor",
      "DeepSeek",
      "OpenRouter",
    ]);
  });

  it("shows the key field after choosing a provider, but no models until a key is typed", async () => {
    renderModal();
    await chooseProvider("deepseek");

    const keyInput = screen.getByLabelText("API key do provedor");
    expect(keyInput).toHaveAttribute("type", "password");
    expect(screen.getByText(/cobradas na sua conta do provedor/)).toBeInTheDocument();
    expect(screen.queryByText(/Modelo \(com suporte a imagem\)/)).not.toBeInTheDocument();
    await flush(2000);
    expect(modelsCalls()).toHaveLength(0);
  });

  it("loads models once provider and key are filled, preselects the default and saves the choice", async () => {
    const onSave = renderModal();
    await chooseProvider("deepseek");

    fireEvent.change(screen.getByLabelText("API key do provedor"), {
      target: { value: "sk-user" },
    });
    expect(screen.getByText("Carregando modelos...")).toBeInTheDocument();
    await flush(700);

    expect(screen.queryByText("Carregando modelos...")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /DeepSeek-V4.1-Flash/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(modelsCalls()).toHaveLength(1);

    fireEvent.click(screen.getByText("Salvar"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        visionProvider: "deepseek",
        visionApiKey: "sk-user",
        visionModel: "deepseek-flash",
      })
    );
  });

  it("preselects the first model when the provider default is not in the list", async () => {
    modelsResponse = () =>
      json({ provider: "openrouter", models: [{ id: "a/x", name: "A: X" }, { id: "b/y", name: "B: Y" }] });
    const onSave = renderModal();
    await chooseProvider("openrouter");
    await typeKey("sk-user");

    expect(screen.getByRole("option", { name: /A: X/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByText("Salvar"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visionModel: "a/x" }));
  });

  it("keeps a previously saved model when it is still in the list", async () => {
    const onSave = renderModal({
      visionProvider: "deepseek",
      visionApiKey: "sk-user",
      visionModel: "deepseek-lite",
    });
    await flush();
    await flush(700);

    expect(screen.getByRole("option", { name: /DeepSeek-Lite/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(screen.getByText("Salvar"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visionModel: "deepseek-lite" }));
  });

  it("saves the model picked by the user", async () => {
    const onSave = renderModal();
    await chooseProvider("deepseek");
    await typeKey("sk-user");

    fireEvent.click(screen.getByRole("option", { name: /DeepSeek-Lite/ }));
    fireEvent.click(screen.getByText("Salvar"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visionModel: "deepseek-lite" }));
  });

  it("clears the model when the provider changes", async () => {
    const onSave = renderModal({ visionProvider: "deepseek", visionModel: "deepseek-lite" });
    await flush();

    fireEvent.change(screen.getByLabelText("Provedor de IA"), { target: { value: "openrouter" } });
    fireEvent.click(screen.getByText("Salvar"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ visionProvider: "openrouter", visionModel: "" })
    );
  });

  it("hides key and model fields again when going back to the server default", async () => {
    renderModal({ visionProvider: "deepseek", visionApiKey: "sk-user" });
    await flush();
    await flush(700);
    expect(screen.getByLabelText("API key do provedor")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Provedor de IA"), { target: { value: "server" } });
    await flush(2000);

    expect(screen.queryByLabelText("API key do provedor")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(modelsCalls()).toHaveLength(1);
  });

  it("shows a specific message and a retry button when the key is rejected, and keeps saving available", async () => {
    modelsResponse = () =>
      json({ detail: { code: "provider_auth_error", message: "x" } }, false, 400);
    const onSave = renderModal({ visionModel: "modelo-antigo" });
    await chooseProvider("deepseek");
    await typeKey("sk-errada");

    expect(screen.getByRole("alert")).toHaveTextContent(/Chave recusada pelo provedor/);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    modelsResponse = () => json({ provider: "deepseek", models: MODELS });
    fireEvent.click(screen.getByText("Tentar novamente"));
    await flush(700);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Salvar"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("saves the previous model untouched while the model list is unavailable", async () => {
    modelsResponse = () => json({ detail: { code: "upstream_timeout", message: "x" } }, false, 504);
    const onSave = renderModal({ visionProvider: "deepseek", visionApiKey: "sk-user", visionModel: "salvo" });
    await flush();
    await flush(700);

    expect(screen.getByRole("alert")).toHaveTextContent(/demorou demais/);
    fireEvent.click(screen.getByText("Salvar"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visionModel: "salvo" }));
  });

  it("falls back to the server message for unknown error codes", async () => {
    modelsResponse = () => json({ detail: { code: "algo_novo", message: "mensagem do servidor" } }, false, 500);
    renderModal({ visionProvider: "deepseek", visionApiKey: "sk-user" });
    await flush();
    await flush(700);

    expect(screen.getByRole("alert")).toHaveTextContent("mensagem do servidor");
  });

  it("warns when the provider list cannot be loaded and still offers the server default", async () => {
    providersResponse = () => Promise.reject(new Error("Network down"));
    renderModal();
    await flush();

    expect(screen.getByText(/Não foi possível carregar a lista de provedores/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Provedor de IA")).getAllByRole("option")).toHaveLength(1);
  });

  it("keeps showing a saved provider that the backend did not list", async () => {
    providersResponse = () => Promise.reject(new Error("Network down"));
    renderModal({ visionProvider: "deepseek" });
    await flush();

    expect(screen.getByLabelText("Provedor de IA")).toHaveValue("deepseek");
  });
});

describe("ReviewModal provider errors", () => {
  it.each([
    ["provider_auth_error", /chave de API foi recusada pelo provedor/],
    ["missing_api_key", /Falta a API key do provedor/],
    ["unknown_provider", /não reconhece o provedor escolhido/],
  ])("shows a specific message for %s and keeps manual selection", (code, expected) => {
    const onConfirm = vi.fn();
    render(
      <ReviewModal
        imageSrc="data:image/jpeg;base64,mock"
        result={null}
        error={{ code, message: "x" }}
        isLoading={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(expected);
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    fireEvent.click(screen.getByText(/Confirmar & Enviar VTT/));
    expect(onConfirm).toHaveBeenCalledWith("d20", 9);
  });
});
