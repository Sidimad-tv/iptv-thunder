import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import "./App.css";

// Browser compatibility polyfills for non-Tauri environments
if (typeof globalThis.Touch !== 'function') {
  globalThis.Touch = class Touch { constructor() {} identifier = 0; target = null; screenX = 0; screenY = 0; clientX = 0; clientY = 0; pageX = 0; pageY = 0; } as any;
}
if (typeof globalThis.TouchEvent !== 'function') {
  globalThis.TouchEvent = class TouchEvent extends Event {
    constructor(type: string, opts?: EventInit) { super(type, opts); }
    touches: Touch[] = []; targetTouches: Touch[] = []; changedTouches: Touch[] = [];
    altKey = false; metaKey = false; ctrlKey = false; shiftKey = false;
  } as any;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <ThemeProvider defaultTheme="dark" storageKey="iptv-thunder-theme">
      <div className="ui h-screen w-full overflow-hidden bg-transparent">
        <App />
      </div>
    </ThemeProvider>
  </ErrorBoundary>,
);
