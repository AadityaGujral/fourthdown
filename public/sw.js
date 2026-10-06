function notificationUrl(href){
 try{const url=new URL(href||"/notifications",self.location.origin);if(url.origin===self.location.origin&&["http:","https:"].includes(url.protocol))return url.href}catch{}
 return new URL("/notifications",self.location.origin).href;
}
self.addEventListener("push",event=>{
 let data={title:"FourthDown",body:"New football alert",href:"/notifications"};
 try{data={...data,...event.data.json()}}catch{}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag||"fourthdown-alert",data:{href:notificationUrl(data.href)},renotify:true}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();const href=notificationUrl(event.notification?.data?.href);
 event.waitUntil((async()=>{
  for(const client of await clients.matchAll({type:"window",includeUncontrolled:true})){
   if(new URL(client.url).origin===self.location.origin&&"focus" in client){
    try{const navigated=await client.navigate(href);if(navigated)return await navigated.focus()}catch{}
   }
  }
  if(clients.openWindow)return clients.openWindow(href);
 })());
});
