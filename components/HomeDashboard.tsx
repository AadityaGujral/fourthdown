'use client';
import {useState} from 'react';
import Link from 'next/link';
import {teams} from '@/lib/teams';
import type {StandingRow} from '@/lib/live-nfl';
export function ClubLogo({abbr}:{abbr:string}) {
 const code=({ARZ:'ari',WAS:'wsh'} as Record<string,string>)[abbr]||abbr.toLowerCase();
 const [failed,setFailed]=useState(false);
 return failed?<span className="hd-logo-fallback">{abbr}</span>:<img className="hd-club-logo" src={`https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png`} alt={abbr} onError={()=>setFailed(true)}/>;
}
export default function HomeDashboard({rows,groups}:{rows:StandingRow[];groups:{name:string;leaders:{id:string;name:string;team:string;value:string}[]}[]}) {
 const [conference,setConference]=useState('AFC'); const [category,setCategory]=useState(0);
 const sorted=rows.map(r=>{const team=teams.find(t=>t.abbr===r.abbr);return {...r,conference:team?.division.slice(0,3)||r.conference,division:team?.division||r.division}}).sort((a,b)=>(Number(b.pct)||0)-(Number(a.pct)||0)||Number(b.wins)-Number(a.wins));
 const conferenceRows=sorted.filter(r=>r.conference.includes(conference));
 const division=conferenceRows.find(r=>/East/.test(r.division))?.division||conferenceRows[0]?.division;
 const divisionRows=conferenceRows.filter(r=>r.division===division);
 const power=rows.map(r=>({...r,index:Math.max(0,Math.min(100,Math.round((Number(r.pct)||0)*80+10+(Number(r.wins)-Number(r.losses))*1.5)))})).sort((a,b)=>b.index-a.index);
 const current=groups[category];
 return <section className="hd-panels">
  <article className="hd-panel"><div className="hd-section-head"><h2>Standings</h2><Link href="/standings">Full standings ↗</Link></div><div className="hd-tabs" aria-label="Conference">{['AFC','NFC'].map(c=><button key={c} aria-pressed={conference===c} onClick={()=>setConference(c)}>{c}</button>)}</div><p className="hd-caption">{division||'Conference standings'}</p><table><thead><tr><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">PCT</th></tr></thead><tbody>{divisionRows.map(r=><tr key={r.abbr}><td><ClubLogo abbr={r.abbr}/><span>{r.team}</span></td><td>{r.wins}</td><td>{r.losses}</td><td>{r.pct}</td></tr>)}</tbody></table>{!rows.length&&<p className="hd-empty">Standings temporarily unavailable.</p>}<Link className="hd-panel-link" href="/teams">Explore all 32 teams →</Link></article>
  <article className="hd-panel hd-race"><div className="hd-section-head"><h2>Playoff race</h2><Link href="/standings">View all ↗</Link></div><p className="hd-caption">{conference} · WIN-PERCENTAGE ORDER</p>{conferenceRows.slice(0,7).map((r,i)=><div className="hd-rank-row" key={r.abbr}><span className="hd-rank">{i+1}</span><ClubLogo abbr={r.abbr}/><strong>{r.team.replace(/^(New York|Los Angeles|[A-Za-z]+) /,'')}</strong><span>{r.wins}–{r.losses}</span></div>)}<p className="hd-footnote">Record snapshot, not official playoff seeds. NFL tiebreakers are not applied.</p></article>
  <article className="hd-panel"><div className="hd-section-head"><h2>Stat leaders</h2><Link href="/stats">All stats ↗</Link></div><div className="hd-tabs hd-stat-tabs">{groups.slice(0,4).map((g,i)=><button aria-pressed={i===category} onClick={()=>setCategory(i)} key={g.name}>{g.name}</button>)}</div>{current?.leaders.map((p,i)=><Link className="hd-player-row" href={p.id?`/players/${p.id}`:'/stats'} key={p.id+i}><span className="hd-rank">{i+1}</span><span><strong>{p.name}</strong><small>{p.team}</small></span><b>{p.value}</b></Link>)}{!groups.length&&<p className="hd-empty">Player stats temporarily unavailable. Check the stats hub shortly.</p>}<p className="hd-footnote">League leaders · ESPN data</p></article>
  <article className="hd-panel"><div className="hd-section-head"><h2>Power index</h2><Link href="/analytics">Method ↗</Link></div><p className="hd-caption"># &nbsp; TEAM <span>INDEX</span></p>{power.slice(0,7).map((r,i)=><div className="hd-rank-row" key={r.abbr}><span className="hd-rank">{i+1}</span><ClubLogo abbr={r.abbr}/><strong>{r.abbr}</strong><span>{r.index}</span></div>)}<p className="hd-footnote">FourthDown’s record-based index. Not a prediction.</p></article>
 </section>;
}
