import {createHash} from "node:crypto";
import {teams} from "./teams";
import type {LiveGame,InjuryRow} from "./live-nfl";
export type AlertEvent={kind:"game"|"injury";title:string;body:string;href:string;dedupe_key:string;team_slugs?:string[];player_id?:string};
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,32);
export function buildAlertEvents(games:LiveGame[],injuries:InjuryRow[],now=Date.now()):AlertEvent[]{
 const events:AlertEvent[]=[];
 for(const g of games){
  const start=Date.parse(g.startAt||"");
  if(!/^\d+$/.test(g.id)||!Number.isFinite(start)||start<now-24*3600000||start>now+24*3600000)continue;
  if(!["pre","in","post"].includes(g.phase||""))continue;
  const slugs=teams.filter(t=>t.abbr===g.home||t.abbr===g.away).map(t=>t.slug);if(!slugs.length)continue;
  const phase=g.phase==="post"?"Final":g.phase==="in"?"Live":"Upcoming";
  const score=g.phase==="pre"?"":` · ${g.away} ${g.awayScore??0}–${g.homeScore??0} ${g.home}`;
  events.push({kind:"game",title:`${g.away} vs ${g.home}`,body:`${phase}${score} · ${g.day} ${g.time} · ${g.network}`,href:`/games/${g.id}`,team_slugs:slugs,
   dedupe_key:`v16:game:${g.id}:${digest([g.phase,g.phase==="pre"?g.startAt:[g.awayScore,g.homeScore]])}`});
 }
 for(const i of injuries){
  if(!/^\d+$/.test(i.playerId)||!i.name||!i.status)continue;
  events.push({kind:"injury",title:`${i.name} injury update`.slice(0,200),body:[i.team,i.position,i.status,i.detail].filter(Boolean).join(" · ").slice(0,2000),href:`/players/${i.playerId}`,player_id:i.playerId,
   dedupe_key:`v16:injury:${i.playerId}:${digest([i.status.trim(),i.detail.trim()])}`});
 }
 return Array.from(new Map(events.map(e=>[e.dedupe_key,e])).values()).slice(0,100);
}
