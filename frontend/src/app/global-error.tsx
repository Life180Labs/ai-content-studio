"use client";

import { PageError } from "@/components/shared/error-boundary";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <PageError error={error} reset={reset} />
      </body>
    </html>
  );
}
