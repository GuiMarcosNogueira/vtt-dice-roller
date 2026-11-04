import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisionModels } from "../app/hooks/useVisionModels";
import { VisionProvider } from "../app/types";

const DEEPSEEK: VisionProvider = {
  id: "deepseek",
  name: "DeepSeek",
  default_model: "deepseek-flash",
  requires_user_key: true,
};
const OPENROUTER: VisionProvider = { ...DEEPSEEK, id: "openrouter", name: "OpenRouter" };
const SERVER: VisionProvider = {
  id: "server",
  name: "Padrão do servidor",
  default_model: "m",
  requires_user_key: false,
};

const MODELS = [{ id: "deepseek-flash", name: "DeepSeek-V4.1-Flash" }];

const base = {
  apiUrl: "http://api:8000",
  apiToken: "",
  provider: DEEPSEEK as VisionProvider | undefined,
  apiKey: "sk-user",
};

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
const failure = (status: number, body?: unknown) =>
  Promise.resolve({
    ok: false,
    status,
    json: async () => {
      if (body === undefined) throw new Error("sem corpo");
      return body;
    },
  } as Response);

// fetch que respeita o AbortSignal, como o de verdade
const abortAware = (respond: (url: string) => Promise<Response>) =>
  vi.fn().mockImplementation((url: string, init: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      init.signal!.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError"))
      );
      respond(url).then(resolve, reject);
    });
  });

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("useVisionModels", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("does not fetch for providers that do not need a user key", async () => {
    global.fetch = vi.fn();

    const { result } = renderHook(() => useVisionModels({ ...base, provider: SERVER }));
    await advance(2000);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ models: [], isLoading: false, error: null });
  });

  it("does not fetch without a provider or without a key", async () => {
    global.fetch = vi.fn();

    renderHook(() => useVisionModels({ ...base, provider: undefined }));
    renderHook(() => useVisionModels({ ...base, apiKey: "" }));
    await advance(2000);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("debounces typing and fetches once with the final key", async () => {
    global.fetch = vi.fn().mockImplementation(() => ok({ models: MODELS }));

    const { result, rerender } = renderHook((props) => useVisionModels(props), {
      initialProps: { ...base, apiKey: "s" },
    });
    expect(result.current.isLoading).toBe(true);
    await advance(300);
    rerender({ ...base, apiKey: "sk" });
    await advance(300);
    expect(global.fetch).not.toHaveBeenCalled();
    rerender({ ...base, apiKey: "sk-final" });
    await advance(600);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("http://api:8000/api/models?provider=deepseek");
    expect((init as RequestInit).headers).toMatchObject({ "X-Vision-Api-Key": "sk-final" });
    expect(result.current).toMatchObject({ models: MODELS, isLoading: false, error: null });
  });

  it("sends the access token together with the provider key", async () => {
    global.fetch = vi.fn().mockImplementation(() => ok({ models: MODELS }));

    renderHook(() => useVisionModels({ ...base, apiToken: "token-da-mesa" }));
    await advance(600);

    expect(vi.mocked(global.fetch).mock.calls[0][1]?.headers).toEqual({
      Authorization: "Bearer token-da-mesa",
      "X-Vision-Api-Key": "sk-user",
    });
  });

  it("ignores a response that arrives after the key changed", async () => {
    global.fetch = abortAware(
      (url) =>
        new Promise((resolve) => {
          // a primeira chamada nunca responde; a segunda responde na hora
          if (vi.mocked(global.fetch).mock.calls.length > 1) {
            resolve({ ok: true, status: 200, json: async () => ({ models: MODELS }) } as Response);
          }
          void url;
        })
    );

    const { result, rerender } = renderHook((props) => useVisionModels(props), {
      initialProps: { ...base, apiKey: "primeira" },
    });
    await advance(600);
    rerender({ ...base, apiKey: "segunda" });
    await advance(600);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ models: MODELS, isLoading: false, error: null });
  });

  it("exposes the error code returned by the backend", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(() =>
        failure(400, { detail: { code: "provider_auth_error", message: "recusada" } })
      );

    const { result } = renderHook(() => useVisionModels(base));
    await advance(600);

    expect(result.current.error).toEqual({ code: "provider_auth_error", message: "recusada" });
    expect(result.current.models).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("reports a network error when the request fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useVisionModels(base));
    await advance(600);

    expect(result.current.error?.code).toBe("network_error");
  });

  it("retries after an error", async () => {
    global.fetch = vi.fn().mockImplementation(() => failure(502));
    const { result } = renderHook(() => useVisionModels(base));
    await advance(600);
    expect(result.current.error?.code).toBe("upstream_error");

    global.fetch = vi.fn().mockImplementation(() => ok({ models: MODELS }));
    act(() => result.current.retry());
    expect(result.current.isLoading).toBe(true);
    await advance(600);

    expect(result.current).toMatchObject({ models: MODELS, error: null, isLoading: false });
  });

  it("clears the list when the key is erased or the provider changes", async () => {
    global.fetch = vi.fn().mockImplementation(() => ok({ models: MODELS }));
    const { result, rerender } = renderHook((props) => useVisionModels(props), {
      initialProps: base,
    });
    await advance(600);
    expect(result.current.models).toEqual(MODELS);

    rerender({ ...base, apiKey: "" });
    expect(result.current).toMatchObject({ models: [], isLoading: false, error: null });

    rerender(base);
    await advance(600);
    expect(result.current.models).toEqual(MODELS);

    rerender({ ...base, provider: OPENROUTER });
    expect(result.current.models).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await advance(600);
    expect(vi.mocked(global.fetch).mock.calls.at(-1)?.[0]).toContain("provider=openrouter");
  });
});
