class E extends Error{}
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const enc=new TextEncoder(),hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async t=>hex(await crypto.subtle.digest('SHA-256',enc.encode(t)));
async function pbk(pw,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:100000},k,256))}
async function mk(pw){const s=crypto.getRandomValues(new Uint8Array(16));return hex(s)+':'+await pbk(pw,s)}
async function chk(pw,st){const[s,h]=st.split(':');return await pbk(pw,new Uint8Array(s.match(/../g).map(x=>parseInt(x,16))))===h}
const slugify=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const rm=(env,u)=>u&&env.R2&&u.startsWith('/img/')?env.R2.delete(u.slice(5)):0;
const okUrl=u=>!u||/^(https?:\/\/|\/)/.test(u);
const T={banners:{t:'banners',f:['title','description','image_url','target_url','display_order','status'],o:'display_order,id',img:'image_url',req:'title'},
categories:{t:'game_categories',f:['name','slug','icon_url','description','display_order','status'],o:'display_order,name',img:'icon_url',req:'name'},
payments:{t:'payment_methods',f:['name','description','image_url','display_order','status'],o:'display_order,id',img:'image_url',req:'name'}};
const SK=['site_name','store_name','site_description','whatsapp_number','footer_text','instagram','tiktok','contact_info','logo_url','favicon_url','wa_template','footer_about','hours','color_primary','color_accent'];
async function auth(req,env){const m=(req.headers.get('cookie')||'').match(/ks=([a-f0-9]{64})/);if(!m)return null;
return env.DB.prepare('SELECT admin_id FROM sessions WHERE token_hash=? AND expires_at>?').bind(await sha(m[1]),Date.now()).first()}
async function saveProduct(env,b,id){
const DB=env.DB,name=String(b.name||'').trim(),slug=slugify(b.slug||name);
if(!name||!slug)throw new E('Nama produk wajib diisi');
const vs=(b.variants||[]).filter(v=>v.duration||v.name).map(v=>({name:String(v.name||'').trim(),duration:String(v.duration||v.name).trim(),price:Math.round(Number(v.price)),status:Number(v.status)===0?0:1}));
if(vs.some(v=>!(v.price>=0)))throw new E('Harga varian harus angka ≥ 0');
if(!okUrl(b.image_url))throw new E('URL gambar tidak valid');
const a=[name,slug,Number(b.game_category_id)||null,b.image_url||null,String(b.description||''),Math.max(0,parseInt(b.total_sold)||0),Number(b.status)===0?0:1];
const ins=pid=>vs.map(v=>DB.prepare('INSERT INTO product_variants(product_id,name,duration,price,status) VALUES(?,?,?,?,?)').bind(pid,v.name,v.duration,v.price,v.status));
if(!id){const r=await DB.prepare('INSERT INTO products(name,slug,game_category_id,image_url,description,total_sold,status) VALUES(?,?,?,?,?,?,?)').bind(...a).run();id=r.meta.last_row_id;if(vs.length)await DB.batch(ins(id));return id}
const old=await DB.prepare('SELECT image_url FROM products WHERE id=?').bind(id).first();if(!old)throw new E('Produk tidak ditemukan');
await DB.batch([DB.prepare('UPDATE products SET name=?,slug=?,game_category_id=?,image_url=?,description=?,total_sold=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(...a,id),
DB.prepare('DELETE FROM product_variants WHERE product_id=?').bind(id),...ins(id)]);
if(old.image_url!==a[3])await rm(env,old.image_url);return id}
async function adminApi(req,env,u,m,a){
const DB=env.DB,s=u.pathname.slice(11).split('/'),r=s[0],id=Number(s[1])||0;
const body=()=>req.json().catch(()=>{throw new E('Body tidak valid')});
if(r==='me')return J({ok:1});
if(r==='logout'){const c=req.headers.get('cookie').match(/ks=([a-f0-9]{64})/)[1];await DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(c)).run();return J({ok:1},200,{'set-cookie':'ks=;Path=/;Max-Age=0;HttpOnly;Secure;SameSite=Strict'})}
if(r==='stats'){const n=async q=>(await DB.prepare(q).first()).n;
return J({products:await n('SELECT COUNT(*) n FROM products'),variants:await n('SELECT COUNT(*) n FROM product_variants'),sold:await n('SELECT COALESCE(SUM(total_sold),0) n FROM products'),banners:await n('SELECT COUNT(*) n FROM banners'),
latest:(await DB.prepare('SELECT name,total_sold FROM products ORDER BY id DESC LIMIT 5').all()).results,top:(await DB.prepare('SELECT name,total_sold FROM products ORDER BY total_sold DESC LIMIT 5').all()).results})}
if(r==='upload'&&m==='POST'){if(!env.R2)throw new E('Upload belum aktif (R2 tidak dipasang). Tempel link gambar saja.');const f=(await req.formData()).get('file');
const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[f&&f.type];
if(!ext)throw new E('Format harus JPG, PNG, atau WebP');if(f.size>2*1024*1024)throw new E('Ukuran maksimal 2MB');
const buf=await f.arrayBuffer(),h=new Uint8Array(buf.slice(0,12)),sig=ext==='png'?h[0]===0x89&&h[1]===0x50:ext==='jpg'?h[0]===0xff&&h[1]===0xd8:h[8]===0x57&&h[9]===0x45;
if(!sig)throw new E('Isi file tidak sesuai format gambar');
const key=crypto.randomUUID()+'.'+ext;await env.R2.put(key,buf,{httpMetadata:{contentType:f.type}});return J({url:'/img/'+key})}
if(r==='password'&&m==='POST'){const b=await body();if(String(b.new||'').length<8)throw new E('Password baru minimal 8 karakter');
const ad=await DB.prepare('SELECT * FROM admins WHERE id=?').bind(a.admin_id).first();if(!await chk(String(b.current||''),ad.password_hash))throw new E('Password saat ini salah');
await DB.prepare('UPDATE admins SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(await mk(b.new),ad.id).run();return J({ok:1})}
if(r==='settings'&&m==='PUT'){const b=await body();
for(const k of['color_primary','color_accent'])if(b[k]&&!/^#[0-9a-f]{6}$/i.test(b[k]))throw new E('Warna harus format #rrggbb');
if('whatsapp_number' in b&&!/^\d{8,16}$/.test(b.whatsapp_number))throw new E('Nomor WhatsApp: angka saja, format internasional (628...)');
await DB.batch(SK.filter(k=>k in b).map(k=>DB.prepare('INSERT INTO website_settings(setting_key,setting_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP').bind(k,String(b[k]??''))));return J({ok:1})}
if(r==='products'){
if(m==='GET'&&!id)return J((await DB.prepare('SELECT p.*,c.name game FROM products p LEFT JOIN game_categories c ON c.id=p.game_category_id ORDER BY p.id DESC').all()).results);
if(m==='GET'){const p=await DB.prepare('SELECT * FROM products WHERE id=?').bind(id).first();if(!p)return J({error:'Tidak ditemukan'},404);p.variants=(await DB.prepare('SELECT * FROM product_variants WHERE product_id=? ORDER BY price,id').bind(id).all()).results;return J(p)}
if(m==='POST')return J({id:await saveProduct(env,await body())},201);
if(m==='PUT'&&id)return J({id:await saveProduct(env,await body(),id)});
if(m==='DELETE'&&id){const p=await DB.prepare('SELECT image_url FROM products WHERE id=?').bind(id).first();await DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();if(p)await rm(env,p.image_url);return J({ok:1})}}
const c=T[r];
if(c){
if(m==='GET')return J((await DB.prepare(`SELECT * FROM ${c.t} ORDER BY ${c.o}`).all()).results);
if(m==='POST'||m==='PUT'){const b=await body();if(r==='categories'&&!b.slug)b.slug=slugify(b.name);
if(!String(b[c.req]||'').trim())throw new E('Kolom '+c.req+' wajib diisi');
if(!okUrl(b.target_url)||!okUrl(b[c.img]))throw new E('URL tidak valid');
const v=c.f.map(k=>k==='status'?(Number(b[k])===0?0:1):k==='display_order'?parseInt(b[k])||0:(b[k]??null));
if(m==='POST'){await DB.prepare(`INSERT INTO ${c.t}(${c.f}) VALUES(${c.f.map(()=>'?')})`).bind(...v).run();return J({ok:1},201)}
const old=await DB.prepare(`SELECT ${c.img} i FROM ${c.t} WHERE id=?`).bind(id).first();
await DB.prepare(`UPDATE ${c.t} SET ${c.f.map(k=>k+'=?')} WHERE id=?`).bind(...v,id).run();if(old&&old.i!==b[c.img])await rm(env,old.i);return J({ok:1})}
if(m==='DELETE'&&id){if(r==='categories'){const n=await DB.prepare('SELECT COUNT(*) n FROM products WHERE game_category_id=?').bind(id).first();if(n.n)throw new E(`Kategori dipakai ${n.n} produk. Pindahkan atau hapus produk tersebut dulu.`)}
const old=await DB.prepare(`SELECT ${c.img} i FROM ${c.t} WHERE id=?`).bind(id).first();await DB.prepare(`DELETE FROM ${c.t} WHERE id=?`).bind(id).run();if(old)await rm(env,old.i);return J({ok:1})}}
return J({error:'Not found'},404)}
export default{async fetch(req,env){
const u=new URL(req.url),p=u.pathname,m=req.method,DB=env.DB;
try{
if(p.startsWith('/img/')){if(!env.R2)return new Response('',{status:404});const o=await env.R2.get(p.slice(5));if(!o)return new Response('',{status:404});
return new Response(o.body,{headers:{'content-type':o.httpMetadata?.contentType||'image/jpeg','cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})}
const og=req.headers.get('origin');if(m!=='GET'&&og&&new URL(og).origin!==u.origin)return J({error:'Forbidden'},403);
if(p==='/api/login'&&m==='POST'){
const ip=req.headers.get('cf-connecting-ip')||'x',now=Date.now();
await DB.prepare('DELETE FROM login_attempts WHERE ts<?').bind(now-9e5).run();
if((await DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE ip=?').bind(ip).first()).n>=5)return J({error:'Terlalu banyak percobaan. Coba lagi 15 menit lagi.'},429);
const{email,password}=await req.json().catch(()=>({}));
if(!(await DB.prepare('SELECT COUNT(*) n FROM admins').first()).n&&env.ADMIN_EMAIL&&env.ADMIN_PASSWORD)
await DB.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').bind(env.ADMIN_EMAIL.toLowerCase(),await mk(env.ADMIN_PASSWORD)).run();
const a=await DB.prepare('SELECT * FROM admins WHERE email=?').bind(String(email||'').toLowerCase()).first();
if(!a||!await chk(String(password||''),a.password_hash)){await DB.prepare('INSERT INTO login_attempts VALUES(?,?)').bind(ip,now).run();return J({error:'Email atau password salah'},401)}
const t=hex(crypto.getRandomValues(new Uint8Array(32)));
await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await sha(t),a.id,now+7*864e5).run();
return J({ok:1},200,{'set-cookie':`ks=${t};Path=/;Max-Age=604800;HttpOnly;Secure;SameSite=Strict`})}
if(p.startsWith('/api/admin/')){const a=await auth(req,env);if(!a)return J({error:'Sesi berakhir, silakan login'},401);return await adminApi(req,env,u,m,a)}
if(p==='/api/settings')return J(Object.fromEntries((await DB.prepare('SELECT setting_key k,setting_value v FROM website_settings').all()).results.map(x=>[x.k,x.v])));
if(p==='/api/home')return J({banners:(await DB.prepare('SELECT title,description,image_url,target_url FROM banners WHERE status=1 ORDER BY display_order,id').all()).results,
categories:(await DB.prepare('SELECT name,slug,icon_url,description FROM game_categories WHERE status=1 ORDER BY display_order,name').all()).results,
payments:(await DB.prepare('SELECT name,description,image_url FROM payment_methods WHERE status=1 ORDER BY display_order,id').all()).results});
if(p==='/api/products'){const q=u.searchParams.get('q')||'',cat=u.searchParams.get('category'),pg=Math.max(0,parseInt(u.searchParams.get('page'))||0),N=12;
const r=await DB.prepare(`SELECT p.name,p.slug,p.image_url,p.total_sold,c.name game,(SELECT MIN(price) FROM product_variants v WHERE v.product_id=p.id AND v.status=1) min_price FROM products p LEFT JOIN game_categories c ON c.id=p.game_category_id WHERE p.status=1 AND p.name LIKE ?${cat?' AND c.slug=?':''} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
.bind(...['%'+q.replace(/[%_]/g,'')+'%',...(cat?[cat]:[]),N+1,pg*N]).all();
return J({items:r.results.slice(0,N),more:r.results.length>N})}
const x=p.match(/^\/api\/products\/([a-z0-9-]+)$/);
if(x){const pr=await DB.prepare('SELECT p.id,p.name,p.slug,p.image_url,p.description,p.total_sold,c.name game FROM products p LEFT JOIN game_categories c ON c.id=p.game_category_id WHERE p.slug=? AND p.status=1').bind(x[1]).first();
if(!pr)return J({error:'Produk tidak ditemukan'},404);
pr.variants=(await DB.prepare('SELECT id,name,duration,price,status FROM product_variants WHERE product_id=? ORDER BY price,id').bind(pr.id).all()).results;return J(pr)}
return J({error:'Not found'},404)
}catch(e){const known=e instanceof E||/UNIQUE|FOREIGN/.test(e.message);
return J({error:known?(/UNIQUE/.test(e.message)?'Data duplikat (slug/email sudah dipakai)':/FOREIGN/.test(e.message)?'Data masih dipakai data lain':e.message):'Terjadi kesalahan server'},known?400:500)}}}
