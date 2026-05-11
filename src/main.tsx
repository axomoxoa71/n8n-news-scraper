import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logWebEvent } from "./logger";

window.onerror = (message, source, lineno, colno, error) => {
  logWebEvent({
    level: "error",
    layer: "web",
    message: "unhandled_global_error",
    error_message: typeof message === "string" ? message : String(message),
    error_source: source,
    error_line: lineno,
    error_column: colno,
    error_name: error instanceof Error ? error.name : "UnknownError",
    error_stack: error instanceof Error ? error.stack : undefined,
  });
};

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  logWebEvent({
    level: "error",
    layer: "web",
    message: "unhandled_promise_rejection",
    error_name: reason instanceof Error ? reason.name : "UnknownError",
    error_message: reason instanceof Error ? reason.message : String(reason),
    error_stack: reason instanceof Error ? reason.stack : undefined,
  });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
