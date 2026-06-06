import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <ThemeProvider defaultTheme="dark" storageKey="iptv-thunder-theme">
      <div className="ui h-screen w-full overflow-hidden bg-transparent">
        <App />
      </div>
    </ThemeProvider>
  </ErrorBoundary>,
);
