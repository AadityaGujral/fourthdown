"use client";
import type {Session} from "@supabase/supabase-js";
import {useRef,useState} from "react";
import {getSupabase} from "@/lib/supabase";
import {withTimeout} from "@/lib/client-state";
export default function TestEmailButton(){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState("");const lock=useRef(false);
 async function send(){
  if(lock.current)return;lock.current=true;setBusy(true);setStatus("Sending test email…");
  try{
   const {data:{session},error}=await withTimeout<{data:{session:Session|null};error:unknown}>(getSupabase().auth.getSession());
   if(error||!session?.access_token){setStatus("Sign in to send a test email.");return}
   const response=await fetch("/api/email/test",{method:"POST",headers:{Authorization:"Bearer "+session.access_token},signal:AbortSignal.timeout(20000)});
   const result=await response.json();
   setStatus(response.ok&&result.ok?`${result.message} Recipient: ${result.recipient}`:result.error||"Test email could not be sent. Please retry.");
  }catch{setStatus("Could not confirm email acceptance. Check your inbox before retrying.")}
  finally{lock.current=false;setBusy(false)}
 }
 return <div className="emailAlertControl"><button className="btn secondary" onClick={send} disabled={busy} aria-busy={busy}>{busy?"SENDING…":"SEND TEST EMAIL"}</button><p className="accountNote">Sends to your signed-in account email. One test per UTC hour; does not change your preferences.</p><p className="cloudStatus" role="status" aria-live="polite">{status}</p></div>
}
