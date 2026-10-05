import webpush from "web-push";

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
 if(!SB_URL||!SB_KEY||!RESEND_KEY)return Response.json({ok:false,error:"V15 environment incomplete"},{status:500});

 const emailRows=await rpc("get_v14_email_batch",{p_secret:CRON_SECRET});
 let emailSent=0,emailFailed=0;const emailErrors:string[]=[];
 for(const a of emailRows||[]){
  try{
   const accent=a.kind==="injury"?"#ffb612":"#ef3340";
   const html=`<div style="font-family:Arial;background:#0b0e13;color:#fff;padding:28px"><h1>FourthDown</h1><p style="color:${accent};font-weight:700">${esc(a.kind.toUpperCase())} ALERT</p><h2>${esc(a.title)}</h2><p>${esc(a.body)}</p><p style="color:#9aa3af">Independent football intelligence. Not affiliated with or endorsed by the NFL.</p></div>`;
   const out=await sendEmail(a.recipient,"FourthDown: "+a.title,html);
   await rpc("record_v14_email_delivery",{p_secret:CRON_SECRET,p_user_id:a.user_id,p_kind:a.kind,p_dedupe_key:a.dedupe_key,p_recipient:a.recipient,p_provider_id:out?.id||null});
   emailSent++;
  }catch(e:any){emailFailed++;emailErrors.push(e?.message||"send failed")}
 }

 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 const privateKey=process.env.VAPID_PRIVATE_KEY;
 const subject=process.env.VAPID_SUBJECT;
 let pushCandidates=0,pushSent=0,pushFailed=0;const pushErrors:string[]=[];
 if(publicKey&&privateKey&&subject){
  webpush.setVapidDetails(subject,publicKey,privateKey);
  const pushRows=await rpc("get_v15_push_batch",{p_secret:CRON_SECRET});
  pushCandidates=(pushRows||[]).length;
  for(const p of pushRows||[]){
   try{
    await webpush.sendNotification(
      {endpoint:p.endpoint,keys:{p256dh:p.p256dh,auth:p.auth}},
      JSON.stringify({title:p.title,body:p.body,href:p.href||"/notifications",tag:p.dedupe_key})
    );
    await rpc("record_v15_push_delivery",{p_secret:CRON_SECRET,p_user_id:p.user_id,p_notification_id:p.notification_id,p_dedupe_key:p.dedupe_key});
    pushSent++;
   }catch(e:any){
    pushFailed++;pushErrors.push(e?.body||e?.message||"push failed");
    if(e?.statusCode===404||e?.statusCode===410){
      await rpc("delete_v15_push_subscription",{p_secret:CRON_SECRET,p_subscription_id:p.subscription_id});
    }
   }
  }
 }

 return Response.json({
  ok:true,mode:"alerts",
  email:{candidates:(emailRows||[]).length,sent:emailSent,failed:emailFailed},
  push:{candidates:pushCandidates,sent:pushSent,failed:pushFailed},
  testMode:Boolean(process.env.RESEND_TEST_RECIPIENT),
  errors:[...emailErrors,...pushErrors].slice(0,4),
  at:new Date().toISOString()
 });
}