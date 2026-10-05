import {createClient} from "@supabase/supabase-js";

function esc(v:any){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
async function sendEmail(to:string,subject:string,html:string){
 const apiKey=process.env.RESEND_API_KEY;if(!apiKey) throw new Error("RESEND_API_KEY is not configured");
 const from=process.env.RESEND_FROM_EMAIL||"FourthDown <onboarding@resend.dev>";
 const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
 const data=await res.json();if(!res.ok) throw new Error(data?.message||("Resend "+res.status));return data;
}
async function rest(path:string,token:string,init?:RequestInit){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) throw new Error("Supabase not configured");
 const res=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})}});
 if(!res.ok) throw new Error("Supabase REST "+res.status+": "+await res.text());
 const text=await res.text();return text?JSON.parse(text):[];
}
export async function POST(req:Request){
 try{
  const auth=req.headers.get("authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)return Response.json({ok:false,error:"Unauthorized"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return Response.json({ok:false,error:"Supabase not configured"},{status:500});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user?.email)return Response.json({ok:false,error:"Invalid session"},{status:401});
  const uid=user.id;

  const notifications=await rest(
    "notifications?select=id,kind,title,body,href,dedupe_key,created_at&user_id=eq."+encodeURIComponent(uid)+"&kind=in.(game,injury)&order=created_at.desc&limit=20",
    token
  );

  let sent=0,skipped=0,failed=0;const errors:string[]=[];
  for(const n of notifications){
    const emailDedupe="email:"+n.dedupe_key;
    const existing=await rest("email_deliveries?select=id&user_id=eq."+encodeURIComponent(uid)+"&dedupe_key=eq."+encodeURIComponent(emailDedupe)+"&limit=1",token);
    if(existing?.length){skipped++;continue}
    const accent=n.kind==="injury"?"#ffb612":"#ef3340";
    const html=`<div style="font-family:Arial;background:#0b0e13;color:#fff;padding:28px"><h1 style="margin:0 0 8px">FourthDown</h1><p style="color:${accent};font-weight:700">${esc(String(n.kind).toUpperCase())} ALERT</p><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p><p style="color:#9aa3af">Independent football intelligence. Not affiliated with or endorsed by the NFL.</p></div>`;
    try{
      const out=await sendEmail(user.email,"FourthDown: "+n.title,html);
      await rest("email_deliveries",token,{method:"POST",body:JSON.stringify({user_id:uid,kind:n.kind,dedupe_key:emailDedupe,recipient:user.email,provider_id:out?.id||null,status:"sent"})});
      sent++;
    }catch(e:any){failed++;errors.push(e?.message||"send failed")}
  }

  return Response.json({ok:true,sent,skipped,failed,candidates:notifications.length,sender:process.env.RESEND_FROM_EMAIL?"verified-domain":"resend-onboarding",errors});
 }catch(e:any){return Response.json({ok:false,error:e?.message||"Email dispatch failed"},{status:500})}
}