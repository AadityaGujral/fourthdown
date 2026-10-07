"use client";import {useEffect,useState,useRef} from "react";import {getSupabase} from "@/lib/supabase";import {checked,readLocalList,validTeam,validPlayer,withTimeout} from "@/lib/client-state";const KEY="fourthdown:savedPlayers";
export default function SavedPlayerButton({id,name,team,position}:{id:string;name:string;team:string;position:string}){const [saved,setSaved]=useState(false);const supabase=getSupabase();const [busy,setBusy]=useState(true),[error,setError]=useState("");const lock=useRef(false);
 useEffect(()=>{let active=true;setBusy(true);(async()=>{
 const {data:{session},error}=await withTimeout(supabase.auth.getSession()) as any;if(error)throw error;
 if(session?.user){const {data}=await checked(supabase.from("saved_players").select("player_id").eq("user_id",session.user.id).eq("player_id",id).maybeSingle());if(active)setSaved(Boolean(data))}
 else if(active)setSaved(readLocalList(KEY,validPlayer).some(p=>p.id===id));
 if(active)setBusy(false);
 })().catch(()=>{if(active)setError("Could not load saved status. Please refresh.")});return()=>{active=false}},[id]);
 async function toggle(){
 if(lock.current)return;lock.current=true;setBusy(true);setError("");
 try{const {data:{session},error:sessionError}=await withTimeout(supabase.auth.getSession()) as any;if(sessionError)throw sessionError;
 if(session?.user){if(saved)await checked(supabase.from("saved_players").delete().eq("user_id",session.user.id).eq("player_id",id));else await checked(supabase.from("saved_players").upsert({user_id:session.user.id,player_id:id,player_name:name,team,position}));}else{let list=readLocalList(KEY,validPlayer);list=saved?list.filter(p=>p.id!==id):[...list.filter(p=>p.id!==id),{id,name,team,position}];localStorage.setItem(KEY,JSON.stringify(list));}
 setSaved(!saved);window.dispatchEvent(new Event("fourthdown:savedPlayers"));
 }catch{setError("Could not save this change. Please retry.")}finally{lock.current=false;setBusy(false)}
 }
 return <><button className={saved?"savePlayerBtn active":"savePlayerBtn"} disabled={busy} aria-busy={busy} onClick={toggle}>{saved?"★ SAVED PLAYER":"☆ SAVE PLAYER"}</button>{error&&<p role="alert" className="cloudStatus">{error}</p>}</>}