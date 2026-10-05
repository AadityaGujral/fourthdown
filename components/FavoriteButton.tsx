"use client";
import {useEffect,useState} from "react";

const KEY="fourthdown:favorites";
export default function FavoriteButton({slug,name}:{slug:string;name:string}){
  const [fav,setFav]=useState(false);
  useEffect(()=>{try{setFav(JSON.parse(localStorage.getItem(KEY)||"[]").includes(slug))}catch{}},[slug]);
  function toggle(){
    let list:string[]=[];
    try{list=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{}
    list=fav?list.filter(x=>x!==slug):Array.from(new Set([...list,slug]));
    localStorage.setItem(KEY,JSON.stringify(list));
    setFav(!fav);
    window.dispatchEvent(new Event("fourthdown:favorites"));
  }
  return <button className={fav?"favBtn active":"favBtn"} onClick={toggle} aria-pressed={fav}>{fav?"★ FAVORITED":"☆ FAVORITE "+name}</button>
}