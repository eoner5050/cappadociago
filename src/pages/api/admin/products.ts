import type { APIRoute } from 'astro';
import { requireAdmin, adminErrorResponse } from '../../../lib/adminAuth';

export const prerender = false;

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const { admin } = await requireAdmin(request);
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) return new Response(JSON.stringify({ error: 'Product id is required.' }), { status: 400, headers: { 'Content-Type':'application/json' } });
    const default_price = Number(body.default_price);
    const default_capacity = Math.max(1, Number(body.default_capacity || 1));
    if (!Number.isFinite(default_price) || default_price < 0) return new Response(JSON.stringify({ error: 'Default price is invalid.' }), { status: 400, headers: { 'Content-Type':'application/json' } });

    const { data: current, error: readError } = await admin.from('products').select('id,slug').eq('id', id).single();
    if (readError || !current) throw readError || new Error('Product not found.');

    const { data: product, error } = await admin.from('products')
      .update({ default_price, default_capacity })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    // If this product has an editable tour revision, keep both panels in sync.
    await admin.from('tours').update({ price: default_price, default_capacity }).eq('slug', current.slug);

    return new Response(JSON.stringify({ success:true, product }), { headers:{'Content-Type':'application/json','Cache-Control':'no-store'} });
  } catch (err) { return adminErrorResponse(err); }
};
