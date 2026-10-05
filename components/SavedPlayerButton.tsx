"use client";
import {useEffect,useState} from "react";
const KEY="fourthdown:savedPlayers";
export default function SavedPlayerButton({id,name,team,position}:{id:string;name:string;team:string;position:string}){
  const [saved,setSaved]=useState(false);
  useEffect(()=>{try{const list=JSON.parse(localStorage.getItem(KEY)||"[]");setSaved(list.some((p:any)=>p.id===id))}catch{}},[id]);
  function toggle(){let list:any[]=[];try{list=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{};list=saved?list.filter(p=>p.id!==id):[...list.filter(p=>p.id!==id),{id,name,team,position}];localStorage.setItem(KEY,JSON.stringify(list));setSaved(!saved);window.dispatchEvent(new Event("fourthdown:savedPlayers"));}
  return <button className={saved?"savePlayerBtn active":"savePlayerBtn"} onClick={toggle}>{saved?"★ SAVED PLAYER":"☆ SAVE PLAYER"}</button>
}