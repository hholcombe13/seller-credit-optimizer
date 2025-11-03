import { NextRequest, NextResponse } from "next/server";
import { computeScenario } from "@/lib/mortgage";

export async function POST(req: NextRequest){
  const scenarios = await req.json();
  const results = (Array.isArray(scenarios) ? scenarios : []).map(computeScenario);
  return NextResponse.json(results);
}
