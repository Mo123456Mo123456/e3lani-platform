import { useMemo } from "react";

import { trpc } from "./trpc";
import type { ResumableVideoApi } from "./resumable-video-upload";

export function useResumableVideoApi() {
  const capabilities = trpc.media.resumableCapabilities.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
  });
  const prepare = trpc.media.prepareResumableVideo.useMutation();
  const status = trpc.media.resumableVideoStatus.useMutation();
  const signPart = trpc.media.signResumableVideoPart.useMutation();
  const complete = trpc.media.completeResumableVideo.useMutation();
  const abort = trpc.media.abortResumableVideo.useMutation();

  const api = useMemo<ResumableVideoApi>(
    () => ({
      prepare: (input) => prepare.mutateAsync(input),
      status: (ticket) => status.mutateAsync({ ticket }),
      signPart: (ticket, partNumber) => signPart.mutateAsync({ ticket, partNumber }),
      complete: (ticket) => complete.mutateAsync({ ticket }),
      abort: (ticket) => abort.mutateAsync({ ticket }),
    }),
    [abort, complete, prepare, signPart, status],
  );

  return {
    api,
    enabled: capabilities.data?.enabled === true,
    isLoading: capabilities.isLoading,
    isError: capabilities.isError,
    retry: capabilities.refetch,
  };
}
