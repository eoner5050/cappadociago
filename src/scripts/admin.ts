import { createClient } from "@supabase/supabase-js";

const cleanEnv = (value: string | undefined) =>
  String(value ?? "")
    .trim()
    .replace(/^(["'])|(["'])$/g, "");

const supabaseUrl = cleanEnv(import.meta.env.PUBLIC_SUPABASE_URL);
const supabasePublishableKey = cleanEnv(
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Supabase bağlantısı eksik. Vercel Environment Variables içinde PUBLIC_SUPABASE_URL ve PUBLIC_SUPABASE_PUBLISHABLE_KEY değerlerini kontrol edin."
  );
}

let parsedSupabaseUrl: URL;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  throw new Error(
    `Geçersiz PUBLIC_SUPABASE_URL: ${JSON.stringify(supabaseUrl)}. Değer https://...supabase.co biçiminde olmalı.`
  );
}

if (!['http:', 'https:'].includes(parsedSupabaseUrl.protocol)) {
  throw new Error(
    `Geçersiz PUBLIC_SUPABASE_URL protokolü: ${parsedSupabaseUrl.protocol}. URL http:// veya https:// ile başlamalı.`
  );
}

// Geçici teşhis: yalnızca URL'yi gösterir, Supabase anahtarını asla loglamaz.
console.log("SUPABASE URL CHECK:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabasePublishableKey);

type Product = {
  id: string; name: string; slug: string; category: string;
  default_price: number; default_capacity: number; active: boolean; ask_for_price?: boolean;
};
type Availability = {
  id?: string; product_id: string; date: string; price: number;
  capacity: number; booked: number; status: "available"|"sold_out"|"closed";
};
type Reservation = {
  id:string; reservation_date:string; product_id:string|null; tour_name:string; customer_name:string;
  customer_count:number; hotel:string|null; phone:string|null; email:string|null; note:string|null; created_at?:string;
};
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const loginView = $("loginView"), appView = $("appView");
const loginForm = $("loginForm") as HTMLFormElement, loginError = $("loginError");
const productSelect = $("productSelect") as HTMLSelectElement;
const calendar = $("calendar"), monthTitle = $("monthTitle");
const askPriceBtn = $("askPriceBtn") as HTMLButtonElement;
const dayDialog = $("dayDialog") as HTMLDialogElement;
const bulkDialog = $("bulkDialog") as HTMLDialogElement;
const reservationForm = $("reservationForm") as HTMLFormElement;
const reservationProduct = $("reservationProduct") as HTMLSelectElement;
const reservationsList = $("reservationsList");
const reservationFilterProduct = $("reservationFilterProduct") as HTMLSelectElement;
const reservationFilterStart = $("reservationFilterStart") as HTMLInputElement;
const reservationFilterEnd = $("reservationFilterEnd") as HTMLInputElement;
const reservationFilterClear = $("reservationFilterClear") as HTMLButtonElement;
const reservationFilterSummary = $("reservationFilterSummary");
let products: Product[] = [];
let reservationRows: Reservation[] = [];
let availability = new Map<string, Availability>();
let currentDate = new Date();
currentDate.setDate(1);

const yyyyMmDd = (d:Date) => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const selectedProduct = () => products.find(p => p.id === productSelect.value);
function updateAskPriceButton(){
  const p=selectedProduct(); if(!p||!askPriceBtn) return;
  askPriceBtn.classList.toggle("on",!!p.ask_for_price);
  askPriceBtn.textContent=p.ask_for_price?"💬 Ask For Price: Açık":"💬 Ask For Price: Kapalı";
}

async function ensureAdmin(userId:string) {
  const { data, error } = await supabase.from("admin_users").select("user_id,role").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Bu kullanıcı yönetici olarak yetkilendirilmemiş.");
  return data;
}

async function boot() {
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session) return showLogin();
  try {
    await ensureAdmin(session.user.id);
    $("adminEmail").textContent = session.user.email || "";
    loginView.classList.add("hidden"); appView.classList.remove("hidden");
    await loadProducts();
    await loadMonth();
  } catch(e:any) {
    await supabase.auth.signOut();
    showLogin(e.message);
  }
}

function showLogin(message="") {
  loginView.classList.remove("hidden"); appView.classList.add("hidden");
  if (message) { loginError.textContent = message; loginError.classList.remove("hidden"); }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault(); loginError.classList.add("hidden");
  const email = ($("email") as HTMLInputElement).value;
  const password = ($("password") as HTMLInputElement).value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return showLogin(error?.message || "Giriş başarısız.");
  try { await ensureAdmin(data.user.id); location.reload(); }
  catch(err:any){ await supabase.auth.signOut(); showLogin(err.message); }
});
$("logoutBtn").addEventListener("click", async()=>{ await supabase.auth.signOut(); location.reload(); });

