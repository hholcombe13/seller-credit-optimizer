import { NextRequest, NextResponse } from "next/server";
import { computeScenario } from "@/lib/mortgage";

export async function POST(req: NextRequest){
  const body = await req.json();
  const out = computeScenario(body);
  return NextResponse.json(out);
}
