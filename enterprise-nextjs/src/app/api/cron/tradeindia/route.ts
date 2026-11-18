import { runCron } from "@/server/integrations/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (request: Request) => runCron("tradeindia", request);
