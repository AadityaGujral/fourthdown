import {createClient} from "@supabase/supabase-js";
import {getLiveScoreboard,getLeagueInjuryWatch} from "@/lib/live-nfl";
import {teams} from "@/lib/teams";

function esc(v:any){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}
async function sendEmail(to:string,subject:string,html:string){
 const apiKey=process.env.RESEND_API_KEY;if(!apiKey) throw new Error("RESEND_API_KEY is not configured");
 const from=process.env.RESEND_FROM_EMAIL||"FourthDown <onboarding@resend.dev>";
 const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
 const data=await res.json();if(!res.ok) throw new Error(data?.message||("Resend "+res.status));return data;
}
async function rest(path:string,token:string,init?:RequestInit){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) throw new Error("Supabase not configured");
 const res=await fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})}});
 if(!res.ok) throw new Error("Supabase REST "+res.status+": "+await res.text());
 const text=await res.text();return text?JSON.parse(text):[];
}
export async function POST(req:Request){
 try{
  const auth=req.headers.get("authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  if(!token)return Response.json({ok:false,error:"Unauthorized"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return Response.json({ok:false,error:"Supabase not configured"},{status:500});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user?.email)return Response.json({ok:false,error:"Invalid session"},{status:401});
  const uid=user.id;
  const [favs,players,prefsRows,board,injuryWatch]=await Promise.all([
    rest("favorite_teams?select=team_slug&user_id=eq."+encodeURIComponent(uid),token),
    rest("saved_players?select=player_id,player_name,team,position&user_id=eq."+encodeURIComponent(uid),token),
    rest("notification_preferences?select=*&user_id=eq."+encodeURIComponent(uid)+"&limit=1",token),
    getLiveScoreboard(),getLeagueInjuryWatch()
  ]);
  const prefs=prefsRows?.[0]||null;
  const favAbbr=new Set<string>(teams.filter(t=>(favs||[]).some((f:any)=>f.team_slug===t.slug)).map(t=>t.abbr));
  const savedIds=new Set((players||[]).map((p:any)=>String(p.player_id)));
  const candidates:any[]=[];
  if(prefs?.game_alerts!==false)for(const g of board.games||[]){if(favAbbr.has(g.away)||favAbbr.has(g.home))candidates.push({kind:"game",dedupe_key:"email:game:"+g.id+":"+g.status,subject:"FourthDown: "+g.away+" vs "+g.home,html:`<div style="font-family:Arial;background:#0b0e13;color:#fff;padding:28px"><h1 style="margin:0 0 8px">FourthDown</h1><p style="color:#ef3340;font-weight:700">GAME ALERT</p><h2>${esc(g.away)} vs ${esc(g.home)}</h2><p>${esc(g.status)} · ${esc(g.day)} ${esc(g.time)} · ${esc(g.network)}</p><p style="color:#9aa3af">Independent football intelligence. Not affiliated with or endorsed by the NFL.</p></div>`})}
  if(prefs?.injury_alerts!==false)for(const i of injuryWatch.rows||[]){if(savedIds.has(String(i.playerId)))candidates.push({kind:"injury",dedupe_key:"email:injury:"+i.playerId+":"+i.status+":"+i.detail,subject:"FourthDown injury update: "+i.name,html:`<div style="font-family:Arial;background:#0b0e13;color:#fff;padding:28px"><h1 style="margin:0 0 8px">FourthDown</h1><p style="color:#ffb612;font-weight:700">INJURY ALERT</p><h2>${esc(i.name)}</h2><p>${esc([i.team,i.position,i.status,i.detail].filter(Boolean).join(" · "))}</p><p style="color:#9aa3af">Check FourthDown for the latest player context.</p></div>`})}
  let sent=0,skipped=0,failed=0;const errors:string[]=[];
  for(const c of candidates.slice(0,8)){
    const existing=await rest("email_deliveries?select=id&user_id=eq."+encodeURIComponent(uid)+"&dedupe_key=eq."+encodeURIComponent(c.dedupe_key)+"&limit=1",token);
    if(existing?.length){skipped++;continue}
    try{
      const out=await sendEmail(user.email,c.subject,c.html);
      await rest("email_deliveries",token,{method:"POST",body:JSON.stringify({user_id:uid,kind:c.kind,dedupe_key:c.dedupe_key,recipient:user.email,provider_id:out?.id||null,status:"sent"})});
      sent++;
    }catch(e:any){failed++;errors.push(e?.message||"send failed")}
  }
  return Response.json({ok:true,sent,skipped,failed,candidates:candidates.length,favorites:favs?.length||0,savedPlayers:players?.length||0,gameAlerts:prefs?.game_alerts!==false,injuryAlerts:prefs?.injury_alerts!==false,sender:process.env.RESEND_FROM_EMAIL?"verified-domain":"resend-onboarding",errors});
 }catch(e:any){return Response.json({ok:false,error:e?.message||"Email dispatch failed"},{status:500})}
}