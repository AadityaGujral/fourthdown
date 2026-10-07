/** Read only valid local entries; malformed or unavailable storage is not account data. */
export function readLocalList(key:string,valid:(value:any)=>boolean):any[]{
 try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value.filter(valid):[]}catch{return []}
}
export const validTeam=(value:any)=>typeof value==="string";
export const validPlayer=(value:any)=>value&&typeof value.id==="string"&&typeof value.name==="string";
export function readLocalProfile(defaults:Record<string,any>){
 try{const value=JSON.parse(localStorage.getItem("fourthdown:profile")||"{}");return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,typeof value?.[k]===typeof v?value[k]:v]))}catch{return {...defaults}}
}
export async function checked<T extends {error?:unknown;data?:any;count?:number|null}>(work:PromiseLike<T>):Promise<T>{const result=await withTimeout(work);if(result.error)throw result.error;return result}
export async function withTimeout<T>(work:PromiseLike<T>,ms=15000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve(work),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Request timed out. Please retry.")),ms)})])}finally{clearTimeout(timer)}
}
