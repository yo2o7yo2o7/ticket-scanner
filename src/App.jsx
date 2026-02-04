import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Scanner from "./pages/Scanner.jsx";

export default function App() {
  const base = "px-3 py-2 rounded-lg border text-sm font-medium";
  const active = "bg-black text-white border-black";
  const idle = "bg-white text-black border-gray-200 hover:border-gray-400";

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8" }}>
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>Ticket Scanner</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Single event • Excel import/export • QR redeem
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/scanner"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
            >
              Scanner
            </NavLink>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scanner" element={<Scanner />} />
        </Routes>
      </div>
    </div>
  );
}
