import {runAlertJob} from "@/lib/alert-jobs";
export const runtime="nodejs";
export const maxDuration=120;
export const dynamic="force-dynamic";
export async function GET(request:Request){return runAlertJob(request,"alerts")}
