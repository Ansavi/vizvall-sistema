<!-- MODULO: RECETAS (insumos por servicio) — prefijo "rc" -->
<style>
#sec-receta { display:none;overflow:auto;position:absolute;top:56px;left:0;right:0;bottom:0;background:var(--bg,#F2F3F5); }
#sec-receta.activo { display:block; }
.rc-wrap { padding:18px 22px;max-width:1050px; }
.rc-head { margin-bottom:16px; }
.rc-title { font-size:18px;font-weight:600;color:#1A1A1A; }
.rc-sub { font-size:13px;color:#8A8A8A;margin-top:3px; }
.rc-card { background:#fff;border:1px solid #EEF0F3;border-radius:12px;padding:18px;margin-bottom:16px; }
.rc-fg { margin-bottom:12px; }
.rc-flabel { display:block;font-size:12.5px;color:#444;margin-bottom:4px;font-weight:500; }
.rc-finp { width:100%;padding:9px 11px;border:1px solid #E2E4E9;border-radius:8px;font-size:13.5px;box-sizing:border-box;background:#fff; }
.rc-finp:focus { border-color:#C8241A;outline:none; }
.rc-btn { padding:8px 15px;border:1px solid #E2E4E9;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px; }
.rc-btn.primary { background:#C8241A;color:#fff;border-color:#C8241A; }
.rc-btn.sm { padding:5px 10px;font-size:12px; }
.rc-btn:disabled { opacity:.5;cursor:not-allowed; }
.rc-table { width:100%;border-collapse:collapse;font-size:13px; }
.rc-table th { text-align:left;padding:10px 12px;border-bottom:2px solid #EEF0F3;color:#6B6B6B;font-weight:600;font-size:12px;background:#FAFBFC; }
.rc-table td { padding:10px 12px;border-bottom:1px solid #F2F3F5; }
.rc-id { font-family:monospace;font-size:11.5px;color:#8A8A8A; }
.rc-empty { text-align:center;color:#8A8A8A;padding:30px 20px;font-size:13.5px; }
.rc-accion { background:none;border:none;cursor:pointer;font-size:13px;padding:3px 7px;border-radius:6px;color:#6B6B6B; }
.rc-accion:hover { background:#F2F3F5; }
.rc-stock-bad { color:#C8241A;font-weight:600; }
.rc-add-row { display:grid;grid-template-columns:2fr 1fr auto;gap:10px;align-items:end;background:#FAFBFC;border-radius:8px;padding:12px;margin-top:12px; }
.rc-result { position:absolute;background:#fff;border:1px solid #E2E4E9;border-radius:8px;max-height:200px;overflow:auto;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.1);min-width:260px; }
.rc-result div { padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #F2F3F5; }
.rc-result div:hover { background:#FAFBFC; }
@media(max-width:600px){ .rc-add-row{grid-template-columns:1fr} }
</style>

<div id="sec-receta">
<div class="rc-wrap">
  <div class="rc-head">
    <div class="rc-title">🧪 Recetas de insumos por servicio</div>
    <div class="rc-sub">Define qué insumos consume cada servicio. Al vender, se descuentan automáticamente del stock.</div>
  </div>

  <div class="rc-card" id="rc-config-card" style="margin-bottom:14px">
    <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:#0A6B4F">📋 Servicios con receta configurada</div>
    <div id="rc-config-lista" style="font-size:13px;color:#6B6B6B">Cargando…</div>
  </div>

  <div class="rc-card">
    <div class="rc-fg" style="margin-bottom:0">
      <label class="rc-flabel">Seleccione un servicio para crear o editar su receta</label>
      <select class="rc-finp" id="rc-servicio" onchange="rcCargarReceta()">
        <option value="">— Seleccione —</option>
      </select>
    </div>
  </div>

  <div id="rc-receta-cont"></div>
</div>
</div><!-- /sec-receta -->

<script>
var rcServicios=[], rcProductos=[], rcProdSel=null;

function rcAbrir() {
  // Cargar servicios y productos
  google.script.run.withSuccessHandler(function(resp){
    rcServicios = resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos.filter(function(s){return s.ESTADO==='ACTIVO';}):[];
    var sel=document.getElementById('rc-servicio');
    sel.innerHTML='<option value="">— Seleccione —</option>';
    rcServicios.forEach(function(s){ var o=document.createElement('option'); o.value=s.ID_SERVICIO; o.textContent=s.NOMBRE_SERVICIO; sel.appendChild(o); });
  }).withFailureHandler(function(){}).ejecutar('listarServicios',{estado:'ACTIVO',usuario:sesion.USUARIO||'',rol:sesion.ROL||'',token:sesion.TOKEN||''});

  google.script.run.withSuccessHandler(function(resp){
    rcProductos = resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos.filter(function(p){return p.ESTADO==='ACTIVO';}):[];
  }).withFailureHandler(function(){}).ejecutar('listarProductos',{soloActivos:true,usuario:sesion.USUARIO||'',rol:sesion.ROL||'',token:sesion.TOKEN||''});

  document.getElementById('rc-receta-cont').innerHTML='';
  rcCargarConfigurados();
}

// Carga y muestra los servicios que ya tienen receta
function rcCargarConfigurados() {
  google.script.run.withSuccessHandler(function(resp){
    var cont=document.getElementById('rc-config-lista');
    var lista = resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos:[];
    if(!lista.length){ cont.innerHTML='<span style="color:#999">Aún no hay servicios con receta. Seleccione uno abajo para configurar.</span>'; return; }
    cont.innerHTML = lista.map(function(s){
      return '<div onclick="rcEditarServicio(\''+s.ID_SERVICIO+'\')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin:4px 0;background:#F0FAF6;border:1px solid #C5E8D8;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'#E0F4EA\'" onmouseout="this.style.background=\'#F0FAF6\'">'+
        '<span style="font-weight:600;color:#0A4D38">'+s.NOMBRE_SERVICIO+'</span>'+
        '<span style="font-size:12px;color:#0A6B4F">'+s.TOTAL_INSUMOS+' insumo(s) · ✏️ Editar</span>'+
      '</div>';
    }).join('');
  }).withFailureHandler(function(){
    document.getElementById('rc-config-lista').innerHTML='<span style="color:#C8241A">No se pudo cargar la lista.</span>';
  }).ejecutar('listarServiciosConReceta',{usuario:sesion.USUARIO||'',rol:sesion.ROL||'',token:sesion.TOKEN||''});
}

// Al hacer clic en un servicio configurado, lo selecciona y abre su receta
function rcEditarServicio(idServ) {
  var sel=document.getElementById('rc-servicio');
  sel.value=idServ;
  rcCargarReceta();
  // scroll suave a la receta
  setTimeout(function(){ var cont=document.getElementById('rc-receta-cont'); if(cont) cont.scrollIntoView({behavior:'smooth',block:'start'}); },200);
}

function rcCargarReceta() {
  var idServ=document.getElementById('rc-servicio').value;
  var cont=document.getElementById('rc-receta-cont');
  if(!idServ){ cont.innerHTML=''; return; }
  cont.innerHTML='<div class="rc-card"><div class="rc-empty">Cargando receta…</div></div>';
  google.script.run
    .withSuccessHandler(function(resp){
      var receta = resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos:[];
      rcRenderReceta(idServ, receta);
    })
    .withFailureHandler(function(e){ cont.innerHTML='<div class="rc-card" style="color:#C8241A">⚠ '+e.message+'</div>'; })
    .ejecutar('listarRecetaServicio', { ID_SERVICIO:idServ, usuario:sesion.USUARIO||'', rol:sesion.ROL||'', token:sesion.TOKEN||'' });
}

function rcRenderReceta(idServ, receta) {
  var cont=document.getElementById('rc-receta-cont');
  var html='<div class="rc-card">';
  html+='<h3 style="margin:0 0 12px;font-size:15px">Insumos de la receta</h3>';

  if(!receta.length){
    html+='<div class="rc-empty">Este servicio aún no tiene insumos definidos. Agregue el primero abajo.</div>';
  } else {
    html+='<table class="rc-table"><thead><tr><th>Insumo</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Stock actual</th><th style="text-align:right">Acción</th></tr></thead><tbody>';
    receta.forEach(function(r){
      var stock=parseFloat(r.STOCK_ACTUAL)||0;
      var stockCls = stock<=0 ? 'rc-stock-bad' : '';
      html+='<tr>'+
        '<td><b>'+(r.PRODUCTO_NOMBRE||'—')+'</b> <span class="rc-id">('+(r.UNIDAD_MEDIDA||'')+')</span></td>'+
        '<td style="text-align:right">'+r.CANTIDAD+'</td>'+
        '<td style="text-align:right" class="'+stockCls+'">'+stock+'</td>'+
        '<td style="text-align:right"><button class="rc-accion" style="color:#C8241A" onclick=\'rcQuitar("'+r.ID_SERVICIO_INSUMO+'")\' title="Quitar">🗑️</button></td>'+
      '</tr>';
    });
    html+='</tbody></table>';
  }

  // Fila para agregar
  html+='<div class="rc-add-row">'+
    '<div style="position:relative"><label class="rc-flabel">Insumo</label><input class="rc-finp" id="rc-prod-search" type="text" placeholder="Buscar producto…" oninput="rcBuscarProd()" autocomplete="off"/><input type="hidden" id="rc-prod-id"/><div id="rc-prod-result"></div></div>'+
    '<div><label class="rc-flabel">Cantidad</label><input class="rc-finp" id="rc-cant" type="number" min="0" step="0.01" placeholder="1"/></div>'+
    '<div><button class="rc-btn primary" id="rc-btn-add" onclick="rcAgregar()">+ Agregar</button></div>'+
  '</div>';

  html+='</div>';
  cont.innerHTML=html;
}

function rcBuscarProd() {
  var q=document.getElementById('rc-prod-search').value.toLowerCase().trim();
  var cont=document.getElementById('rc-prod-result');
  if(q.length<2){ cont.innerHTML=''; cont.className=''; return; }
  var res=rcProductos.filter(function(p){
    return String(p.NOMBRE||'').toLowerCase().indexOf(q)>=0 || String(p.CODIGO||'').toLowerCase().indexOf(q)>=0;
  }).slice(0,8);
  if(!res.length){ cont.innerHTML='<div style="color:#8A8A8A">Sin resultados</div>'; cont.className='rc-result'; return; }
  cont.className='rc-result';
  cont.innerHTML=res.map(function(p){
    return '<div onclick=\'rcSelProd("'+p.ID_PRODUCTO+'")\'>'+p.NOMBRE+' <span class="rc-id">('+(p.UNIDAD_MEDIDA||'')+' · stock '+(p.STOCK||0)+')</span></div>';
  }).join('');
}
function rcSelProd(id) {
  var p=rcProductos.find(function(x){ return x.ID_PRODUCTO===id; });
  if(!p) return;
  rcProdSel=p;
  document.getElementById('rc-prod-id').value=p.ID_PRODUCTO;
  document.getElementById('rc-prod-search').value=p.NOMBRE;
  document.getElementById('rc-prod-result').innerHTML='';
  document.getElementById('rc-prod-result').className='';
}

function rcAgregar() {
  var idServ=document.getElementById('rc-servicio').value;
  var idProd=document.getElementById('rc-prod-id').value;
  if(!idProd){ alert('⚠ Busque y seleccione un insumo'); return; }
  var cant=parseFloat(document.getElementById('rc-cant').value)||0;
  if(cant<=0){ alert('⚠ Ingrese una cantidad válida'); return; }
  var btn=document.getElementById('rc-btn-add'); btn.disabled=true; btn.textContent='⏳…';
  google.script.run
    .withSuccessHandler(function(resp){
      btn.disabled=false; btn.textContent='+ Agregar';
      if(!resp||!resp.ok){ alert('⚠ '+(resp?resp.mensaje:'Error')); return; }
      if(typeof pnNotif==='function') pnNotif('✓ '+resp.mensaje,'ok');
      rcCargarReceta();
      rcCargarConfigurados();
    })
    .withFailureHandler(function(e){ btn.disabled=false; btn.textContent='+ Agregar'; alert('⚠ '+e.message); })
    .ejecutar('agregarInsumoReceta', {
      ID_SERVICIO:idServ, ID_PRODUCTO:idProd, CANTIDAD:cant,
      usuario:sesion.USUARIO||'', rol:sesion.ROL||'', token:sesion.TOKEN||''
    });
}

function rcQuitar(idSI) {
  if(!confirm('¿Quitar este insumo de la receta?')) return;
  google.script.run
    .withSuccessHandler(function(resp){
      if(!resp||!resp.ok){ alert('⚠ '+(resp?resp.mensaje:'Error')); return; }
      if(typeof pnNotif==='function') pnNotif('✓ Insumo quitado','ok');
      rcCargarReceta();
      rcCargarConfigurados();
    })
    .withFailureHandler(function(e){ alert('⚠ '+e.message); })
    .ejecutar('quitarInsumoReceta', { ID_SERVICIO_INSUMO:idSI, usuario:sesion.USUARIO||'', rol:sesion.ROL||'', token:sesion.TOKEN||'' });
}
</script>
