"use client";
import TestEmailButton from "./TestEmailButton";
import Link from "next/link";import {useEffect,useState,useRef} from "react";import {teams} from "@/lib/teams";import {getSupabase} from "@/lib/supabase";
import {checked,readLocalList,readLocalProfile,validTeam,validPlayer,withTimeout} from "@/lib/client-state";
type Prefs={name:string;email:string;gameAlerts:boolean;injuryAlerts:boolean;fantasyAlerts:boolean;weeklyDigest:boolean;emailGameAlerts:boolean;emailInjuryAlerts:boolean;emailWeeklyDigest:boolean};
const DEFAULT:Prefs={name:"",email:"",gameAlerts:true,injuryAlerts:true,fantasyAlerts:false,weeklyDigest:true,emailGameAlerts:false,emailInjuryAlerts:false,emailWeeklyDigest:false};
export default function AccountCenter(){
 const [saving,setSaving]=useState(false);const [saveStatus,setSaveStatus]=useState("");const saveLock=useRef(false);
 const [prefs,setPrefs]=useState<Prefs>(DEFAULT);const [teamSlugs,setTeamSlugs]=useState<string[]>([]);const [players,setPlayers]=useState<any[]>([]);const [deliveryCount,setDeliveryCount]=useState(0);
 const [user,setUser]=useState<any>(null);const [password,setPassword]=useState("");const [status,setStatus]=useState("");const [loading,setLoading]=useState(true);const supabase=getSupabase();const generation=useRef(0);const [loadError,setLoadError]=useState(false);

 async function hydrateCloud(uid:string,email:string,version:number){
   const [{data:profile},{data:favs},{data:saved},{data:notifs},{count}]=await withTimeout(Promise.all([
     supabase.from("profiles").select("full_name,email").eq("id",uid).maybeSingle(),
     supabase.from("favorite_teams").select("team_slug").eq("user_id",uid),
     supabase.from("saved_players").select("player_id,player_name,team,position").eq("user_id",uid),
     supabase.from("notification_preferences").select("*").eq("user_id",uid).maybeSingle(),
     supabase.from("email_deliveries").select("id",{count:"exact",head:true}).eq("user_id",uid)
   ].map(query=>checked(query))));
   if(version!==generation.current)return;
   const localFavs=readLocalList("fourthdown:favorites",validTeam);const localPlayers=readLocalList("fourthdown:savedPlayers",validPlayer);
   if((favs||[]).length===0&&localFavs.length)await checked(supabase.from("favorite_teams").upsert(localFavs.map((s:string)=>({user_id:uid,team_slug:s}))));
   if((saved||[]).length===0&&localPlayers.length)await checked(supabase.from("saved_players").upsert(localPlayers.map((p:any)=>({user_id:uid,player_id:p.id,player_name:p.name,team:p.team,position:p.position}))));
   const freshFavs=(await checked(supabase.from("favorite_teams").select("team_slug").eq("user_id",uid))).data||[];const freshPlayers=(await checked(supabase.from("saved_players").select("player_id,player_name,team,position").eq("user_id",uid))).data||[];
   if(version!==generation.current)return;
   setTeamSlugs(freshFavs.map((x:any)=>x.team_slug));setPlayers(freshPlayers.map((x:any)=>({id:x.player_id,name:x.player_name,team:x.team,position:x.position})));setDeliveryCount(count||0);
   setPrefs({name:profile?.full_name||"",email:profile?.email||email||"",gameAlerts:notifs?.game_alerts??true,injuryAlerts:notifs?.injury_alerts??true,fantasyAlerts:notifs?.fantasy_alerts??false,weeklyDigest:notifs?.weekly_digest??true,emailGameAlerts:notifs?.email_game_alerts??false,emailInjuryAlerts:notifs?.email_injury_alerts??false,emailWeeklyDigest:notifs?.email_weekly_digest??false});
 }
 async function loadAccount(){
 const version=++generation.current;setLoading(true);setLoadError(false);
 try{const {data:{session},error}=await withTimeout(supabase.auth.getSession()) as any;if(error)throw error;if(version!==generation.current)return;
 setUser(session?.user||null);
 if(session?.user)await withTimeout(hydrateCloud(session.user.id,session.user.email||"",version));
 else{setPrefs(readLocalProfile(DEFAULT) as Prefs);setTeamSlugs(readLocalList("fourthdown:favorites",validTeam));setPlayers(readLocalList("fourthdown:savedPlayers",validPlayer));setDeliveryCount(0)}
 }catch{if(version===generation.current){generation.current++;setLoadError(true);setStatus("Could not load account data. Please retry.");setLoading(false)}}
 finally{if(version===generation.current)setLoading(false)}
 }
 useEffect(()=>{let alive=true;void loadAccount();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{generation.current++;setTimeout(()=>{if(alive)void loadAccount()},0)});return()=>{alive=false;generation.current++;subscription.unsubscribe()}},[]);
 async function signIn(){setStatus("Signing in…");const {error}=await supabase.auth.signInWithPassword({email:prefs.email,password});setStatus(error?error.message:"Signed in ✓")}
 async function signUp(){setStatus("Creating account…");const {error}=await supabase.auth.signUp({email:prefs.email,password,options:{data:{full_name:prefs.name}}});setStatus(error?error.message:"Account created. Check your email if confirmation is required.")}
 async function signOut(){await supabase.auth.signOut();setUser(null);setStatus("Signed out")}
 async function save(){
  if(saveLock.current)return;saveLock.current=true;setSaving(true);setSaveStatus("Saving preferences…");
  try{
   if(user){
    await Promise.all([
     checked(supabase.from("profiles").upsert({id:user.id,full_name:prefs.name,email:prefs.email,updated_at:new Date().toISOString()})),
     checked(supabase.from("notification_preferences").upsert({user_id:user.id,game_alerts:prefs.gameAlerts,injury_alerts:prefs.injuryAlerts,fantasy_alerts:prefs.fantasyAlerts,weekly_digest:prefs.weeklyDigest,email_game_alerts:prefs.emailGameAlerts,email_injury_alerts:prefs.emailInjuryAlerts,email_weekly_digest:prefs.emailWeeklyDigest,updated_at:new Date().toISOString()}))
    ]);
    setSaveStatus("Preferences saved to your account ✓");
   }else{localStorage.setItem("fourthdown:profile",JSON.stringify(prefs));setSaveStatus("Saved on this device. Sign in to receive email alerts.")}
  }catch{setSaveStatus("Could not save all preferences. Please retry. If this continues, refresh and sign in again.")}
  finally{saveLock.current=false;setSaving(false)}
 }

 const favs=teams.filter(t=>teamSlugs.includes(t.slug));if(loading)return <div className="panel"><p className="muted">Loading account…</p></div>;
 if(loadError)return <section className="panel"><p role="alert">{status}</p><button className="btn" onClick={()=>void loadAccount()}>RETRY ACCOUNT</button></section>;
 return <div className="accountGrid">
  <section className="panel accountProfile"><span className="kicker">{user?"CLOUD ACCOUNT":"SIGN IN"}</span><h2>{user?"Your FourthDown":"Create or sign in"}</h2><label>Name<input value={prefs.name} onChange={e=>setPrefs({...prefs,name:e.target.value})} placeholder="Your name"/></label><label>Email<input type="email" value={prefs.email} onChange={e=>setPrefs({...prefs,email:e.target.value})} placeholder="you@example.com"/></label>{!user&&<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8+ characters"/></label>}<div className="actions">{user?<button className="btn secondary" onClick={signOut}>SIGN OUT</button>:<><button className="btn" onClick={signIn}>SIGN IN</button><button className="btn secondary" onClick={signUp}>CREATE ACCOUNT</button></>}</div><p className="accountNote">{user?"Cloud sync is active across signed-in devices.":"You can keep using local mode, or sign in to enable cloud sync."}</p>{status&&<p className="cloudStatus">{status}</p>}</section>
  <section className="panel"><span className="kicker">IN-APP ALERTS</span><h2>Notifications</h2>{[["gameAlerts","Game alerts"],["injuryAlerts","Injury alerts"],["fantasyAlerts","Fantasy alerts"],["weeklyDigest","Weekly digest"]].map(([k,l])=><label className="toggleRow" key={k}><span>{l}</span><input type="checkbox" checked={(prefs as any)[k]} onChange={e=>setPrefs({...prefs,[k]:e.target.checked})}/></label>)}</section>
  <section className="panel"><span className="kicker">AUTOMATED EMAIL</span><h2>Email delivery</h2>{[["emailGameAlerts","Favorite-team game emails"],["emailInjuryAlerts","Saved-player injury emails"],["emailWeeklyDigest","Monday weekly digest"]].map(([k,l])=><label className="toggleRow" key={k}><span>{l}</span><input type="checkbox" checked={(prefs as any)[k]} onChange={e=>setPrefs({...prefs,[k]:e.target.checked})}/></label>)}<p className="accountNote">{deliveryCount} email delivery record{deliveryCount===1?"":"s"} · Manage your scheduled game, injury and weekly email preferences here.</p><button className="btn secondary" onClick={save} disabled={saving} aria-busy={saving}>{saving?"SAVING…":"SAVE PREFERENCES"}</button><p className="cloudStatus" role="status" aria-live="polite">{saveStatus}</p>{user&&<TestEmailButton key={user.id}/>}</section>
  <section className="panel"><span className="kicker">MY TEAMS</span><h2>{favs.length} Favorites</h2>{favs.length?favs.map(t=><Link className="accountItem" href={"/teams/"+t.slug} key={t.slug}><b>{t.abbr}</b><span>{t.name}</span></Link>):<p className="muted">No favorite teams yet.</p>}<Link className="textLink" href="/teams">Manage teams →</Link></section>
  <section className="panel"><span className="kicker">SAVED PLAYERS</span><h2>{players.length} Players</h2>{players.length?players.map(p=><Link className="accountItem" href={"/players/"+p.id} key={p.id}><b>{p.position||"NFL"}</b><span>{p.name}<small>{p.team}</small></span></Link>):<p className="muted">Save players from any player profile.</p>}<Link className="textLink" href="/stats">Browse leaders →</Link></section>
 </div>
}