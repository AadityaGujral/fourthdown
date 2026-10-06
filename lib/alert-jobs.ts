import webpush from "web-push";
import {timingSafeEqual} from "node:crypto";
import {getLiveScoreboard,getLeagueInjuryWatch} from "./live-nfl";
import {buildAlertEvents} from "./alert-events";
export function authorized(request:Request){
 const expected=process.env.CRON_SECRET;
 const actual=request.headers.get("authorization")||"";
 if(!expected)return false;
 const a=Buffer.from(actual),b=Buffer.from("Bearer "+expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function jobRpc(action:string,payload:unknown={}){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.CRON_SECRET;
 if(!url||!key||!secret)throw new Error("Job configuration incomplete");
 const response=await fetch(url+"/rest/v1/rpc/v16_alert_job",{method:"POST",cache:"no-store",signal:AbortSignal.timeout(8000),headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({p_secret:secret,p_action:action,p_payload:payload})});
 if(!response.ok)throw new Error("Job database unavailable");
 return response.json();
}
function escapeHtml(value:unknown){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}
export function safePushEndpoint(value:string){
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&(!u.port||u.port==="443")&&(u.hostname==="fcm.googleapis.com"||u.hostname.endsWith(".push.services.mozilla.com")||u.hostname==="web.push.apple.com"||u.hostname.endsWith(".notify.windows.com"))}catch{return false}
}
export function failurePolicy(error:any){
 const status=Number(error?.statusCode)||0;
 return {code:status?`http_${status}`:"network_or_timeout",permanent:status>=400&&status<500&&![408,409,429].includes(status)};
}
type Job={id:string;token:string;channel:"email"|"push";recipient:string;endpoint:string;p256dh:string;auth:string;payload:{kind:string;title:string;body:string;href:string}};
async function send(job:Job){
 if(job.channel==="email"){
  const recipient=process.env.RESEND_TEST_RECIPIENT||job.recipient;
  const response=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(8000),headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"fourthdown-v16-"+job.id},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL||"FourthDown <onboarding@resend.dev>",to:[recipient],subject:job.payload.title,html:`<div style="font-family:Arial"><h1>FourthDown</h1><h2>${escapeHtml(job.payload.title)}</h2><p style="white-space:pre-line">${escapeHtml(job.payload.body)}</p><p>Manage your alert preferences in FourthDown.</p></div>`})});
  if(!response.ok)throw {statusCode:response.status};
  return (await response.json()).id as string;
 }
 if(!safePushEndpoint(job.endpoint))throw {statusCode:400};
 await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},JSON.stringify({title:job.payload.title,body:job.payload.body,href:job.payload.href,tag:"fourthdown-"+job.id}),{timeout:8000,TTL:3600});
 return null;
}
export async function deliverQueue(rpc=jobRpc,deliver=send){
 const channels:string[]=[];
 if(process.env.RESEND_API_KEY)channels.push("email");
 if(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT){webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);channels.push("push")}
 const jobs:Job[]=await rpc("claim",{channels});
 const counts={claimed:jobs.length,sent:0,failed:0,unsettled:0};let next=0;
 await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{
  while(next<jobs.length){
   const job=jobs[next++];let outcome;
   try{const id=await deliver(job);outcome={success:true,provider_id:id};}
   catch(error){outcome={success:false,...failurePolicy(error)};console.warn(JSON.stringify({event:"v16_delivery_failed",channel:job.channel,code:outcome.code}))}
   // Settlement failure must not turn an accepted send into a new failed send attempt.
   try{const result=await rpc("settle",{id:job.id,token:job.token,...outcome});if(!result.settled)throw new Error("Lease lost");if(outcome.success)counts.sent++;else counts.failed++;}
   catch{counts.unsettled++;console.error(JSON.stringify({event:"v16_delivery_unsettled",channel:job.channel}))}
  }
 }));
 return counts;
}
export async function runAlertJob(request:Request,mode:"alerts"|"weekly"){
 if(!authorized(request))return Response.json({ok:false,error:"Unauthorized"},{status:401});
 const dryRun=new URL(request.url).searchParams.get("dryRun")==="1";
 if(process.env.VERCEL_ENV==="preview"&&!dryRun)return Response.json({ok:false,error:"Preview delivery disabled"},{status:403});
 try{
  let ingestion:any={inserted:0},availability:any={};
  if(mode==="alerts"){
   const [board,injuries]=await Promise.all([getLiveScoreboard(),getLeagueInjuryWatch()]);
   availability={games:board.ok,injuries:injuries.ok};
   const events=buildAlertEvents(board.ok?board.games:[],injuries.ok?injuries.rows:[]);
   if(dryRun)return Response.json({ok:true,dryRun:true,mode,availability,eventCount:events.length,delivery:await jobRpc("status")});
   ingestion=await jobRpc("ingest",{events});
  }else if(dryRun)return Response.json({ok:true,dryRun:true,mode,delivery:await jobRpc("status")});
  const queued=await jobRpc(mode==="weekly"?"weekly":"enqueue");
  const delivery=await deliverQueue();
  const degraded=mode==="alerts"&&(!availability.games||!availability.injuries);
  const result={ok:!degraded&&delivery.failed===0&&delivery.unsettled===0,degraded,mode,availability,ingestion,...queued,delivery,testMode:Boolean(process.env.RESEND_TEST_RECIPIENT),at:new Date().toISOString()};
  await jobRpc("record_run",{mode,result});
  console.info(JSON.stringify({event:"v16_job_completed",...result}));
  return Response.json(result,{status:result.ok?200:207});
 }catch{
  console.error(JSON.stringify({event:"v16_job_failed",mode}));
  return Response.json({ok:false,error:"Alert job failed; pending deliveries are retained."},{status:503});
 }
}
