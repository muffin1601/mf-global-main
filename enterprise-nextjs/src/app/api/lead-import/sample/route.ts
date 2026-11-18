import { handle, requireApiActor } from "@/lib/auth/api";
import { csvResponse } from "@/lib/export/tabular";
import { SAMPLE_CSV } from "@/lib/imports/lead-csv";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => {
  await requireApiActor();
  return csvResponse("lead_import_sample.csv", SAMPLE_CSV);
});
