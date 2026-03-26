import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <main>WatchCircle web scaffold ready.</main>;
}

const rootNode = document.getElementById("root");

if (!rootNode) {
  throw new Error("Root element not found");
}

createRoot(rootNode).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
