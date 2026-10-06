"use client";
import Link from "next/link";import {useEffect,useState} from "react";import {getSupabase} from "@/lib/supabase";
export default function NotificationCenter(){
 const supabase=getSupabase();const [items,setItems]=useState<any[]>([]);const [loading,setLoading]=useState(true);
 async function load(){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.user){setItems([]);setLoading(false);return}
  const uid=session.user.id;
  const {data}=await supabase.from("notifications").select("*").eq("user_id",uid).eq("in_app_visible",true).order("created_at",{ascending:false}).limit(50);setItems(data||[]);setLoading(false)
 }
 useEffect(()=>{load();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>{void load()},0)});return()=>subscription.unsubscribe()},[]);
 async function markRead(id:number){await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id);setItems(v=>v.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x))}
 async function markAll(){const {data:{session}}=await supabase.auth.getSession();if(!session?.user)return;const now=new Date().toISOString();await supabase.from("notifications").update({read_at:now}).eq("user_id",session.user.id).is("read_at",null);setItems(v=>v.map(x=>({...x,read_at:x.read_at||now})))}
 if(loading)return <p className="muted">Loading notifications…</p>;
 if(!items.length)return <div className="emptyState"><strong>No alerts yet.</strong><p>Favorite a team or save a player, then FourthDown will surface relevant game and injury alerts here.</p></div>;
 const unread=items.filter(x=>!x.read_at).length;
 return <><div className="notificationToolbar"><span>{unread} unread</span>{unread>0&&<button onClick={markAll}>MARK ALL READ</button>}</div><div className="notificationList">{items.map(n=><article className={n.read_at?"notificationItem":"notificationItem unread"} key={n.id} onClick={()=>!n.read_at&&markRead(n.id)}><div><span className={"notificationKind "+n.kind}>{n.kind.toUpperCase()}</span><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></div>{n.href&&<Link href={n.href}>OPEN →</Link>}</article>)}</div></>
}