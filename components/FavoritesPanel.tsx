"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {teams} from "@/lib/teams";

const KEY="fourthdown:favorites";
export default function FavoritesPanel(){
  const [slugs,setSlugs]=useState<string[]>([]);
  useEffect(()=>{
    const load=()=>{try{setSlugs(JSON.parse(localStorage.getItem(KEY)||"[]"))}catch{setSlugs([])}};
    load();window.addEventListener("fourthdown:favorites",load);return()=>window.removeEventListener("fourthdown:favorites",load);
  },[]);
  const favs=teams.filter(t=>slugs.includes(t.slug));
  return <section className="page personalize">
    <div className="sectionTitle"><div><span className="kicker">PERSONALIZED</span><h2>My Teams</h2></div><Link href="/teams">EDIT FAVORITES →</Link></div>
    {favs.length?<div className="favoriteGrid">{favs.map(t=><Link className="favoriteCard" href={"/teams/"+t.slug} key={t.slug}><b>{t.abbr}</b><span>{t.name}</span><small>{t.division}</small></Link>)}</div>:<div className="emptyState"><strong>Your FourthDown feed starts here.</strong><p>Open any team page and tap Favorite. Your teams stay saved on this device.</p><Link className="btn" href="/teams">CHOOSE A TEAM →</Link></div>}
  </section>
}