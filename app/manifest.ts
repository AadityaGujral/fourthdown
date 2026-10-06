import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{
 return {id:"/",name:"FourthDown",short_name:"FourthDown",description:"Independent football intelligence and opt-in alerts",start_url:"/",scope:"/",display:"standalone",background_color:"#0b0e13",theme_color:"#0b0e13",icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png"},{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]};
}
