import {createClient} from "@supabase/supabase-js";
import {withTimeout} from "@/lib/client-state";

export async function POST(req:Request){
 const reply=(body:object,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
 if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=="production")return reply({ok:false,error:"Test email is available on the production site only."},403);
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return reply({ok:false,error:"Sign in to send a test email."},401);
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return reply({ok:false,error:"Account service is not configured."},503);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await withTimeout(client.auth.getUser(token),8000);
  if(error||!user?.email)return reply({ok:false,error:"Session expired. Please sign in again."},401);
  if(!user.email_confirmed_at)return reply({ok:false,error:"Confirm your account email first."},403);
  const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
  if(!apiKey||!from||process.env.RESEND_TEST_RECIPIENT)return reply({ok:false,error:"Verified-domain email sending is not ready."},503);
  // Fixed content and server-derived recipient. Repeated requests within the UTC hour
  // reuse a provider idempotency key, including retries after an uncertain timeout.
  const response=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(8000),headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json","Idempotency-Key":`fourthdown-test-v1-${user.id}-${Math.floor(Date.now()/3600000)}`},body:JSON.stringify({from,to:[user.email],subject:"FourthDown: Test email",text:"Your FourthDown test email has arrived. This is a delivery check, not a game or injury update. Manage alerts at https://getfourthdown.com/account"})});
  const result=await response.json();
  if(!response.ok||!result.id)return reply({ok:false,error:"Email provider did not accept the test. Please retry later or report this message.",code:response.status},502);
  return reply({ok:true,recipient:user.email,message:"Test email accepted for delivery. Check your inbox and Spam. Repeat clicks within this hour reuse the same test email."});
 }catch{return reply({ok:false,error:"Could not confirm email acceptance. Check your inbox before retrying."},504)}
}
