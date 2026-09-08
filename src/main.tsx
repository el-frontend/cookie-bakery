import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./providers";
import App from "./App";
import { ToastProvider } from "./components/ToastProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Providers>
  </StrictMode>
);
