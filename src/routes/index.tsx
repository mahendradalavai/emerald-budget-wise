import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, LogOut, Wallet, ChevronLeft, ChevronRight, Trash2, CalendarDays, BarChart3, List, Pencil, Search, X, RefreshCw, UserRound, Phone, Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ProfileTab } from "@/components/ProfileTab";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kharcha – Daily, Monthly & Yearly Expense Tracker" },
      { name: "description", content: "Track your monthly budget and daily spending on rent, groceries, curries, travel, drinks and more." },
      { property: "og:title", content: "Kharcha – Expense Tracker" },
      { property: "og:description", content: "Simple green mobile expense tracker for daily, monthly and yearly spending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Cat = { key: string; label: string; emoji: string; custom?: boolean };

const DEFAULT_CATEGORIES: Cat[] = [
  { key: "rent", label: "Room Rent", emoji: "🏠" },
  { key: "groceries", label: "Groceries", emoji: "🛒" },
  { key: "curries", label: "Curries", emoji: "🍛" },
  { key: "travel", label: "Travel", emoji: "🚌" },
  { key: "drinks", label: "Drinks", emoji: "🥤" },
  { key: "other", label: "Other", emoji: "💸" },
];
const EMOJI_CHOICES = ["🏠","🛒","🍛","🚌","🥤","💸","🍔","🍕","☕","🎬","👕","💊","📱","⚡","🎁","🐾","📚","🏋️","✈️","🎮","💇","🧾","🛕","🎵"];

const money = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const today = () => new Date().toISOString().slice(0, 10);

type Expense = { id: string; amount: number; category: string; note: string | null; spent_on: string };

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <div className="min-h-screen bg-secondary/60">
      <div className="mx-auto min-h-screen max-w-md bg-background shadow-xl">
        {!ready ? <div className="p-10 text-center text-muted-foreground">Loading…</div>
          : session ? <Tracker userId={session.user.id} email={session.user.email || session.user.phone && "+" + session.user.phone || ""} /> : <Auth />}
      </div>
    </div>
  );
}

const authSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid mobile number");

function PhoneAuth() {
  const [cc, setCc] = useState("+91");
  const [num, setNum] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    const phone = (cc.trim() + num.replace(/\D/g, "")).replace(/^\+?/, "+");
    const p = phoneSchema.safeParse(phone);
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p.data });
    setBusy(false);
    if (error) { toast.error(error.message.includes("provider") || error.message.includes("Unsupported") ? "Mobile sign-in isn't switched on yet." : "Couldn't send code. Try again."); return; }
    setSentTo(p.data); setCode(""); setCooldown(30);
    toast.success("Code sent by SMS");
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    if (!/^\d{6}$/.test(code)) { toast.error("Enter the 6-digit code"); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: "sms" });
    setBusy(false);
    if (error) toast.error("Wrong or expired code");
  };

  if (sentTo) return (
    <form onSubmit={verify} className="space-y-4">
      <h2 className="text-xl font-bold">Enter code</h2>
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to {sentTo}</p>
      <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-14 rounded-xl text-center text-2xl font-bold tracking-[0.5em]" placeholder="------" />
      <Button disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">{busy ? "Checking…" : "Verify & continue"}</Button>
      <div className="flex justify-between text-sm font-semibold">
        <button type="button" onClick={() => setSentTo(null)} className="text-muted-foreground">Change number</button>
        <button type="button" disabled={cooldown > 0 || busy} onClick={send} className="text-primary disabled:text-muted-foreground">{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button>
      </div>
    </form>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="space-y-4">
      <h2 className="text-xl font-bold">Sign in with mobile</h2>
      <p className="text-sm text-muted-foreground">New or returning — we'll text you a code.</p>
      <div className="flex gap-2">
        <Input value={cc} maxLength={4} onChange={(e) => setCc(e.target.value.replace(/[^\d+]/g, ""))} className="h-12 w-20 rounded-xl text-center" aria-label="Country code" />
        <Input type="tel" inputMode="numeric" maxLength={15} value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} className="h-12 flex-1 rounded-xl" placeholder="98765 43210" aria-label="Mobile number" />
      </div>
      <Button disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">{busy ? "Sending…" : "Send OTP"}</Button>
    </form>
  );
}

