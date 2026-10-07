import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, LogOut, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LOCK_DAYS = 14;
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Username: 3–20 letters, numbers or _");
const nameSchema = z.string().trim().max(50, "Name must be under 50 characters");

type Profile = { username: string | null; full_name: string | null; avatar_url: string | null; username_changed_at: string | null };

export function ProfileTab({ userId, contact, onSignOut }: { userId: string; contact: string; onSignOut: () => void }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showAvatar = async (path: string | null) => {
    if (!path) { setAvatarSrc(null); return; }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
    setAvatarSrc(data?.signedUrl ?? null);
  };

  const load = async () => {
    setLoading(true);
    let { data, error } = await supabase.from("profiles").select("username,full_name,avatar_url,username_changed_at").eq("id", userId).maybeSingle();
    if (!error && !data) {
      const ins = await supabase.from("profiles").insert({ id: userId }).select("username,full_name,avatar_url,username_changed_at").single();
      data = ins.data; error = ins.error;
    }
    if (error) toast.error("Couldn't load your profile");
    setProfile(data);
    setUsername(data?.username ?? "");
    setFullName(data?.full_name ?? "");
    await showAvatar(data?.avatar_url ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  const unlockAt = profile?.username && profile.username_changed_at
    ? new Date(new Date(profile.username_changed_at).getTime() + LOCK_DAYS * 864e5) : null;
  const locked = !!unlockAt && unlockAt > new Date();
  const daysLeft = unlockAt ? Math.ceil((unlockAt.getTime() - Date.now()) / 864e5) : 0;

  const save = async () => {
    const n = nameSchema.safeParse(fullName);
    if (!n.success) { toast.error(n.error.issues[0]?.message); return; }
    const update: { full_name: string | null; username?: string } = { full_name: n.data || null };
    if (!locked && username.trim() && username.trim().toLowerCase() !== profile?.username) {
      const u = usernameSchema.safeParse(username);
      if (!u.success) { toast.error(u.error.issues[0]?.message); return; }
      if (profile?.username && !window.confirm(`After changing, you can't change your username again for ${LOCK_DAYS} days. Continue?`)) return;
      update.username = u.data;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("That username is already taken");
      else if (error.message.includes("USERNAME_LOCKED")) toast.error(`You can change your username once every ${LOCK_DAYS} days`);
      else toast.error("Couldn't save. Try again.");
      return;
    }
    toast.success("Profile saved");
    load();
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (up.error) { setUploading(false); toast.error("Upload failed. Try again."); return; }
    const old = profile?.avatar_url;
    const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
    setUploading(false);
    if (error) { toast.error("Couldn't save photo"); return; }
    if (old) supabase.storage.from("avatars").remove([old]);
    toast.success("Photo updated");
    load();
  };

  if (loading) return <div className="space-y-3"><div className="mx-auto h-28 w-28 animate-pulse rounded-full bg-secondary" /><div className="h-12 animate-pulse rounded-xl bg-secondary" /><div className="h-12 animate-pulse rounded-xl bg-secondary" /></div>;

  const initial = (profile?.full_name || profile?.username || contact || "?").charAt(0).toUpperCase();

  return (
    <section className="space-y-5">
      <div className="flex flex-col items-center">
        <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change profile photo" className="relative">
          {avatarSrc
            ? <img src={avatarSrc} alt="Profile photo" className="h-28 w-28 rounded-full object-cover ring-4 ring-secondary" />
            : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-4xl font-extrabold text-primary-foreground ring-4 ring-secondary">{initial}</div>}
          <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Camera className="h-4 w-4" /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <p className="mt-2 text-xs text-muted-foreground">{uploading ? "Uploading…" : "Tap to change photo"}</p>
        {profile?.username && <p className="mt-2 font-bold">@{profile.username}</p>}
        <p className="text-sm text-muted-foreground">{contact}</p>
      </div>

      <div className="space-y-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={fullName} maxLength={50} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="h-12 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">Username {locked && <Lock className="h-3 w-3" />}</Label>
          <Input value={username} maxLength={20} disabled={locked} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="choose_a_username" className="h-12 rounded-xl" />
          <p className="text-xs text-muted-foreground">
            {locked ? `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.` : `You can change your username once every ${LOCK_DAYS} days.`}
          </p>
        </div>
        <Button disabled={busy} onClick={save} className="h-12 w-full rounded-xl text-base font-bold">{busy ? "Saving…" : "Save profile"}</Button>
      </div>

      <Button variant="outline" onClick={onSignOut} className="h-12 w-full rounded-xl text-base font-bold text-destructive"><LogOut className="h-4 w-4" /> Log out</Button>
    </section>
  );
}
