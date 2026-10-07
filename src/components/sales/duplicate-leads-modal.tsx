"use client";

import { useEffect, useState } from "react";
import { Users2, GitMerge, Check, AlertCircle, X, CheckCircle2 } from "lucide-react";
import type { DuplicateCluster } from "@/lib/gigxomi/lead-duplicates-store";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onMerged?: () => void;
};

export function DuplicateLeadsModal({ isOpen, onClose, onMerged }: Props) {
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  const loadDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/leads/duplicates");
      const data = await res.json();
      if (data.ok) setClusters(data.clusters || []);
    } catch (err) {
      console.error("Failed to load duplicates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadDuplicates();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMerge = async (primaryId: string, secondaryId: string) => {
    setMerging(secondaryId);
    try {
      const res = await fetch("/api/sales/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryLeadId: primaryId, secondaryLeadId: secondaryId }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadDuplicates();
        onMerged?.();
      } else {
        alert(data.error || "Failed to merge leads");
      }
    } catch (err: any) {
      alert(err.message || "Failed to merge leads");
    } finally {
      setMerging(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "750px",
          background: "#18181b",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "14px",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Users2 size={20} color="var(--closer-orange, #ff6b2f)" />
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
              Duplicate Lead Merge & Recapture
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>
          Identifies leads with matching phone numbers or emails across multiple form/ad submissions. Merging preserves the primary lead, aggregates all call records and notes, and removes the duplicate.
        </p>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            Scanning database for duplicate phone matches...
          </div>
        ) : clusters.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#10b981", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            <CheckCircle2 size={16} /> Zero duplicate leads found. Your lead database is 100% clean and deduplicated.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {clusters.map((cluster) => {
              const primary = cluster.leads[0];
              const duplicates = cluster.leads.slice(1);
              return (
                <div
                  key={cluster.key}
                  style={{
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#ff8c42" }}>
                      {cluster.key} ({cluster.count} matching records)
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Primary: {primary.customerName}
                    </span>
                  </div>

                  {duplicates.map((dup) => (
                    <div
                      key={dup.id}
                      style={{
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <strong style={{ color: "#fff" }}>{dup.customerName}</strong>
                        <span style={{ color: "#94a3b8", marginLeft: "0.5rem" }}>
                          Stage: {dup.stage} • Source: {dup.source} • Created: {new Date(dup.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={merging === dup.id}
                        onClick={() => handleMerge(primary.id, dup.id)}
                        style={{
                          padding: "0.4rem 0.8rem",
                          borderRadius: "6px",
                          background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
                          border: "none",
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          cursor: merging === dup.id ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <GitMerge size={12} />
                        {merging === dup.id ? "Merging..." : "Merge into Primary"}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
