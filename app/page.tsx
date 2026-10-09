import Link from 'next/link';
import HomeSlideshow from '@/components/HomeSlideshow';
import {getLiveScoreboard,getLiveStandings,getLeagueLeaders,getTeamRoster} from '@/lib/live-nfl';
import {getHomeNews} from '@/lib/home-news';
import HomeDashboard,{ClubLogo} from '@/components/HomeDashboard';
import FavoritesPanel from '@/components/FavoritesPanel';
import SavedPlayersPanel from '@/components/SavedPlayersPanel';
import PersonalizedFeed from '@/components/PersonalizedFeed';
import './home.css';
export const revalidate=60;
export default async function Home(){
 const [board,standings,leaders,stories]=await Promise.all([getLiveScoreboard(),getLiveStandings(),getLeagueLeaders(),getHomeNews()]);
 const featured=board.games.find(g=>g.phase==='in')||board.games.find(g=>g.phase==='pre')||board.games[0];
 const rosters=featured?await Promise.all([getTeamRoster(featured.away),getTeamRoster(featured.home)]):[];
 const portraits=rosters.map(r=>r.players.find(p=>p.position==='QB'&&p.headshot));
 const top=stories[0];
 return <main className="hd-home">
  <div className="hd-masthead"><span>EVERYTHING NFL. NOTHING ELSE.</span><span>SCORES / STORIES / INSIGHT</span></div>
  <section className="hd-hero-grid">
   <HomeSlideshow games={board.games} stories={stories} featuredId={featured?.id}>
   <article className="hd-matchup">
    <div className="hd-stadium" aria-hidden="true"/>
    {portraits.map((p,i)=>p&&<img key={i} className={`hd-portrait hd-portrait-${i}`} src={p.headshot} alt={`${p.name}, ${i===0?featured?.awayName:featured?.homeName}`} />)}
    <div className="hd-match-content"><div className="hd-match-meta"><span className="hd-badge">{featured?.phase==='in'?'LIVE NOW':featured?.phase==='post'?'FINAL':'FEATURED MATCHUP'}</span><span>{featured?.venue||'YOUR FOOTBALL HEADQUARTERS'}</span></div>
    {featured?<><div className="hd-scoreboard"><div><ClubLogo abbr={featured.away}/><h1>{featured.away}</h1><small>{featured.awayRecord}</small></div><div className="hd-score-center">{featured.phase==='pre'?<strong className="hd-versus">VS</strong>:<strong>{featured.awayScore??'–'}<i>:</i>{featured.homeScore??'–'}</strong>}<span>{featured.status}</span><small>{featured.phase==='pre'?`${featured.day} · ${featured.time}`:featured.network}</small></div><div><ClubLogo abbr={featured.home}/><h2>{featured.home}</h2><small>{featured.homeRecord}</small></div></div><div className="hd-hero-actions"><Link className="btn" href={`/games/${featured.id}`}>GAME CENTER →</Link><Link className="btn secondary" href="/scores">FULL SCHEDULE</Link></div></>:<div className="hd-no-game"><h1>THE GAME.<br/>ALL OF IT.</h1><p>{board.ok?'No games on the current scoreboard. Explore the league.':'The scoreboard is temporarily unavailable.'}</p><Link className="btn" href="/teams">EXPLORE TEAMS →</Link></div>}
    </div>
   </article>
   </HomeSlideshow>
   <article className="hd-top-story" style={top?.image?{backgroundImage:`linear-gradient(0deg,#030d12 6%,#030d1299 75%),url("${top.image.replace(/["\\\n\r]/g,'')}")`}:undefined}><span className="hd-badge">{top?'TOP STORY':'MY FOURTHDOWN'}</span><h2>{top?.title||'Your teams. Your players. Your game.'}</h2><p>{top?'The latest from around the league.':'Save your favorites and get game and injury updates in your inbox.'}</p>{top?<a href={top.url} target="_blank" rel="noopener noreferrer">Read on ESPN ↗</a>:<Link href="/account">Personalize your feed →</Link>}</article>
   <aside className="hd-news-list" aria-label="Latest NFL stories">{stories.slice(1,5).map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.image&&<img src={s.image} alt=""/>}<span><strong>{s.title}</strong><small>ESPN · NFL</small></span></a>)}{!stories.length&&<><h2>Around the league</h2><p>News feed temporarily unavailable.</p><Link href="/injuries">Injury watch →</Link><Link href="/stats">Player leaders →</Link><Link href="/notifications">Your alerts →</Link></>}</aside>
  </section>
  <section className="hd-scores"><div className="hd-section-head"><h2>NFL scoreboard</h2><span className="hd-caption">CURRENT SCHEDULE · ALL TIMES ET</span><Link href="/scores">Full schedule →</Link></div><div className="hd-score-strip">{board.games.map(g=><Link href={`/games/${g.id}`} className={`hd-score-card ${g.phase==='in'?'is-live':''}`} key={g.id}><small>{g.phase==='pre'?`${g.day} ${g.time}`:g.status}</small><div><ClubLogo abbr={g.away}/><span>{g.away}</span><b>{g.phase==='pre'?'':g.awayScore??'–'}</b></div><div><ClubLogo abbr={g.home}/><span>{g.home}</span><b>{g.phase==='pre'?'':g.homeScore??'–'}</b></div><em>{g.network}</em></Link>)}</div>{!board.games.length&&<p className="hd-empty">{board.ok?'No games listed in the current schedule.':'Scoreboard temporarily unavailable.'}</p>}</section>
  <HomeDashboard rows={standings.rows} groups={leaders.groups}/>
  <section className="hd-bottom"><div><div className="hd-section-head"><h2>Analytics center</h2><Link href="/analytics">Explore →</Link></div><div className="hd-feature-grid"><Link href="/analytics"><b>▥</b><span><strong>Team performance</strong><small>Records and strength signals</small></span></Link><Link href="/scores"><b>↗</b><span><strong>Matchup center</strong><small>Scores and game context</small></span></Link><Link href="/standings"><b>≡</b><span><strong>Conference race</strong><small>Follow the standings</small></span></Link></div></div><div><div className="hd-section-head"><h2>Fantasy watch</h2><Link href="/fantasy">Fantasy hub →</Link></div><div className="hd-feature-grid"><Link href="/stats"><b>↑</b><span><strong>Player leaders</strong><small>Find standout performers</small></span></Link><Link href="/account"><b>☆</b><span><strong>Your watchlist</strong><small>Track saved players</small></span></Link><Link href="/injuries"><b>+</b><span><strong>Injury report</strong><small>Latest availability</small></span></Link></div></div></section>
  <div className="hd-personal"><PersonalizedFeed/><FavoritesPanel/><SavedPlayersPanel/></div>
  <p className="hd-data-note">Scores, standings and player data: ESPN public feeds. News links open the original publisher. Availability and update timing vary.</p>
 </main>;
}
