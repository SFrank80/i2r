// web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import IncidentFormPage from "./components/incidentform";   // <— THIS file
import "./styles.css";                           // keep styles separate

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IncidentFormPage />
  </React.StrictMode>
);
