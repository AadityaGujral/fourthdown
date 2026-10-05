"use client";
import Link from "next/link";import {useEffect,useState} from "react";import {teams} from "@/lib/teams";
type Prefs={name:string;email:string;gameAlerts:boolean;injuryAlerts:boolean;fantasyAlerts:boolean;weeklyDigest:boolean};
const DEFAULT:Prefs={name:"",email:"",gameAlerts:true,injuryAlerts:true,fantasyAlerts:false,weeklyDigest:true};
export default function AccountCenter(){
 const [prefs,setPrefs]=useState<Prefs>(DEFAULT);const [teamSlugs,setTeamSlugs]=useState<string[]>([]);const [players,setPlayers]=useState<any[]>([]);const [saved,setSaved]=useState(false);
 useEffect(()=>{try{setPrefs({...DEFAULT,...JSON.parse(localStorage.getItem("fourthdown:profile")||"{}")});setTeamSlugs(JSON.parse(localStorage.getItem("fourthdown:favorites")||"[]"));setPlayers(JSON.parse(localStorage.getItem("fourthdown:savedPlayers")||"[]"))}catch{}},[]);
 function save(){localStorage.setItem("fourthdown:profile",JSON.stringify(prefs));setSaved(true);setTimeout(()=>setSaved(false),1600)}
 const favs=teams.filter(t=>teamSlugs.includes(t.slug));
 return <div className="accountGrid">
  <section className="panel accountProfile"><span className="kicker">LOCAL PROFILE</span><h2>Your FourthDown</h2><label>Name<input value={prefs.name} onChange={e=>setPrefs({...prefs,name:e.target.value})} placeholder="Your name"/></label><label>Email<input type="email" value={prefs.email} onChange={e=>setPrefs({...prefs,email:e.target.value})} placeholder="you@example.com"/></label><button className="btn" onClick={save}>{saved?"SAVED ✓":"SAVE PROFILE"}</button><p className="accountNote">Stored only in this browser in V10. Cloud sign-in comes after an auth/database provider is connected.</p></section>
  <section className="panel"><span className="kicker">ALERT PREFERENCES</span><h2>Notifications</h2>{[["gameAlerts","Game alerts"],["injuryAlerts","Injury alerts"],["fantasyAlerts","Fantasy alerts"],["weeklyDigest","Weekly digest"]].map(([k,l])=><label className="toggleRow" key={k}><span>{l}</span><input type="checkbox" checked={(prefs as any)[k]} onChange={e=>setPrefs({...prefs,[k]:e.target.checked})}/></label>)}<button className="btn secondary" onClick={save}>SAVE PREFERENCES</button></section>
  <section className="panel"><span className="kicker">MY TEAMS</span><h2>{favs.length} Favorites</h2>{favs.length?favs.map(t=><Link className="accountItem" href={"/teams/"+t.slug} key={t.slug}><b>{t.abbr}</b><span>{t.name}</span></Link>):<p className="muted">No favorite teams yet.</p>}<Link className="textLink" href="/teams">Manage teams →</Link></section>
  <section className="panel"><span className="kicker">SAVED PLAYERS</span><h2>{players.length} Players</h2>{players.length?players.map(p=><Link className="accountItem" href={"/players/"+p.id} key={p.id}><b>{p.position||"NFL"}</b><span>{p.name}<small>{p.team}</small></span></Link>):<p className="muted">Save players from any player profile.</p>}<Link className="textLink" href="/stats">Browse leaders →</Link></section>
 </div>
}