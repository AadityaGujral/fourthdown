'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import type {LiveGame} from '@/lib/live-nfl';
import type {HomeStory} from '@/lib/home-news';
import {ClubLogo} from './HomeDashboard';
export default function HomeSlideshow({children,games,stories,featuredId}:{children:ReactNode;games:LiveGame[];stories:HomeStory[];featuredId?:string}) {
 const recent=games.filter(g=>g.phase==='post'&&g.id!==featuredId).sort((a,b)=>(b.startAt||'').localeCompare(a.startAt||'')).slice(0,3);
 const upcoming=games.filter(g=>g.phase==='pre'&&g.id!==featuredId).sort((a,b)=>(a.startAt||'').localeCompare(b.startAt||'')).slice(0,3);
 const slides:({kind:'featured';label:string}|{kind:'game';label:string;game:LiveGame}|{kind:'news';label:string;story:HomeStory})[]=[{kind:'featured',label:'Featured matchup'}];
 for(let i=0;i<3;i++){if(recent[i])slides.push({kind:'game',label:`Result: ${recent[i].away} at ${recent[i].home}`,game:recent[i]});if(upcoming[i])slides.push({kind:'game',label:`Upcoming: ${upcoming[i].away} at ${upcoming[i].home}`,game:upcoming[i]});if(stories[i])slides.push({kind:'news',label:stories[i].title,story:stories[i]});}
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hover,setHover]=useState(false),[reduced,setReduced]=useState(true),[hidden,setHidden]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const motion=()=>setReduced(media.matches);const visibility=()=>setHidden(document.hidden);motion();visibility();media.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility)}},[]);
 const count=slides.length,active=index%count,slide=slides[active];
 useEffect(()=>{if(paused||hover||reduced||hidden||count<2)return;const timer=setInterval(()=>setIndex(i=>(i+1)%count),2000);return()=>clearInterval(timer)},[paused,hover,reduced,hidden,count]);
 const move=(i:number)=>{setPaused(true);setIndex((i+count)%count)};
 return <section className="hd-slideshow" aria-label="NFL games and news slideshow" aria-roledescription="carousel" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setPaused(true)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();move(active+1)}if(e.key==='ArrowLeft'){e.preventDefault();move(active-1)}}}>
 <div className="hd-slide-stage" aria-live={paused||reduced?'polite':'off'}>
 <div role="group" aria-roledescription="slide" aria-label={`${active+1} of ${count}: ${slide.label}`} key={active}>
 {slide.kind==='featured'?children:slide.kind==='game'?<article className="hd-matchup hd-carousel-game"><div className="hd-stadium" aria-hidden="true"/><div className="hd-match-content"><div className="hd-match-meta"><span className="hd-badge">{slide.game.phase==='post'?'RECENT RESULT':'UPCOMING GAME'}</span><span>{slide.game.venue}</span></div><div className="hd-scoreboard"><div><ClubLogo abbr={slide.game.away}/><h2>{slide.game.away}</h2><small>{slide.game.awayName}</small></div><div className="hd-score-center"><strong>{slide.game.phase==='post'?<>{slide.game.awayScore??'–'}<i>:</i>{slide.game.homeScore??'–'}</>:<span className="hd-versus">VS</span>}</strong><span>{slide.game.status}</span><small>{slide.game.network}</small></div><div><ClubLogo abbr={slide.game.home}/><h2>{slide.game.home}</h2><small>{slide.game.homeName}</small></div></div><div className="hd-hero-actions"><Link className="btn" href={`/games/${slide.game.id}`}>{slide.game.phase==='post'?'GAME RECAP':'GAME PREVIEW'} →</Link><Link className="btn secondary" href="/scores">ALL GAMES</Link></div></div></article>:<article className="hd-news-slide" style={slide.story.image?{backgroundImage:`linear-gradient(90deg,#030d12f5,#030d1288),url("${slide.story.image.replace(/["\\\n\r]/g,'')}")`}:undefined}><span className="hd-badge">LATEST NEWS · ESPN</span><h2>{slide.story.title}</h2><a className="btn" href={slide.story.url} target="_blank" rel="noopener noreferrer">READ ARTICLE ↗</a></article>}
 </div></div>
 {count>1&&<div className="hd-slide-controls"><button type="button" onClick={()=>move(active-1)} aria-label="Previous slide">‹</button><button className="hd-rotation-accessible" type="button" onClick={()=>{setPaused(!(paused||reduced));setReduced(false)}} aria-label={paused||reduced?'Play slideshow':'Pause slideshow'}>{paused||reduced?'▶':'Ⅱ'}</button><button type="button" onClick={()=>move(active+1)} aria-label="Next slide">›</button></div>}
 </section>;
}
