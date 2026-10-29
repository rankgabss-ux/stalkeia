export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if ((url.pathname === '/api/image/' || url.pathname === '/api/image' || url.pathname === '/image' || url.pathname === '/image/')) {
   if (request.method !== 'GET') return new Response('Method not allowed', {status:405});
   const raw = url.searchParams.get('url');
   if (!raw || raw.length > 4096) return new Response('Invalid image URL', {status:400});
   let target;
   try { target = new URL(raw); } catch { return new Response('Invalid image URL', {status:400}); }
   const host = target.hostname.toLowerCase();
   if (target.protocol !== 'https:' || !(/^scontent-[a-z0-9-]+\.cdninstagram\.com$/.test(host) || /^instagram\.[a-z0-9-]+\.fna\.fbcdn\.net$/.test(host)) || target.port || target.username || target.password) {
    return new Response('Image host not allowed', {status:403});
   }
   try {
    const upstream = await fetch(target.toString(), {
     headers: {'accept':'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8'},
     redirect:'manual', signal:AbortSignal.timeout(12000)
    });
    if (!upstream.ok) return new Response('Image upstream returned '+upstream.status, {status:502});
    const type=(upstream.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if (!['image/jpeg','image/png','image/webp','image/avif'].includes(type)) return new Response('Not an image', {status:502});
    const length=Number(upstream.headers.get('content-length')||0);
    if (length > 3_000_000) return new Response('Image too large', {status:413});
    const bytes=await upstream.arrayBuffer();
    if(bytes.byteLength > 3_000_000) return new Response('Image too large', {status:413});
    return new Response(bytes,{status:200,headers:{'content-type':type,'cache-control':'public, max-age=3600','x-content-type-options':'nosniff'}});
   } catch { return new Response('Image fetch failed', {status:502}); }
  }
  if (url.pathname === '/api/proxy/hikerapi.php' || url.pathname === '/api/proxy/instagram.php') {
   const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
   if(request.method!=='GET')return json({error:'Método não permitido'},405);
   if(!env.ROCKET_API_TOKEN)return json({error:'Token ROCKET_API_TOKEN não configurado'},503);
   const username=(url.searchParams.get('username')||'').replace(/^@/,'');
   if(!/^[A-Za-z0-9._]{1,30}$/.test(username))return json({error:'Nome de usuário inválido'},400);
   if(url.pathname.endsWith('instagram.php') && url.searchParams.get('tipo')!=='perfil')return json({error:'Esta versão de teste suporta apenas consulta de perfil público; demais recursos ainda exigem adaptação.'},501);
   if(url.pathname.endsWith('hikerapi.php') && url.searchParams.get('path')!=='/v2/user/by/username')return json({error:'Endpoint ainda não implementado nesta versão de teste'},501);
   try {
    const upstream = await fetch(
      'https://v1.rocketapi.io/instagram/user/get_info_by_username',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Token ' + env.ROCKET_API_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username }),
        signal: AbortSignal.timeout(15000)
      }
    );
    const data=await upstream.json();
    if(!upstream.ok)return json({error:'HikerAPI retornou HTTP '+upstream.status},upstream.status);
    const user=data?.user||data?.response?.user||data?.response||data;
    if(!user || !user.username)return json({error:'Resposta da API sem perfil reconhecível'},502);
    // A API pode fornecer a foto em qualquer um destes campos.
    // Preserve a URL assinada completa, incluindo a query string.
    const photoCandidates = [
     user.hd_profile_pic_url_info?.url,
     ...(Array.isArray(user.hd_profile_pic_versions) ? [...user.hd_profile_pic_versions].sort((a,b)=>(Number(b?.width)||0)-(Number(a?.width)||0)).map(photo=>photo?.url) : []),
     user.profile_pic_url_hd,
     user.profile_pic_url
    ];
    const photo = photoCandidates.find(value=>typeof value==='string' && value.trim());
    if(photo) {
     // Mantém os campos esperados pelo site e fornece um proxy pronto para uso.
     user.profile_pic_url = photo;
     user.profile_pic_url_hd = photo;
     user.profile_pic_proxy_url = '/api/image?url=' + encodeURIComponent(photo);
    }
    if(url.pathname.endsWith('hikerapi.php'))return json({user});
    return json({...user,user_id:user.pk||user.id});
   } catch(e){return json({error:'Falha na consulta da API'},502)}
  }
  return env.ASSETS.fetch(request);
 }
};
