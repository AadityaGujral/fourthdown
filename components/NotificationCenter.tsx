"use client";
import Link from "next/link";import {useEffect,useState} from "react";import {getSupabase} from "@/lib/supabase";import {teams} from "@/lib/teams";
function resolveTeam(value:string){const v=(value||"").toLowerCase();return teams.find(t=>t.abbr.toLowerCase()===v||t.name.toLowerCase()===v||v.includes(t.name.toLowerCase()))?.abbr||value}
export default function NotificationCenter(){
 const supabase=getSupabase();const [items,setItems]=useState<any[]>([]);const [loading,setLoading]=useState(true);
 async function load(){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.user){setItems([]);setLoading(false);return}
  const uid=session.user.id;
  const [{data:favs},{data:players},{data:prefs},snap]=await Promise.all([
   supabase.from("favorite_teams").select("team_slug").eq("user_id",uid),
   supabase.from("saved_players").select("player_id,player_name,team,position,fantasy_priority").eq("user_id",uid),
   supabase.from("notification_preferences").select("*").eq("user_id",uid).maybeSingle(),
   fetch("/api/personalization/snapshot").then(r=>r.json()).catch(()=>({games:[],injuries:[]}))
  ]);
  const favTeams=teams.filter(t=>(favs||[]).some((f:any)=>f.team_slug===t.slug));const favAbbr=new Set(favTeams.map(t=>t.abbr));const savedIds=new Set((players||[]).map((p:any)=>p.player_id));const inserts:any[]=[];
  if(prefs?.game_alerts!==false)for(const g of snap.games||[]){if(favAbbr.has(g.away)||favAbbr.has(g.home))inserts.push({user_id:uid,kind:"game",title:g.away+" vs "+g.home,body:g.status+" · "+g.day+" "+g.time+" · "+g.network,href:"/games/"+g.id,dedupe_key:"game:"+g.id+":"+g.status})}
  if(prefs?.injury_alerts!==false)for(const i of snap.injuries||[]){if(savedIds.has(i.playerId))inserts.push({user_id:uid,kind:"injury",title:i.name+" injury update",body:[i.team,i.position,i.status,i.detail].filter(Boolean).join(" · "),href:"/players/"+i.playerId,dedupe_key:"injury:"+i.playerId+":"+i.status+":"+i.detail})}
  if(prefs?.fantasy_alerts===true)for(const p of players||[]){
    const abbr=resolveTeam(p.team);const g=(snap.games||[]).find((x:any)=>x.home===abbr||x.away===abbr);if(!g)continue;
    const injury=(snap.injuries||[]).find((i:any)=>String(i.playerId)===String(p.player_id));
    const opp=g.home===abbr?g.away:g.home;const site=g.home===abbr?"vs":"@";const priority=p.fantasy_priority===1?"CORE":p.fantasy_priority===3?"DEEP WATCH":"WATCH";
    const health=injury?[injury.status,injury.detail].filter(Boolean).join(" · "):"No current injury flag";
    inserts.push({user_id:uid,kind:"fantasy",title:p.player_name+" fantasy watch",body:[priority,abbr+" "+site+" "+opp,g.day+" "+g.time,g.status,health].filter(Boolean).join(" · "),href:"/players/"+p.player_id,dedupe_key:"fantasy:"+p.player_id+":"+g.id+":"+g.status+":"+(injury?.status||"clear")})
  }
  if(inserts.length)await supabase.from("notifications").upsert(inserts,{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});
  const {data}=await supabase.from("notifications").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(50);setItems(data||[]);setLoading(false)
 }
 useEffect(()=>{load();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>load());return()=>subscription.unsubscribe()},[]);
 async function markRead(id:number){await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id);setItems(v=>v.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x))}
 async function markAll(){const {data:{session}}=await supabase.auth.getSession();if(!session?.user)return;const now=new Date().toISOString();await supabase.from("notifications").update({read_at:now}).eq("user_id",session.user.id).is("read_at",null);setItems(v=>v.map(x=>({...x,read_at:x.read_at||now})))}
 if(loading)return <p className="muted">Loading notifications…</p>;
 if(!items.length)return <div className="emptyState"><strong>No alerts yet.</strong><p>Favorite a team or save a player, then FourthDown will surface relevant game, injury and fantasy-watch alerts here.</p></div>;
 const unread=items.filter(x=>!x.read_at).length;
 return <><div className="notificationToolbar"><span>{unread} unread</span>{unread>0&&<button onClick={markAll}>MARK ALL READ</button>}</div><div className="notificationList">{items.map(n=><article className={n.read_at?"notificationItem":"notificationItem unread"} key={n.id} onClick={()=>!n.read_at&&markRead(n.id)}><div><span className={"notificationKind "+n.kind}>{n.kind.toUpperCase()}</span><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></div>{n.href&&<Link href={n.href}>OPEN →</Link>}</article>)}</div></>
}