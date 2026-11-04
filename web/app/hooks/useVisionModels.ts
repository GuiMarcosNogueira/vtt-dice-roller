"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeaders, readApiError } from "../lib/api";
import { RecognitionError, VisionModel, VisionProvider } from "../types";

const DEBOUNCE_MS = 600;

interface ModelsState {
  models: VisionModel[];
  isLoading: boolean;
  error: RecognitionError | null;
}

const EMPTY: ModelsState = { models: [], isLoading: false, error: null };
const LOADING: ModelsState = { models: [], isLoading: true, error: null };

interface Params {
  apiUrl: string;
  apiToken: string;
  provider: VisionProvider | undefined;
  apiKey: string;
}

export function useVisionModels({ apiUrl, apiToken, provider, apiKey }: Params) {
  const [state, setState] = useState<ModelsState>(EMPTY);
  const [attempt, setAttempt] = useState(0);

  const providerId = provider?.id;
  const enabled = Boolean(provider?.requires_user_key) && apiKey !== "";

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }

    setState(LOADING);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/models?provider=${encodeURIComponent(providerId!)}`,
          {
            headers: { ...authHeaders(apiToken), "X-Vision-Api-Key": apiKey },
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          setState({ models: [], isLoading: false, error: await readApiError(response) });
          return;
        }
        const data: { models: VisionModel[] } = await response.json();
        setState({ models: data.models, isLoading: false, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          models: [],
          isLoading: false,
          error: { code: "network_error", message: String(err) },
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, providerId, apiKey, apiUrl, apiToken, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
