"use client";

import { useCallback, useEffect, useState } from "react";
import { getLeadDetailAction } from "@/app/(crm)/crm/lead-management/actions";
import type { LeadDetail } from "@/server/leads/types";

type State = { id: string; tick: number; lead?: LeadDetail; error?: string };

/** Loads one lead's detail through the authorised server action; `reload` refetches. */
export function useLeadDetail(id: string) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    let cancelled = false;
    getLeadDetailAction(id).then((res) => {
      if (cancelled) return;
      setState(res.ok ? { id, tick, lead: res.lead } : { id, tick, error: res.error });
    }).catch(() => {
      // Network/transport failure: show an error instead of an endless loading skeleton.
      if (!cancelled) setState({ id, tick, error: "Could not load the lead. Check your connection and try again." });
    });
    return () => { cancelled = true; };
  }, [id, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state && state.id === id ? state : null;
  return { lead: current?.lead, error: current?.error, loading: !current, reload };
}
