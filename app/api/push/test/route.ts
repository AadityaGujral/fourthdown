import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";
export const runtime="nodejs";

export async function POST(request:Request){
 const bearer=request.headers.get("authorization")||"";
 const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
 if(!token)return Response.json({ok:false,error:"Unauthorized"},{status:401});
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
  if(!url||!key||!publicKey||!privateKey||!subject)return Response.json({ok:false,error:"Push environment incomplete"},{status:503});
  const authClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await authClient.auth.getUser(token);
  if(error||!user)return Response.json({ok:false,error:"Invalid session"},{status:401});
  const userClient=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const query=await userClient.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id",user.id);
  if(query.error)throw new Error("Subscription query failed");
  if(!query.data?.length)return Response.json({ok:false,sent:0,failed:0,error:"No active browser subscriptions. Enable push first."},{status:409});
  webpush.setVapidDetails(subject,publicKey,privateKey);
  let sent=0,failed=0;
  for(const item of query.data){
   try{
    await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},JSON.stringify({title:"FourthDown V15",body:"Browser push is working.",href:"/notifications",tag:"fourthdown-v15-test"}),{timeout:8000});
    sent++;
   }catch(error:any){
    failed++;
    console.warn(JSON.stringify({event:"test_push_failure",statusCode:error?.statusCode||null}));
    if(error?.statusCode===404||error?.statusCode===410){
     const result=await userClient.from("push_subscriptions").delete().eq("user_id",user.id).eq("endpoint",item.endpoint);
     if(result.error)console.warn(JSON.stringify({event:"expired_push_cleanup_failure"}));
    }
   }
  }
  return Response.json({ok:sent>0,sent,failed,...(sent?{}:{error:"No test pushes were accepted. Enable push again and retry."})},{status:sent?200:502});
 }catch{
  console.error(JSON.stringify({event:"test_push_route_failure"}));
  return Response.json({ok:false,error:"Push service temporarily unavailable. Please retry."},{status:503});
 }
}
