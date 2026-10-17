"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ACCENTS, CURRENT_USER, FONT_SCALES, useApp } from "@/lib/store";
import type { Density, Theme } from "@/lib/types";

const CONNECTIONS = [
  { name: "Telephony (Exotel / Twilio)", detail: "Call events, recordings, missed-call queue", icon: "phone" as const },
  { name: "WhatsApp Business API", detail: "Templates, campaigns, inbound threads", icon: "whatsapp" as const },
  { name: "Razorpay", detail: "Payment links, settlements, receipts", icon: "card" as const },
  { name: "Google Calendar", detail: "Demo booking and availability", icon: "calendar" as const },
  { name: "OpenAI", detail: "Call summaries and next-step suggestions", icon: "sparkle" as const },
];

export function SettingsView() {
  const { state, setTheme, setDensity, setAccent, setFontScale, reset } = useApp();
  const [exported, setExported] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ leads: state.leads }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `closer-leads-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2200);
  };

  return (
    <div className="settings">
      <header className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Appearance and workspace data live in this browser while the backend is being wired.
          </p>
        </div>
      </header>

      <section className="card settings-card">
        <div className="settings-head">
          <div>
            <h2 className="settings-title">Appearance</h2>
            <p className="settings-sub">Saved automatically and applied before the first paint.</p>
          </div>
        </div>
        <div className="settings-body">
          <div className="setting-row">
            <div>
              <div className="setting-name">Theme</div>
              <p className="setting-desc">Warm neutral in both modes — same hierarchy, different ink.</p>
            </div>
            <div className="seg" role="group" aria-label="Theme">
              {(["light", "dark"] as Theme[]).map((t) => (
                <button key={t} data-on={state.theme === t} onClick={() => setTheme(t)}>
                  <Icon name={t === "light" ? "sun" : "moon"} size={12} />
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-name">Density</div>
              <p className="setting-desc">Compact tightens rows and cards for large pipelines.</p>
            </div>
            <div className="seg" role="group" aria-label="Density">
              {(["comfortable", "compact"] as Density[]).map((d) => (
                <button key={d} data-on={state.density === d} onClick={() => setDensity(d)}>
                  {d === "comfortable" ? "Comfortable" : "Compact"}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-name">Accent colour</div>
              <p className="setting-desc">
                Used for primary buttons, links and highlights. The default orange comes from the
                Closer logo.
              </p>
            </div>
            <div className="swatches" role="group" aria-label="Accent colour">
              {ACCENTS.map((preset) => {
                const active = state.accent.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="swatch"
                    style={{ background: preset.color }}
                    aria-label={preset.label}
                    title={preset.label}
                    aria-pressed={active}
                    onClick={() => setAccent(preset.color)}
                  >
                    {active && <Icon name="check" size={12} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-name">Text size</div>
              <p className="setting-desc">Scales labels, tables and form controls across the app.</p>
            </div>
            <div className="seg" role="group" aria-label="Text size">
              {FONT_SCALES.map((scale) => (
                <button
                  key={scale.id}
                  data-on={state.fontScale === scale.id}
                  onClick={() => setFontScale(scale.id)}
                >
                  {scale.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card settings-card">
        <div className="settings-head">
          <div>
            <h2 className="settings-title">Workspace</h2>
            <p className="settings-sub">Local demo data for {CURRENT_USER}&apos;s team.</p>
          </div>
        </div>
        <div className="settings-body">
          <div className="setting-row">
            <div>
              <div className="setting-name">Export leads</div>
              <p className="setting-desc">
                Download every lead in this workspace as JSON — the same shape the API will accept.
              </p>
            </div>
            <button className="btn" onClick={exportJson}>
              <Icon name="download" size={14} /> {exported ? "Downloaded" : "Export JSON"}
            </button>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-name">Reset demo data</div>
              <p className="setting-desc">
                Restore the 18 seeded leads. Your stage moves and edits are discarded.
              </p>
            </div>
            {confirmReset ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
                <button
                  className="btn"
                  data-variant="danger"
                  onClick={() => {
                    reset();
                    setConfirmReset(false);
                  }}
                >
                  Reset
                </button>
              </div>
            ) : (
              <button className="btn" onClick={() => setConfirmReset(true)}>
                <Icon name="trash" size={14} /> Reset
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card settings-card">
        <div className="settings-head">
          <div>
            <h2 className="settings-title">Connections</h2>
            <p className="settings-sub">
              The UI is ready for these. Nothing is connected yet — credentials come next.
            </p>
          </div>
          <span className="chip">{CONNECTIONS.length} pending</span>
        </div>
        <div className="settings-body">
          {CONNECTIONS.map((c) => (
            <div className="setting-row" key={c.name}>
              <div className="conn">
                <span className="conn-icon">
                  <Icon name={c.icon} size={15} />
                </span>
                <div>
                  <div className="setting-name">{c.name}</div>
                  <p className="setting-desc">{c.detail}</p>
                </div>
              </div>
              <button className="btn" disabled title="API wiring comes next">
                Not connected
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
