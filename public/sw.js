self.addEventListener("push",event=>{
  let data={title:"FourthDown",body:"New football alert",href:"/notifications"};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:"/icon-192.png",
    badge:"/icon-192.png",
    tag:data.tag||"fourthdown-alert",
    data:{href:data.href||"/notifications"},
    renotify:true
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const href=event.notification?.data?.href||"/notifications";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if("focus" in client){client.navigate(href);return client.focus()}}
    if(clients.openWindow)return clients.openWindow(href);
  }));
});