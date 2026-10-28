import { discoverArticles } from '../../../lib/science/retrieval';
import { cachedArticles } from '../../../lib/science/article-cache';
import { env } from "@/lib/platform";
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url),body=url.searchParams.get('body')||'all',q=url.searchParams.get('q')||'',limit=Number(url.searchParams.get('limit')||12);
 if(!['moon','mars','all'].includes(body)||q.length>180||!Number.isInteger(limit)||limit<1||limit>24)return Response.json({error:'Choose Moon, Mars or all; query up to 180 characters and limit 1–24.'},{status:400});
 try{const options={body:body as 'moon'|'mars'|'all',query:q,limit};const result=env.DB?await cachedArticles(env.DB,options):await discoverArticles(options);return Response.json(result,{headers:{'Cache-Control':result.diagnostics.every(d=>d.ok)?'public, max-age=180, stale-while-revalidate=300':'no-store'}});}catch{return Response.json({error:'Scientific sources are unavailable. Retry shortly; no substitute records were generated.'},{status:502});}
}
