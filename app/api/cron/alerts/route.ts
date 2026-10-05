const SB_URL=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const CRON_SECRET=process.env.CRON_SECRET!;
const RESEND_KEY=process.env.RESEND_API_KEY!;

async function rpc(name:string,body:any){
 const r=await fetch(SB_URL+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:SB_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
 if(!r.ok)throw new Error("Supabase RPC "+r.status+": "+await r.text());
 const t=await r.text();return t?JSON.parse(t):null;
}
async function sendEmail(to:string,subject:string,html:string){
 const recipient=process.env.RESEND_TEST_RECIPIENT||to;
 const from=process.env.RESEND_FROM_EMAIL||"FourthDown <onboarding@resend.dev>";
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+RESEND_KEY,"Content-Type":"application/json"},body:JSON.stringify({from,to:[recipient],subject,html})});
 const d=await r.json();if(!r.ok)throw new Error(d?.message||("Resend "+r.status));return d;
}
function esc(v:any){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
export async function GET(req:Request){
 if(!CRON_SECRET||req.headers.get("authorization")!=="Bearer "+CRON_SECRET)return new Response("Unauthorized",{status:401});
 if(!SB_URL||!SB_KEY||!RESEND_KEY)return Response.json({ok:false,error:"V14 environment incomplete"},{status:500});
 const rows=await rpc("get_v14_email_batch",{p_secret:CRON_SECRET});
 let sent=0,failed=0;const errors:string[]=[];
 for(const a of rows||[]){
  try{
   const accent=a.kind==="injury"?"#ffb612":"#ef3340";
   const html=`<div style="font-family:Arial;background:#0b0e13;color:#fff;padding:28px"><h1>FourthDown</h1><p style="color:${accent};font-weight:700">${esc(a.kind.toUpperCase())} ALERT</p><h2>${esc(a.title)}</h2><p>${esc(a.body)}</p><p style="color:#9aa3af">Independent football intelligence. Not affiliated with or endorsed by the NFL.</p></div>`;
   const out=await sendEmail(a.recipient,"FourthDown: "+a.title,html);
   await rpc("record_v14_email_delivery",{p_secret:CRON_SECRET,p_user_id:a.user_id,p_kind:a.kind,p_dedupe_key:a.dedupe_key,p_recipient:a.recipient,p_provider_id:out?.id||null});
   sent++;
  }catch(e:any){failed++;errors.push(e?.message||"send failed")}
 }
 return Response.json({ok:true,mode:"alerts",candidates:(rows||[]).length,sent,failed,testMode:Boolean(process.env.RESEND_TEST_RECIPIENT),errors:errors.slice(0,3),at:new Date().toISOString()});
}