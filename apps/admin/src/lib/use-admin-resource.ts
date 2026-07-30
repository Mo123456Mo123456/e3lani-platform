"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { readSession } from "./session";

interface ResourceState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  token?: string;
}

export function useAdminResource<T>(path: string, enabled = true): ResourceState<T> & { reload: () => void } {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ loading: true });

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false });
      return;
    }

    const session = readSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    let active = true;
    setState((current) => ({ ...current, loading: true, error: undefined, token: session.token }));
    apiFetch<T>(path, session.token)
      .then((data) => {
        if (active) {
          setState({ data, loading: false, token: session.token });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            error: error instanceof Error ? error.message : "Request failed",
            loading: false,
            token: session.token,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, path, router, version]);

  return {
    ...state,
    reload: () => setVersion((value) => value + 1),
  };
}
