import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";

function normalizeStatus(s) {
  const v = String(s || "").trim().toLowerCase();
  return v === "used" ? "used" : "unused";
}

function normalizeId(id) {
  return String(id ?? "").trim();
}

export default function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("ticket_id", { ascending: true });

    if (error) alert(`Load failed: ${error.message}`);
    else setTickets(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tickets;
    return tickets.filter((t) =>
      (t.ticket_id || "").toLowerCase().includes(s) ||
      (t.name || "").toLowerCase().includes(s) ||
      (t.email || "").toLowerCase().includes(s) ||
      (t.status || "").toLowerCase().includes(s)
    );
  }, [tickets, q]);

  async function upsertMany(rows) {
    const { error } = await supabase
      .from("tickets")
      .upsert(rows, { onConflict: "ticket_id" });
    if (error) throw error;
  }

  async function onImport(file) {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const rows = json
        .map((r) => {
          const ticketId = normalizeId(
            r.ticketId ?? r.TicketId ?? r.ticket_id ?? r["ticket id"] ?? r.TICKETID
          );
          if (!ticketId) return null;
          const st = normalizeStatus(r.status ?? r.Status ?? "unused");
          return {
            ticket_id: ticketId,
            name: String(r.name ?? r.Name ?? ""),
            email: String(r.email ?? r.Email ?? ""),
            status: st,
            used_at: st === "used" ? new Date().toISOString() : null,
          };
        })
        .filter(Boolean);

      if (rows.length === 0) {
        alert("No valid rows found. Ensure your Excel has a 'ticketId' column.");
        return;
      }

      await upsertMany(rows);
      await load();
      alert(`Imported/updated ${rows.length} tickets.`);
    } catch (e) {
      alert(`Import failed: ${e.message || e}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportExcel() {
    const rows = tickets.map((t) => ({
      ticketId: t.ticket_id,
      name: t.name || "",
      email: t.email || "",
      status: t.status || "unused",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    XLSX.writeFile(wb, "tickets.xlsx");
  }

  async function addOne() {
    const ticketId = prompt("Ticket ID:");
    if (!ticketId) return;

    const name = prompt("Name (optional):") || "";
    const email = prompt("Email (optional):") || "";

    setLoading(true);
    const { error } = await supabase
      .from("tickets")
      .upsert(
        [{ ticket_id: normalizeId(ticketId), name, email, status: "unused", used_at: null }],
        { onConflict: "ticket_id" }
      );
    setLoading(false);

    if (error) return alert(`Add failed: ${error.message}`);
    await load();
  }

  async function toggleStatus(ticket) {
    const next = ticket.status === "used" ? "unused" : "used";
    const payload = {
      status: next,
      used_at: next === "used" ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("ticket_id", ticket.ticket_id);

    if (error) return alert(`Update failed: ${error.message}`);
    setTickets((prev) =>
      prev.map((t) =>
        t.ticket_id === ticket.ticket_id ? { ...t, ...payload } : t
      )
    );
  }

  async function deleteOne(ticketId) {
    if (!confirm(`Delete ticket ${ticketId}?`)) return;
    const { error } = await supabase.from("tickets").delete().eq("ticket_id", ticketId);
    if (error) return alert(`Delete failed: ${error.message}`);
    setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId));
  }

  async function deleteAll() {
    if (!confirm("This will delete ALL tickets. Continue?")) return;
    setLoading(true);
    const { error } = await supabase.from("tickets").delete().neq("ticket_id", "");
    setLoading(false);
    if (error) return alert(`Delete all failed: ${error.message}`);
    setTickets([]);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Dashboard</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {loading ? "Working…" : `${tickets.length} tickets total`}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticketId / name / email / status"
              style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #e5e7eb", minWidth: 260 }}
            />

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
              style={{ display: "none" }}
              id="importFile"
            />
            <label
              htmlFor="importFile"
              style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", cursor: "pointer" }}
            >
              Import Excel
            </label>

            <button onClick={exportExcel} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}>
              Export Excel
            </button>

            <button onClick={addOne} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}>
              Add Ticket
            </button>

            <button onClick={deleteAll} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #ef4444", background: "#ef4444", color: "white" }}>
              Delete All
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Ticket ID</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Name</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Email</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>Status</th>
                <th style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.ticket_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{t.ticket_id}</td>
                  <td style={{ padding: 12 }}>{t.name || "-"}</td>
                  <td style={{ padding: 12 }}>{t.email || "-"}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      onClick={() => toggleStatus(t)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: t.status === "used" ? "#111827" : "white",
                        color: t.status === "used" ? "white" : "#111827",
                        cursor: "pointer",
                      }}
                    >
                      {t.status === "used" ? "used" : "unused"}
                    </button>
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    <button
                      onClick={() => deleteOne(t.ticket_id)}
                      style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: "#6b7280" }}>
                    No tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
