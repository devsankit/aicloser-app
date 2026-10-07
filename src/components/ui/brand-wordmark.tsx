import Link from "next/link";
import type { MouseEventHandler } from "react";

type BrandWordmarkProps = {
  ariaLabel?: string;
  className?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  priority?: boolean;
  collapsed?: boolean;
  variant?: "lockup" | "image";
};

export function BrandWordmark({
  ariaLabel = "Go to AI Closer home",
  className = "brand-wordmark",
  href = "/",
  onClick,
  collapsed = false,
}: BrandWordmarkProps) {
  if (collapsed) {
    return (
      <Link
        aria-label={ariaLabel}
        className={`${className} closer-brand-lockup`}
        href={href}
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        <span
          className="closer-brand-icon"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(255, 91, 20, 0.35)",
          }}
        >
          <img
            src="/icon.png"
            alt="AI Closer"
            width={32}
            height={32}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </span>
      </Link>
    );
  }

  return (
    <Link
      aria-label={ariaLabel}
      className={`${className} closer-brand-lockup`}
      href={href}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        textDecoration: "none",
        lineHeight: 1,
      }}
    >
      <span className="closer-brand-logo-wrapper" style={{ display: "inline-flex", alignItems: "center" }}>
        <img
          src="/assets/closer-logo.png"
          alt="AI Closer"
          className="closer-logo-img closer-logo-img-light"
          style={{ height: "32px", width: "auto", display: "block" }}
        />
        <img
          src="/assets/closer-logo-dark.png"
          alt="AI Closer"
          className="closer-logo-img closer-logo-img-dark"
          style={{ height: "32px", width: "auto", display: "none" }}
        />
      </span>
    </Link>
  );
}
