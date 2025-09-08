// FILE: web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import IncidentForm from "./components/incidentform";
import "./styles.css"; // <- DON'T remove — restores the UI look

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IncidentForm />
  </React.StrictMode>
);
