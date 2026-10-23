"use client";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 48, maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 650 }}>This page could not load</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        Billing data is temporarily unavailable. Your workspace and payments are unaffected.
      </p>
      <button className="btn" data-variant="primary" style={{ marginTop: 20 }} onClick={reset}>
        Try again
      </button>
      {error.digest ? (
        <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-tertiary)" }}>
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
