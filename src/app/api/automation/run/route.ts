import { NextResponse } from "next/server";
import { runAutomationSweep } from "@/services/automation/automation.service";

export async function POST(req:Request) {
  const secret = req.headers.get("x-automation-secret");
  if (process.env.AUTOMATION_SECRET && secret !== process.env.AUTOMATION_SECRET) {
    return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  }
  return NextResponse.json(await runAutomationSweep());
}
