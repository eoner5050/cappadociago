import type { APIRoute } from 'astro';
import { requireAdmin, adminErrorResponse } from '../../../lib/adminAuth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { admin } = await requireAdmin(request);
    const form = await request.formData();
    const file = form.get('file');
    const slug = String(form.get('slug') || 'tour').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'tour';
    if (!(file instanceof File)) return new Response(JSON.stringify({error:'Image file is required.'}), {status:400,headers:{'Content-Type':'application/json'}});
    if (!file.type.startsWith('image/')) return new Response(JSON.stringify({error:'Only image files are allowed.'}), {status:400,headers:{'Content-Type':'application/json'}});
    if (file.size > 12 * 1024 * 1024) return new Response(JSON.stringify({error:'Image must be smaller than 12 MB.'}), {status:400,headers:{'Content-Type':'application/json'}});
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path = `${slug}/${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await admin.storage.from('tour-images').upload(path, bytes, { contentType:file.type, upsert:false, cacheControl:'31536000' });
    if (error) throw error;
    const { data } = admin.storage.from('tour-images').getPublicUrl(path);
    return new Response(JSON.stringify({success:true,url:data.publicUrl,path}), {headers:{'Content-Type':'application/json'}});
  } catch (err) { return adminErrorResponse(err); }
};
