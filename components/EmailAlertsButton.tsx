"use client";
import {useState} from "react";
import {getSupabase} from "@/lib/supabase";
export default function EmailAlertsButton(){
 const supabase=getSupabase();const [status,setStatus]=useState("");
 async function send(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token||!session.user){setStatus("Sign in to email alerts.");return}
  setStatus("Checking email alerts…");
  try{
   const uid=session.user.id;
   const [{data:notifications},{data:deliveries}]=await Promise.all([
    supabase.from("notifications").select("id,kind,title,body,href,dedupe_key,created_at").eq("user_id",uid).in("kind",["game","injury"]).order("created_at",{ascending:false}).limit(20),
    supabase.from("email_deliveries").select("dedupe_key").eq("user_id",uid).limit(100)
   ]);
   const delivered=new Set((deliveries||[]).map((x:any)=>x.dedupe_key));
   const pending=(notifications||[]).filter((n:any)=>!delivered.has("email:"+n.dedupe_key)).slice(0,8);
   if(!pending.length){setStatus("0 email alert(s) sent · "+(notifications?.length||0)+" already delivered/available");return}
   const r=await fetch("/api/email/dispatch",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({alerts:pending})});
   const d=await r.json();
   if(!d.ok){setStatus(d.error||"Email delivery unavailable");return}
   if(d.deliveries?.length){
    const rows=d.deliveries.map((x:any)=>({user_id:uid,kind:x.kind,dedupe_key:x.dedupe_key,recipient:session.user.email||"",provider_id:x.provider_id||null,status:"sent"}));
    await supabase.from("email_deliveries").upsert(rows,{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});
   }
   setStatus(d.sent+" email alert(s) sent · "+d.failed+" failed");
  }catch(e:any){setStatus(e?.message||"Email delivery unavailable")}
 }
 return <div className="emailAlertControl"><button className="btn" onClick={send}>EMAIL MY ALERTS</button>{status&&<span>{status}</span>}</div>
}