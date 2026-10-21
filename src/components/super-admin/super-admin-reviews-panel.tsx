"use client";

import { useState, useEffect } from "react";
import { aicloserApi } from "@/lib/api-client";
import {
  Star,
  MessageSquare,
  CheckCircle2,
  Clock,
  Phone,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export type FeedbackRecord = {
  id: string;
  rating: number;
  name: string;
  contact: string;
  comment: string;
  source: string;
  status: "NEW" | "CONTACTED" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string | null;
  adminNotes?: string | null;
};

type FeedbackStats = {
  total: number;
  pending: number;
  resolved: number;
  avgRating: string;
};

export function SuperAdminReviewsPanel() {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({ total: 0, pending: 0, resolved: 0, avgRating: "0.0" });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "NEW" | "CONTACTED" | "RESOLVED">("ALL");
  const [copiedLink, setCopiedLink] = useState(false);

  const RATE_PAGE_URL = "https://aicloser.in/rate";
  const GMB_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJo5F7NI8XYzkRdOsuwCANm0U";

  const loadData = async () => {
    setLoading(true);
    try {
      const data = (await aicloserApi.superAdmin.listFeedback()) as any;
      const rawItems = Array.isArray(data) ? data : (data?.items || data?.feedback || []);
      const formattedItems: FeedbackRecord[] = rawItems.map((item: any) => ({
        id: String(item.id),
        rating: Number(item.rating ?? item.metadata?.rating ?? 5),
        name: String(item.name ?? item.customerName ?? item.actorUserId ?? "Anonymous"),
        contact: String(item.contact ?? item.phone ?? item.metadata?.contact ?? ""),
        comment: String(item.comment ?? item.message ?? item.note ?? ""),
        source: String(item.source ?? "web"),
        status: (item.status ?? (item.action?.includes("RESOLVED") ? "RESOLVED" : "NEW")) as "NEW" | "CONTACTED" | "RESOLVED",
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        resolvedAt: item.resolvedAt ?? null,
        adminNotes: item.adminNotes ?? null,
      }));
      setItems(formattedItems);
      const total = formattedItems.length;
      const pending = formattedItems.filter((i) => i.status === "NEW" || i.status === "CONTACTED").length;
      const resolved = formattedItems.filter((i) => i.status === "RESOLVED").length;
      const avgRating = total > 0 ? (formattedItems.reduce((acc, i) => acc + i.rating, 0) / total).toFixed(1) : "0.0";
      setStats(data?.stats || { total, pending, resolved, avgRating });
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "NEW" | "CONTACTED" | "RESOLVED") => {
    try {
      await aicloserApi.superAdmin.updateFeedbackStatus(id, newStatus);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
      if (newStatus === "RESOLVED") {
        setStats((s) => ({ ...s, pending: Math.max(0, s.pending - 1), resolved: s.resolved + 1 }));
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(RATE_PAGE_URL);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredItems = items.filter((item) => {
    if (filter === "ALL") return true;
    return item.status === filter;
  });

  const getCleanPhone = (contact: string) => {
    const cleaned = contact.replace(/\D/g, "");
    if (cleaned.length === 10) return `91${cleaned}`;
    return cleaned;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header Banner & Tools */}
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                backgroundColor: "rgba(249, 115, 22, 0.15)",
                color: "var(--accent)",
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              GMB Protection Funnel
            </span>
            <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>Ai Closer - Sales CRM</span>
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", margin: "0 0 6px 0" }}>
            Customer Feedback & Reviews Gate
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, maxWidth: "620px" }}>
            4–5 star raters are automatically routed to Google Maps. 1–3 star complaints are intercepted here
            so you can resolve them privately without hurting your public rating.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={copyShareLink}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              backgroundColor: "var(--border)",
              color: "var(--text)",
              border: "1px solid var(--border-strong)",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copiedLink ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
            <span>{copiedLink ? "Link Copied!" : "Copy Review Link"}</span>
          </button>

          <a
            href={RATE_PAGE_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              backgroundColor: "var(--accent)",
              color: "var(--text)",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span>Open Rate Page</span>
            <ExternalLink size={15} />
          </a>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              backgroundColor: "var(--border)",
              border: "1px solid var(--border-strong)",
              borderRadius: "10px",
              color: "var(--text)",
              cursor: "pointer",
            }}
            title="Refresh Feed"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
            <ShieldCheck size={16} color="var(--success)" />
            <span>Bad Reviews Intercepted</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text)", marginTop: "10px" }}>
            {stats.total}
          </div>
          <div style={{ fontSize: "12px", color: "var(--success)", marginTop: "4px" }}>
            Filtered from Google Maps
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span>Pending Action</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--danger)", marginTop: "10px" }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Clients awaiting follow-up
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
            <CheckCircle2 size={16} color="var(--accent)" />
            <span>Resolved Grievances</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--accent)", marginTop: "10px" }}>
            {stats.resolved}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Issues resolved by team
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
            <Star size={16} color="var(--warning)" />
            <span>Intercepted Avg Rating</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--warning)", marginTop: "10px" }}>
            {stats.avgRating} <span style={{ fontSize: "16px", color: "var(--text-tertiary)" }}>/ 5</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Target Google Rating: 5.0 ⭐
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        {(["ALL", "NEW", "CONTACTED", "RESOLVED"] as const).map((tabKey) => {
          const isActive = filter === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setFilter(tabKey)}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                backgroundColor: isActive ? "var(--accent)" : "var(--bg-surface)",
                color: isActive ? "var(--text)" : "var(--text-secondary)",
                transition: "all 0.15s ease",
              }}
            >
              {tabKey === "ALL" && `All Feedbacks (${items.length})`}
              {tabKey === "NEW" && `New (${items.filter((i) => i.status === "NEW").length})`}
              {tabKey === "CONTACTED" && `Contacted (${items.filter((i) => i.status === "CONTACTED").length})`}
              {tabKey === "RESOLVED" && `Resolved (${items.filter((i) => i.status === "RESOLVED").length})`}
            </button>
          );
        })}
      </div>

      {/* Feed List */}
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "20px",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-tertiary)" }}>
            Loading feedbacks...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: "0 0 6px 0" }}>
              No Negative Reviews in this Queue
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-tertiary)", margin: 0 }}>
              All good! Either all complaints are resolved or customers are rating 4–5 stars on Google.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filteredItems.map((item) => {
              const waText = encodeURIComponent(
                `Hi ${item.name}, thank you for sharing your feedback with AI Closer leadership. We noticed you had an issue (${item.rating}-star rating): "${item.comment}". Our founder personally asked me to reach out and resolve this for you. Could we assist you right now?`
              );
              const waUrl = `https://wa.me/${getCleanPhone(item.contact)}?text=${waText}`;

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: "#121215",
                    border: "1px solid var(--border)",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* Top Bar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                          {item.name}
                        </span>
                        {/* Rating Stars */}
                        <div style={{ display: "flex", gap: "2px" }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              fill={s <= item.rating ? "var(--warning)" : "none"}
                              color={s <= item.rating ? "var(--warning)" : "#52525B"}
                            />
                          ))}
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            backgroundColor:
                              item.status === "NEW"
                                ? "rgba(239, 68, 68, 0.15)"
                                : item.status === "CONTACTED"
                                ? "rgba(234, 179, 8, 0.15)"
                                : "rgba(34, 197, 94, 0.15)",
                            color:
                              item.status === "NEW"
                                ? "var(--danger)"
                                : item.status === "CONTACTED"
                                ? "var(--warning)"
                                : "var(--success)",
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                        Phone / Contact: <span style={{ color: "#D4D4D8", fontWeight: 600 }}>{item.contact}</span> •{" "}
                        {new Date(item.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>

                    {/* Quick Outreach Buttons */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => handleUpdateStatus(item.id, "CONTACTED")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          backgroundColor: "var(--success)",
                          color: "var(--text)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>WhatsApp Client</span>
                      </a>

                      <a
                        href={`tel:${item.contact}`}
                        onClick={() => handleUpdateStatus(item.id, "CONTACTED")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          backgroundColor: "var(--border)",
                          color: "var(--text)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <Phone size={13} />
                        <span>Call</span>
                      </a>

                      {item.status !== "RESOLVED" ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(item.id, "RESOLVED")}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "rgba(59, 130, 246, 0.15)",
                            color: "var(--accent)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(item.id, "NEW")}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "transparent",
                            color: "var(--text-tertiary)",
                            border: "1px solid var(--border-strong)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comment Body */}
                  <div
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      fontSize: "14px",
                      color: "#E4E4E7",
                      lineHeight: 1.5,
                    }}
                  >
                    "{item.comment}"
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
