"use client";

import { useEffect, useState } from "react";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import type { CustomFieldDefinition, LeadCustomValues } from "@/lib/gigxomi/custom-fields-store";
import type { AppRole } from "@/lib/auth/types";
import { aicloserApi } from "@/lib/api-client";

type Props = {
  leadId: string;
  userRole?: AppRole;
  onValuesChanged?: () => void;
};

export function LeadCustomFieldsEditor({ leadId, userRole = "SALES_AGENT", onValuesChanged }: Props) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [values, setValues] = useState<LeadCustomValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [centralFields, centralValues] = await Promise.all([
          aicloserApi.customFields.list(),
          aicloserApi.customFields.getLeadValues(leadId),
        ]);
        if (mounted) {
          const mappedFields: CustomFieldDefinition[] = Array.isArray(centralFields)
            ? centralFields.map((field: any) => ({
              id: String(field.id),
              name: String(field.fieldKey),
              label: String(field.fieldLabel),
              type: String(field.fieldType || "text") as CustomFieldDefinition["type"],
              options: Array.isArray(field.options) ? field.options : [],
              required: Boolean(field.isRequired),
              defaultValue: field.defaultValue,
              rolePermissions: { ADMIN: "READ_WRITE", MANAGER: "READ_WRITE", SALES_AGENT: "READ_WRITE" },
              sortOrder: Number(field.position ?? 0),
              createdAt: String(field.createdAt || new Date().toISOString()),
              updatedAt: String(field.updatedAt || new Date().toISOString()),
            }))
            : [];
          setFields(mappedFields);

          const rawValues = (centralValues as any)?.values || {};
          const valuesByLegacyId = mappedFields.reduce<LeadCustomValues>((acc, field) => {
            if (Object.prototype.hasOwnProperty.call(rawValues, field.name)) {
              acc[field.id] = rawValues[field.name] as any;
            }
            return acc;
          }, {});
          setValues(valuesByLegacyId);
        }
      } catch (err) {
        console.error("Failed to load custom fields for lead", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [leadId]);

  const roleKey = userRole === "SUPER_ADMIN" || userRole === "ADMIN" ? "ADMIN" : userRole === "MANAGER" ? "MANAGER" : "SALES_AGENT";

  // Filter out HIDDEN fields for the current role
  const visibleFields = fields.filter((f) => {
    const perm = f.rolePermissions[roleKey] || "READ_WRITE";
    return perm !== "HIDDEN";
  });

  const handleFieldChange = (fieldId: string, val: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const valuesByKey = fields.reduce<Record<string, unknown>>((acc, field) => {
        if (Object.prototype.hasOwnProperty.call(values, field.id)) {
          acc[field.name] = values[field.id];
        }
        return acc;
      }, {});
      await aicloserApi.customFields.updateLeadValues(leadId, valuesByKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onValuesChanged?.();
    } catch (err) {
      console.error("Failed to save custom field values", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "0.75rem", fontSize: "0.85rem", opacity: 0.7 }}>
        Loading custom fields...
      </div>
    );
  }

  if (visibleFields.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: "10px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "var(--closer-text-bright, #fff)", display: "flex", alignItems: "center", gap: "6px" }}>
          <ClipboardList size={15} color="var(--closer-orange, #ff6b2f)" /> Custom CRM Data Fields
        </h4>
        <span style={{ fontSize: "0.75rem", color: "var(--closer-muted, #94a3b8)" }}>
          {visibleFields.length} configured field{visibleFields.length > 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {visibleFields.map((field) => {
          const perm = field.rolePermissions[roleKey] || "READ_WRITE";
          const isReadOnly = perm === "READ_ONLY";
          const val = values[field.id] ?? "";

          return (
            <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--closer-muted, #cbd5e1)" }}>
                {field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
              </label>

              {field.type === "dropdown" ? (
                <select
                  disabled={isReadOnly}
                  value={String(val)}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "inherit",
                    fontSize: "0.82rem",
                  }}
                >
                  <option value="">{field.placeholder || "Select option..."}</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "date" ? (
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={String(val)}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "inherit",
                    fontSize: "0.82rem",
                  }}
                />
              ) : field.type === "number" ? (
                <input
                  type="number"
                  disabled={isReadOnly}
                  placeholder={field.placeholder}
                  value={String(val)}
                  onChange={(e) => handleFieldChange(field.id, e.target.value ? Number(e.target.value) : "")}
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "inherit",
                    fontSize: "0.82rem",
                  }}
                />
              ) : field.type === "boolean" ? (
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", cursor: "pointer", marginTop: "0.25rem" }}>
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={Boolean(val)}
                    onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                  />
                  <span>{val ? "Yes / Confirmed" : "No / Unset"}</span>
                </label>
              ) : (
                <input
                  type="text"
                  disabled={isReadOnly}
                  placeholder={field.placeholder || "Enter value..."}
                  value={String(val)}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "inherit",
                    fontSize: "0.82rem",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
        {saveSuccess && (
          <span style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={13} /> Custom fields saved
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "0.45rem 1rem",
            borderRadius: "6px",
            background: "linear-gradient(135deg, #ff6b2f, #ff8c42)",
            color: "#fff",
            border: "none",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            boxShadow: "0 2px 8px rgba(255, 107, 47, 0.3)",
          }}
        >
          {saving ? "Saving..." : "Save Custom Fields"}
        </button>
      </div>
    </div>
  );
}
