"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { Download, ExternalLink, RefreshCcw, Save, Upload } from "lucide-react";

export type AdminWebinar = {
  capacity: number | null;
  countdownEnabled: boolean;
  currency: string;
  description: string;
  id: string;
  meetingLink: string | null;
  phonePeEnabled: boolean;
  priceAmount: number;
  priceMode: "FREE" | "PAID";
  registrationEnabled: boolean;
  scheduledAt: string;
  thumbnailUrl: string | null;
  title: string;
};

export type AdminRegistration = {
  createdAt: string;
  currentMonthlyProjects: string;
  email: string;
  fullName: string;
  id: string;
  participantType: string;
  paymentStatus: string;
  status: string;
  whatsappNumber: string;
};

type ApiPayload = {
  error?: string;
  ok?: boolean;
  registrations?: Array<{
    createdAt: string;
    currentMonthlyProjects: string;
    email: string;
    fullName: string;
    id: string;
    participantType: string;
    payments?: Array<{ status: string }>;
    status: string;
    whatsappNumber: string;
  }>;
  webinar?: AdminWebinar & { priceAmount: number | string };
};

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeRegistrations(items: ApiPayload["registrations"] = []): AdminRegistration[] {
  return items.map((item) => ({
    createdAt: item.createdAt,
    currentMonthlyProjects: item.currentMonthlyProjects,
    email: item.email,
    fullName: item.fullName,
    id: item.id,
    participantType: item.participantType,
    paymentStatus: item.payments?.[0]?.status ?? "",
    status: item.status,
    whatsappNumber: item.whatsappNumber,
  }));
}

function normalizeWebinar(webinar: ApiPayload["webinar"]): AdminWebinar | null {
  if (!webinar) return null;
  return {
    ...webinar,
    priceAmount: Number(webinar.priceAmount),
  };
}

