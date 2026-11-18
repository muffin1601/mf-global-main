import { handleWebhook } from "@/server/integrations/webhooks";

export const dynamic = "force-dynamic";

export const POST = (request: Request) => handleWebhook("coachinpromo", request);
