"use client";
import Link from "next/link";
import {useState} from "react";
import {teams} from "@/lib/teams";

const items=[["Home","/"],["Scores","/scores"],["News","/news"],["Teams","/teams"],["Stats","/stats"],["Standings","/standings"],["Analytics","/analytics"],["Fantasy","/fantasy"]];
export default function HeaderClient(){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const matches=q.trim()?teams.filter(t=>(t.name+" "+t.abbr+" "+t.division).toLowerCase().includes(q.toLowerCase())).slice(0,5):[];
  return <header className="header">
    <Link className="logo" href="/"><b>4</b>FOURTHDOWN</Link>
    <nav className={open?"navOpen":""}>{items.map(([n,h])=><Link key={h} href={h} onClick={()=>setOpen(false)}>{n}</Link>)}</nav>
    <div className="headerTools">
      <form action="/search" className="searchBox">
        <input name="q" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search teams…" aria-label="Search FourthDown"/>
        {matches.length>0&&<div className="searchSuggest">{matches.map(t=><Link key={t.slug} href={"/teams/"+t.slug} onClick={()=>setQ("")}><b>{t.abbr}</b><span>{t.name}</span></Link>)}</div>}
      </form>
      <span className="live">● LIVE</span>
      <button className="menuBtn" onClick={()=>setOpen(v=>!v)} aria-label="Toggle navigation" aria-expanded={open}>☰</button>
    </div>
  </header>
}