export function GappWebinarConsole({
  initialRegistrations,
  initialWebinar,
  onSaved,
}: {
  initialRegistrations: AdminRegistration[];
  initialWebinar: AdminWebinar;
  onSaved?: () => Promise<void> | void;
}) {
  const [webinar, setWebinar] = useState(initialWebinar);
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function update<K extends keyof AdminWebinar>(key: K, value: AdminWebinar[K]) {
    setWebinar((current) => ({ ...current, [key]: value }));
  }

  async function refresh() {
    const response = await fetch("/api/super-admin/gapp-webinars", { credentials: "include", cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;
    const nextWebinar = normalizeWebinar(payload.webinar);
    if (!response.ok || payload.ok === false || !nextWebinar) {
      setStatus(payload.error ?? "Unable to refresh GAPP webinar.");
      return;
    }
    setWebinar(nextWebinar);
    setRegistrations(normalizeRegistrations(payload.registrations));
    setStatus("GAPP webinar refreshed.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("");
    const response = await fetch("/api/super-admin/gapp-webinars", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...webinar,
        scheduledAt: webinar.scheduledAt,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;
    const nextWebinar = normalizeWebinar(payload.webinar);
    if (!response.ok || payload.ok === false || !nextWebinar) {
      setStatus(payload.error ?? "Unable to save GAPP webinar.");
      setIsSaving(false);
      return;
    }
    setWebinar(nextWebinar);
    setRegistrations(normalizeRegistrations(payload.registrations));
    await onSaved?.();
    setStatus("Webinar published to Agency Growth and the Sales workspace.");
    setIsSaving(false);
  }

  async function uploadThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setStatus("");
    const formData = new FormData();
    formData.set("thumbnail", file);
    const response = await fetch(`/api/super-admin/gapp-webinars/${encodeURIComponent(webinar.id)}/thumbnail`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;
    const nextWebinar = normalizeWebinar(payload.webinar);
    if (!response.ok || payload.ok === false || !nextWebinar) {
      setStatus(payload.error ?? "Unable to upload thumbnail.");
      setIsUploading(false);
      return;
    }
    setWebinar(nextWebinar);
    setStatus("Thumbnail uploaded.");
    setIsUploading(false);
  }

  return (
    <section className="brief-card gapp-admin-card">
      <div className="landing-controls-head">
        <div>
          <span className="meta-pill">Unified webinar scheduler</span>
          <strong>Schedule once. Publish to Agency Growth and Sales.</strong>
          <p className="muted-copy">Control the public registration page, sales-agent invite view, countdown, capacity, payment mode, meeting link, and attendee export from one place.</p>
        </div>
        <div className="package-form-actions">
          <a className="freelancer-secondary-button" href="/webinar" rel="noreferrer" target="_blank">
            Preview
            <ExternalLink size={14} strokeWidth={1.8} />
          </a>
          <button className="freelancer-secondary-button" onClick={refresh} type="button">
            <RefreshCcw size={14} strokeWidth={1.8} />
            Refresh
          </button>
        </div>
      </div>

      <form className="freelancer-form-grid marketing-form-grid" onSubmit={save}>
        <label className="freelancer-field freelancer-field-full">
          <span>Webinar title</span>
          <input onChange={(event) => update("title", event.target.value)} value={webinar.title} />
        </label>
        <label className="freelancer-field">
          <span>Date and time</span>
          <input onChange={(event) => update("scheduledAt", fromDateTimeLocal(event.target.value))} type="datetime-local" value={toDateTimeLocal(webinar.scheduledAt)} />
        </label>
        <label className="freelancer-field">
          <span>Capacity</span>
          <input
            min={1}
            onChange={(event) => update("capacity", event.target.value ? Number(event.target.value) : null)}
            placeholder="Unlimited"
            type="number"
            value={webinar.capacity ?? ""}
          />
        </label>
        <label className="freelancer-field freelancer-field-full">
          <span>Description</span>
          <textarea onChange={(event) => update("description", event.target.value)} rows={4} value={webinar.description} />
        </label>
        <label className="freelancer-field freelancer-field-full">
          <span>Meeting link</span>
          <input onChange={(event) => update("meetingLink", event.target.value)} placeholder="https://..." value={webinar.meetingLink ?? ""} />
        </label>
        <label className="freelancer-field">
          <span>Price mode</span>
          <select onChange={(event) => update("priceMode", event.target.value as "FREE" | "PAID")} value={webinar.priceMode}>
            <option value="FREE">Free</option>
            <option value="PAID">Paid</option>
          </select>
        </label>
        <label className="freelancer-field">
          <span>Paid price</span>
          <input min={0} onChange={(event) => update("priceAmount", Number(event.target.value))} type="number" value={webinar.priceAmount} />
        </label>
        <label className="landing-checkbox-row">
          <input checked={webinar.registrationEnabled} onChange={(event) => update("registrationEnabled", event.target.checked)} type="checkbox" />
          <span>Registration enabled</span>
        </label>
        <label className="landing-checkbox-row">
          <input checked={webinar.countdownEnabled} onChange={(event) => update("countdownEnabled", event.target.checked)} type="checkbox" />
          <span>Countdown enabled</span>
        </label>
        <label className="landing-checkbox-row">
          <input checked={webinar.phonePeEnabled} onChange={(event) => update("phonePeEnabled", event.target.checked)} type="checkbox" />
          <span>PhonePe enabled for paid webinar</span>
        </label>

        <div className="package-form-actions freelancer-field-full">
          <button className="freelancer-primary-button" disabled={isSaving} type="submit">
            <Save size={15} strokeWidth={1.8} />
            {isSaving ? "Publishing..." : "Publish webinar schedule"}
          </button>
          <label className="freelancer-secondary-button gapp-upload-button">
            <Upload size={15} strokeWidth={1.8} />
            {isUploading ? "Uploading..." : "Upload thumbnail"}
            <input accept="image/*" hidden onChange={uploadThumbnail} type="file" />
          </label>
          <a className="freelancer-secondary-button" href={`/api/super-admin/gapp-webinars/${encodeURIComponent(webinar.id)}/registrations.csv`}>
            <Download size={15} strokeWidth={1.8} />
            Export CSV
          </a>
        </div>
      </form>

      {status ? <p className="dashboard-inline-status success">{status}</p> : null}

      <div className="gapp-registration-table-wrap">
        <div className="landing-controls-head compact">
          <div>
            <span className="meta-pill">Registrations</span>
            <strong>{registrations.length} latest attendees</strong>
          </div>
        </div>
        <table className="gapp-registration-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>WhatsApp</th>
              <th>Email</th>
              <th>Type</th>
              <th>Projects</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {registrations.length ? (
              registrations.map((item) => (
                <tr key={item.id}>
                  <td>{item.fullName}</td>
                  <td>{item.whatsappNumber}</td>
                  <td>{item.email}</td>
                  <td>{item.participantType}</td>
                  <td>{item.currentMonthlyProjects}</td>
                  <td>{item.paymentStatus || item.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No GAPP registrations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
