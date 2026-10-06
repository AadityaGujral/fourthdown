const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={},fetch=global.fetch){
 const exports={};const logs=[],cacheCalls=[];
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const context={exports,require:name=>{
  if(name==='next/cache')return {unstable_cache:(fn,key,options)=>{cacheCalls.push({key,options});return fn}};
  if(mocks[name])return mocks[name];throw new Error('Unexpected import '+name);
 },fetch,AbortSignal,Response,Request,URL,process:{env:{...process.env}},console:{warn:value=>logs.push(value),error:value=>logs.push(value)},setTimeout,clearTimeout};
 vm.runInNewContext(code,context,{filename:file});return {exports,context,logs,cacheCalls};
}
test('nested ESPN categories produce compact leaders; upstream response is never fetch-cached',async()=>{
 let options;
 const payload={leaders:{categories:[{name:'yards',displayName:'Passing Yards',leaders:[{athlete:{id:'123',displayName:'Test Player',links:[{large:'x'.repeat(2100000)}]},team:{abbreviation:'NYG'},displayValue:'0'}]}]}};
 const app=load('lib/live-nfl.ts',{},async(_url,opts)=>{options=opts;return Response.json(payload)});
 const result=await app.exports.getLeagueLeaders();
 assert.equal(result.ok,true);assert.equal(result.groups[0].leaders[0].name,'Test Player');assert.equal(result.groups[0].leaders[0].value,'0');
 assert.ok(JSON.stringify(result).length<1000);assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);assert.equal(app.cacheCalls[0].options.revalidate,900);
});
test('leaders also accept an array-shaped feed',async()=>{
 const app=load('lib/live-nfl.ts',{},async()=>Response.json({leaders:[{name:'yards',leaders:[{athlete:{id:'1',displayName:'Player'},value:0}]}]}));
 assert.equal((await app.exports.getLeagueLeaders()).groups[0].leaders[0].value,'0');
});
test('successful empty scoreboard stays distinct from unavailable scoreboard',async()=>{
 const app=load('lib/live-nfl.ts',{},async()=>Response.json({events:[]}));
 const result=await app.exports.getLiveScoreboard();assert.equal(result.ok,true);assert.equal(result.games.length,0);
});
for(const name of ['getLiveScoreboard','getLiveStandings','getGameSummary','getTeamRoster','getPlayerProfile','getLeagueLeaders']){
 test(name+' returns a fallback and emits a sanitized diagnostic when the feed fails',async()=>{
  let signal;
  const app=load('lib/live-nfl.ts',{},async(_url,opts)=>{signal=opts.signal;throw new Error('secret-upstream-payload')});
  const result=await app.exports[name]('test');assert.equal(result.ok,false);assert.ok(signal instanceof AbortSignal);assert.equal(app.logs.length,1);assert.ok(!app.logs[0].includes('secret-upstream-payload'));
 });
}
function pushApp({rows=[],authError=false,queryError=false,sendError=null}={}){
 const deleted=[];
 const client={auth:{getUser:async()=>({data:{user:authError?null:{id:'audit-user'}},error:authError?new Error('auth'):null})},from:()=>({select:()=>({eq:async()=>({data:rows,error:queryError?new Error('db'):null})}),delete:()=>({eq:()=>({eq:async(_field,endpoint)=>{deleted.push(endpoint);return {error:null}}})})})};
 const app=load('app/api/push/test/route.ts',{'@supabase/supabase-js':{createClient:()=>client},'web-push':{setVapidDetails:()=>{},sendNotification:async()=>{if(sendError)throw sendError}}});
 for(const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'])app.context.process.env[name]='test';
 return {...app,deleted};
}
const request=(token=true)=>new Request('https://fourthdown.example/api/push/test',{method:'POST',headers:token?{Authorization:'Bearer test'}:{}});
test('test push rejects unauthenticated requests',async()=>{
 const app=pushApp();assert.equal((await app.exports.POST(request(false))).status,401);
});
test('test push rejects invalid sessions',async()=>{
 const app=pushApp({authError:true});assert.equal((await app.exports.POST(request())).status,401);
});
test('zero subscriptions cannot report test-push success',async()=>{
 const app=pushApp();const r=await app.exports.POST(request());assert.equal(r.status,409);assert.equal((await r.json()).ok,false);
});
test('expired subscription is removed for this user and failed delivery reports failure',async()=>{
 const app=pushApp({rows:[{endpoint:'https://push.example/expired'}],sendError:{statusCode:410,body:'private endpoint error'}});
 const r=await app.exports.POST(request());const data=await r.json();assert.equal(r.status,502);assert.equal(data.ok,false);assert.deepEqual(app.deleted,['https://push.example/expired']);assert.ok(!JSON.stringify(data).includes('private endpoint error'));
});
test('accepted push reports delivery count',async()=>{
 const app=pushApp({rows:[{endpoint:'https://push.example/valid'}]});const r=await app.exports.POST(request());assert.equal(r.status,200);assert.equal((await r.json()).sent,1);
});
test('subscription database errors produce a controlled retryable response',async()=>{
 const app=pushApp({queryError:true});assert.equal((await app.exports.POST(request())).status,503);assert.equal(app.logs.length,1);
});
test('notification clicks stay on the app origin and await navigation before focus',async()=>{
 const handlers={},opened=[],focused=[];
 const current={url:'https://fourthdown.example/account',focus:async()=>{},navigate:async href=>{assert.equal(href,'https://fourthdown.example/notifications');return {focus:async()=>focused.push(true)}}};
 const context={URL,self:{location:{origin:'https://fourthdown.example'},addEventListener:(name,fn)=>handlers[name]=fn},clients:{matchAll:async()=>[current],openWindow:async href=>opened.push(href)}};
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
 let completed;
 handlers.notificationclick({notification:{data:{href:'https://outside.example/phishing'},close(){}},waitUntil:p=>completed=p});
 await completed;assert.equal(focused.length,1);assert.equal(opened.length,0);
});
test('Arizona and Washington roster requests use ESPN identifiers',async()=>{
 const requested=[];
 const app=load('lib/live-nfl.ts',{},async url=>{requested.push(url);return Response.json({athletes:[{items:[{id:'1',displayName:'Player'}]}]})});
 assert.equal((await app.exports.getTeamRoster('ARZ')).ok,true);assert.equal((await app.exports.getTeamRoster('WAS')).ok,true);
 assert.ok(requested[0].includes('/teams/ari/roster'));assert.ok(requested[1].includes('/teams/wsh/roster'));
});
test('scoreboard normalizes provider aliases for app favorites and branding',async()=>{
 const app=load('lib/live-nfl.ts',{},async()=>Response.json({events:[{id:'game',date:'2026-10-06T20:00:00Z',competitions:[{competitors:[{homeAway:'home',team:{abbreviation:'ARI'}},{homeAway:'away',team:{abbreviation:'WSH'}}]}]}]}));
 const result=await app.exports.getLiveScoreboard();assert.equal(result.games[0].home,'ARZ');assert.equal(result.games[0].away,'WAS');
});
