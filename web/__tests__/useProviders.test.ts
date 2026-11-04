import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProviders } from "../app/hooks/useProviders";
import { SERVER_PROVIDER, VisionProvider } from "../app/types";

const CATALOG: VisionProvider[] = [
  { id: "server", name: "Padrão do servidor", default_model: "m", requires_user_key: false },
  { id: "deepseek", name: "DeepSeek", default_model: "deepseek-flash", requires_user_key: true },
];

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: async () => body } as Response);

describe("useProviders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("loads the provider catalog from the backend", async () => {
    global.fetch = vi.fn().mockImplementation(() => jsonResponse(CATALOG));

    const { result } = renderHook(() => useProviders("http://api:8000", ""));

    await waitFor(() => expect(result.current.providers).toEqual(CATALOG));
    expect(result.current.failed).toBe(false);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("http://api:8000/api/providers");
    expect(init?.headers).not.toHaveProperty("Authorization");
  });

  it("sends the access token when configured", async () => {
    global.fetch = vi.fn().mockImplementation(() => jsonResponse(CATALOG));

    const { result } = renderHook(() => useProviders("http://api:8000", "token-da-mesa"));

    await waitFor(() => expect(result.current.providers).toEqual(CATALOG));
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer token-da-mesa",
    });
  });

  it("falls back to the server default when the response is not ok", async () => {
    global.fetch = vi.fn().mockImplementation(() => jsonResponse({}, false, 401));

    const { result } = renderHook(() => useProviders("http://api:8000", ""));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.providers).toEqual([SERVER_PROVIDER]);
  });

  it("falls back to the server default when the request fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

    const { result } = renderHook(() => useProviders("http://api:8000", ""));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.providers).toEqual([SERVER_PROVIDER]);
  });

  it("recovers when a later request succeeds", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));
    const { result, rerender } = renderHook(({ url }) => useProviders(url, ""), {
      initialProps: { url: "http://api:8000" },
    });
    await waitFor(() => expect(result.current.failed).toBe(true));

    global.fetch = vi.fn().mockImplementation(() => jsonResponse(CATALOG));
    rerender({ url: "http://outro:8000" });

    await waitFor(() => expect(result.current.providers).toEqual(CATALOG));
    expect(result.current.failed).toBe(false);
  });

  it("ignores an aborted request after unmount", async () => {
    global.fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );

    const { result, unmount } = renderHook(() => useProviders("http://api:8000", ""));
    unmount();
    await Promise.resolve();

    expect(result.current.failed).toBe(false);
    expect(result.current.providers).toEqual([SERVER_PROVIDER]);
  });
});
