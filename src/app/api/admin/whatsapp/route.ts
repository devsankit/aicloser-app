import { handleWhatsAppSetup } from "@/lib/meta/whatsapp-setup-api";
export const GET = (request: Request) => handleWhatsAppSetup(request, "state");
export const POST = (request: Request) => handleWhatsAppSetup(request, "state");
