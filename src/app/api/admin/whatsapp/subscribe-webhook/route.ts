import { handleWhatsAppSetup } from "@/lib/meta/whatsapp-setup-api";
export const POST = (request: Request) => handleWhatsAppSetup(request, "subscribe");
