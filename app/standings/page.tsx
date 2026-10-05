import type {Metadata} from "next";import {getLiveStandings} from "@/lib/live-nfl";
export const metadata:Metadata={title:"Standings & Playoffs"};export const revalidate=300;
export default async function Page(){
 const live=await getLiveStandings();
 const afc=live.rows.filter(r=>r.conference.includes("AFC"));const nfc=live.rows.filter(r=>r.conference.includes("NFC"));
 const Table=({rows}:{rows:typeof live.rows})=><div className="standingsWrap"><table className="standingsTable"><thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>Streak</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.abbr+r.division+i}><td><b>{r.abbr}</b> {r.team}<small>{r.division}</small></td><td>{r.wins}</td><td>{r.losses}</td><td>{r.ties}</td><td>{r.pct}</td><td>{r.streak}</td></tr>)}</tbody></table></div>;
 return <section className="page"><div className="pageHead"><span className="kicker">STANDINGS · V7</span><h1>Standings & Playoffs</h1><p className="muted">Conference and division records from the FourthDown live-data layer.</p></div>
 {live.ok?<><div className="liveDataFlag">LIVE PROTOTYPE FEED · Server cached for 5 minutes</div><div className="standingsGrid"><article className="panel"><h2>AFC</h2><Table rows={afc}/></article><article className="panel"><h2>NFC</h2><Table rows={nfc}/></article></div></>:<div className="demoFlag">The live standings feed is temporarily unavailable. FourthDown will retry automatically.</div>}
 </section>
}