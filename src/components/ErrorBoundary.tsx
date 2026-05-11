import { Component, type ErrorInfo, type ReactNode } from "react";
import { logWebEvent } from "../logger";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logWebEvent({
      level: "error",
      layer: "web",
      message: "react_error_boundary_caught",
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      component_stack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            background: "#0f1117",
            color: "#e5e7eb",
            fontFamily: "sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#9ca3af", maxWidth: "40rem" }}>
            An unexpected error occurred. Please reload the page. If the problem
            persists, contact support and include the trace ID visible in the
            browser console.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1.25rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
