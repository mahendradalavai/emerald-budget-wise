import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { toast } from "sonner";
import {
  Home, ShoppingCart, Soup, Bus, GlassWater, MoreHorizontal, Plus, LogOut, Wallet,
  ChevronLeft, ChevronRight, Trash2, CalendarDays, BarChart3, List,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kharcha – Daily, Monthly & Yearly Expense Tracker" },
      { name: "description", content: "Track your monthly budget and daily spending on rent, groceries, curries, travel, drinks and more." },
      { property: "og:title", content: "Kharcha – Expense Tracker" },
      { property: "og:description", content: "Simple green mobile expense tracker for daily, monthly and yearly spending." },
    ],
  }),
  component: Index,
});

const CATEGORIES = [
  { key: "rent", label: "Room Rent", icon: Home },
  { key: "groceries", label: "Groceries", icon: ShoppingCart },
  { key: "curries", label: "Curries", icon: Soup },
  { key: "travel", label: "Travel", icon: Bus },
  { key: "drinks", label: "Drinks", icon: GlassWater },
  { key: "other", label: "Other", icon: MoreHorizontal },
] as const;
const catOf = (k: string) => CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[5];
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
          : session ? <Tracker email={session.user.email ?? ""} /> : <Auth />}
      </div>
    </div>
  );
}

const authSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = authSchema.safeParse({ email, password });
    if (!p.success) return toast.error(p.error.issues[0].message);
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
      <form onSubmit={submit} className="-mt-8 mx-5 space-y-4 rounded-3xl bg-card p-6 shadow-lg">
        <h2 className="text-xl font-bold">{mode === "in" ? "Welcome back" : "Create account"}</h2>
        <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" placeholder="you@email.com" /></div>
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" placeholder="••••••" /></div>
        <Button disabled={busy} className="h-12 w-full rounded-xl text-base font-bold">{mode === "in" ? "Sign in" : "Sign up"}</Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-sm font-semibold text-primary">
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

function Tracker({ email }: { email: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [tab, setTab] = useState<"month" | "daily" | "year">("month");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [yearExp, setYearExp] = useState<Expense[]>([]);
  const [budget, setBudget] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const key = ym(month);
  const year = month.getFullYear();

  const load = async () => {
    const start = `${key}-01`;
    const end = ym(new Date(month.getFullYear(), month.getMonth() + 1, 1)) + "-01";
    const [e, b, y] = await Promise.all([
      supabase.from("expenses").select("*").gte("spent_on", start).lt("spent_on", end).order("spent_on", { ascending: false }),
      supabase.from("budgets").select("amount").eq("month", key).maybeSingle(),
      supabase.from("expenses").select("*").gte("spent_on", `${year}-01-01`).lt("spent_on", `${year + 1}-01-01`),
    ]);
    setExpenses((e.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
    setBudget(Number(b.data?.amount ?? 0));
    setYearExp((y.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
  };
  useEffect(() => { load(); }, [key]);

  const spent = expenses.reduce((s, x) => s + x.amount, 0);
  const left = budget - spent;
  const byCat = useMemo(() => CATEGORIES.map((c) => ({ ...c, total: expenses.filter((x) => x.category === c.key).reduce((s, x) => s + x.amount, 0) })), [expenses]);
  const byDay = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach((x) => m.set(x.spent_on, [...(m.get(x.spent_on) ?? []), x]));
    return [...m.entries()];
  }, [expenses]);
  const byMonth = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const k = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { label: new Date(year, i).toLocaleString("en", { month: "short" }), total: yearExp.filter((x) => x.spent_on.startsWith(k)).reduce((s, x) => s + x.amount, 0) };
  }), [yearExp, year]);
  const yearTotal = byMonth.reduce((s, m) => s + m.total, 0);
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  const del = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

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
        {tab === "month" && (
          <section className="space-y-3">
            <h3 className="font-bold">Spending by category</h3>
            {byCat.map((c) => (
              <div key={c.key} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary"><c.icon className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm font-semibold"><span>{c.label}</span><span>{money(c.total)}</span></div>
                  <Progress value={spent ? (c.total / spent) * 100 : 0} className="mt-2 h-1.5 bg-secondary" />
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "daily" && (
          <section className="space-y-4">
            {byDay.length === 0 && <p className="py-10 text-center text-muted-foreground">No expenses this month yet. Tap + to add one.</p>}
            {byDay.map(([day, items]) => (
              <div key={day}>
                <div className="mb-2 flex justify-between text-sm font-bold">
                  <span>{new Date(day + "T00:00").toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="text-primary">{money(items.reduce((s, x) => s + x.amount, 0))}</span>
                </div>
                <div className="divide-y divide-border rounded-2xl bg-card shadow-sm ring-1 ring-border">
                  {items.map((x) => { const c = catOf(x.category); return (
                    <div key={x.id} className="flex items-center gap-3 p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><c.icon className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0"><p className="font-semibold">{c.label}</p>{x.note && <p className="truncate text-xs text-muted-foreground">{x.note}</p>}</div>
                      <p className="font-bold">{money(x.amount)}</p>
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

      <button aria-label="Add expense" onClick={() => setAddOpen(true)} className="fixed bottom-20 right-[max(1.25rem,calc(50vw-12.75rem))] z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Plus className="h-7 w-7" />
      </button>
      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-md -translate-x-1/2 border-t border-border bg-card">
        {([["month", "Monthly", BarChart3], ["daily", "Daily", List], ["year", "Yearly", CalendarDays]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${tab === k ? "text-primary" : "text-muted-foreground"}`}>
            <span className={`rounded-full px-5 py-1 ${tab === k ? "bg-secondary" : ""}`}><I className="h-5 w-5" /></span>{l}
          </button>
        ))}
      </nav>

      <AddExpense open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      <BudgetDrawer open={budgetOpen} onOpenChange={setBudgetOpen} month={key} current={budget} onSaved={load} />
    </div>
  );
}

const expenseSchema = z.object({
  amount: z.number().positive("Enter an amount").max(100000000),
  category: z.string(),
  note: z.string().trim().max(200),
  spent_on: z.string().min(10, "Pick a date"),
});

function AddExpense({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("groceries");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const save = async () => {
    const p = expenseSchema.safeParse({ amount: Number(amount), category, note, spent_on: date });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const { error } = await supabase.from("expenses").insert({ ...p.data, note: p.data.note || null });
    if (error) return toast.error(error.message);
    toast.success("Expense added");
    setAmount(""); setNote(""); onOpenChange(false); onSaved();
  };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader><DrawerTitle>Add expense</DrawerTitle></DrawerHeader>
        <div className="space-y-4 px-5 pb-8">
          <Input inputMode="decimal" placeholder="₹ 0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 rounded-xl text-2xl font-bold" />
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold ${category === c.key ? "border-primary bg-secondary text-primary" : "border-border"}`}>
                <c.icon className="h-5 w-5" />{c.label}
              </button>
            ))}
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-12 rounded-xl" />
          <Button onClick={save} className="h-12 w-full rounded-xl text-base font-bold">Save</Button>
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
    if (!(n >= 0) || n > 100000000) return toast.error("Enter a valid amount");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("budgets").upsert({ month, amount: n, user_id: u.user!.id }, { onConflict: "user_id,month" });
    if (error) return toast.error(error.message);
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
