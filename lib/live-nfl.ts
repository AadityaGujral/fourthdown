export type LiveGame={
  id:string;away:string;awayName:string;home:string;homeName:string;time:string;day:string;network:string;status:string;
  awayRecord:string;homeRecord:string;awayScore:number|null;homeScore:number|null;venue:string;detail:string;source:"espn-public"
};
export type StandingRow={conference:string;division:string;team:string;abbr:string;wins:string;losses:string;ties:string;pct:string;streak:string};

const SCOREBOARD="https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const STANDINGS="https://site.api.espn.com/apis/v2/sports/football/nfl/standings";

function record(c:any){return c?.records?.find((r:any)=>r.type==="total")?.summary||c?.records?.[0]?.summary||""}
function teamAbbr(c:any){return c?.team?.abbreviation||c?.team?.shortDisplayName||"NFL"}

export async function getLiveScoreboard():Promise<{games:LiveGame[];updatedAt:string;ok:boolean}>{
  try{
    const res=await fetch(SCOREBOARD,{next:{revalidate:60}});
    if(!res.ok) throw new Error("scoreboard "+res.status);
    const data:any=await res.json();
    const games:LiveGame[]=(data.events||[]).map((e:any)=>{
      const comp=e.competitions?.[0]||{};
      const cs=comp.competitors||[];
      const home=cs.find((c:any)=>c.homeAway==="home")||cs[0]||{};
      const away=cs.find((c:any)=>c.homeAway==="away")||cs[1]||{};
      const date=new Date(e.date);
      const status=e.status?.type?.shortDetail||e.status?.type?.detail||"Scheduled";
      return {
        id:String(e.id),away:teamAbbr(away),awayName:away.team?.displayName||"Away",home:teamAbbr(home),homeName:home.team?.displayName||"Home",
        time:date.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})+" ET",
        day:date.toLocaleDateString("en-US",{weekday:"short",timeZone:"America/New_York"}).toUpperCase(),
        network:(comp.broadcasts?.[0]?.names||[]).join(" / ")||"NFL",
        status,awayRecord:record(away),homeRecord:record(home),
        awayScore:away.score==null?null:Number(away.score),homeScore:home.score==null?null:Number(home.score),
        venue:comp.venue?.fullName||"Venue TBA",detail:status,source:"espn-public" as const
      }
    });
    return {games,updatedAt:new Date().toISOString(),ok:true};
  }catch{return {games:[],updatedAt:new Date().toISOString(),ok:false}}
}

export async function getLiveStandings():Promise<{rows:StandingRow[];updatedAt:string;ok:boolean}>{
  try{
    const res=await fetch(STANDINGS,{next:{revalidate:300}});
    if(!res.ok) throw new Error("standings "+res.status);
    const data:any=await res.json();
    const rows:StandingRow[]=[];
    const walk=(node:any,conference="",division="")=>{
      const name=node?.name||node?.shortName||"";
      let conf=conference,div=division;
      if(/AFC|NFC/.test(name)&&!/North|South|East|West/.test(name)) conf=name;
      if(/North|South|East|West/.test(name)) div=name;
      const entries=node?.standings?.entries||[];
      for(const entry of entries){
        const stats:any={}; for(const s of entry.stats||[]) stats[s.name]=s.displayValue??s.value;
        rows.push({conference:conf,division:div,team:entry.team?.displayName||"",abbr:entry.team?.abbreviation||"",
          wins:String(stats.wins??""),losses:String(stats.losses??""),ties:String(stats.ties??"0"),
          pct:String(stats.winPercent??stats.winpercent??""),streak:String(stats.streak??"")});
      }
      for(const child of node?.children||[]) walk(child,conf,div);
    };
    for(const child of data.children||[]) walk(child);
    return {rows,updatedAt:new Date().toISOString(),ok:rows.length>0};
  }catch{return {rows:[],updatedAt:new Date().toISOString(),ok:false}}
}