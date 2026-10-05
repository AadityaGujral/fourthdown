import type {Metadata} from "next";import {games as demoGames} from "@/lib/games";import {GameCard} from "@/components/GameCard";import {getLiveScoreboard} from "@/lib/live-nfl";
export const metadata:Metadata={title:"Scores & Game Center"};export const revalidate=60;
export default async function Scores(){
  const live=await getLiveScoreboard();const games=live.ok&&live.games.length?live.games:demoGames;
  return <section className="page"><div className="pageHead"><span className="kicker">GAME CENTER · V7</span><h1>Live NFL Scores</h1><p className="muted">Current games and schedule data refresh automatically on the server.</p></div>
  <div className={live.ok?"liveDataFlag":"demoFlag"}>{live.ok?`LIVE PROTOTYPE FEED · Updated ${new Date(live.updatedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"})} ET`:"LIVE FEED TEMPORARILY UNAVAILABLE · Showing FourthDown fallback data."}</div>
  <div className="gameGrid">{games.map(g=><GameCard key={g.id} g={g}/>)}</div></section>
}