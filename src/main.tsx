import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Default to dark mode for Drive IA
if (typeof document !== "undefined") {
  const saved = localStorage.getItem("driveia-theme");
  const theme = saved ?? "dark";
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (!saved) localStorage.setItem("driveia-theme", "dark");
}

createRoot(document.getElementById("root")!).render(<App />);
