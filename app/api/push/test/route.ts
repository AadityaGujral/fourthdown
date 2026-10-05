import {createClient} from "@supabase/supabase-js";
import webpush from "web-push";

export async function POST(request:Request){
  const bearer=request.headers.get("authorization")||"";
  const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
  if(!token)return Response.json({ok:false,error:"Unauthorized"},{status:401});

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT;
  if(!url||!key||!publicKey||!privateKey||!subject)return Response.json({ok:false,error:"Push environment incomplete"},{status:500});

  const authClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const userResult=await authClient.auth.getUser(token);
  const user=userResult.data.user;
  if(userResult.error||!user)return Response.json({ok:false,error:"Invalid session"},{status:401});

  const userClient=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const query=await userClient.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id",user.id);
  if(query.error)return Response.json({ok:false,error:query.error.message},{status:400});

  webpush.setVapidDetails(subject,publicKey,privateKey);
  let sent=0,failed=0;const errors:string[]=[];
  for(const item of query.data||[]){
    try{
      await webpush.sendNotification(
        {endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},
        JSON.stringify({title:"FourthDown V15",body:"Browser push is working.",href:"/notifications",tag:"fourthdown-v15-test"})
      );
      sent++;
    }catch(error:any){
      failed++;errors.push(error?.body||error?.message||"Push failed");
    }
  }
  return Response.json({ok:true,sent,failed,errors:errors.slice(0,2)});
}