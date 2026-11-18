
/* Tarahi static WhatsApp ordering: no server, no payment processing, no stored orders. */
let waConfig={businessNumber:'',ordersEnabled:false,productsVerified:false};
async function loadWhatsAppConfig(){
  try{
    const response=await fetch(BASE+'/whatsapp-config.json',{cache:'no-store'});
    if(!response.ok)return;
    const cfg=await response.json();
    waConfig={
      businessNumber:typeof cfg.businessNumber==='string'?cfg.businessNumber.trim():'',
      ordersEnabled:cfg.ordersEnabled===true,
      productsVerified:cfg.productsVerified===true
    };
  }catch{waConfig={businessNumber:'',ordersEnabled:false,productsVerified:false};}
}
function waOrderingReady(){
  return waConfig.ordersEnabled && waConfig.productsVerified &&
    /^[1-9][0-9]{7,14}$/.test(waConfig.businessNumber) && !state.settings.live;
}
function waBuildMessage(form){
  const get=(key,max)=>String(form.get(key)||'').trim().slice(0,max);
  const items=state.cart.filter(item=>product(item.id)&&item.quantity>0);
  const lines=['Hi Tarahi! I would like to request the following order:',''];
  for(let i=0;i<items.length;i++){
    const item=items[i],p=product(item.id);
    lines.push((i+1)+'. '+p.name+' / '+p.color+' / Size '+item.size+
      ' / Qty '+item.quantity+' / '+fmt(p.price*item.quantity));
  }
  lines.push('','Product subtotal (estimated): '+fmt(subtotal()),
    'Delivery fee: To be confirmed','',
    'Name: '+get('customerName',80),
    'City: '+get('city',80));
  const address=get('address',240),notes=get('notes',300);
  if(address)lines.push('Delivery address: '+address);
  if(notes)lines.push('Special instructions: '+notes);
  lines.push('','Please confirm stock, prices, delivery charges and payment details.',
    'I understand this message is an inquiry until Tarahi confirms.');
  return lines.join('\n');
}
function whatsappCheckout(){
  const valid=state.cart.filter(item=>product(item.id)&&item.quantity>0);
  if(!valid.length)return '<section class="empty"><h2>Your bag is empty.</h2><p>Add a piece before ordering.</p><a href="/shop" data-link class="btn">Explore the collection ↗</a></section>';
  const enabled=waOrderingReady();
  const rows=valid.map(item=>{
    const p=product(item.id);
    return '<div class="summary-item"><img src="'+esc(p.image)+'" alt="'+esc(p.name)+'"/><div><div class="name">'+esc(p.name)+
      '</div><div class="meta">Size '+esc(item.size)+' · Qty '+Number(item.quantity)+'</div><div class="price">'+fmt(p.price*item.quantity)+'</div></div></div>';
  }).join('');
  const notice=enabled?
    '<p class="checkout-notice">Clicking the button opens WhatsApp with a pre-written message. Review it, then tap Send. Your order is not placed until you send the message and Tarahi confirms it.</p>':
    '<p class="checkout-notice" role="status"><strong>PREVIEW ONLY:</strong> Business WhatsApp and real products have not been configured. No orders can be sent yet. You can review and copy a sample message.</p>';
  return '<section class="container checkout">'+
    '<div class="checkout-header"><span class="eyebrow">TARAHI / WHATSAPP ORDERS</span><h1>Order on WhatsApp.</h1>'+
    '<p class="muted">Review your bag and send your request directly to Tarahi. No online payment is taken here.</p></div>'+
    '<div class="checkout-grid"><div class="checkout-form">'+
      '<h3>Your details</h3><form id="wa-order-form">'+
      '<div class="form-grid"><div class="field"><label for="wa-name">Full name *</label><input id="wa-name" name="customerName" required minlength="2" maxlength="80" autocomplete="name" placeholder="Your name"/></div>'+
      '<div class="field"><label for="wa-city">City *</label><input id="wa-city" name="city" required minlength="2" maxlength="80" autocomplete="address-level2" placeholder="e.g. Lahore"/></div></div>'+
      '<div class="field"><label for="wa-address">Delivery address (optional)</label><textarea id="wa-address" name="address" maxlength="240" autocomplete="street-address" placeholder="You may share your address later in WhatsApp"></textarea></div>'+
      '<div class="field"><label for="wa-notes">Order notes (optional)</label><textarea id="wa-notes" name="notes" maxlength="300" placeholder="Colour, fit, or delivery questions"></textarea></div>'+
      '<div class="field"><label for="wa-message-preview">WhatsApp message preview</label><textarea id="wa-message-preview" readonly rows="11" aria-label="WhatsApp order message preview"></textarea></div>'+
      notice+
      '<div class="wa-actions"><button type="button" class="btn full" id="wa-send-order"'+(enabled?'':' disabled')+'>'+
      (enabled?'Continue to WhatsApp ↗':'WhatsApp ordering not active yet')+'</button>'+
      '<button type="button" class="btn secondary full" id="wa-copy-order">Copy message</button></div>'+
      '<p class="checkout-notice">Orders are subject to stock availability, delivery charges and manual confirmation. No payment or order record is created on this website.</p>'+
      '</form></div><aside class="order-summary"><h3>Your shopping bag</h3>'+rows+
      '<div class="summary-line summary-total"><span>Product subtotal</span><strong>'+fmt(subtotal())+'</strong></div>'+
      '<p class="checkout-notice">Shipping and cash-on-delivery terms are confirmed in chat. Prices are sample values until real products are published.</p>'+
      '<a href="/shop" data-link class="text-link">Continue shopping ↗</a></aside></div></section>';
}
function waRefreshPreview(){
  const form=document.getElementById('wa-order-form');
  const preview=document.getElementById('wa-message-preview');
  if(form&&preview)preview.value=waBuildMessage(new FormData(form));
}
document.addEventListener('input',event=>{
  if(event.target.closest('#wa-order-form')&&event.target.id!=='wa-message-preview')waRefreshPreview();
});
document.addEventListener('click',async event=>{
  const open=event.target.closest('#wa-send-order');
  const copy=event.target.closest('#wa-copy-order');
  if(!open&&!copy)return;
  event.preventDefault();
  const form=document.getElementById('wa-order-form');
  if(!form)return;
  waRefreshPreview();
  const message=waBuildMessage(new FormData(form));
  if(copy){
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        await navigator.clipboard.writeText(message);
      }else{
        document.getElementById('wa-message-preview').select();
        if(!document.execCommand('copy'))throw Error('Copy not available');
      }
      toast('Order message copied. No order has been sent.');
    }catch{toast('Select and copy the message preview manually.');}
    return;
  }
  if(!form.reportValidity())return;
  if(!waOrderingReady()){toast('WhatsApp ordering has not been activated.');return;}
  const url='https://wa.me/'+waConfig.businessNumber+'?text='+encodeURIComponent(message);
  window.open(url,'_blank','noopener,noreferrer');
  toast('Review and send your message in WhatsApp. Tarahi must confirm your order.');
});
document.addEventListener('submit',event=>{
  if(event.target.id==='wa-order-form')event.preventDefault();
});
