import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { startEngine, stopEngine, getEngineStatus, ensureEngineRunning } from "@/lib/engine";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  ensureEngineRunning();

  return NextResponse.json({ status: getEngineStatus() });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "start") {
      const result = startEngine();
      return NextResponse.json(result);
    } else if (action === "stop") {
      const result = stopEngine();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
