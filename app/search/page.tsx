import Link from "next/link";
import {teams} from "@/lib/teams";
import type {Metadata} from "next";

export const metadata:Metadata={title:"Search"};
const sections=[["Scores","/scores"],["News","/news"],["Teams","/teams"],["Stats","/stats"],["Standings","/standings"],["Analytics","/analytics"],["Fantasy","/fantasy"]];
export default async function Search({searchParams}:{searchParams:Promise<{q?:string}>}){
  const {q=""}=await searchParams;const term=q.trim().toLowerCase();
  const teamResults=term?teams.filter(t=>(t.name+" "+t.abbr+" "+t.division).toLowerCase().includes(term)):[];
  const sectionResults=term?sections.filter(([n])=>n.toLowerCase().includes(term)):[];
  return <section className="page"><div className="pageHead"><span className="kicker">GLOBAL SEARCH</span><h1>{q?"Results for “"+q+"”":"Search FourthDown"}</h1><form action="/search" className="searchPageForm"><input name="q" defaultValue={q} placeholder="Team, abbreviation, division or section"/><button className="btn">SEARCH</button></form></div>
  {!term?<div className="notice">Try “Jets”, “AFC East”, “analytics” or “stats”.</div>:<div className="searchResults">
    {teamResults.map(t=><Link className="teamCard" href={"/teams/"+t.slug} key={t.slug}><b>{t.abbr}</b><span>{t.name}</span><small>{t.division}</small></Link>)}
    {sectionResults.map(([n,h])=><Link className="card" href={h} key={h}><span className="kicker">SECTION</span><h3>{n}</h3><p>Open FourthDown {n.toLowerCase()}.</p></Link>)}
    {!teamResults.length&&!sectionResults.length&&<div className="emptyState"><strong>No results found.</strong><p>Try a team name, abbreviation, division or FourthDown section.</p></div>}
  </div>}
  </section>
}