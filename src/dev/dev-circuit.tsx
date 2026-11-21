import { createRoot } from "react-dom/client";
import messages from "../i18n/es.json";
const root = document.getElementById("circuit-root");
if (!root) throw new Error("Circuit root not found");
createRoot(root).render(<main><h1>{messages.circuit.title}</h1></main>);
