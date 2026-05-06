// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  getCountFromServer,
  orderBy,
  query,
  where,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const AdminUpload       = React.lazy(() => import("./AdminUpload"));
const AdminBookings     = React.lazy(() => import("./AdminBookings"));
const AdminMediaManager = React.lazy(() => import("./AdminMediaManager"));

async function safeCount(qy) {
  try {
    const res = await getCountFromServer(qy);
    return res.data().count || 0;
  } catch {
    return 0;
  }
}
const cls = (...xs) => xs.filter(Boolean).join(" ");

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState({ rows: [], loading: true, error: "" });
  const [loadingStats, setLoadingStats] = useState(true);
  const [refIndex, setRefIndex] = useState({ rows: [], loading: true, error: "" });
  const [refSearch, setRefSearch] = useState("");
  const [savingStatus, setSavingStatus] = useState({});
  const [headerVisible, setHeaderVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setHeaderVisible(true);
    (async () => {
      setLoadingStats(true);
      const bookingsCol  = collection(db, "bookings");
      const galleriesCol = collection(db, "galleries");

      const totalBookings = await safeCount(query(bookingsCol));
      const pending = await safeCount(query(bookingsCol, where("status", "==", "pending")));
      const confirmedUpcoming = await safeCount(
        query(bookingsCol, where("status", "==", "confirmed"), where("startAt", ">=", new Date()))
      );
      const galleries = await safeCount(query(galleriesCol));
      setStats({ totalBookings, pending, confirmedUpcoming, galleries });
      setLoadingStats(false);

      await refreshUpcoming(setUpcoming);
      await loadRefIndex();
    })();
  }, []);

  async function refreshUpcoming(setter) {
    try {
      const bookingsCol = collection(db, "bookings");
      const qy = query(
        bookingsCol,
        where("startAt", ">=", new Date()),
        orderBy("startAt", "asc"),
        limit(6)
      );
      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setter({ rows, loading: false, error: "" });
    } catch (e) {
      setter({ rows: [], loading: false, error: "Couldn't load upcoming bookings." });
    }
  }

  async function loadRefIndex() {
    setRefIndex((p) => ({ ...p, loading: true, error: "" }));
    try {
      const col = collection(db, "bookings");
      let snap;
      try {
        snap = await getDocs(query(col, orderBy("startAt", "desc"), limit(300)));
      } catch {
        snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(300)));
      }
      const rows = snap.docs.map((d) => {
        const data = d.data();
        const dt = data.startAt?.toDate?.() || null;
        return {
          id: d.id,
          reference: data.reference || "",
          name: data.details?.name || "",
          email: data.details?.email || "",
          status: (data.status || "").toLowerCase(),
          when: dt
            ? dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
            : `${data.date || ""} ${data.time || ""}`.trim(),
        };
      });
      setRefIndex({ rows, loading: false, error: "" });
    } catch (e) {
      setRefIndex({ rows: [], loading: false, error: "Couldn't load references." });
    }
  }

  async function changeStatus(b, nextStatus) {
    const id = b.id;
    const prev = (b.status || "").toLowerCase();
    const next = String(nextStatus || "").toLowerCase();
    if (!next || next === prev) return;
    if (next === "canceled" && !window.confirm("Mark this booking as CANCELED?")) return;

    setSavingStatus((m) => ({ ...m, [id]: true }));
    try {
      await updateDoc(doc(db, "bookings", id), {
        status: next,
        updatedAt: serverTimestamp(),
        ...(next === "confirmed" ? { confirmedAt: serverTimestamp() } : {}),
        ...(next === "finished"  ? { finishedAt: serverTimestamp() }  : {}),
        ...(next === "canceled"  ? { canceledAt: serverTimestamp() }  : {}),
      });

      setUpcoming((p) => ({
        ...p,
        rows: p.rows.map((r) => (r.id === id ? { ...r, status: next } : r)),
      }));
    } catch {
      alert("Could not change status.");
    } finally {
      setSavingStatus((m) => ({ ...m, [id]: false }));
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await updateDoc(doc(db, "bookings", id), {
        status: "canceled",
        canceledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setUpcoming((p) => ({
        ...p,
        rows: p.rows.map((r) => (r.id === id ? { ...r, status: "canceled" } : r)),
      }));
    } catch {
      alert("Could not cancel.");
    }
  }

  async function deleteBooking(id, status) {
    if ((status || "").toLowerCase() !== "canceled") {
      alert("Only canceled bookings can be deleted.");
      return;
    }
    if (!window.confirm("Permanently delete this canceled booking?")) return;
    try {
      await deleteDoc(doc(db, "bookings", id));
      setUpcoming((p) => ({
        ...p,
        rows: p.rows.filter((r) => r.id !== id),
      }));
    } catch {
      alert("Could not delete.");
    }
  }

  const filteredRefs = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return refIndex.rows;
    return refIndex.rows.filter((r) =>
      r.reference.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    );
  }, [refSearch, refIndex.rows]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (err) {
      alert("Sign out failed: " + err.message);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
      </svg>
    )},
    { id: "bookings", label: "Bookings", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    )},
    { id: "upload", label: "Upload", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
      </svg>
    )},
    { id: "media", label: "Media", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <section className="relative bg-burgundy overflow-hidden -mt-16 md:-mt-20 pt-24 md:pt-28 pb-8 md:pb-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div
              className={cls(
                "transition-all duration-700",
                headerVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="w-12 h-0.5 bg-gold mb-4" />
              <h1 className="font-serif text-2xl md:text-3xl font-light text-white">
                Admin Dashboard
              </h1>
            </div>
            <button
              onClick={handleSignOut}
              className="btn bg-white/10 text-white hover:bg-white/20 border border-white/20 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Sign Out
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="mt-8 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cls(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-gold text-charcoal"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stats */}
              {loadingStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="bg-white border border-burgundy/10 p-6 animate-pulse">
                      <div className="h-8 bg-burgundy/10 rounded w-16 mx-auto" />
                      <div className="h-4 bg-burgundy/5 rounded w-24 mx-auto mt-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Bookings" value={stats.totalBookings} icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                  } />
                  <StatCard label="Pending" value={stats.pending} color="amber" icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  } />
                  <StatCard label="Upcoming" value={stats.confirmedUpcoming} color="emerald" icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  } />
                  <StatCard label="Galleries" value={stats.galleries} color="purple" icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  } />
                </div>
              )}

              {/* Upcoming Bookings */}
              <div className="bg-white border border-burgundy/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-burgundy/10 flex items-center justify-between">
                  <h3 className="font-serif text-lg text-charcoal">Upcoming Bookings</h3>
                  <span className="text-sm text-charcoal/50">{upcoming.rows.length} sessions</span>
                </div>
                {upcoming.loading ? (
                  <div className="p-6 text-center text-charcoal/50">Loading...</div>
                ) : upcoming.error ? (
                  <div className="p-6 text-center text-red-600">{upcoming.error}</div>
                ) : upcoming.rows.length === 0 ? (
                  <div className="p-6 text-center text-charcoal/50">No upcoming bookings</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-burgundy/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Reference</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">When</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-burgundy/10">
                        {upcoming.rows.map((b) => (
                          <tr key={b.id} className="hover:bg-burgundy/5 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm bg-burgundy/5 px-2 py-1 rounded">{b.reference}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-charcoal">{b.details?.name}</td>
                            <td className="px-4 py-3 text-charcoal/70">
                              {b.startAt?.toDate?.().toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={b.status} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  to={`/admin/album/${b.id}`}
                                  title="Edit Album Layout"
                                  className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-burgundy text-cream hover:bg-olive transition-colors"
                                >
                                  Album
                                </Link>
                                <ActionBtn
                                  onClick={() => changeStatus(b, "confirmed")}
                                  disabled={savingStatus[b.id]}
                                  color="emerald"
                                  title="Confirm"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                                  </svg>
                                </ActionBtn>
                                <ActionBtn
                                  onClick={() => changeStatus(b, "finished")}
                                  disabled={savingStatus[b.id]}
                                  color="gold"
                                  title="Mark Finished"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                  </svg>
                                </ActionBtn>
                                <ActionBtn
                                  onClick={() => cancelBooking(b.id)}
                                  disabled={savingStatus[b.id]}
                                  color="wine"
                                  title="Cancel"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                </ActionBtn>
                                <ActionBtn
                                  onClick={() => deleteBooking(b.id, b.status)}
                                  color="red"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                </ActionBtn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === "bookings" && (
            <div className="bg-white border border-burgundy/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-burgundy/10">
                <h3 className="font-serif text-lg text-charcoal">All Booking References</h3>
                <p className="text-sm text-charcoal/50 mt-1">Search and manage all bookings</p>
              </div>
              <div className="p-4 border-b border-burgundy/10">
                <div className="relative max-w-md">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by reference, name, or email..."
                    className="input pl-10"
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-burgundy/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">When</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-charcoal/70 uppercase tracking-wider">Album</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-burgundy/10">
                    {filteredRefs.map((r) => (
                      <tr key={r.id} className="hover:bg-burgundy/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm bg-burgundy/5 px-2 py-1 rounded">{r.reference}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-charcoal">{r.name}</td>
                        <td className="px-4 py-3 text-charcoal/70">{r.email}</td>
                        <td className="px-4 py-3 text-charcoal/70">{r.when}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/admin/album/${r.id}`}
                            className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold bg-burgundy text-cream hover:bg-olive transition-colors"
                          >
                            Edit album
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRefs.length === 0 && (
                  <div className="p-8 text-center text-charcoal/50">
                    No bookings found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div className="bg-white border border-burgundy/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-burgundy/10">
                <h3 className="font-serif text-lg text-charcoal">Upload Images</h3>
                <p className="text-sm text-charcoal/50 mt-1">Upload photos to client galleries or portfolio</p>
              </div>
              <Suspense fallback={<div className="p-6 text-center text-charcoal/50">Loading upload tools...</div>}>
                <AdminUpload />
              </Suspense>
            </div>
          )}

          {/* Media Tab */}
          {activeTab === "media" && (
            <div className="bg-white border border-burgundy/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-burgundy/10">
                <h3 className="font-serif text-lg text-charcoal">Media Manager</h3>
                <p className="text-sm text-charcoal/50 mt-1">View and manage uploaded images</p>
              </div>
              <div className="p-4">
                <Suspense fallback={<div className="p-6 text-center text-charcoal/50">Loading media manager...</div>}>
                  <AdminMediaManager />
                </Suspense>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------- UI Components ---------- */
function StatCard({ label, value, icon, color = "burgundy" }) {
  const colors = {
    burgundy: "bg-burgundy/10 text-burgundy",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    purple: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="bg-white border border-burgundy/10 p-6 hover:shadow-soft transition-shadow">
      <div className="flex items-center justify-between">
        <div className={cls("w-10 h-10 rounded-full flex items-center justify-center", colors[color])}>
          {icon}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-charcoal">{value}</div>
          <div className="text-sm text-charcoal/60">{label}</div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const s = (status || "").toLowerCase();
  const styles = {
    confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    finished: "bg-gold/20 text-charcoal ring-gold/40",
    canceled: "bg-red-50 text-red-700 ring-red-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  const labels = {
    confirmed: "Confirmed",
    finished: "Finished",
    canceled: "Canceled",
    pending: "Pending",
  };

  return (
    <span className={cls(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1",
      styles[s] || styles.pending
    )}>
      {labels[s] || "Pending"}
    </span>
  );
}

function ActionBtn({ children, onClick, disabled, color = "gray", title }) {
  const colors = {
    emerald: "text-emerald-600 hover:bg-emerald-50",
    gold: "text-amber-600 hover:bg-amber-50",
    wine: "text-wine hover:bg-wine/10",
    red: "text-red-600 hover:bg-red-50",
    gray: "text-charcoal/60 hover:bg-charcoal/5",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cls(
        "p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        colors[color]
      )}
    >
      {children}
    </button>
  );
}