function Auth() {
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = authSchema.safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ ...p.data, options: { emailRedirectTo: window.location.origin } });
      if (error) toast.error(error.message);
      else { toast.success("Check your email to confirm your account"); setMode("in"); }
    }
    setBusy(false);
  };
  return (
    <div className="flex min-h-screen flex-col">
      <div className="rounded-b-[2.5rem] bg-primary px-6 pb-14 pt-16 text-primary-foreground">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/20"><Wallet className="h-7 w-7" /></div>
        <h1 className="text-3xl font-extrabold">Kharcha</h1>
        <p className="mt-1 opacity-90">Know where every rupee goes.</p>
      </div>
      <div className="-mt-8 mx-5 rounded-3xl bg-card p-6 shadow-lg">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {([["email", "Email", Mail], ["phone", "Mobile OTP", Phone]] as const).map(([k, l, I]) => (
            <button key={k} type="button" onClick={() => setMethod(k)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold ${method === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>
              <I className="h-4 w-4" />{l}
            </button>
          ))}
        </div>
        {method === "email" ? (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-xl font-bold">{mode === "in" ? "Welcome back" : "Create account"}</h2>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" placeholder="you@email.com" /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" placeholder="••••••" /></div>
            <Button disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">{mode === "in" ? "Sign in" : "Sign up"}</Button>
            <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm font-semibold text-primary">
              {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </form>
        ) : <PhoneAuth />}
      </div>
      <p className="mt-4 px-8 text-center text-xs text-muted-foreground">You'll stay signed in on this device until you log out.</p>
    </div>
  );
}

function Tracker({ userId, email }: { userId: string; email: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [tab, setTab] = useState<"month" | "daily" | "year" | "profile">("month");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [yearExp, setYearExp] = useState<Expense[]>([]);
  const [customCats, setCustomCats] = useState<Cat[]>([]);
  const [budget, setBudget] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<Cat | null>(null);
  const [calDay, setCalDay] = useState<string | null>(null);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const key = ym(month);
  const year = month.getFullYear();

  const cats = useMemo(() => [...DEFAULT_CATEGORIES, ...customCats], [customCats]);
  const catOf = (k: string) => cats.find((c) => c.key === k) ?? { key: k, label: "Deleted category", emoji: "💸" };

  const load = async () => {
    setLoading(true); setLoadError(false);
    const start = `${key}-01`;
    const end = ym(new Date(month.getFullYear(), month.getMonth() + 1, 1)) + "-01";
    try {
      const [e, b, y, c] = await Promise.all([
        supabase.from("expenses").select("*").gte("spent_on", start).lt("spent_on", end).order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("budgets").select("amount").eq("month", key).maybeSingle(),
        supabase.from("expenses").select("amount,spent_on").gte("spent_on", `${year}-01-01`).lt("spent_on", `${year + 1}-01-01`),
        supabase.from("categories").select("*").order("created_at"),
      ]);
      if (e.error || b.error || y.error || c.error) throw new Error("load failed");
      setExpenses((e.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
      setBudget(Number(b.data?.amount ?? 0));
      setYearExp((y.data ?? []).map((x) => ({ id: "", category: "", note: null, spent_on: x.spent_on, amount: Number(x.amount) })));
      setCustomCats((c.data ?? []).map((x) => ({ key: x.id, label: x.label, emoji: x.emoji, custom: true })));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); setCalDay(null); }, [key]);

  const spent = expenses.reduce((s, x) => s + x.amount, 0);
  const left = budget - spent;
  const byCat = useMemo(() => cats.map((c) => ({ ...c, total: expenses.filter((x) => x.category === c.key).reduce((s, x) => s + x.amount, 0) })), [expenses, cats]);
  const byDay = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach((x) => m.set(x.spent_on, [...(m.get(x.spent_on) ?? []), x]));
    return [...m.entries()];
  }, [expenses]);
  const dayTotals = useMemo(() => new Map(byDay.map(([d, items]) => [d, items.reduce((s, x) => s + x.amount, 0)])), [byDay]);
  const maxDay = Math.max(1, ...dayTotals.values());
  const byMonth = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const k = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { label: new Date(year, i).toLocaleString("en", { month: "short" }), total: yearExp.filter((x) => x.spent_on.startsWith(k)).reduce((s, x) => s + x.amount, 0) };
  }), [yearExp, year]);
  const yearTotal = byMonth.reduce((s, m) => s + m.total, 0);
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  // calendar grid
  const daysInMonth = new Date(year, month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(year, month.getMonth(), 1).getDay();
  const calCells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`),
  ];

  const del = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error("Couldn't delete. Try again."); else { toast.success("Deleted"); load(); }
  };
  const openAdd = () => { setEditExp(null); setAddOpen(true); };

  const q = query.trim().toLowerCase();
  const isFiltering = q !== "" || catFilter !== "all";
  const visibleDays = useMemo(() => byDay
    .filter(([d]) => !calDay || d === calDay)
    .map(([d, items]) => [d, items.filter((x) => {
      if (catFilter !== "all" && x.category !== catFilter) return false;
      if (!q) return true;
      return (x.note ?? "").toLowerCase().includes(q) || catOf(x.category).label.toLowerCase().includes(q);
    })] as [string, Expense[]])
    .filter(([, items]) => items.length > 0), [byDay, calDay, catFilter, q, cats]);
  const filteredCount = visibleDays.reduce((s, [, i]) => s + i.length, 0);
  const filteredTotal = visibleDays.reduce((s, [, i]) => s + i.reduce((a, x) => a + x.amount, 0), 0);

  if (loadError) return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
      <span className="text-5xl">📡</span>
      <p className="mt-4 text-lg font-bold">Couldn't load your expenses</p>
      <p className="mt-1 text-sm text-muted-foreground">Check your internet connection and try again.</p>
      <Button onClick={load} className="mt-5 rounded-xl"><RefreshCw className="h-4 w-4" /> Try again</Button>
    </div>
  );

  return (
    <div className="pb-28">
      <header className="rounded-b-[2rem] bg-primary px-5 pb-6 pt-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div><p className="text-xs opacity-80">Hello 👋</p><p className="max-w-[220px] truncate font-bold">{email}</p></div>
          <button aria-label="Sign out" onClick={() => supabase.auth.signOut()} className="rounded-full bg-primary-foreground/20 p-2.5"><LogOut className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full p-1.5 hover:bg-primary-foreground/20"><ChevronLeft /></button>
          <p className="text-lg font-bold">{month.toLocaleString("en", { month: "long", year: "numeric" })}</p>
          <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full p-1.5 hover:bg-primary-foreground/20"><ChevronRight /></button>
        </div>
        <div className="mt-4 rounded-2xl bg-primary-foreground/15 p-4">
          <div className="flex justify-between text-sm opacity-90"><span>Balance left</span>
            <button onClick={() => setBudgetOpen(true)} className="font-semibold underline">Budget {money(budget)}</button></div>
          <p className="mt-1 text-3xl font-extrabold">{money(left)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-foreground/25">
            <div className="h-full rounded-full bg-primary-foreground" style={{ width: `${budget ? Math.min(100, (spent / budget) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-sm opacity-90">Spent {money(spent)}</p>
        </div>
      </header>

      <main className="px-5 pt-5">
        {tab === "profile" && <ProfileTab userId={userId} contact={email} onSignOut={() => supabase.auth.signOut()} />}
        {tab === "month" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Spending by category</h3>
              <button onClick={() => { setEditCat(null); setCatOpen(true); }} className="flex items-center gap-1 text-sm font-semibold text-primary">
                <Plus className="h-4 w-4" /> New
              </button>
            </div>
            {byCat.map((c) => (
              <div key={c.key} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-2xl">{c.emoji}</div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm font-semibold"><span>{c.label}</span><span>{money(c.total)}</span></div>
                  <Progress value={spent ? (c.total / spent) * 100 : 0} className="mt-2 h-1.5 bg-secondary" />
                </div>
                {c.custom && (
                  <button aria-label={`Edit ${c.label}`} onClick={() => { setEditCat(c); setCatOpen(true); }} className="p-1 text-muted-foreground hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {tab === "daily" && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
              <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground">
                {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calCells.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const t = dayTotals.get(d) ?? 0;
                  const isToday = d === today();
                  return (
                    <button key={d} onClick={() => setCalDay(calDay === d ? null : d)}
                      className={`flex flex-col items-center rounded-lg py-1.5 text-xs font-semibold ${calDay === d ? "bg-primary text-primary-foreground" : isToday ? "ring-1 ring-primary" : ""}`}>
                      <span>{Number(d.slice(8))}</span>
                      <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${t ? "bg-primary" : "bg-transparent"}`}
                        style={t && calDay !== d ? { opacity: 0.35 + 0.65 * (t / maxDay), transform: `scale(${0.8 + 0.9 * (t / maxDay)})` } : undefined} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search notes or categories" value={query} maxLength={50} onChange={(e) => setQuery(e.target.value)} className="h-11 rounded-xl pl-9 pr-9" />
              {query && <button aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
            </div>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {[{ key: "all", label: "All", emoji: "✨" }, ...cats].map((c) => (
                <button key={c.key} onClick={() => setCatFilter(c.key)}
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${catFilter === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                  <span>{c.emoji}</span>{c.label}
                </button>
              ))}
            </div>
            {isFiltering && <p className="text-xs text-muted-foreground">{filteredCount} result{filteredCount === 1 ? "" : "s"} · {money(filteredTotal)}</p>}

            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />)}</div>
            ) : visibleDays.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <span className="text-4xl">{isFiltering ? "🔍" : "🌱"}</span>
                <p className="mt-3 font-bold">{isFiltering ? "Nothing matches" : calDay ? "No spending this day" : "No expenses yet"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{isFiltering ? "Try a different word or category." : "Tap the green + button to add your first one."}</p>
                {isFiltering
                  ? <Button variant="outline" onClick={() => { setQuery(""); setCatFilter("all"); setCalDay(null); }} className="mt-4 rounded-xl">Clear filters</Button>
                  : <Button onClick={openAdd} className="mt-4 rounded-xl"><Plus className="h-4 w-4" /> Add expense</Button>}
              </div>
            ) : visibleDays.map(([day, items]) => (
              <div key={day}>
                <div className="mb-2 flex justify-between text-sm font-bold">
                  <span>{new Date(day + "T00:00").toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="text-primary">{money(items.reduce((s, x) => s + x.amount, 0))}</span>
                </div>
                <div className="divide-y divide-border rounded-2xl bg-card shadow-sm ring-1 ring-border">
                  {items.map((x) => { const c = catOf(x.category); return (
                    <div key={x.id} className="flex items-center gap-3 p-3">
                      <button onClick={() => { setEditExp(x); setAddOpen(true); }} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit ${c.label} expense`}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl">{c.emoji}</div>
                        <div className="flex-1 min-w-0"><p className="font-semibold">{c.label}</p>{x.note && <p className="truncate text-xs text-muted-foreground">{x.note}</p>}</div>
                        <p className="font-bold">{money(x.amount)}</p>
                      </button>
                      <button aria-label="Delete" onClick={() => del(x.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>); })}
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "year" && (
          <section>
            <div className="rounded-2xl bg-secondary p-4"><p className="text-sm text-secondary-foreground">Total spent in {year}</p><p className="text-2xl font-extrabold text-primary">{money(yearTotal)}</p></div>
            <div className="mt-5 flex h-48 items-end gap-1.5">
              {byMonth.map((m, i) => (
                <button key={m.label} onClick={() => { setMonth(new Date(year, i, 1)); setTab("month"); }} className="flex flex-1 flex-col items-center gap-1">
                  <div className={`w-full rounded-t-md ${i === month.getMonth() ? "bg-primary" : "bg-primary/40"}`} style={{ height: `${(m.total / maxMonth) * 160 + 4}px` }} />
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 divide-y divide-border rounded-2xl bg-card ring-1 ring-border">
              {byMonth.map((m) => <div key={m.label} className="flex justify-between p-3 text-sm"><span>{m.label}</span><span className="font-semibold">{money(m.total)}</span></div>)}
            </div>
          </section>
        )}
      </main>

      <button aria-label="Add expense" onClick={openAdd} className="fixed bottom-20 right-[max(1.25rem,calc(50vw-12.75rem))] z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Plus className="h-7 w-7" />
      </button>
      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-md -translate-x-1/2 border-t border-border bg-card">
        {([["month", "Monthly", BarChart3], ["daily", "Daily", List], ["year", "Yearly", CalendarDays], ["profile", "Profile", UserRound]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${tab === k ? "text-primary" : "text-muted-foreground"}`}>
            <span className={`rounded-full px-4 py-1 ${tab === k ? "bg-secondary" : ""}`}><I className="h-5 w-5" /></span>{l}
          </button>
        ))}
      </nav>

      <AddExpense open={addOpen} onOpenChange={setAddOpen} onSaved={load} cats={cats} edit={editExp} />
      <BudgetDrawer open={budgetOpen} onOpenChange={setBudgetOpen} month={key} current={budget} onSaved={load} />
      <CategoryDrawer open={catOpen} onOpenChange={setCatOpen} edit={editCat} onSaved={load} />
    </div>
  );
}

const expenseSchema = z.object({
  amount: z.number({ message: "Enter an amount" }).finite("Enter a valid amount").positive("Amount must be more than 0").max(100000000, "Amount is too large"),
  category: z.string().min(1, "Pick a category"),
  note: z.string().trim().max(200, "Note must be under 200 characters"),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

function AddExpense({ open, onOpenChange, onSaved, cats, edit }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; cats: Cat[]; edit: Expense | null }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("groceries");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setAmount(edit ? String(edit.amount) : "");
    setCategory(edit?.category ?? "groceries");
    setNote(edit?.note ?? "");
    setDate(edit?.spent_on ?? today());
  }, [open, edit]);
  const save = async () => {
    const p = expenseSchema.safeParse({ amount: amount.trim() === "" ? NaN : Number(amount), category, note, spent_on: date });
    if (!p.success) { toast.error(p.error.issues[0]?.message); return; }
    setBusy(true);
    const row = { ...p.data, note: p.data.note || null };
    const { error } = edit
      ? await supabase.from("expenses").update(row).eq("id", edit.id)
      : await supabase.from("expenses").insert(row);
    setBusy(false);
    if (error) { toast.error("Couldn't save. Check your internet and try again."); return; }
    toast.success(edit ? "Expense updated" : "Expense added");
    onOpenChange(false); onSaved();
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader><DrawerTitle>{edit ? "Edit expense" : "Add expense"}</DrawerTitle></DrawerHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 pb-8">
          <Input inputMode="decimal" placeholder="₹ 0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-14 rounded-xl text-2xl font-bold" />
          <div className="grid grid-cols-3 gap-2">
            {cats.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold ${category === c.key ? "border-primary bg-secondary text-primary" : "border-border"}`}>
                <span className="text-2xl">{c.emoji}</span>{c.label}
              </button>
            ))}
          </div>
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
          <Input placeholder="Note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className="h-12 rounded-xl" />
          <Button disabled={busy} onClick={save} className="h-12 w-full rounded-xl text-base font-bold">{busy ? "Saving…" : edit ? "Save changes" : "Save"}</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function BudgetDrawer({ open, onOpenChange, month, current, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; month: string; current: number; onSaved: () => void }) {
  const [val, setVal] = useState("");
  useEffect(() => { if (open) setVal(current ? String(current) : ""); }, [open, current]);
  const save = async () => {
    const n = Number(val);
    if (!(n >= 0) || n > 100000000) { toast.error("Enter a valid amount"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("budgets").upsert({ month, amount: n, user_id: u.user!.id }, { onConflict: "user_id,month" });
    if (error) { toast.error(error.message); return; }
    toast.success("Budget saved"); onOpenChange(false); onSaved();
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader><DrawerTitle>How much do you have this month?</DrawerTitle></DrawerHeader>
        <div className="space-y-4 px-5 pb-8">
          <Input inputMode="decimal" placeholder="₹ 0" value={val} onChange={(e) => setVal(e.target.value)} className="h-14 rounded-xl text-2xl font-bold" />
          <Button onClick={save} className="h-12 w-full rounded-xl text-base font-bold">Save budget</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function CategoryDrawer({ open, onOpenChange, edit, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; edit: Cat | null; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("💸");
  useEffect(() => { if (open) { setLabel(edit?.label ?? ""); setEmoji(edit?.emoji ?? "💸"); } }, [open, edit]);
  const save = async () => {
    const l = label.trim();
    if (!l || l.length > 30) { toast.error("Enter a category name"); return; }
    if (edit) {
      const { error } = await supabase.from("categories").update({ label: l, emoji }).eq("id", edit.key);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("categories").insert({ label: l, emoji });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(edit ? "Category updated" : "Category added");
    onOpenChange(false); onSaved();
  };
  const remove = async () => {
    if (!edit) return;
    const { error } = await supabase.from("categories").delete().eq("id", edit.key);
    if (error) { toast.error(error.message); return; }
    toast.success("Category deleted"); onOpenChange(false); onSaved();
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader><DrawerTitle>{edit ? "Edit category" : "New category"}</DrawerTitle></DrawerHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 pb-8">
          <Input placeholder="Category name" value={label} onChange={(e) => setLabel(e.target.value)} className="h-12 rounded-xl" />
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_CHOICES.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={`rounded-xl border p-2 text-2xl ${emoji === e ? "border-primary bg-secondary" : "border-border"}`}>{e}</button>
            ))}
          </div>
          <Button onClick={save} className="h-12 w-full rounded-xl text-base font-bold">{edit ? "Save changes" : "Add category"}</Button>
          {edit && <Button variant="outline" onClick={remove} className="h-12 w-full rounded-xl text-base font-bold text-destructive">Delete category</Button>}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
