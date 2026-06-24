import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/account";
import { ChatClient, type ChatSummary } from "./chat-client";
import { StudioNav } from "./studio-nav";

export default async function AdStudioChatPage() {
  const ctx = await getCurrentAccount().catch(() => redirect("/login"));

  const { data } = await ctx.supabase
    .from("ad_chats")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <StudioNav active="chat" />
      <ChatClient initialChats={(data ?? []) as ChatSummary[]} />
    </div>
  );
}
