import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { listenForServiceWorkerUpdates, registerServiceWorker } from "@/lib/pushNotifications";
import { logBuildInfo } from "@/lib/buildInfo";
import { logger } from '@/lib/logger';

// Log build info for debugging
logBuildInfo();

// Register our custom SW FIRST, before app renders - ensures it takes priority
registerServiceWorker().then(() => {
  logger.log('[main] Custom SW registered successfully');
}).catch((err) => {
  logger.error('[main] Custom SW registration failed:', err);
});

// Listen for SW updates from the stub (old sw.js will trigger reload)
listenForServiceWorkerUpdates();

createRoot(document.getElementById("root")!).render(<App />);
