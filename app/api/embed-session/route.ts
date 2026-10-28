import { env } from 'cloudflare:workers';
import { getIdentity } from '../../../lib/auth/identity';
import { D1CompanionStore } from '../../../lib/companion/security';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return Response.json({error:'Use your own host-backend session endpoint.'},{status:403});
 const identity=await getIdentity(request);if(!identity)return Response.json({error:'Sign in to preview the embedded companion.'},{status:401});
 if(!env.DB)return Response.json({error:'Session storage unavailable.'},{status:503});
 const store=new D1CompanionStore(env.DB);
 if(!await store.rateLimit(identity.id,'demo-sessions',15,3600000))return Response.json({error:'Too many preview sessions. Retry later.'},{status:429});
 return Response.json(await store.issue(identity.id,origin),{status:201,headers:{'Cache-Control':'no-store'}});
}
