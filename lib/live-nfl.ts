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

export type LivePlay={id:string;clock:string;period:number;text:string;team:string;scoring:boolean;scoreValue:number};
export type RosterPlayer={id:string;name:string;shortName:string;position:string;jersey:string;experience:string;status:string;headshot:string};
export type InjuryRow={playerId:string;name:string;position:string;status:string;detail:string};
export type PlayerProfile={id:string;name:string;displayName:string;position:string;team:string;jersey:string;height:string;weight:string;age:string;experience:string;college:string;headshot:string;status:string};

export async function getGameSummary(eventId:string):Promise<{plays:LivePlay[];leaders:any[];injuries:InjuryRow[];ok:boolean}>{
  try{
    const res=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${encodeURIComponent(eventId)}`,{next:{revalidate:30}});
    if(!res.ok) throw new Error("summary "+res.status);
    const data:any=await res.json();
    const plays:LivePlay[]=(data.plays||[]).slice(-40).reverse().map((p:any)=>({
      id:String(p.id||p.sequenceNumber||Math.random()),clock:p.clock?.displayValue||"",period:Number(p.period?.number||0),
      text:p.text||p.shortText||"Play",team:p.team?.abbreviation||"",scoring:Boolean(p.scoringPlay),scoreValue:Number(p.scoreValue||0)
    }));
    const leaders=(data.leaders||[]).flatMap((group:any)=>(group.leaders||[]).slice(0,3).map((l:any)=>({
      category:group.displayName||group.name||"Leader",name:l.athlete?.displayName||"",id:String(l.athlete?.id||""),
      value:l.displayValue||l.value||"",team:l.team?.abbreviation||""
    })));
    const injuries:InjuryRow[]=(data.injuries||[]).flatMap((team:any)=>(team.injuries||[]).map((i:any)=>({
      playerId:String(i.athlete?.id||""),name:i.athlete?.displayName||"",position:i.athlete?.position?.abbreviation||"",
      status:i.status||i.type?.description||"",detail:i.details?.detail||i.details?.type||""
    })));
    return {plays,leaders,injuries,ok:true};
  }catch{return {plays:[],leaders:[],injuries:[],ok:false}}
}

export async function getTeamRoster(abbr:string):Promise<{players:RosterPlayer[];ok:boolean}>{
  try{
    const res=await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr.toLowerCase()}/roster`,{next:{revalidate:1800}});
    if(!res.ok) throw new Error("roster "+res.status);
    const data:any=await res.json();
    const groups=data.athletes||[];
    const players:RosterPlayer[]=groups.flatMap((g:any)=>(g.items||[]).map((a:any)=>({
      id:String(a.id||""),name:a.fullName||a.displayName||"",shortName:a.shortName||a.displayName||"",
      position:a.position?.abbreviation||g.position||"",jersey:String(a.jersey||""),experience:a.experience?.displayValue||"",
      status:a.status?.name||a.status?.type||"Active",headshot:a.headshot?.href||""
    })));
    return {players,ok:players.length>0};
  }catch{return {players:[],ok:false}}
}

export async function getPlayerProfile(id:string):Promise<{player:PlayerProfile|null;ok:boolean}>{
  try{
    const res=await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${encodeURIComponent(id)}`,{next:{revalidate:3600}});
    if(!res.ok) throw new Error("athlete "+res.status);
    const d:any=await res.json();const a=d.athlete||d;
    const player:PlayerProfile={id:String(a.id||id),name:a.fullName||a.displayName||"NFL Player",displayName:a.displayName||a.fullName||"NFL Player",
      position:a.position?.displayName||a.position?.abbreviation||"",team:a.team?.displayName||a.team?.name||"",jersey:String(a.jersey||""),
      height:a.displayHeight||"",weight:a.displayWeight||"",age:String(a.age||""),experience:a.experience?.displayValue||"",
      college:a.college?.name||"",headshot:a.headshot?.href||"",status:a.status?.name||a.status?.type||""};
    return {player,ok:true};
  }catch{return {player:null,ok:false}}
}

export async function getLeagueLeaders():Promise<{groups:{name:string;leaders:{id:string;name:string;team:string;value:string}[]}[];ok:boolean}>{
  try{
    const res=await fetch("https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders",{next:{revalidate:900}});
    if(!res.ok) throw new Error("leaders "+res.status);
    const d:any=await res.json();
    const groups=(d.leaders||d.categories||[]).slice(0,8).map((g:any)=>({
      name:g.displayName||g.name||"Leader",
      leaders:(g.leaders||[]).slice(0,5).map((l:any)=>({id:String(l.athlete?.id||""),name:l.athlete?.displayName||"",team:l.team?.abbreviation||"",value:String(l.displayValue||l.value||"")}))
    })).filter((g:any)=>g.leaders.length);
    return {groups,ok:groups.length>0};
  }catch{return {groups:[],ok:false}}
}