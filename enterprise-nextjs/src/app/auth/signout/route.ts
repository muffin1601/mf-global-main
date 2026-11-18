import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function POST(request:Request){const supabase=await createSupabaseServerClient();await supabase.auth.signOut();return NextResponse.redirect(new URL("/crm/login",request.url),303)}
