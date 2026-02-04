import React, { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../supabaseClient";

function extractTicketId(decodedText) {
  const text = String(decodedText || "").trim();
  if (!text) return "";

  try {
    if (text.startsWith("http://") || text.startsWith("https://")) {
      const u = new URL(text);
      const q = u.searchParams.get("ticketId") || u.searchParams.get("ticket_id");
      if (q) return q.trim();
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length) return parts[parts.length - 1].trim();
    }
  } catch {}

  return text;
}

export default function Scanner() {
  const readerId = "qr-reader";
  const qrRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  const statusBox = useMemo(() => {
    if (!result) return null;
    const base = { padding: 14, borderRadius: 16, border: "1px solid #e5e7eb", background: "white" };
    if (result.type === "ok") return { ...base, border: "1px solid #10b981" };
    if (result.type === "used") return { ...base, border: "1px solid #f59e0b" };
    if (result.type === "notfound") return { ...base, border: "1px solid #ef4444" };
    if (result.type === "error") return { ...base, border: "1px solid #ef4444" };
    return base;
  }, [result]);

  async function redeem(ticketId) {
    setResult(null);

    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("ticket_id", ticketId)
      .maybeSingle();

    if (error) return setResult({ type: "error", message: error.message });
    if (!data) return setResult({ type: "notfound", message: `Ticket not found: ${ticketId}` });
    if ((data.status || "unused") === "used") {
      return setResult({ type: "used", message: `Already used: ${ticketId}`, ticket: data });
    }

    const payload = { status: "used", used_at: new Date().toISOString() };
    const upd = await supabase.from("tickets").update(payload).eq("ticket_id", ticketId);
    if (upd.error) return setResult({ type: "error", message: upd.error.message });

    setResult({ type: "ok", message: `Redeemed ✅ ${ticketId}`, ticket: { ...data, ...payload } });
  }

  async function start() {
    if (scanning) return;
    setResult(null);

    const qrcode = new Html5Qrcode(readerId);
    qrRef.current = qrcode;

    try {
      setScanning(true);
      await qrcode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText) => {
          try { await qrcode.stop(); } catch {}
          setScanning(false);

          const ticketId = extractTicketId(decodedText);
          if (!ticketId) return setResult({ type: "error", message: "Could not read ticketId from QR." });

          await redeem(ticketId);
        },
        () => {}
      );
    } catch (e) {
      setScanning(false);
      setResult({ type: "error", message: e.message || String(e) });
      try { await qrcode.clear(); } catch {}
    }
  }

  async function stop() {
    const qrcode = qrRef.current;
    if (!qrcode) return;
    try { await qrcode.stop(); } catch {}
    try { await qrcode.clear(); } catch {}
    qrRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => { stop(); }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Scanner</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Scan QR → match ticketId → mark used</div>
          </div>

          {!scanning ? (
            <button onClick={start} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white" }}>
              Start Camera
            </button>
          ) : (
            <button onClick={stop} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}>
              Stop
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div id={readerId} style={{ width: "100%" }} />
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setResult(null)} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}>
            Clear Message
          </button>

          <button
            onClick={async () => {
              const manual = prompt("Enter ticketId manually:");
              if (manual) await redeem(manual.trim());
            }}
            style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}
          >
            Manual Redeem
          </button>
        </div>
      </div>

      {result && (
       <div style={{ ...statusBox, color: "#111827" }}>
          <div style={{ fontWeight: 700 }}>
            {result.type === "ok" && "Redeemed"}
            {result.type === "used" && "Already Used"}
            {result.type === "notfound" && "Not Found"}
            {result.type === "error" && "Error"}
          </div>
          <div style={{ marginTop: 6 }}>{result.message}</div>
          {result.ticket && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#111827" }}>
              Name: {result.ticket.name || "-"} • Email: {result.ticket.email || "-"}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button onClick={start} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white" }}>
              Scan Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
