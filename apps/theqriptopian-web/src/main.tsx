import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeBridgeRequestInterceptor } from "./services/bridgeFetch";

initializeBridgeRequestInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
