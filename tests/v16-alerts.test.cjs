const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,mocks={},env={}){
 const exports={};const ctx={exports,require:name=>mocks[name]||require(name),process:{env:{...env}},Buffer,URL,Request,Response,AbortSignal,console:{info(){},warn(){},error(){}}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,ctx);return exports;
}
const teams=load('lib/teams.ts');const events=load('lib/alert-events.ts',{'./teams':teams});
const time=Date.parse('2026-10-06T12:00:00Z');
const game={id:'123',startAt:'2026-10-06T14:00:00Z',phase:'pre',away:'NYJ',home:'BUF',awayScore:0,homeScore:0,day:'TUE',time:'10 AM ET',network:'NFL',status:'Scheduled'};
test('upcoming/final daily window excludes old and distant games',()=>{
 const result=events.buildAlertEvents([game,{...game,id:'124',startAt:'2026-10-01T12:00:00Z'},{...game,id:'125',startAt:'2026-10-09T12:00:00Z'}],[],time);assert.equal(result.length,1);assert.ok(result[0].team_slugs.includes('new-york-jets'));
});
test('clock-only changes do not generate duplicate game alerts; score changes do',()=>{
 const a={...game,phase:'in',status:'12:00 - 1st'};const b={...a,status:'11:59 - 1st'};const c={...b,awayScore:7};
 assert.equal(events.buildAlertEvents([a,b,c],[],time).length,2);
});
test('injuries dedupe by player status/detail and reject unidentified players',()=>{
 const i={playerId:'7',name:'Player',status:'Out',detail:'Ankle',position:'QB'};
 assert.equal(events.buildAlertEvents([],[i,i,{...i,playerId:''}],time).length,1);
 assert.notEqual(events.buildAlertEvents([],[i],time)[0].dedupe_key,events.buildAlertEvents([],[{...i,status:'Questionable'}],time)[0].dedupe_key);
});
const jobsModule=(env={})=>load('lib/alert-jobs.ts',{'./live-nfl':{},'./alert-events':events,'web-push':{setVapidDetails(){}}},env);
test('cron guard fails closed when missing or wrong and permits matching bearer',()=>{
 const a=jobsModule({CRON_SECRET:'test-secret'});assert.equal(a.authorized(new Request('https://example.com')),false);assert.equal(a.authorized(new Request('https://example.com',{headers:{authorization:'Bearer wrong'}})),false);assert.equal(a.authorized(new Request('https://example.com',{headers:{authorization:'Bearer test-secret'}})),true);
 assert.equal(jobsModule().authorized(new Request('https://example.com',{headers:{authorization:'Bearer undefined'}})),false);
});
test('push destinations exclude arbitrary hosts, credentials, and insecure URLs',()=>{
 const a=jobsModule();for(const url of ['http://fcm.googleapis.com/send','https://localhost/','https://fcm.googleapis.com.evil.example/','https://user:pass@fcm.googleapis.com/'])assert.equal(a.safePushEndpoint(url),false);
 assert.equal(a.safePushEndpoint('https://fcm.googleapis.com/send/token'),true);assert.equal(a.safePushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/token'),true);
});
test('transient delivery failures are retryable; gone subscriptions are permanent',()=>{
 const a=jobsModule();for(const code of [429,500,503,408])assert.equal(a.failurePolicy({statusCode:code}).permanent,false);for(const code of [400,404,410])assert.equal(a.failurePolicy({statusCode:code}).permanent,true);
});
test('delivery concurrency is bounded and every job settles with its claim token',async()=>{
 const a=jobsModule({RESEND_API_KEY:'test'});const jobs=Array.from({length:12},(_,i)=>({id:String(i),token:'token-'+i,channel:'email'}));let active=0,max=0;const settled=[];
 const result=await a.deliverQueue(async(action,payload)=>{if(action==='claim')return jobs;settled.push(payload);return {settled:true}},async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return 'provider-id'});
 assert.equal(result.sent,12);assert.ok(max<=4);assert.equal(settled.length,12);assert.equal(settled[8].token,'token-'+settled[8].id);
});
test('accepted sends with settlement failure remain unsettled, not re-sent as failure',async()=>{
 const a=jobsModule({RESEND_API_KEY:'test'});let sends=0,settles=0;
 const result=await a.deliverQueue(async action=>{if(action==='claim')return [{id:'1',token:'t',channel:'email'}];settles++;throw new Error('db failed')},async()=>{sends++;return 'provider'});
 assert.equal(sends,1);assert.equal(settles,1);assert.equal(result.unsettled,1);assert.equal(result.failed,0);
});
test('preview cannot invoke delivery jobs',async()=>{
 const a=jobsModule({CRON_SECRET:'test',VERCEL_ENV:'preview'});const response=await a.runAlertJob(new Request('https://example.com/api/cron/alerts',{headers:{authorization:'Bearer test'}}),'alerts');assert.equal(response.status,403);
});
