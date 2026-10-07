"use client";
import { useEffect, useState } from "react";
type Status = { state: string; eligible: boolean; qualified: boolean; message: string };

export function MetaLeadQualification({ leadId }: { leadId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/sales/meta-conversions?leadId=${encodeURIComponent(leadId)}`, { cache: "no-store" });
        const result = await response.json();
        if (active && response.ok && result.ok) setStatus(result);
        else if (active) setError("Unable to load Meta reporting status.");
      } catch { if (active) setError("Unable to load Meta reporting status."); }
    }
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [leadId]);
  async function qualify() {
    if (!confirmed || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sales/meta-conversions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, confirmQualified: true }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not apply label.");
      setStatus(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Please retry."); }
    finally { setBusy(false); }
  }
  return <section className="sales-panel nested" aria-label="Meta lead reporting">
    <h3>Meta qualified lead</h3>
    {status?.qualified ? <span className="sales-chip">Meta qualified lead · {status.state === "sent" ? "Sent to Meta" : status.state}</span> : null}
    <p role="status">{status?.message ?? "Checking WhatsApp ad attribution…"}</p>
    {status?.eligible ? <><label style={{ display: "flex", gap: 8, alignItems: "start" }}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I confirmed this is a genuine, suitable lead and want to share its ad conversion with Meta.</label>
      <button type="button" className="sales-primary-button" disabled={!confirmed || busy} onClick={() => void qualify()}>{busy ? "Queueing…" : "Apply label & send to Meta"}</button></> : null}
    {error ? <p role="alert">{error}</p> : null}
    <small>Uses the original WhatsApp ad click ID. No chat text or OTP is shared. Reapplying cannot resend the same conversion. Meta optimisation is not instant.</small>
  </section>;
}
