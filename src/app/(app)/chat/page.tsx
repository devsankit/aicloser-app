import type { Metadata } from "next";
import { ChatView } from "@/components/chat/ChatView";

export const metadata: Metadata = { title: "Live Multi-Channel Chat" };

export default function ChatPage() {
  return <ChatView />;
}
