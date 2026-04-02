import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
/**
 * ⚠️ CRITICAL: SDKProvider MUST wrap App.
 * Removing it causes a blank screen — useSDK() throws if provider is missing.
 * DO NOT remove SDKProvider from this file.
 */
import ReactDOM from "react-dom/client";
import App from "./App";
import { SDKProvider } from "./contexts/SDKProvider";
import { InternetIdentityProvider } from "./hooks/useInternetIdentity";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <InternetIdentityProvider>
      {/* ⚠️ CRITICAL: SDKProvider must stay here — DO NOT REMOVE */}
      <SDKProvider>
        <App />
      </SDKProvider>
    </InternetIdentityProvider>
  </QueryClientProvider>,
);
