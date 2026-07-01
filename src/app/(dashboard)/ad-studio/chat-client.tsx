"use client";

import { useEffect, useRef, useState } from "react";
import { waitForJob } from "@/lib/ai-ads/wait-job";
import { SkillPicker } from "./skill-picker";
import { PromptEnhancer } from "./prompt-enhancer";
import {
  Plus,
  Loader2,
  Sparkles,
  X,
  Trash2,
  MessageSquare,
  Package,
  Boxes,
  Stamp,
  Clapperboard,
  Film,
  Wand2,
  Heart,
  Download,
  PenLine,
  Copy,
  LayoutTemplate,
  Aperture,
  Lock,
  SlidersHorizontal,
  Image as ImageIcon,
  PanelLeft,
  Camera,
} from "lucide-react";

import { Lightbox, ActionIcon, type ViewerItem } from "./ad-result";
import { MentionTextarea } from "./mention-textarea";
import { GeneratingPanel } from "./generating";
import { TEMPLATE_GROUPS } from "./templates";
import { chatCredits, planLimits } from "@/lib/ai-ads/cost";
import { useAuth } from "@/hooks/use-auth";

export type ChatSummary = { id: string; title: string | null; updated_at: string };
export type SoulRef = { id: string; handle: string; name: string; kind: string; url: string };

type Asset = { id: string; url: string; label: string; favorite: boolean; type?: "image" | "video" };
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text?: string | null;
  attachments?: string[];
  assets?: Asset[];
  suggestions?: string[];
  error?: boolean;
};

const SUGGESTIONS = [
  "A bold summer-sale poster with the text “50% OFF” in gold on deep navy",
  "A minimalist logo for a coffee brand called “Aurora”",
  "A cozy lifestyle scene for a scented candle, warm tones",
  "A vibrant Instagram story background for a flash sale",
];

