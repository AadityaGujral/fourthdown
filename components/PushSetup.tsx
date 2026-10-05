"use client";
import {useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase";

function urlBase64ToUint8Array(base64String:string){
 const padding="=".repeat((4-base64String.length%4)%4);
 const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
 const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
export default function PushSetup(){
 const supabase=getSupabase();
 const [supported,setSupported]=useState(true);const [enabled,setEnabled]=useState(false);
 const [game,setGame]=useState(false);const [injury,setInjury]=useState(false);
 const [status,setStatus]=useState("");const [loading,setLoading]=useState(true);

 async function refresh(){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){setSupported(false);setLoading(false);return}
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user){setLoading(false);return}
  const reg=await navigator.serviceWorker.register("/sw.js");
  const sub=await reg.pushManager.getSubscription();setEnabled(Boolean(sub));
  const {data:p}=await supabase.from("notification_preferences").select("push_game_alerts,push_injury_alerts").eq("user_id",session.user.id).maybeSingle();
  setGame(p?.push_game_alerts??false);setInjury(p?.push_injury_alerts??false);setLoading(false);
 }
 useEffect(()=>{refresh()},[]);

 async function enable(){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.user){setStatus("Sign in first.");return}
  const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key){setStatus("Push key is not configured.");return}
  const permission=await Notification.requestPermission();if(permission!=="granted"){setStatus("Browser notification permission was not granted.");return}
  const reg=await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
  const json=sub.toJSON();
  const {error}=await supabase.from("push_subscriptions").upsert({
    user_id:session.user.id,endpoint:sub.endpoint,p256dh:json.keys?.p256dh||"",auth:json.keys?.auth||"",user_agent:navigator.userAgent,updated_at:new Date().toISOString()
  },{onConflict:"user_id,endpoint"});
  if(error){setStatus(error.message);return}
  await supabase.from("notification_preferences").upsert({user_id:session.user.id,push_game_alerts:true,push_injury_alerts:true,updated_at:new Date().toISOString()});
  setGame(true);setInjury(true);setEnabled(true);setStatus("Browser push enabled ✓");
 }
 async function save(){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.user){setStatus("Sign in first.");return}
  const {error}=await supabase.from("notification_preferences").upsert({user_id:session.user.id,push_game_alerts:game,push_injury_alerts:injury,updated_at:new Date().toISOString()});
  setStatus(error?error.message:"Push preferences saved ✓");
 }
 async function disable(){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.user)return;
  const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  if(sub){await supabase.from("push_subscriptions").delete().eq("user_id",session.user.id).eq("endpoint",sub.endpoint);await sub.unsubscribe()}
  await supabase.from("notification_preferences").upsert({user_id:session.user.id,push_game_alerts:false,push_injury_alerts:false,updated_at:new Date().toISOString()});
  setGame(false);setInjury(false);setEnabled(false);setStatus("Browser push disabled");
 }
 async function testPush(){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token){setStatus("Sign in first.");return}
  setStatus("Sending test push…");
  const r=await fetch("/api/push/test",{method:"POST",headers:{Authorization:"Bearer "+session.access_token}});
  const d=await r.json();setStatus(d.ok?d.sent+" test push sent"+(d.failed?" · "+d.failed+" failed":""):(d.error||"Test push failed"));
 }

 if(loading)return <section className="panel"><p className="muted">Checking browser push…</p></section>;
 if(!supported)return <section className="panel"><span className="kicker">BROWSER PUSH · V15</span><h2>Not supported here</h2><p className="muted">Use a modern browser with Web Push support.</p></section>;
 return <section className="panel"><span className="kicker">BROWSER PUSH · V15</span><h2>{enabled?"Push enabled":"Turn on push alerts"}</h2><p className="accountNote">Receive FourthDown alerts even when the site is not open. Browser permission is required.</p>
 {!enabled?<button className="btn" onClick={enable}>ENABLE BROWSER PUSH</button>:<>
 <label className="toggleRow"><span>Favorite-team game push</span><input type="checkbox" checked={game} onChange={e=>setGame(e.target.checked)}/></label>
 <label className="toggleRow"><span>Saved-player injury push</span><input type="checkbox" checked={injury} onChange={e=>setInjury(e.target.checked)}/></label>
 <div className="actions"><button className="btn secondary" onClick={save}>SAVE PUSH SETTINGS</button><button className="btn secondary" onClick={testPush}>SEND TEST PUSH</button><button className="btn secondary" onClick={disable}>DISABLE PUSH</button></div>
 </>}
 {status&&<p className="cloudStatus">{status}</p>}</section>;
}