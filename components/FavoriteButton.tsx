"use client";import {useEffect,useState,useRef} from "react";import {getSupabase} from "@/lib/supabase";import {checked,readLocalList,validTeam,validPlayer,withTimeout} from "@/lib/client-state";const KEY="fourthdown:favorites";
export default function FavoriteButton({slug,name}:{slug:string;name:string}){const [fav,setFav]=useState(false);const supabase=getSupabase();const [busy,setBusy]=useState(true),[error,setError]=useState("");const lock=useRef(false);
 useEffect(()=>{let active=true;setBusy(true);(async()=>{
 const {data:{session},error}=await withTimeout(supabase.auth.getSession()) as any;if(error)throw error;
 if(session?.user){const {data}=await checked(supabase.from("favorite_teams").select("team_slug").eq("user_id",session.user.id).eq("team_slug",slug).maybeSingle());if(active)setFav(Boolean(data))}
 else if(active)setFav(readLocalList(KEY,validTeam).includes(slug));
 if(active)setBusy(false);
 })().catch(()=>{if(active)setError("Could not load saved status. Please refresh.")});return()=>{active=false}},[slug]);
 async function toggle(){
 if(lock.current)return;lock.current=true;setBusy(true);setError("");
 try{const {data:{session},error:sessionError}=await withTimeout(supabase.auth.getSession()) as any;if(sessionError)throw sessionError;
 if(session?.user){if(fav)await checked(supabase.from("favorite_teams").delete().eq("user_id",session.user.id).eq("team_slug",slug));else await checked(supabase.from("favorite_teams").upsert({user_id:session.user.id,team_slug:slug}));}else{let list=readLocalList(KEY,validTeam);list=fav?list.filter(x=>x!==slug):Array.from(new Set([...list,slug]));localStorage.setItem(KEY,JSON.stringify(list));}
 setFav(!fav);window.dispatchEvent(new Event("fourthdown:favorites"));
 }catch{setError("Could not save this change. Please retry.")}finally{lock.current=false;setBusy(false)}
 }
 return <><button className={fav?"favBtn active":"favBtn"} disabled={busy} aria-busy={busy} onClick={toggle} aria-pressed={fav}>{fav?"★ FAVORITED":"☆ FAVORITE "+name}</button>{error&&<p role="alert" className="cloudStatus">{error}</p>}</>}