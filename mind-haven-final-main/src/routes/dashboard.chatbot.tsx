import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import companionAvatar from "@/assets/companion-avatar.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard/chatbot")({
  component: ChatbotPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const MEMORY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-memory`;

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi there 💛 I'm your MindHaven companion. I'm here to listen — no judgments, no pressure. How are you feeling today?",
};

function ChatbotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memory, setMemory] = useState<Record<string, unknown>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Load history + memory on mount / when user becomes available
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: history }, { data: mem }] = await Promise.all([
        supabase
          .from("chat_messages")
          .select("role, content, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase.from("user_memory").select("summary").eq("user_id", user.id).maybeSingle(),
      ]);
      if (history && history.length > 0) {
        setMessages(
          history.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }))
        );
      }
      if (mem?.summary && typeof mem.summary === "object") {
        setMemory(mem.summary as Record<string, unknown>);
      }
    })();
  }, [user]);

  const persistMessage = async (msg: Msg) => {
    if (!user) return;
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: msg.role,
      content: msg.content,
    });
  };

  const refreshMemory = async (allMsgs: Msg[]) => {
    if (!user) return;
    try {
      const resp = await fetch(MEMORY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMsgs, memory }),
      });
      if (!resp.ok) return;
      const { memory: updated } = await resp.json();
      if (updated && typeof updated === "object") {
        setMemory(updated);
        await supabase.from("user_memory").upsert(
          { user_id: user.id, summary: updated, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      }
    } catch (e) {
      console.error("memory update failed", e);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    persistMessage(userMsg);

    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const allMsgs = [...messages.filter((m) => m !== GREETING), userMsg];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMsgs, memory }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Persist assistant message + refresh memory
      if (assistantSoFar) {
        const assistantMsg: Msg = { role: "assistant", content: assistantSoFar };
        await persistMessage(assistantMsg);
        // Update memory in background every few exchanges
        const next = [...allMsgs, assistantMsg];
        if (next.filter((m) => m.role === "user").length % 3 === 0) {
          refreshMemory(next);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col animate-rise" style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}>
      {/* Compact header */}
      <div className="flex items-center gap-3 pb-5 mb-2 border-b border-glass-border/20">
        <div className="relative">
          <img
            src={companionAvatar}
            alt="MindHaven Companion"
            width={48}
            height={48}
            className="rounded-full"
            style={{ background: "var(--companion-avatar-bg, oklch(0.92 0.02 85))" }}
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
            style={{ background: "oklch(0.72 0.15 155)", borderColor: "var(--background)" }} />
        </div>
        <div>
          <h1 className="font-display text-xl" style={{ color: "var(--ink, var(--foreground))" }}>
            MindHaven Companion
          </h1>
          <p className="text-xs" style={{ color: "oklch(0.72 0.15 155)" }}>
            Online · Here to listen
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] px-2.5 py-1 rounded-full font-medium"
            style={{ background: "oklch(0.72 0.15 155 / 0.15)", color: "oklch(0.72 0.15 155)" }}>
            AI Companion
          </span>
        </div>
      </div>

      {/* Messages area - takes all available space */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 space-y-5"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Avatar for bot */}
            {msg.role === "assistant" && (
              <img
                src={companionAvatar}
                alt=""
                className="rounded-full shrink-0 mt-1 object-cover"
                style={{ width: 32, height: 32, minWidth: 32, background: "oklch(0.92 0.02 85)" }}
              />
            )}

            <div
              className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user" ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tl-md"
              }`}
              style={
                msg.role === "user"
                  ? {
                      background: "oklch(0.72 0.15 155 / 0.2)",
                      color: "var(--foreground)",
                    }
                  : {
                      background: "oklch(0.92 0.02 85 / 0.1)",
                      border: "1px solid oklch(0.92 0.02 85 / 0.15)",
                      color: "var(--foreground)",
                    }
              }
            >
              {msg.content}
              {msg.role === "assistant" && isLoading && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-4 rounded-full ml-1 animate-pulse"
                  style={{ background: "oklch(0.72 0.15 155 / 0.5)" }} />
              )}
            </div>

            {/* Spacer for user (no avatar) */}
            {msg.role === "user" && <div className="w-8 shrink-0" />}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2.5">
            <img
              src={companionAvatar}
              alt=""
              className="rounded-full shrink-0 mt-1 object-cover"
              style={{ width: 32, height: 32, minWidth: 32, background: "oklch(0.92 0.02 85)" }}
            />
            <div className="rounded-2xl rounded-tl-md px-4 py-3"
              style={{ background: "oklch(0.92 0.02 85 / 0.1)", border: "1px solid oklch(0.92 0.02 85 / 0.15)" }}>
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "oklch(0.72 0.15 155 / 0.6)", animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "oklch(0.72 0.15 155 / 0.6)", animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "oklch(0.72 0.15 155 / 0.6)", animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-muted-foreground/30 py-2">
        Not a therapist or medical professional · For support, reach out to a licensed professional
      </p>

      {/* Input bar */}
      <div className="rounded-2xl p-2 flex gap-2 items-end"
        style={{ background: "oklch(0.92 0.02 85 / 0.08)", border: "1px solid oklch(0.92 0.02 85 / 0.12)" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Share what's on your mind…"
          rows={1}
          className="flex-1 min-h-[42px] max-h-[120px] resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/30 focus:outline-none"
          style={{ color: "var(--foreground)" }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
          style={{
            background: input.trim() && !isLoading ? "oklch(0.72 0.15 155)" : "oklch(0.72 0.15 155 / 0.3)",
            color: "white",
          }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
