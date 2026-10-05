"use client";
import {useState} from "react";
import {getSupabase} from "@/lib/supabase";
export default function EmailAlertsButton(){
 const supabase=getSupabase();const [status,setStatus]=useState("");
 async function send(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token){setStatus("Sign in to email alerts.");return}
  setStatus("Checking email alerts…");
  try{
   const r=await fetch("/api/email/dispatch",{method:"POST",headers:{Authorization:"Bearer "+session.access_token}});
   const d=await r.json();
   setStatus(d.ok?d.sent+" email alert(s) sent · "+d.skipped+" already delivered":(d.error||"Email delivery unavailable"));
  }catch{setStatus("Email delivery unavailable")}
 }
 return <div className="emailAlertControl"><button className="btn" onClick={send}>EMAIL MY ALERTS</button>{status&&<span>{status}</span>}</div>
}