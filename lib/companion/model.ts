export async function loadCompanionModel(request:Request,fetcher:typeof fetch=fetch) {
 const path='/models/sozo-companion.glb';
 let url=new URL(path,request.url);
 const allowed=new Set([url.hostname,'sozo-research-lab.durgaprashadreddy996.chatgpt.site','sozo-research-lab.sharpscarf8.chatgpt.site']);
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetcher(url,{redirect:'manual'});
  if(response.ok)return response;
  const location=response.headers.get('location');
  await response.body?.cancel();
  if(![301,302,303,307,308].includes(response.status)||!location)throw new Error('The companion model is unavailable.');
  const next=new URL(location,url);
  if(!allowed.has(next.hostname)||next.pathname!==path||next.search||next.username||next.password||(next.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(next.hostname)))throw new Error('The companion model redirect is invalid.');
  url=next;
 }
 throw new Error('The companion model redirect limit was reached.');
}