async function loadProducts() {
  const { data, error } = await supabase.from("products").select("*").eq("active", true).order("category").order("name");
  if (error) throw error;
  products = data || [];
  productSelect.innerHTML = products.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");
  if (reservationProduct) reservationProduct.innerHTML = products.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");
  if (reservationFilterProduct) reservationFilterProduct.innerHTML = `<option value="">Tüm turlar</option>` + products.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");
  $("productsGrid").innerHTML = products.map(p=>`
    <div class="product-card"><h3>${p.name}</h3><p>${p.category}</p>
    <p>Fiyat modu: <b>${p.ask_for_price ? "Fiyat Sorunuz" : "Takvim / Sabit Fiyat"}</b></p>
    <p>Varsayılan fiyat: <b>${p.ask_for_price ? "Ask For Price" : `${p.default_price} €`}</b></p><p>Varsayılan kontenjan: <b>${p.default_capacity}</b></p></div>
  `).join("");
  updateAskPriceButton();
}

async function loadMonth() {
  const product = selectedProduct(); if (!product) return;
  const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const end = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0);
  const { data, error } = await supabase.from("availability")
    .select("*").eq("product_id", product.id).gte("date", yyyyMmDd(start)).lte("date", yyyyMmDd(end));
  if (error) throw error;
  availability = new Map((data || []).map((r:Availability)=>[r.date,r]));
  renderCalendar();
}

