"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {getSupabase} from "@/lib/supabase";
import {teams} from "@/lib/teams";

type Watched={id:string;name:string;team:string;position:string;priority:number;note:string};
function teamAbbr(value:string){
 const v=(value||"").toLowerCase();
 const hit=teams.find(t=>t.abbr.toLowerCase()===v||t.name.toLowerCase()===v||v.includes(t.name.toLowerCase()));
 return hit?.abbr||value;
}
function priorityLabel(n:number){return n===1?"CORE":n===2?"WATCH":"DEEP WATCH"}

export default function FantasyCommandCenter(){
 const supabase=getSupabase();
 const [players,setPlayers]=useState<Watched[]>([]);
 const [snap,setSnap]=useState<any>({games:[],injuries:[]});
 const [status,setStatus]=useState("");
 const [loading,setLoading]=useState(true);

 async function load(){
  const [{data:{session}},snapshot]=await Promise.all([
   supabase.auth.getSession(),
   fetch("/api/personalization/snapshot").then(r=>r.json()).catch(()=>({games:[],injuries:[]}))
  ]);
  setSnap(snapshot||{games:[],injuries:[]});
  if(session?.user){
   const {data}=await supabase.from("saved_players").select("player_id,player_name,team,position,fantasy_priority,fantasy_note").eq("user_id",session.user.id);
   setPlayers((data||[]).map((p:any)=>({id:p.player_id,name:p.player_name,team:p.team,position:p.position,priority:p.fantasy_priority??2,note:p.fantasy_note||""})));
  }else{
   try{
    const local=JSON.parse(localStorage.getItem("fourthdown:savedPlayers")||"[]");
    setPlayers(local.map((p:any)=>({id:p.id,name:p.name,team:p.team,position:p.position,priority:p.fantasyPriority??2,note:p.fantasyNote||""})));
   }catch{setPlayers([])}
  }
  setLoading(false);
 }

 useEffect(()=>{load();const fn=()=>load();window.addEventListener("fourthdown:savedPlayers",fn);return()=>window.removeEventListener("fourthdown:savedPlayers",fn)},[]);

 const enriched=useMemo(()=>players.map(p=>{
   const abbr=teamAbbr(p.team);
   const game=(snap.games||[]).find((g:any)=>g.home===abbr||g.away===abbr);
   const injury=(snap.injuries||[]).find((i:any)=>String(i.playerId)===String(p.id));
   const opponent=game?(game.home===abbr?game.away:game.home):"";
   let signal="NO GAME",reason="No current-week matchup found in the prototype feed.";
   if(game){signal="READY";reason=[opponent&&"vs "+opponent,game.day,game.time,game.status].filter(Boolean).join(" · ")}
   if(injury){signal="WATCH";reason=[injury.status,injury.detail].filter(Boolean).join(" · ")||"Injury update available"}
   return {...p,abbr,game,injury,opponent,signal,reason};
 }).sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name)),[players,snap]);

 async function saveMeta(id:string,patch:Partial<Watched>){
  const next=players.map(p=>p.id===id?{...p,...patch}:p);setPlayers(next);
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.user){
   const row=next.find(p=>p.id===id)!;
   const {error}=await supabase.from("saved_players").update({fantasy_priority:row.priority,fantasy_note:row.note}).eq("user_id",session.user.id).eq("player_id",id);
   setStatus(error?error.message:"Watchlist saved ✓");
  }else{
   try{
    const local=JSON.parse(localStorage.getItem("fourthdown:savedPlayers")||"[]");
    const row=next.find(p=>p.id===id)!;
    localStorage.setItem("fourthdown:savedPlayers",JSON.stringify(local.map((p:any)=>p.id===id?{...p,fantasyPriority:row.priority,fantasyNote:row.note}:p)));
    setStatus("Saved on this device ✓");
   }catch{}
  }
 }

 if(loading)return <section className="panel"><p className="muted">Building your fantasy watchlist…</p></section>;
 if(!enriched.length)return <section className="panel fantasyCommand"><span className="kicker">MY WATCHLIST · V16</span><h2>Fantasy Command Center</h2><div className="emptyState"><strong>No watched players yet.</strong><p>Save players from any player profile and they will appear here with matchup and availability context.</p><Link className="btn" href="/stats">BROWSE PLAYERS →</Link></div></section>;

 return <section className="panel fantasyCommand">
   <div className="sectionTitle"><div><span className="kicker">MY WATCHLIST · V16</span><h2>Fantasy Command Center</h2></div><span className="muted">{enriched.length} watched</span></div>
   <p className="accountNote">Signals are transparent availability/matchup context from the prototype feed—not projected fantasy points or betting advice.</p>
   <div className="fantasyWatchGrid">
   {enriched.map(p=><article className="fantasyWatchCard" key={p.id}>
     <div className="fantasyWatchTop"><span className={"fantasySignal "+p.signal.toLowerCase().replace(" ","-")}>{p.signal}</span><select value={p.priority} onChange={e=>saveMeta(p.id,{priority:Number(e.target.value)})}><option value={1}>1 · Core</option><option value={2}>2 · Watch</option><option value={3}>3 · Deep Watch</option></select></div>
     <Link href={"/players/"+p.id}><strong>{p.name}</strong></Link>
     <small>{[p.position,p.abbr,priorityLabel(p.priority)].filter(Boolean).join(" · ")}</small>
     <p>{p.reason}</p>
     <input value={p.note} onChange={e=>setPlayers(v=>v.map(x=>x.id===p.id?{...x,note:e.target.value}:x))} onBlur={e=>saveMeta(p.id,{note:e.target.value})} placeholder="Add fantasy note…"/>
   </article>)}
   </div>
   {status&&<p className="cloudStatus">{status}</p>}
 </section>;
}