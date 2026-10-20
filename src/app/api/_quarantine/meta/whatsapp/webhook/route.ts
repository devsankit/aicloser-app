// Keep the callback configured in the existing AiCloser Meta app working while
// the app moves to the canonical WhatsApp marketing webhook route.
export { GET, POST } from "@/app/api/whatsapp-marketing/webhook/route";

export const dynamic = "force-dynamic";