// Director controls — professional art-direction the user can dial in.
const FORMATS_CHAT = [
  { v: "auto", label: "Auto size" },
  { v: "1:1", label: "Square · 1:1" },
  { v: "4:5", label: "Portrait · 4:5" },
  { v: "9:16", label: "Story · 9:16" },
  { v: "16:9", label: "Wide · 16:9" },
  { v: "4:3", label: "Landscape · 4:3" },
  { v: "3:4", label: "Portrait tall · 3:4" },
  { v: "3:2", label: "Photo · 3:2" },
  { v: "2:3", label: "Photo tall · 2:3" },
  { v: "21:9", label: "Cinematic · 21:9" },
];
const LENSES = [
  { v: "", label: "Lens · Auto" },
  { v: "shot on a 24mm wide-angle lens with expansive context", label: "24mm wide" },
  { v: "shot on a 35mm lens, natural environmental look", label: "35mm" },
  { v: "shot on a 50mm lens, natural balanced perspective", label: "50mm" },
  { v: "shot on an 85mm f/1.4 lens, shallow depth of field and creamy bokeh", label: "85mm portrait" },
  { v: "shot on a 100mm macro lens, extreme close-up detail", label: "100mm macro" },
  { v: "shot with a tilt-shift lens, selective focus", label: "Tilt-shift" },
];
const ANGLES = [
  { v: "", label: "Angle · Auto" },
  { v: "eye-level three-quarter angle", label: "Eye-level" },
  { v: "dramatic low hero angle looking up", label: "Low / hero" },
  { v: "high angle looking down", label: "High" },
  { v: "overhead top-down flat-lay", label: "Overhead flat-lay" },
  { v: "dynamic dutch-tilt angle", label: "Dutch tilt" },
  { v: "extreme macro close-up", label: "Macro close-up" },
];
const LIGHTS = [
  { v: "", label: "Light · Auto" },
  { v: "soft diffused natural daylight", label: "Soft daylight" },
  { v: "clean studio softbox lighting", label: "Studio softbox" },
  { v: "dramatic Rembrandt lighting with deep shadows", label: "Rembrandt" },
  { v: "butterfly beauty lighting", label: "Butterfly / beauty" },
  { v: "rim backlighting for glowing separation", label: "Rim / backlit" },
  { v: "warm golden-hour light", label: "Golden hour" },
  { v: "bright airy high-key lighting", label: "High-key" },
  { v: "moody low-key chiaroscuro lighting", label: "Low-key" },
  { v: "vibrant neon coloured-gel lighting", label: "Neon" },
];
const LOOKS = [
  { v: "", label: "Look · Auto" },
  { v: "high-fashion editorial magazine look", label: "Editorial" },
  { v: "cinematic teal-and-orange colour grade", label: "Cinematic" },
  { v: "vintage 35mm film look with subtle grain", label: "Vintage film" },
  { v: "minimal Scandinavian aesthetic", label: "Minimal" },
  { v: "opulent luxury aesthetic", label: "Luxury" },
  { v: "bold vibrant colour-pop", label: "Vibrant" },
];
// Image models offered in the composer. "auto" lets the route pick (GPT Image 2 for
// Souls/Best, else 1.5). The prompt-only models ignore references/Souls.
const MODELS = [
  { v: "auto", label: "Model: Auto" },
  { v: "gpt-image-2", label: "GPT Image 2 · best" },
  { v: "gpt-image-1.5", label: "GPT Image 1.5" },
  { v: "nano-banana-pro", label: "Nano Banana Pro" },
  { v: "nano-banana", label: "Nano Banana" },
  { v: "imagen4-ultra", label: "Imagen 4 Ultra" },
  { v: "flux-pro", label: "Flux Pro 1.1" },
  { v: "recraft", label: "Recraft V3" },
  { v: "ideogram", label: "Ideogram V3" },
];

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function ChatClient({ initialChats }: { initialChats: ChatSummary[] }) {
  const [chats, setChats] = useState<ChatSummary[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChats[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type ProductRef = { id: string; name: string; imageUrl: string | null };
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductRef[]>([]);
  const [pinned, setPinned] = useState<{ id: string; url: string; label: string } | null>(null);

  type Copy = { hook: string; headline: string; caption: string; cta: string; hashtags: string[] };
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyVariants, setCopyVariants] = useState<Copy[]>([]);
  const [copyLoading, setCopyLoading] = useState(false);
  const [variations, setVariations] = useState(1);
  const [quality, setQuality] = useState<"standard" | "hd" | "best">("standard");
  const { account } = useAuth();
  const planFree = planLimits(account?.plan).maxImageQuality === "standard";
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [lockedLook, setLockedLook] = useState<{ id: string; url: string } | null>(null);

  const [showDirector, setShowDirector] = useState(false);
  const [format, setFormat] = useState("auto");
  const [lens, setLens] = useState("");
  const [angle, setAngle] = useState("");
  const [lighting, setLighting] = useState("");
  const [look, setLook] = useState("");
  const [realism, setRealism] = useState(true);
  const [mood, setMood] = useState("auto");
  const [model, setModel] = useState("auto");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState<string | null>(null);
  useEffect(() => setEnhanced(null), [input]); // editing the prompt clears a stale enhanced version

  const [viewer, setViewer] = useState<ViewerItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [upscalingId, setUpscalingId] = useState<string | null>(null);
  const [souls, setSouls] = useState<SoulRef[]>([]);
  const [selectedSouls, setSelectedSouls] = useState<SoulRef[]>([]);
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [savingSoul, setSavingSoul] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const styleInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeChatId) void openChat(activeChatId);
    fetch("/api/ai-ads/products")
      .then((r) => r.json())
      .then((j: { products?: ProductRef[] }) => setProducts(j.products ?? []))
      .catch(() => {});
    fetch("/api/ai-ads/soul")
      .then((r) => r.json())
      .then((j: { items?: SoulRef[] }) => setSouls(j.items ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function loadChats() {
    try {
      const j = (await (await fetch("/api/ai-ads/chat")).json()) as { chats: ChatSummary[] };
      setChats(j.chats ?? []);
    } catch {
      /* ignore */
    }
  }

  async function openChat(id: string) {
    setActiveChatId(id);
    setError(null);
    try {
      const j = (await (await fetch(`/api/ai-ads/chat/${id}`)).json()) as { messages: ChatMsg[] };
      setMessages(j.messages ?? []);
    } catch (e) {
      setError(msg(e));
    }
  }

  function newChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput("");
    setFiles([]);
    setError(null);
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) setFiles((f) => [...f, ...picked].slice(0, 4));
    e.target.value = "";
  }

  async function send(opts?: { text?: string; refAssetIds?: string[] }) {
    const override = opts?.text !== undefined;
    const text = (opts?.text ?? input).trim();
    const refIds = opts?.refAssetIds ?? (pinned ? [pinned.id] : []);
    if (
      (!text &&
        files.length === 0 &&
        selectedProducts.length === 0 &&
        refIds.length === 0 &&
        selectedSouls.length === 0) ||
      loading
    )
      return;
    const localFiles = override ? [] : files;
    const localProducts = override ? [] : selectedProducts;
    const localStyle = override ? null : styleFile;
    const localLogo = override ? null : logoFile;
    const localSouls = override ? [] : selectedSouls;
    const pinnedUrl = !opts?.refAssetIds && pinned ? pinned.url : null;
    if (!override) {
      setInput("");
      setFiles([]);
      setSelectedProducts([]);
      setPinned(null);
      setStyleFile(null);
      setLogoFile(null);
      setSelectedSouls([]);
      setAtQuery(null);
    }
    setError(null);
    setMessages((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        text,
        attachments: [
          ...localFiles.map((f) => URL.createObjectURL(f)),
          ...localProducts.map((p) => p.imageUrl).filter((u): u is string => !!u),
          ...(pinnedUrl ? [pinnedUrl] : []),
          ...(localStyle ? [URL.createObjectURL(localStyle)] : []),
          ...(localLogo ? [URL.createObjectURL(localLogo)] : []),
          ...localSouls.map((s) => s.url),
        ],
      },
    ]);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("text", text);
      if (activeChatId) fd.set("chatId", activeChatId);
      localFiles.forEach((f) => fd.append("products", f));
      if (localProducts.length)
        fd.set("productIds", JSON.stringify(localProducts.map((p) => p.id)));
      if (refIds.length) fd.set("refAssetId", refIds[0]);
      if (!override && variations > 1) fd.set("variations", String(variations));
      if (!override && quality !== "standard") fd.set("quality", quality);
      fd.set("engine", "gpt");
      if (localStyle) fd.set("references", localStyle);
      if (localLogo) fd.set("logo", localLogo);
      if (lockedLook) fd.set("styleAssetId", lockedLook.id);
      if (localSouls.length) fd.set("soulIds", JSON.stringify(localSouls.map((s) => s.id)));
      if (!override && format !== "auto") fd.set("format", format);
      if (!override && model !== "auto") fd.set("model", model);
      if (!override) {
        fd.set("realism", String(realism));
        if (realism) fd.set("mood", mood);
        if (skillId) fd.set("skillId", skillId);
        if (enhanced) fd.set("enhancedPrompt", enhanced);
        const directives = [lens, angle, lighting, look].filter(Boolean).join("; ");
        if (directives) fd.set("directives", directives);
      }
      // The chat route does the reasoning then ENQUEUES the render — it returns a PENDING
      // assistant message + jobId. Clarify / words-only turns return a normal message and
      // no jobId. Parse defensively so an interrupted response never crashes the UI.
      const r = await fetch("/api/ai-ads/chat", { method: "POST", body: fd });
      const raw = await r.text();
      let j:
        | {
            chatId?: string;
            jobId?: string | null;
            message?: {
              id: string;
              text: string;
              assets?: Asset[];
              suggestions?: string[];
              error?: boolean;
              pending?: boolean;
            };
          }
        | null = null;
      try {
        j = JSON.parse(raw);
      } catch {
        j = null;
      }
      if (r.status === 402) {
        if (j?.chatId) await openChat(j.chatId);
        setError("You're out of credits — top up to generate.");
        return;
      }
      if (!r.ok || !j || !j.message) {
        const serverErr = j ? (j as { error?: string }).error : null;
        if (activeChatId) await openChat(activeChatId);
        else await loadChats();
        setError(
          serverErr ||
            "The render was interrupted — if it finished it'll appear above; otherwise tap Generate again.",
        );
        return;
      }
      const am = j.message;
      const cid = j.chatId ?? null;
      const jobId = j.jobId ?? null;
      if (cid) setActiveChatId(cid);
      setMessages((m) => [
        ...m,
        {
          id: am.id,
          role: "assistant",
          text: am.text,
          assets: am.assets ?? [],
          suggestions: am.suggestions ?? [],
          error: am.error,
        },
      ]);
      void loadChats();
      // Enqueued render → poll the job, then reload the chat (worker fills the message).
      if (jobId && am.pending) {
        // Realtime (with polling fallback) — resolves the moment the worker finishes.
        const res = await waitForJob(jobId);
        if (cid) await openChat(cid);
        if (res.status === "failed") setError(res.error || "Generation failed");
        else if (res.status === "timeout") setError("Timed out waiting for the render");
      }
    } catch (e) {
      setError(msg(e));
      setMessages((m) => [
        ...m,
        { id: `err-${Date.now()}`, role: "assistant", text: msg(e), error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onComposerInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
    setAtQuery(m ? m[2].toLowerCase() : null);
  }

  function pickSoul(s: SoulRef) {
    setInput((prev) => prev.replace(/(^|\s)@([a-zA-Z0-9_-]*)$/, `$1@${s.handle} `));
    setSelectedSouls((xs) => (xs.some((x) => x.id === s.id) ? xs : [...xs, s].slice(0, 4)));
    setAtQuery(null);
  }

  const soulMatches =
    atQuery === null
      ? []
      : souls
          .filter(
            (s) => s.handle.toLowerCase().includes(atQuery) || s.name.toLowerCase().includes(atQuery),
          )
          .slice(0, 50);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && atQuery !== null) {
      setAtQuery(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      if (atQuery !== null && soulMatches.length) {
        e.preventDefault();
        pickSoul(soulMatches[0]);
        return;
      }
      e.preventDefault();
      void send();
    }
  }

  async function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChats((c) => c.filter((x) => x.id !== id));
    if (activeChatId === id) newChat();
    try {
      await fetch(`/api/ai-ads/chat/${id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  // ---- lightbox actions (reuse asset routes) ----
  function patchAsset(id: string, patch: Partial<Asset>) {
    setMessages((m) =>
      m.map((msg) =>
        msg.assets ? { ...msg, assets: msg.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : msg,
      ),
    );
    setViewer((v) => (v && v.id === id ? { ...v, ...patch } : v));
  }

  async function toggleFavorite(item: ViewerItem) {
    const fav = !item.favorite;
    patchAsset(item.id, { favorite: fav });
    try {
      await fetch(`/api/ai-ads/assets/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: fav }),
      });
    } catch {
      /* keep optimistic */
    }
  }

  async function copyPrompt(item: ViewerItem) {
    try {
      await navigator.clipboard.writeText(item.label || "");
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function deleteAsset(item: ViewerItem) {
    setMessages((m) =>
      m.map((msg) =>
        msg.assets ? { ...msg, assets: msg.assets.filter((a) => a.id !== item.id) } : msg,
      ),
    );
    setViewer(null);
    try {
      await fetch(`/api/ai-ads/assets/${item.id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }

  async function upscale(item: ViewerItem) {
    setUpscalingId(item.id);
    try {
      const r = await fetch(`/api/ai-ads/assets/${item.id}/upscale`, { method: "POST" });
      if (!r.ok) throw new Error("Upscale failed");
      const j = (await r.json()) as { url: string };
      patchAsset(item.id, { url: j.url });
    } catch (e) {
      setError(msg(e));
    } finally {
      setUpscalingId(null);
    }
  }

  function editThis(a: Asset) {
    setPinned({ id: a.id, url: a.url, label: a.label });
    setViewer(null);
  }

  async function saveSoul(item: ViewerItem, name: string, kind: string) {
    setSavingSoul(true);
    try {
      const fd = new FormData();
      fd.set("source", "chat");
      fd.set("sourceUrl", item.url);
      fd.set("name", name);
      fd.set("kind", kind);
      const r = await fetch("/api/ai-ads/soul", { method: "POST", body: fd });
      const j = (await r.json()) as { soul?: SoulRef; error?: string };
      if (!r.ok || !j.soul) throw new Error(j.error ?? "Couldn't save");
      setSouls((xs) => [j.soul as SoulRef, ...xs]);
      setViewer(null);
    } catch (e) {
      setError(msg(e));
    } finally {
      setSavingSoul(false);
    }
  }

  async function saveSkill(item: ViewerItem) {
    setSavingSkill(true);
    try {
      const r = await fetch("/api/ai-ads/skills/from-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: item.id }),
      });
      const j = (await r.json()) as { skill?: unknown; error?: string };
      if (!r.ok || !j.skill) throw new Error(j.error ?? "Couldn't save skill");
      setViewer(null);
    } catch (e) {
      setError(msg(e));
    } finally {
      setSavingSkill(false);
    }
  }

  async function runVideoJob(
    a: Asset,
    opts: { endpoint: string; body: Record<string, unknown>; userText: string; loadingText: string },
  ) {
    if (loading) return;
    setViewer(null);
    setError(null);
    const loadingId = `vid-loading-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", text: opts.userText, attachments: [a.url] },
      { id: loadingId, role: "assistant", text: opts.loadingText, assets: [] },
    ]);
    setLoading(true);
    try {
      const r = await fetch(opts.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: a.id, chatId: activeChatId, ...opts.body }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Failed");
      const j = (await r.json()) as {
        chatId: string;
        message: { id: string; text: string; assets: Asset[]; suggestions?: string[] };
      };
      if (j.chatId) setActiveChatId(j.chatId);
      setMessages((m) => [
        ...m.filter((x) => x.id !== loadingId),
        {
          id: j.message.id,
          role: "assistant",
          text: j.message.text,
          assets: j.message.assets ?? [],
          suggestions: j.message.suggestions ?? [],
        },
      ]);
      void loadChats();
    } catch (e) {
      setMessages((m) => [
        ...m.filter((x) => x.id !== loadingId),
        { id: `err-${Date.now()}`, role: "assistant", text: msg(e), error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function makeVideo(a: Asset) {
    return runVideoJob(a, {
      endpoint: "/api/ai-ads/video",
      body: { duration: 10 },
      userText: "🎬 Make a cinematic video of this",
      loadingText: "Directing & rendering your cinematic clip with Kling… this takes a minute or two.",
    });
  }

  function makeCommercial(a: Asset) {
    return runVideoJob(a, {
      endpoint: "/api/ai-ads/commercial",
      body: { sceneShots: 3, shotDuration: 5 },
      userText: "🎞️ Make a multi-shot commercial from this",
      loadingText:
        "Storyboarding, generating keyframes, filming each shot and editing your commercial… this takes a few minutes.",
    });
  }

  function moreLikeThis(a: Asset) {
    void send({ text: a.label });
  }

  function lockLook(a: Asset) {
    setLockedLook({ id: a.id, url: a.url });
  }

async function writeCopy(a: Asset) {
    setCopyOpen(true);
    setCopyVariants([]);
    setCopyLoading(true);
    try {
      const r = await fetch("/api/ai-ads/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: a.label }),
      });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? "Copy failed");
      const j = (await r.json()) as { variants: Copy[] };
      setCopyVariants(j.variants ?? []);
    } catch (e) {
      setError(msg(e));
      setCopyOpen(false);
    } finally {
      setCopyLoading(false);
    }
  }

  function copyCopyToClipboard(c: Copy) {
    const text = [c.hook, c.headline, c.caption, c.cta, c.hashtags.map((h) => `#${h}`).join(" ")]
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const empty = messages.length === 0 && !loading;
  const willEdit =
    files.length > 0 ||
    selectedProducts.length > 0 ||
    !!pinned ||
    !!styleFile ||
    !!logoFile ||
    !!lockedLook;
  const estCredits = chatCredits({
    variations,
    quality,
    isEdit: willEdit,
    engine: "gpt",
    model: model === "auto" ? undefined : model,
  });

  // Flatten the conversation into a generation feed (gallery, not a chat): each
  // assistant result becomes a group captioned by the prompt that made it.
  const generations: { id: string; prompt: string; assets: Asset[]; error?: boolean; text?: string }[] =
    [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const prompt = [...messages.slice(0, i)].reverse().find((x) => x.role === "user")?.text || "";
    if (m.assets && m.assets.length) generations.push({ id: m.id, prompt, assets: m.assets });
    else if (m.error) generations.push({ id: m.id, prompt, assets: [], error: true, text: m.text || "" });
  }
  const pendingPrompt = loading
    ? [...messages].reverse().find((x) => x.role === "user")?.text || ""
    : "";
  const soulHandles = new Set(souls.map((s) => s.handle.toLowerCase()));

  return (
    <div className="mx-auto flex max-w-6xl gap-4">
      {/* Chat history drawer — hidden by default for a clean canvas */}
      {sidebarOpen ? (
      <aside className="w-60 shrink-0 self-start rounded-2xl border border-white/10 bg-card/40 p-2 backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between px-1.5 py-1">
          <span className="text-[12px] font-medium text-muted-foreground">History</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close history"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-220px)] space-y-0.5 overflow-y-auto">
          {chats.map((c) => (
            <div
              key={c.id}
              onClick={() => openChat(c.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                activeChatId === c.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <MessageSquare className="size-3.5 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{c.title || "New chat"}</span>
              <button
                type="button"
                onClick={(e) => deleteChat(c.id, e)}
                aria-label="Delete chat"
                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      ) : null}

      {/* Thread */}
      <div className="flex min-h-[calc(100vh-200px)] flex-1 flex-col">
        {/* Canvas toolbar — history toggle + new chat (sidebar stays hidden) */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title="Chat history"
            className={`flex size-9 items-center justify-center rounded-lg border transition-colors ${
              sidebarOpen
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
          >
            <PanelLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={newChat}
            title="Start a new creation"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[13px] text-foreground/80 transition-colors hover:text-foreground"
          >
            <Plus className="size-4" /> New
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="size-6 text-primary" strokeWidth={2} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Create anything</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Describe an image and generate it. Add a product, logo or reference with{" "}
                <span className="text-foreground/80">＋</span> to compose them in — then refine by
                chatting.
              </p>
              <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
              >
                <LayoutTemplate className="size-4" /> Browse templates
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {generations.map((g) => (
                <div key={g.id} className="space-y-2">
                  {g.prompt ? (
                    <p className="line-clamp-1 px-0.5 text-[13px] text-muted-foreground" title={g.prompt}>
                      {g.prompt}
                    </p>
                  ) : null}
                  {g.error ? (
                    <p className="text-[13px] text-destructive">{g.text || "Something went wrong"}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {g.assets.map((a) => (
                        <GalleryTile
                          key={a.id}
                          a={a}
                          onOpen={setViewer}
                          onFavorite={toggleFavorite}
                          onEditThis={editThis}
                          onMoreLikeThis={moreLikeThis}
                          onWriteCopy={writeCopy}
                          onLock={lockLook}
                          onMakeVideo={makeVideo}
                          onMakeCommercial={makeCommercial}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading ? (
                <GeneratingPanel count={Math.min(variations, 8)} prompt={pendingPrompt} />
              ) : null}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="relative mx-auto mb-4 w-full max-w-3xl rounded-2xl border border-white/10 bg-card/70 p-3 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {showDirector ? (
            <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/60 p-2.5 sm:grid-cols-4">
              <DirectorSelect label="Lens" value={lens} onChange={setLens} options={LENSES} />
              <DirectorSelect label="Angle" value={angle} onChange={setAngle} options={ANGLES} />
              <DirectorSelect label="Light" value={lighting} onChange={setLighting} options={LIGHTS} />
              <DirectorSelect label="Look" value={look} onChange={setLook} options={LOOKS} />
            </div>
          ) : null}
          {pinned ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pinned.url} alt="" className="size-9 rounded object-cover" />
              <span className="flex-1 truncate text-[12px] text-foreground">
                Refining this image — describe your change
              </span>
              <button
                type="button"
                onClick={() => setPinned(null)}
                aria-label="Cancel edit"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          {lockedLook ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lockedLook.url} alt="" className="size-9 rounded object-cover" />
              <span className="flex-1 truncate text-[12px] text-foreground">
                <Lock className="mr-1 inline size-3" />
                Locked to this look — new images keep this style
              </span>
              <button
                type="button"
                onClick={() => setLockedLook(null)}
                aria-label="Unlock"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          {files.length > 0 ||
          selectedProducts.length > 0 ||
          selectedSouls.length > 0 ||
          styleFile ||
          logoFile ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={`p${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(f)}
                    alt="product"
                    className="size-14 rounded-lg border border-primary/50 object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-background/85 px-1 py-px text-center text-[9px] text-foreground">
                    Product
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {logoFile ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(logoFile)}
                    alt="logo"
                    className="size-14 rounded-lg border border-amber-500/50 bg-muted object-contain"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-background/85 px-1 py-px text-center text-[9px] text-foreground">
                    Logo
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove logo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : null}
              {styleFile ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(styleFile)}
                    alt="reference"
                    className="size-14 rounded-lg border border-sky-500/50 object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-background/85 px-1 py-px text-center text-[9px] text-foreground">
                    Reference
                  </span>
                  <button
                    type="button"
                    onClick={() => setStyleFile(null)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove reference"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : null}
              {selectedProducts.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="size-14 rounded-lg border border-primary/50 object-cover"
                    />
                  ) : (
                    <div className="size-14 rounded-lg border border-primary/50 bg-muted" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-background/85 px-1 py-px text-center text-[9px] text-foreground">
                    {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProducts((s) => s.filter((x) => x.id !== p.id))}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {selectedSouls.map((s) => (
                <div key={s.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt={s.name}
                    className="size-14 rounded-lg border border-primary/50 object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-background/85 px-1 py-px text-center font-mono text-[9px] text-primary">
                    @{s.handle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSouls((xs) => xs.filter((x) => x.id !== s.id))}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Remove"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {showProducts ? (
            <div className="absolute bottom-[8rem] left-3 z-10 max-h-64 w-64 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg">
              {products.length === 0 ? (
                <div className="px-2 py-3 text-[12px] text-muted-foreground">
                  No products yet — add them in Quick ads.
                </div>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProducts((s) =>
                        s.some((x) => x.id === p.id) ? s : [...s, p].slice(0, 4),
                      );
                      setShowProducts(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="size-7 rounded object-cover" />
                    ) : (
                      <div className="size-7 rounded bg-muted" />
                    )}
                    <span className="truncate">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          {error ? <p className="mb-2 px-1 text-[12px] text-destructive">{error}</p> : null}

          <div className="relative rounded-2xl border border-white/10 bg-background/40 p-2">
            {atQuery !== null && soulMatches.length > 0 ? (
              <div className="absolute bottom-full left-3 z-20 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  Soul IDs{atQuery ? ` matching “${atQuery}”` : ""}
                </div>
                {soulMatches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickSoul(s)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="" className="size-8 rounded-md object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-foreground">{s.name}</span>
                      <span className="block truncate font-mono text-[11px] text-primary">@{s.handle}</span>
                    </span>
                    <span className="text-[10px] capitalize text-muted-foreground">{s.kind}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onPickFiles}
            />
            <input
              ref={styleInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setStyleFile(f);
                e.target.value = "";
              }}
            />
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setLogoFile(f);
                e.target.value = "";
              }}
            />

            {/* Top row: attach · prompt · generate */}
            <div className="flex items-end gap-2">
              <div className="relative shrink-0">
                {showAttach ? (
                  <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                    {[
                      { icon: Package, label: "Product image", onClick: () => fileInput.current?.click() },
                      { icon: Boxes, label: "Saved product", onClick: () => setShowProducts(true) },
                      { icon: Stamp, label: "Brand logo", onClick: () => logoInput.current?.click() },
                      { icon: Aperture, label: "Reference image", onClick: () => styleInput.current?.click() },
                      { icon: LayoutTemplate, label: "Browse templates", onClick: () => setShowTemplates(true) },
                    ].map(({ icon: Icon, label, onClick }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          onClick();
                          setShowAttach(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-foreground/90 hover:bg-muted"
                      >
                        <Icon className="size-4 text-muted-foreground" />
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowAttach((v) => !v)}
                  title="Add product, logo or reference"
                  className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
                    files.length || selectedProducts.length || logoFile || styleFile
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <MentionTextarea
                value={input}
                onChange={onComposerInput}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Describe what you want to create… use @ to add a Soul ID"
                handles={soulHandles}
                boxClassName="flex-1"
                fieldClassName="px-1 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={
                  loading ||
                  (!input.trim() &&
                    files.length === 0 &&
                    selectedProducts.length === 0 &&
                    !pinned &&
                    !styleFile &&
                    !logoFile &&
                    !lockedLook)
                }
                className="ad-cta flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Generate"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate
                    <span className="ml-0.5 rounded-md bg-black/20 px-1.5 py-0.5 text-[11px] font-normal">
                      {estCredits}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom row: mode toggle · pill controls */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
                <span className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[12px] font-medium text-foreground">
                  <ImageIcon className="size-3.5" />
                  Image
                </span>
                <a
                  href="/ad-studio/video"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Film className="size-3.5" />
                  Video
                </a>
              </div>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                title="Size / aspect ratio"
                className={`cursor-pointer appearance-none rounded-lg border bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] outline-none transition-colors hover:border-white/25 ${
                  format !== "auto" ? "border-primary/40 text-primary" : "border-white/10 text-foreground/80"
                }`}
              >
                {FORMATS_CHAT.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as "standard" | "hd" | "best")}
                title="Quality — Standard · HD · Best (higher is sharper and costs more)"
                className={`cursor-pointer appearance-none rounded-lg border bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] outline-none transition-colors hover:border-white/25 ${
                  quality !== "standard" ? "border-primary/40 text-primary" : "border-white/10 text-foreground/80"
                }`}
              >
                <option value="standard">Standard</option>
                <option value="hd" disabled={planFree}>HD{planFree ? " · Pro" : ""}</option>
                <option value="best" disabled={planFree}>Best{planFree ? " · Pro" : ""}</option>
              </select>
              <select
                value={variations}
                onChange={(e) => setVariations(Number(e.target.value))}
                title="How many variations to generate"
                className={`cursor-pointer appearance-none rounded-lg border bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] outline-none transition-colors hover:border-white/25 ${
                  variations > 1 ? "border-primary/40 text-primary" : "border-white/10 text-foreground/80"
                }`}
              >
                <option value={1}>1 image</option>
                <option value={4} disabled={planFree}>4 images{planFree ? " · Pro" : ""}</option>
                <option value={8} disabled={planFree}>8 images{planFree ? " · Pro" : ""}</option>
                <option value={12}>12 images</option>
              </select>
              <button
                type="button"
                onClick={() => setShowDirector((v) => !v)}
                title="Director — lens, angle, lighting, look"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors hover:border-white/25 ${
                  showDirector || lens || angle || lighting || look
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-foreground/80 hover:text-foreground"
                }`}
              >
                <SlidersHorizontal className="size-3.5" />
                Director
              </button>
              <button
                type="button"
                onClick={() => setRealism((v) => !v)}
                title={
                  realism
                    ? "Realistic photo — real skin, film grade, lighting & lens"
                    : "Off — raw prompt (best for logos, graphics, illustration)"
                }
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors hover:border-white/25 ${
                  realism
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/5 text-foreground/80 hover:text-foreground"
                }`}
              >
                <Camera className="size-3.5" />
                Realistic
              </button>
              {realism ? (
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  title="Mood / look — Auto lets the director choose by scene"
                  className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] text-foreground/80 outline-none transition-colors hover:border-white/25"
                >
                  <option value="auto">Mood: Auto</option>
                  <option value="romantic">Romantic</option>
                  <option value="editorial">Editorial</option>
                  <option value="cinematic">Cinematic</option>
                  <option value="documentary">Documentary</option>
                  <option value="golden hour">Golden hour</option>
                  <option value="noir">Noir</option>
                  <option value="studio">Studio</option>
                  <option value="moody">Moody</option>
                </select>
              ) : null}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                title="Model — Auto picks GPT Image 2 for Souls/Best, else 1.5. Prompt-only models ignore references."
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-2.5 pr-2 text-[12px] text-foreground/80 outline-none transition-colors hover:border-white/25"
              >
                {MODELS.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.label}
                  </option>
                ))}
              </select>
              <SkillPicker value={skillId} onChange={setSkillId} kind="image" />
              <PromptEnhancer
                getParams={() => ({
                  kind: "image",
                  prompt: input,
                  mood: realism ? mood : "auto",
                  aspect: format !== "auto" ? format : "1:1",
                  soulIds: selectedSouls.map((s) => s.id),
                  skillId,
                })}
                onUse={({ prompt }) => setEnhanced(prompt)}
              />
              {enhanced ? (
                <span className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1.5 text-[12px] text-primary">
                  ✨ edited prompt
                  <button
                    type="button"
                    onClick={() => setEnhanced(null)}
                    title="Clear edited prompt"
                    className="ml-0.5 hover:text-foreground"
                  >
                    ✕
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Lightbox
        item={viewer}
        onClose={() => setViewer(null)}
        onFavorite={toggleFavorite}
        onCopy={copyPrompt}
        onDelete={deleteAsset}
        onUpscale={upscale}
        onSaveSoul={saveSoul}
        onSaveSkill={saveSkill}
        savingSoul={savingSoul}
        savingSkill={savingSkill}
        upscaling={!!viewer && upscalingId === viewer.id}
        copied={!!viewer && copiedId === viewer.id}
      />

      {copyOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setCopyOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Ad copy</h3>
              <button
                type="button"
                onClick={() => setCopyOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            {copyLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Writing copy…
              </div>
            ) : (
              <div className="space-y-3">
                {copyVariants.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="eyebrow">Hook</div>
                        <p className="text-foreground">{c.hook}</p>
                      </div>
                      <div>
                        <div className="eyebrow">Headline</div>
                        <p className="font-medium text-foreground">{c.headline}</p>
                      </div>
                      <div>
                        <div className="eyebrow">Caption</div>
                        <p className="text-muted-foreground">{c.caption}</p>
                      </div>
                      <div>
                        <div className="eyebrow">CTA</div>
                        <p className="text-foreground">{c.cta}</p>
                      </div>
                      {c.hashtags.length ? (
                        <p className="text-[13px] text-primary">
                          {c.hashtags.map((h) => `#${h}`).join(" ")}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCopyToClipboard(c)}
                      className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                    >
                      <Copy className="size-3.5" /> Copy all
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showTemplates ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowTemplates(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Templates</h3>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-[12px] text-muted-foreground">
              Pick a starting point — it fills the prompt, then just swap in your product.
            </p>
            <div className="space-y-5">
              {TEMPLATE_GROUPS.map((g) => (
                <div key={g.category}>
                  <div className="eyebrow mb-2">{g.category}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {g.items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setInput(t.prompt);
                          setShowTemplates(false);
                        }}
                        className="rounded-xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                      >
                        <div className="text-[13px] font-medium text-foreground">{t.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DirectorSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GalleryTile({
  a,
  onOpen,
  onFavorite,
  onEditThis,
  onMoreLikeThis,
  onWriteCopy,
  onLock,
  onMakeVideo,
  onMakeCommercial,
}: {
  a: Asset;
  onOpen: (i: ViewerItem) => void;
  onFavorite: (i: ViewerItem) => void;
  onEditThis: (a: Asset) => void;
  onMoreLikeThis: (a: Asset) => void;
  onWriteCopy: (a: Asset) => void;
  onLock: (a: Asset) => void;
  onMakeVideo: (a: Asset) => void;
  onMakeCommercial: (a: Asset) => void;
}) {
  if (a.type === "video") {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-black">
        <video src={a.url} controls playsInline className="w-full" />
        <a
          href={a.url}
          download
          target="_blank"
          rel="noreferrer"
          title="Download video"
          aria-label="Download video"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md bg-background/85 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <Download className="size-3.5" />
        </a>
      </div>
    );
  }
  const item = { id: a.id, url: a.url, label: a.label, favorite: a.favorite };
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <button type="button" onClick={() => onOpen(item)} className="block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt={a.label}
          className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </button>
      <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <ActionIcon onClick={() => onMakeVideo(a)} title="Make a video clip from this">
          <Clapperboard className="size-3.5" />
        </ActionIcon>
        <ActionIcon onClick={() => onMakeCommercial(a)} title="Make a multi-shot commercial">
          <Film className="size-3.5" />
        </ActionIcon>
        <ActionIcon onClick={() => onWriteCopy(a)} title="Write ad copy">
          <PenLine className="size-3.5" />
        </ActionIcon>
        <ActionIcon onClick={() => onMoreLikeThis(a)} title="More like this">
          <Sparkles className="size-3.5" />
        </ActionIcon>
        <ActionIcon onClick={() => onEditThis(a)} title="Refine this image">
          <Wand2 className="size-3.5" />
        </ActionIcon>
        <ActionIcon onClick={() => onLock(a)} title="Lock this look (consistent series)">
          <Lock className="size-3.5" />
        </ActionIcon>
        <ActionIcon
          onClick={() => onFavorite(item)}
          active={a.favorite}
          title={a.favorite ? "Unfavorite" : "Favorite"}
        >
          <Heart className={`size-3.5 ${a.favorite ? "fill-primary text-primary" : ""}`} />
        </ActionIcon>
        <a
          href={a.url}
          download
          target="_blank"
          rel="noreferrer"
          title="Download"
          aria-label="Download"
          className="flex size-7 items-center justify-center rounded-md bg-background/85 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        >
          <Download className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