function renderCalendar() {
  const product = selectedProduct(); if (!product) return;
  monthTitle.textContent = currentDate.toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
  const labels=["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
  let html=labels.map(x=>`<div class="dow">${x}</div>`).join("");
  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const offset=(first.getDay()+6)%7;
  const cursor=new Date(first); cursor.setDate(cursor.getDate()-offset);
  for(let i=0;i<42;i++){
    const key=yyyyMmDd(cursor), inMonth=cursor.getMonth()===currentDate.getMonth();
    const row=availability.get(key);
    const price=row?.price ?? product.default_price;
    const cap=row?.capacity ?? product.default_capacity;
    const booked=row?.booked ?? 0;
    const left=Math.max(0,cap-booked);
    let status=row?.status ?? "available";
    if(status==="available" && left===0) status="sold_out";
    const label=status==="sold_out"?"DOLU":status==="closed"?"KAPALI":left<=3?"SON "+left:"MÜSAİT";
    const cls=status==="available" && left<=3?"low":status;
    const fullDate = cursor.toLocaleDateString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric"});
    html+=`<div class="day ${inMonth?"":"out"}" data-date="${key}">
      <div class="day-head">
        <span class="day-number">${cursor.getDate()}</span>
        <span class="day-full-date">${fullDate}</span>
      </div>
      <div class="day-row day-price blue"><span class="day-label">Fiyat</span><span class="day-value">${product.ask_for_price?"Ask For Price":`${price} €`}</span></div>
      <div class="day-row gold"><span class="day-label">Satılan</span><span class="day-value">${booked} kişi</span></div>
      <div class="day-row blue"><span class="day-label">Kalan</span><span class="day-value">${left} / ${cap}</span></div>
      <div class="day-row day-status gold"><span class="day-label">Durum</span><span class="status ${cls}">${label}</span></div>
      ${product.ask_for_price?'<span class="ask-chip">💬 Fiyat Sorunuz</span>':''}</div>`;
    cursor.setDate(cursor.getDate()+1);
  }
  calendar.innerHTML=html;
  calendar.querySelectorAll<HTMLElement>(".day").forEach(el=>el.addEventListener("click",()=>openDay(el.dataset.date!)));
}

function openDay(date:string){
  const p=selectedProduct()!, row=availability.get(date);
  $("dayDialogTitle").textContent=`${p.name} — ${date}`;
  ($("editDate") as HTMLInputElement).value=date;
  ($("editPrice") as HTMLInputElement).value=String(row?.price ?? p.default_price);
  ($("editCapacity") as HTMLInputElement).value=String(row?.capacity ?? p.default_capacity);
  ($("editBooked") as HTMLInputElement).value=String(row?.booked ?? 0);
  ($("editStatus") as HTMLSelectElement).value=row?.status ?? "available";
  dayDialog.showModal();
}

($("dayForm") as HTMLFormElement).addEventListener("submit", async(e)=>{
  e.preventDefault(); const p=selectedProduct()!;
  const payload={
    product_id:p.id,
    date:($("editDate") as HTMLInputElement).value,
    price:Number(($("editPrice") as HTMLInputElement).value),
    capacity:Number(($("editCapacity") as HTMLInputElement).value),
    booked:Number(($("editBooked") as HTMLInputElement).value),
    status:($("editStatus") as HTMLSelectElement).value
  };
  if(payload.booked>payload.capacity) return alert("Satılan sayı kontenjandan büyük olamaz.");
  const {error}=await supabase.from("availability").upsert(payload,{onConflict:"product_id,date"});
  if(error) return alert(error.message);
  dayDialog.close(); await loadMonth();
});
$("dayCancel").addEventListener("click",()=>dayDialog.close());

$("bulkBtn").addEventListener("click",()=>bulkDialog.showModal());
$("bulkCancel").addEventListener("click",()=>bulkDialog.close());
($("bulkForm") as HTMLFormElement).addEventListener("submit", async(e)=>{
  e.preventDefault(); const p=selectedProduct()!;
  const start=new Date(($("bulkStart") as HTMLInputElement).value+"T00:00:00");
  const end=new Date(($("bulkEnd") as HTMLInputElement).value+"T00:00:00");
  if(end<start) return alert("Bitiş tarihi başlangıçtan önce olamaz.");
  const rows=[]; const d=new Date(start);
  while(d<=end){
    rows.push({product_id:p.id,date:yyyyMmDd(d),price:Number(($("bulkPrice") as HTMLInputElement).value),
      capacity:Number(($("bulkCapacity") as HTMLInputElement).value),booked:0,status:($("bulkStatus") as HTMLSelectElement).value});
    d.setDate(d.getDate()+1);
  }
  const {error}=await supabase.from("availability").upsert(rows,{onConflict:"product_id,date"});
  if(error) return alert(error.message);
  bulkDialog.close(); await loadMonth();
});

$("prevMonth").addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()-1);loadMonth();});
$("nextMonth").addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()+1);loadMonth();});
productSelect.addEventListener("change",async()=>{updateAskPriceButton();await loadMonth();});
askPriceBtn.addEventListener("click",async()=>{const p=selectedProduct();if(!p)return;const next=!p.ask_for_price;const {error}=await supabase.from("products").update({ask_for_price:next}).eq("id",p.id);if(error)return alert(error.message);p.ask_for_price=next;updateAskPriceButton();await loadMonth();await loadProducts();});


function resetReservationForm(){
  ($("reservationId") as HTMLInputElement).value="";
  ($("reservationDate") as HTMLInputElement).value=yyyyMmDd(new Date());
  ($("reservationName") as HTMLInputElement).value="";
  ($("reservationCount") as HTMLInputElement).value="1";
  ($("reservationHotel") as HTMLInputElement).value="";
  ($("reservationPhone") as HTMLInputElement).value="";
  ($("reservationEmail") as HTMLInputElement).value="";
  ($("reservationNote") as HTMLTextAreaElement).value="";
}

