import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";

// Log environment info for debugging
console.log('[Storybook Vault] Starting app...');
console.log('[Storybook Vault] Backend URL:', process.env.REACT_APP_BACKEND_URL || 'NOT SET');
console.log('[Storybook Vault] Environment:', process.env.NODE_ENV);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
