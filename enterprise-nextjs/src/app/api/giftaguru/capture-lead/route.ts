import { handleWebhook } from "@/server/integrations/webhooks";

export const dynamic = "force-dynamic";

// GiftaGuru website lead capture. Same contract as /api/printkee/capture-lead (x-api-key header, JSON body).
export const POST = (request: Request) => handleWebhook("giftaguru", request);
