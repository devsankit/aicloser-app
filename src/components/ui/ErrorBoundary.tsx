"use client";

import React, { Component, type ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary caught]:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="card"
          style={{
            padding: "24px",
            margin: "16px",
            background: "var(--bg-surface)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-md)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
              {this.props.fallbackTitle || "Something went wrong in this view"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px", maxWidth: "340px" }}>
              {this.state.error?.message || "An unexpected error occurred. You can safely close or retry."}
            </div>
          </div>
          <button
            type="button"
            className="btn"
            data-size="sm"
            data-variant="primary"
            onClick={this.handleReset}
          >
            Close & Recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
