"use client";
import {useEffect,useRef,useState} from "react";
import {getSupabase} from "@/lib/supabase";

function urlBase64ToUint8Array(value:string){
 const padded=(value+"=".repeat((4-value.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
async function activeRegistration(){
 await navigator.serviceWorker.register("/sw.js");
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([
  navigator.serviceWorker.ready,
  new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Push setup timed out. Please retry.")),10000)})
 ])}finally{clearTimeout(timer)}
}
export default function PushSetup(){
 const supabase=getSupabase();
 const [supported,setSupported]=useState(true),[enabled,setEnabled]=useState(false),[signedIn,setSignedIn]=useState(false);
 const [game,setGame]=useState(false),[injury,setInjury]=useState(false);
 const [status,setStatus]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const operation=useRef(false);
 async function session(){
  const {data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(!session?.user)throw new Error("Sign in first.");
  return session;
 }
 useEffect(()=>{
  let alive=true,generation=0;
  async function refresh(){
   const current=++generation;
   try{
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){
     if(alive)setSupported(false);return;
    }
    const {data:{session},error}=await supabase.auth.getSession();if(error)throw error;
    if(!session?.user){if(alive){setSignedIn(false);setEnabled(false);setGame(false);setInjury(false)}return}
    if(alive&&current===generation)setSignedIn(true);
    const reg=await navigator.serviceWorker.getRegistration("/");
    const sub=await reg?.pushManager.getSubscription();
    const [{data:stored,error:subError},{data:p,error:prefError}]=await Promise.all([
     sub?supabase.from("push_subscriptions").select("endpoint").eq("user_id",session.user.id).eq("endpoint",sub.endpoint).maybeSingle():Promise.resolve({data:null,error:null}),
     supabase.from("notification_preferences").select("push_game_alerts,push_injury_alerts").eq("user_id",session.user.id).maybeSingle()
    ]);
    if(subError||prefError)throw subError||prefError;
    if(alive&&current===generation){setEnabled(Boolean(sub&&stored));setGame(p?.push_game_alerts??false);setInjury(p?.push_injury_alerts??false)}
   }catch(error:any){if(alive)setStatus(error?.message||"Could not check push settings.")}
   finally{if(alive&&current===generation)setLoading(false)}
  }
  void refresh();
  // Supabase operations must run after the synchronous auth callback releases its lock.
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>{if(alive)void refresh()},0)});
  return()=>{alive=false;subscription.unsubscribe()};
 },[supabase]);
 async function run(action:()=>Promise<void>){
  if(operation.current)return;
  operation.current=true;setBusy(true);setStatus("");
  try{await action()}catch(error:any){setStatus(error?.message||"Push action failed. Please retry.")}
  finally{operation.current=false;setBusy(false)}
 }
 async function enable(){
  if(!signedIn)throw new Error("Sign in first.");
  const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)throw new Error("Push key is not configured.");
  if(await Notification.requestPermission()!=="granted")throw new Error("Browser notification permission was not granted.");
  const s=await session();
  const reg=await activeRegistration();let sub=await reg.pushManager.getSubscription();const created=!sub;
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
  const json=sub.toJSON();
  const {error}=await supabase.from("push_subscriptions").upsert({user_id:s.user.id,endpoint:sub.endpoint,p256dh:json.keys?.p256dh||"",auth:json.keys?.auth||"",user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:"user_id,endpoint"});
  if(error){if(created)await sub.unsubscribe();throw new Error("Could not save this browser subscription. Please retry.")}
  setEnabled(true);
  const {error:prefError}=await supabase.from("notification_preferences").upsert({user_id:s.user.id,push_game_alerts:true,push_injury_alerts:true,updated_at:new Date().toISOString()});
  if(prefError)throw new Error("Browser registered, but alert settings could not be saved. Choose your settings and save again.");
  setGame(true);setInjury(true);setStatus("Browser push enabled ✓");
 }
 async function save(){
  const s=await session();
  const {error}=await supabase.from("notification_preferences").upsert({user_id:s.user.id,push_game_alerts:game,push_injury_alerts:injury,updated_at:new Date().toISOString()});
  if(error)throw new Error("Push preferences could not be saved. Please retry.");
  setStatus("Push preferences saved ✓");
 }
 async function disable(){
  const s=await session();const reg=await navigator.serviceWorker.getRegistration("/");const sub=await reg?.pushManager.getSubscription();
  if(sub){
   const {error}=await supabase.from("push_subscriptions").delete().eq("user_id",s.user.id).eq("endpoint",sub.endpoint);
   if(error)throw new Error("Could not remove this browser subscription. Please retry.");
   setEnabled(false);
   if(!await sub.unsubscribe())throw new Error("Server delivery disabled. Browser cleanup failed; retry setup if needed.");
  }
  // Preferences apply to every browser; removing one subscription must not silence others.
  setEnabled(false);setStatus("Push disabled for this browser.");
 }
 async function testPush(){
  const s=await session();setStatus("Sending test push…");
  const r=await fetch("/api/push/test",{method:"POST",headers:{Authorization:"Bearer "+s.access_token},signal:AbortSignal.timeout(20000)});
  const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||"Test push failed.");
  setStatus(d.sent>0?`${d.sent} test push accepted for delivery${d.failed?` · ${d.failed} failed`:""}`:"No active subscription accepted the test. Enable push again.");
 }
 if(loading)return <section className="panel"><p className="muted">Checking browser push…</p></section>;
 if(!supported)return <section className="panel"><span className="kicker">BROWSER PUSH · V15</span><h2>Not supported here</h2><p className="muted">Use a browser with Web Push support. On iPhone, add FourthDown to your Home Screen and open it there.</p></section>;
 return <section className="panel" aria-busy={busy}><span className="kicker">BROWSER PUSH · V15</span><h2>{enabled?"Push enabled":"Turn on push alerts"}</h2><p className="accountNote">Receive FourthDown alerts even when the site is not open. Browser permission is required.</p>
 {!enabled?<button className="btn" disabled={busy} onClick={()=>void run(enable)}>ENABLE BROWSER PUSH</button>:<>
 <label className="toggleRow"><span>Favorite-team game push</span><input disabled={busy} type="checkbox" checked={game} onChange={e=>setGame(e.target.checked)}/></label>
 <label className="toggleRow"><span>Saved-player injury push</span><input disabled={busy} type="checkbox" checked={injury} onChange={e=>setInjury(e.target.checked)}/></label>
 <div className="actions"><button className="btn secondary" disabled={busy} onClick={()=>void run(save)}>SAVE PUSH SETTINGS</button><button className="btn secondary" disabled={busy} onClick={()=>void run(testPush)}>SEND TEST PUSH</button><button className="btn secondary" disabled={busy} onClick={()=>void run(disable)}>DISABLE PUSH</button></div>
 </>}
 {status&&<p className="cloudStatus" role="status">{status}</p>}</section>;
}
