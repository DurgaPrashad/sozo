import { discoverArticles, type ArticleDiscovery } from './retrieval';
import { hashSecret } from '../auth/crypto';
type CachedDiscovery=ArticleDiscovery & {cache?:{status:'fresh'|'cached'|'stale';upstreamRetrievedAt:string}[]};
/** Public publication metadata only. Cached records retain their original retrieval timestamps. */
export async function cachedArticles(db:D1Database,options:{body:'moon'|'mars'|'all';query:string;limit:number},load=discoverArticles,pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<CachedDiscovery>{
 await db.prepare('CREATE TABLE IF NOT EXISTS sozo_article_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, retrieved_at TEXT NOT NULL)').run();
 const parts:CachedDiscovery[]=[];
 for(const body of options.body==='all'?['moon','mars'] as const:[options.body]){
  const key=await hashSecret(`articles-v1|${body}|${options.query.toLowerCase()}`);
  const row=await db.prepare('SELECT payload,retrieved_at FROM sozo_article_cache WHERE cache_key = ?').bind(key).first<{payload:string;retrieved_at:string}>();
  let prior:ArticleDiscovery|undefined;
  try{if(row)prior=JSON.parse(row.payload) as ArticleDiscovery;}catch{}
  const age=row?Date.now()-Date.parse(row.retrieved_at):Infinity;
  if(prior&&age<15*60000){parts.push({...prior,cache:[{status:'cached',upstreamRetrievedAt:prior.retrievedAt}]});continue;}
  let result:ArticleDiscovery|undefined;
  for(let attempt=0;attempt<3;attempt++){
   result=await load({body,query:options.query,limit:24});
   if(result.diagnostics.some(d=>d.ok)||!result.diagnostics.some(d=>/rate limit|HTTP 50[234]/i.test(d.error||'')))break;
   if(attempt<2)await pause(650*(attempt+1)+Math.random()*450);
  }
  if(result?.diagnostics.some(d=>d.ok)){
   const payload=JSON.stringify(result);
   if(payload.length<600000)await db.prepare('INSERT INTO sozo_article_cache(cache_key,payload,retrieved_at) VALUES (?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,retrieved_at=excluded.retrieved_at').bind(key,payload,result.retrievedAt).run();
   parts.push({...result,cache:[{status:'fresh',upstreamRetrievedAt:result.retrievedAt}]});
  }else if(prior&&age<7*86400000){parts.push({...prior,cache:[{status:'stale',upstreamRetrievedAt:prior.retrievedAt}],limitations:[...prior.limitations,'The provider is unavailable. Previously retrieved records are shown with their original timestamps.']});}
  else parts.push({...result!,cache:[]});
 }
 const records:ArticleDiscovery['records']=[],seen=new Set<string>();
 for(let i=0;i<24;i++)for(const part of parts){const record=part.records[i];if(!record||records.length>=options.limit)continue;const k=record.doi?.toLowerCase()||record.title.toLowerCase();if(!seen.has(k)){seen.add(k);records.push(record);}}
 return {records,query:options.query,retrievedAt:parts.map(p=>p.retrievedAt).sort()[0]||new Date().toISOString(),diagnostics:parts.flatMap(p=>p.diagnostics),limitations:[...new Set(parts.flatMap(p=>p.limitations))],cache:parts.flatMap(p=>p.cache||[])};
}
