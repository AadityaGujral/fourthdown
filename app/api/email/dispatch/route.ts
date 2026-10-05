import {createClient} from "@supabase/supabase-js";
function esc(v:any){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
async function sendEmail(to:string,subject:string,html:string){
 const apiKey=process.env.RESEND_API_KEY;if(!apiKey) throw new Error("RESEND_API_KEY is not configured");
 const from=process.env.RESEND_FROM_EMAIL||"FourthDown <onboarding@resend.dev>";
 const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
 const data=await res.json();if(!res.ok) throw new Error(data?.message||("Resend "+res.status));return data;
}
export async function POST(req:Request){
 try{
  const auth=req.headers.get("authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)return Response.json({ok:false,error:"Unauthorized"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return Response.json({ok:false,error:"Supabase not configured"},{status:500});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await supabase.auth.getUser(token);
  if(error||!user?.email)return Response.json({ok:false,error:"Invalid session"},{status:401});
  const body=await req.json().catch(()=>({}));const alerts=Array.isArray(body?.alerts)?body.alerts.slice(0,8):[];
  if(!alerts.length)return Response.json({ok:true,sent:0,failed:0,deliveries:[]});
  let sent=0,failed=0;const deliveries:any[]=[];const errors:string[]=[];
  for(const a of alerts){
    if(!a||!["game","injury"].includes(a.kind)||!a.title||!a.body||!a.dedupe_key){failed++;continue}
    const accent=a.kind==="injury"?"#ffb612":"#ef3340";
    const html=`<div style="font-family:Arial;background:#0b0e13;color:#fff;padding:28px"><h1 style="margin:0 0 8px">FourthDown</h1><p style="color:${accent};font-weight:700">${esc(String(a.kind).toUpperCase())} ALERT</p><h2>${esc(a.title)}</h2><p>${esc(a.body)}</p><p style="color:#9aa3af">Independent football intelligence. Not affiliated with or endorsed by the NFL.</p></div>`;
    try{
      const out=await sendEmail(user.email,"FourthDown: "+a.title,html);
      deliveries.push({kind:a.kind,dedupe_key:"email:"+a.dedupe_key,provider_id:out?.id||null});
      sent++;
    }catch(e:any){failed++;errors.push(e?.message||"send failed")}
  }
  return Response.json({ok:true,sent,failed,deliveries,errors,sender:process.env.RESEND_FROM_EMAIL?"verified-domain":"resend-onboarding"});
 }catch(e:any){return Response.json({ok:false,error:e?.message||"Email dispatch failed"},{status:500})}
}