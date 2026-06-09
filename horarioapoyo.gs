<!-- MODULO: HORARIOS DE PROFESIONALES DE APOYO — prefijo "ha" -->
<style>
#sec-horarioapoyo { display:none;overflow:auto;position:absolute;top:56px;left:0;right:0;bottom:0;background:var(--bg,#F2F3F5); }
#sec-horarioapoyo.activo { display:block; }
.ha-wrap { padding:18px 22px;max-width:1000px; }
.ha-head { margin-bottom:16px; }
.ha-title { font-size:18px;font-weight:600;color:#1A1A1A; }
.ha-sub { font-size:13px;color:#8A8A8A;margin-top:3px; }
.ha-card { background:#fff;border:1px solid #EEF0F3;border-radius:12px;padding:18px;margin-bottom:16px; }
.ha-fg { margin-bottom:12px; }
.ha-flabel { display:block;font-size:12.5px;color:#444;margin-bottom:4px;font-weight:500; }
.ha-finp { width:100%;padding:9px 11px;border:1px solid #E2E4E9;border-radius:8px;font-size:13.5px;box-sizing:border-box;background:#fff; }
.ha-finp:focus { border-color:#C8241A;outline:none; }
.ha-btn { padding:8px 15px;border:1px solid #E2E4E9;border-radius:8px;background:#fff;cursor:pointer;font-size:13px; }
.ha-btn.primary { background:#C8241A;color:#fff;border-color:#C8241A; }
.ha-btn:disabled { opacity:.5;cursor:not-allowed; }
.ha-table { width:100%;border-collapse:collapse;font-size:13px; }
.ha-table th { text-align:left;padding:10px 12px;border-bottom:2px solid #EEF0F3;color:#6B6B6B;font-weight:600;font-size:12px;background:#FAFBFC; }
.ha-table td { padding:10px 12px;border-bottom:1px solid #F2F3F5; }
.ha-empty { text-align:center;color:#8A8A8A;padding:30px 20px;font-size:13.5px; }
.ha-accion { background:none;border:none;cursor:pointer;font-size:13px;padding:3px 7px;border-radius:6px;color:#6B6B6B; }
.ha-accion:hover { background:#F2F3F5; }
.ha-add { display:grid;grid-template-columns:1.3fr 1fr 1fr 0.9fr auto;gap:10px;align-items:end;background:#FAFBFC;border-radius:8px;padding:12px;margin-top:12px; }
.ha-dia { display:inline-block;padding:2px 9px;border-radius:10px;font-size:11.5px;background:#EAF3FD;color:#1A6FC4;font-weight:500; }
@media(max-width:600px){ .ha-add{grid-template-columns:1fr} }
</style>

<div id="sec-horarioapoyo">
<div class="ha-wrap">
  <div class="ha-head">
    <div class="ha-title">🕐 Horarios de Profesionales de Apoyo</div>
    <div class="ha-sub">Define los días y horas de atención de cada profesional. Estos horarios aparecen al agendar una cita de servicio de apoyo.</div>
  </div>

  <div class="ha-card">
    <div class="ha-fg" style="margin-bottom:0">
      <label class="ha-flabel">Seleccione un profesional</label>
      <select class="ha-finp" id="ha-prof" onchange="haCargar()">
        <option value="">— Seleccione —</option>
      </select>
    </div>
  </div>

  <div id="ha-cont"></div>
</div>
</div><!-- /sec-horarioapoyo -->

<script>
var haProfs=[];
var HA_DIAS=['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'];

function haAbrir() {
  var sel=document.getElementById('ha-prof');
  sel.innerHTML='<option value="">— Seleccione —</option>';
  document.getElementById('ha-cont').innerHTML='';
  // 1. Profesionales de apoyo
  google.script.run.withSuccessHandler(function(resp){
    var arr=[];
    if(resp&&resp.ok&&resp.datos){
      if(Array.isArray(resp.datos)) arr=resp.datos;
      else if(Array.isArray(resp.datos.datos)) arr=resp.datos.datos;
    }
    var profs=arr.filter(function(p){ return p.ESTADO==='ACTIVO'; });
    if(profs.length){
      var grp=document.createElement('optgroup'); grp.label='Profesionales de apoyo';
      profs.forEach(function(p){ var o=document.createElement('option'); o.value='PROFESIONAL|'+p.ID_PROFESIONAL; o.textContent=(p.NOMBRES||'')+' '+(p.APELLIDOS||'')+' ('+(p.PROFESION||'')+')'; grp.appendChild(o); });
      sel.appendChild(grp);
    }
  }).withFailureHandler(function(){}).ejecutar('listarProfApoyo',{limite:500,usuario:sesion.USUARIO||'',rol:sesion.ROL||'',token:sesion.TOKEN||''});

  // 2. Médicos con área de apoyo asignada
  google.script.run.withSuccessHandler(function(resp){
    var meds = resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos:[];
    if(meds.length){
      var grp=document.createElement('optgroup'); grp.label='Médicos con servicios de apoyo';
      meds.forEach(function(m){ var o=document.createElement('option'); o.value='MEDICO|'+m.ID_MEDICO; o.textContent='Dr. '+(m.NOMBRES||'')+' '+(m.APELLIDOS||''); grp.appendChild(o); });
      sel.appendChild(grp);
    }
  }).withFailureHandler(function(){}).ejecutar('listarMedicosConApoyo',{usuario:sesion.USUARIO||'',rol:sesion.ROL||'',token:sesion.TOKEN||''});
}

var haEjecTipo='', haEjecId='', haMedAreas=[];

function haCargar() {
  var val=document.getElementById('ha-prof').value;
  var cont=document.getElementById('ha-cont');
  if(!val){ cont.innerHTML=''; return; }
  var pe=val.split('|'); haEjecTipo=pe[0]; haEjecId=pe[1];
  cont.innerHTML='<div class="ha-card"><div class="ha-empty">Cargando horarios…</div></div>';

  // Si es médico, cargar sus áreas de apoyo (necesarias para asignar horario)
  if(haEjecTipo==='MEDICO'){
    google.script.run.withSuccessHandler(function(resp){
      haMedAreas = resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos:[];
      haPedirHorarios();
    }).withFailureHandler(function(){ haMedAreas=[]; haPedirHorarios(); })
      .ejecutar('listarAreasMedico',{ID_MEDICO:haEjecId,usuario:sesion.USUARIO||'',rol:sesion.ROL||'',token:sesion.TOKEN||''});
  } else {
    haMedAreas=[];
    haPedirHorarios();
  }
}

function haPedirHorarios() {
  var cont=document.getElementById('ha-cont');
  google.script.run
    .withSuccessHandler(function(resp){
      var hors=resp&&resp.ok&&Array.isArray(resp.datos)?resp.datos:[];
      haRender(haEjecId, hors);
    })
    .withFailureHandler(function(e){ cont.innerHTML='<div class="ha-card" style="color:#C8241A">⚠ '+e.message+'</div>'; })
    .ejecutar('listarHorariosApoyo', { TIPO_EJECUTOR:haEjecTipo, ID_EJECUTOR:haEjecId, usuario:sesion.USUARIO||'', rol:sesion.ROL||'', token:sesion.TOKEN||'' });
}

function haRender(idProf, hors) {
  var cont=document.getElementById('ha-cont');
  var html='<div class="ha-card"><h3 style="margin:0 0 12px;font-size:15px">Horarios de atención</h3>';
  if(!hors.length){
    html+='<div class="ha-empty">Sin horarios definidos. Agregue el primero abajo.</div>';
  } else {
    html+='<table class="ha-table"><thead><tr><th>Día</th><th>Desde</th><th>Hasta</th><th style="text-align:right">Intervalo</th><th style="text-align:right">Acción</th></tr></thead><tbody>';
    hors.forEach(function(h){
      html+='<tr>'+
        '<td><span class="ha-dia">'+h.DIA_SEMANA+'</span></td>'+
        '<td>'+h.HORA_INICIO+'</td>'+
        '<td>'+h.HORA_FIN+'</td>'+
        '<td style="text-align:right">'+(h.INTERVALO_MIN||30)+' min</td>'+
        '<td style="text-align:right"><button class="ha-accion" style="color:#C8241A" onclick=\'haQuitar("'+h.ID_HORARIO_APOYO+'")\' title="Eliminar">🗑️</button></td>'+
      '</tr>';
    });
    html+='</tbody></table>';
  }
  // Si es médico, selector de área de apoyo (puede tener varias)
  if(haEjecTipo==='MEDICO'){
    if(!haMedAreas.length){
      html+='<div style="background:#FBE9D0;border:1px solid #F0C98A;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#8A5A00;margin-top:12px">⚠ Este médico no tiene áreas de apoyo asignadas. Primero asígnele un área en <b>Médicos → Especialidades</b>.</div>';
      html+='</div>'; document.getElementById('ha-cont').innerHTML=html; return;
    }
    var optAreas=haMedAreas.map(function(a){ return '<option value="'+a.ID_AREA_APOYO+'">'+a.AREA_NOMBRE+'</option>'; }).join('');
    html+='<div style="margin-top:12px"><label class="ha-flabel">Área de apoyo</label><select class="ha-finp" id="ha-area" style="max-width:300px">'+optAreas+'</select></div>';
  }
  // Fila para agregar
  var optDias=HA_DIAS.map(function(d){ return '<option value="'+d+'">'+d+'</option>'; }).join('');
  html+='<div class="ha-add">'+
    '<div><label class="ha-flabel">Día</label><select class="ha-finp" id="ha-dia">'+optDias+'</select></div>'+
    '<div><label class="ha-flabel">Desde</label><input class="ha-finp" id="ha-ini" type="time" value="08:00"/></div>'+
    '<div><label class="ha-flabel">Hasta</label><input class="ha-finp" id="ha-fin" type="time" value="13:00"/></div>'+
    '<div><label class="ha-flabel">Intervalo</label><select class="ha-finp" id="ha-intv"><option value="15">15 min</option><option value="20">20 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></div>'+
    '<div><button class="ha-btn primary" id="ha-btn-add" onclick="haAgregar()">+ Agregar</button></div>'+
  '</div>';
  html+='</div>';
  cont.innerHTML=html;
}

function haAgregar() {
  if(!haEjecId){ alert('⚠ Seleccione un ejecutor'); return; }
  var dia=document.getElementById('ha-dia').value;
  var ini=document.getElementById('ha-ini').value;
  var fin=document.getElementById('ha-fin').value;
  var intv=document.getElementById('ha-intv').value;
  if(!ini||!fin){ alert('⚠ Indique las horas'); return; }
  if(fin<=ini){ alert('⚠ La hora de fin debe ser mayor a la de inicio'); return; }

  var params={ TIPO_EJECUTOR:haEjecTipo, DIA_SEMANA:dia, HORA_INICIO:ini, HORA_FIN:fin, INTERVALO_MIN:intv,
    usuario:sesion.USUARIO||'', rol:sesion.ROL||'', token:sesion.TOKEN||'' };
  if(haEjecTipo==='MEDICO'){
    var idArea=document.getElementById('ha-area')?document.getElementById('ha-area').value:'';
    if(!idArea){ alert('⚠ Seleccione el área de apoyo'); return; }
    params.ID_MEDICO=haEjecId; params.ID_AREA_APOYO=idArea;
  } else {
    params.ID_PROFESIONAL=haEjecId;
  }

  var btn=document.getElementById('ha-btn-add'); btn.disabled=true; btn.textContent='⏳…';
  google.script.run
    .withSuccessHandler(function(resp){
      btn.disabled=false; btn.textContent='+ Agregar';
      if(!resp||!resp.ok){ alert('⚠ '+(resp?resp.mensaje:'Error')); return; }
      if(typeof pnNotif==='function') pnNotif('✓ Horario agregado','ok');
      haCargar();
    })
    .withFailureHandler(function(e){ btn.disabled=false; btn.textContent='+ Agregar'; alert('⚠ '+e.message); })
    .ejecutar('guardarHorarioApoyo', params);
}

function haQuitar(id) {
  if(!confirm('¿Eliminar este horario?')) return;
  google.script.run
    .withSuccessHandler(function(resp){
      if(!resp||!resp.ok){ alert('⚠ '+(resp?resp.mensaje:'Error')); return; }
      if(typeof pnNotif==='function') pnNotif('✓ Horario eliminado','ok');
      haCargar();
    })
    .withFailureHandler(function(e){ alert('⚠ '+e.message); })
    .ejecutar('eliminarHorarioApoyo', { ID_HORARIO_APOYO:id, usuario:sesion.USUARIO||'', rol:sesion.ROL||'', token:sesion.TOKEN||'' });
}
</script>