function escapeHtml(value:any){
  return String(value ?? "").replace(/[&<>'"]/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch] as string));
}

function renderReservations(){
  if(!reservationsList) return;
  const productId=reservationFilterProduct?.value || "";
  const start=reservationFilterStart?.value || "";
  const end=reservationFilterEnd?.value || "";
  const rows=reservationRows.filter(r=>{
    if(productId && r.product_id!==productId) return false;
    if(start && r.reservation_date<start) return false;
    if(end && r.reservation_date>end) return false;
    return true;
  });
  if(reservationFilterSummary){
    const totalPeople=rows.reduce((sum,r)=>sum+(Number(r.customer_count)||0),0);
    reservationFilterSummary.textContent=`${rows.length} rezervasyon · ${totalPeople} misafir`;
  }
  if(!rows.length){
    reservationsList.innerHTML='<div class="empty-state">Seçilen filtrelere uygun rezervasyon bulunamadı.</div>';
    return;
  }
  reservationsList.innerHTML=rows.map(r=>`<article class="reservation-item">
    <div class="reservation-item-head"><div><h3>${escapeHtml(r.customer_name)}</h3><small>${escapeHtml(r.tour_name)}</small></div><span class="reservation-date">${new Date(r.reservation_date+'T00:00:00').toLocaleDateString('tr-TR')}</span></div>
    <div class="reservation-meta"><span><b>Kişi:</b> ${r.customer_count}</span><span><b>Otel:</b> ${escapeHtml(r.hotel||'-')}</span><span><b>Telefon:</b> ${escapeHtml(r.phone||'-')}</span><span><b>E-posta:</b> ${escapeHtml(r.email||'-')}</span></div>
    ${r.note?`<div class="reservation-note"><b>Not:</b> ${escapeHtml(r.note)}</div>`:''}
    <div class="reservation-item-actions"><button type="button" class="btn danger" data-delete-reservation="${r.id}">Sil</button></div>
  </article>`).join('');
  reservationsList.querySelectorAll<HTMLButtonElement>('[data-delete-reservation]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('Bu rezervasyon kaydı silinsin mi?')) return;
    const {error}=await supabase.from('reservations').delete().eq('id',btn.dataset.deleteReservation!);
    if(error) return alert(error.message); await loadReservations();
  }));
}

async function loadReservations(){
  if(!reservationsList) return;
  reservationsList.innerHTML='<div class="notice">Rezervasyonlar yükleniyor…</div>';
  const {data,error}=await supabase.from("reservations").select("*").order("reservation_date",{ascending:true}).order("created_at",{ascending:false}).limit(500);
  if(error){ reservationsList.innerHTML=`<div class="notice">${escapeHtml(error.message)}<br><b>Supabase rezervasyon tablosunu kontrol edin.</b></div>`; return; }
  reservationRows=(data||[]) as Reservation[];
  renderReservations();
}

reservationFilterProduct?.addEventListener('change',renderReservations);
reservationFilterStart?.addEventListener('change',renderReservations);
reservationFilterEnd?.addEventListener('change',renderReservations);
reservationFilterClear?.addEventListener('click',()=>{
  reservationFilterProduct.value='';
  reservationFilterStart.value='';
  reservationFilterEnd.value='';
  renderReservations();
});

reservationForm?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const product=products.find(p=>p.id===reservationProduct.value);
  if(!product) return alert("Tur seçiniz.");
  const payload={
    reservation_date:($('reservationDate') as HTMLInputElement).value,
    product_id:product.id,
    tour_name:product.name,
    customer_name:($('reservationName') as HTMLInputElement).value.trim(),
    customer_count:Number(($('reservationCount') as HTMLInputElement).value),
    hotel:($('reservationHotel') as HTMLInputElement).value.trim()||null,
    phone:($('reservationPhone') as HTMLInputElement).value.trim()||null,
    email:($('reservationEmail') as HTMLInputElement).value.trim()||null,
    note:($('reservationNote') as HTMLTextAreaElement).value.trim()||null
  };
  if(!payload.reservation_date||!payload.customer_name||payload.customer_count<1) return alert("Tarih, müşteri adı ve kişi sayısı zorunludur.");
  const {error}=await supabase.from('reservations').insert(payload);
  if(error) return alert(error.message);
  resetReservationForm(); await loadReservations(); alert('Rezervasyon kaydedildi.');
});
$('reservationReset')?.addEventListener('click',resetReservationForm);
resetReservationForm();


document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(btn=>btn.addEventListener("click",async()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active")); btn.classList.add("active");
  const tab=btn.dataset.tab || "calendar";
  $("calendarTab").classList.toggle("hidden",tab!=="calendar");
  $("productsTab").classList.toggle("hidden",tab!=="products");
  $("reservationsTab").classList.toggle("hidden",tab!=="reservations");
  $("pageTitle").textContent=tab==="calendar"?"Fiyat & Kontenjan Takvimi":tab==="products"?"Ürünler":"Rezervasyon Detayları";
  if(tab==="reservations") await loadReservations();
}));

boot();
