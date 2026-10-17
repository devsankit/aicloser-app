"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Mail, Phone, Search, UserRound, X } from "lucide-react";

import { aicloserApi, type CentralContact, type Lead } from "@/lib/api-client";
import styles from "./universal-lead-search.module.css";

export type UniversalLeadSearchResult = {
  id: string;
  leadId: string | null;
  conversationId: string | null;
  name: string;
  phone: string;
  email: string;
  source: string;
  kind: "contact" | "lead";
};

type UniversalLeadSearchProps = {
  onSelect: (result: UniversalLeadSearchResult) => void;
};

function contactResult(contact: CentralContact): UniversalLeadSearchResult {
  const extended = contact as CentralContact & { conversationId?: string | null };
  return {
    id: contact.id,
    leadId: contact.leadId ?? null,
    conversationId: extended.conversationId ?? null,
    name: contact.fullName || contact.e164Phone,
    phone: contact.e164Phone || "",
    email: contact.email || "",
    source: contact.source || "Contact",
    kind: "contact",
  };
}

function leadResult(lead: Lead): UniversalLeadSearchResult {
  return {
    id: lead.id,
    leadId: lead.id,
    conversationId: lead.conversationId ?? null,
    name: lead.customerName || lead.customerPhone,
    phone: lead.customerPhone || "",
    email: lead.customerEmail || "",
    source: lead.source || "Lead",
    kind: "lead",
  };
}

function dedupeResults(contacts: CentralContact[], leads: Lead[]) {
  const results: UniversalLeadSearchResult[] = [];
  const seen = new Set<string>();

  for (const result of contacts.map(contactResult)) {
    const key = result.leadId ? `lead:${result.leadId}` : `contact:${result.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(result);
  }

  for (const result of leads.map(leadResult)) {
    const key = `lead:${result.leadId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(result);
  }

  return results;
}

function displaySource(source: string) {
  return source
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function UniversalLeadSearch({ onSelect }: UniversalLeadSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UniversalLeadSearchResult[]>([]);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestNumber = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const requestId = ++requestNumber.current;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");
      try {
        const trimmed = query.trim();
        const [contactsResponse, leadsResponse] = await Promise.all([
          aicloserApi.contacts.list({ page: 1, limit: 30, search: trimmed || undefined }),
          trimmed ? aicloserApi.leads.list({ page: 1, limit: 30, search: trimmed }) : Promise.resolve({ leads: [] as Lead[] }),
        ]);
        if (requestId !== requestNumber.current) return;
        setResults(dedupeResults(contactsResponse.contacts, leadsResponse.leads));
        setActiveIndex(-1);
      } catch (loadError) {
        if (requestId !== requestNumber.current) return;
        setResults([]);
        setError(loadError instanceof Error ? loadError.message : "Search could not be loaded.");
      } finally {
        if (requestId === requestNumber.current) setIsLoading(false);
      }
    }, query.trim() ? 220 : 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, query]);

  function openSearch() {
    setIsOpen(true);
  }

  function clearSearch() {
    setQuery("");
    setActiveIndex(-1);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setIsOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      onSelect(results[activeIndex]);
      setIsOpen(false);
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={`${styles.inputShell}${isOpen ? ` ${styles.inputShellOpen}` : ""}`}>
        <Search aria-hidden="true" size={15} strokeWidth={1.8} />
        <input
          aria-controls="universal-lead-search-results"
          aria-expanded={isOpen}
          aria-label="Search leads and contacts"
          onChange={handleInputChange}
          onFocus={openSearch}
          onKeyDown={handleKeyDown}
          placeholder="Search leads or contacts"
          role="combobox"
          value={query}
        />
        {isLoading ? <span aria-label="Loading search" className={styles.loadingDot} /> : null}
        {query ? (
          <button aria-label="Clear lead search" className={styles.clearButton} onClick={clearSearch} type="button">
            <X size={13} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className={styles.results} id="universal-lead-search-results" role="listbox">
          <div className={styles.resultsHeader}>
            <span>{query.trim() ? "Matching leads & contacts" : "All contacts"}</span>
            <span>{results.length ? `${results.length} shown` : "Live data"}</span>
          </div>
          {isLoading ? <div className={styles.emptyState}>Searching live contacts…</div> : null}
          {!isLoading && error ? <div className={styles.emptyState}>{error}</div> : null}
          {!isLoading && !error && results.length === 0 ? (
            <div className={styles.emptyState}>{query.trim() ? "No matching lead or contact found." : "No contacts available."}</div>
          ) : null}
          {!isLoading && !error ? results.map((result, index) => (
            <button
              aria-selected={activeIndex === index}
              className={`${styles.resultItem}${activeIndex === index ? ` ${styles.resultItemActive}` : ""}`}
              key={`${result.kind}-${result.id}`}
              onClick={() => {
                onSelect(result);
                setIsOpen(false);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              <span className={styles.avatar}>{(result.name || "?").slice(0, 1).toUpperCase()}</span>
              <span className={styles.resultCopy}>
                <span className={styles.resultTopline}>
                  <strong>{result.name}</strong>
                  <small>{result.kind === "lead" ? "Lead" : "Contact"}</small>
                </span>
                <span className={styles.resultMeta}>
                  {result.phone ? <><Phone aria-hidden="true" size={12} />{result.phone}</> : null}
                  {result.email ? <><Mail aria-hidden="true" size={12} />{result.email}</> : null}
                  {!result.phone && !result.email ? <><UserRound aria-hidden="true" size={12} />{displaySource(result.source)}</> : null}
                </span>
              </span>
              <span className={styles.resultSource}>{displaySource(result.source)}</span>
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}
