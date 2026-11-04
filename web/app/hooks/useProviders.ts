"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "../lib/api";
import { SERVER_PROVIDER, VisionProvider } from "../types";

const FALLBACK: VisionProvider[] = [SERVER_PROVIDER];

export function useProviders(apiUrl: string, apiToken: string) {
  const [providers, setProviders] = useState<VisionProvider[]>(FALLBACK);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiUrl}/api/providers`, {
      headers: authHeaders(apiToken),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Erro na API (${response.status})`);
        return response.json();
      })
      .then((data: VisionProvider[]) => {
        setProviders(data);
        setFailed(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setProviders(FALLBACK);
        setFailed(true);
      });

    return () => controller.abort();
  }, [apiUrl, apiToken]);

  return { providers, failed };
}
