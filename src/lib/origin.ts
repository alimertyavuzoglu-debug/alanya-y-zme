/** Provider-generated deployment URLs are trusted configuration, not request headers. */
export function expectedOrigin(request: Request): string | null {
  let configured=process.env.APP_ORIGIN;
  if(!configured && process.env.NETLIFY==='true') {
    configured=process.env.CONTEXT==='production'
      ? process.env.URL
      : process.env.DEPLOY_PRIME_URL ?? process.env.URL;
  }
  if(configured){
    try{
      const url=new URL(configured);
      return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.origin:null;
    }catch{return null;}
  }
  const url=new URL(request.url);
  return `${url.protocol}//${request.headers.get('host')??url.host}`;
}
