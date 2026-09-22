import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

/**
 * Apply the stored theme before the first paint.
 *
 * Dark is the base palette on `:root`, so only the opt-in light variant needs
 * a class. Reading the preference here — rather than in an effect after mount —
 * keeps a light-theme visitor from seeing a dark flash on load.
 */
function bootstrapTheme() {
  try {
    const stored = window.localStorage.getItem("explor8-theme");
    if (stored === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.style.colorScheme = "light";
    }
  } catch {
    /* storage unavailable — the dark default still applies */
  }
}

bootstrapTheme();

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <InternetIdentityProvider>
      <App />
    </InternetIdentityProvider>
  </QueryClientProvider>,
);
