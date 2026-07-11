// ============================================================
// VIZVALL — reportes.gs — 7 reportes con filtros, totales y tabla
// Prefijo rpt para no chocar con reporte* existentes.
// ============================================================

function rpt_inRango_(fecha, desde, hasta) {
  if (!fecha) return false;
  var f = String(fecha).substring(0, 10); // yyyy-MM-dd
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

// ════════════════════════════════════════════════════════════
//  1. REPORTE DE VENTAS
// ════════════════════════════════════════════════════════════
function rptVentas(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && v.ESTADO !== 'ANULADA' && rpt_inRango_(v.FECHA_VENTA, desde, hasta); });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var comprobantes = leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila);

    var totalVentas = 0, totalIGV = 0, totalDesc = 0;
    var filas = ventas.map(function(v){
      var pac = '—';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === v.ID_PACIENTE) {
          var pp = pacientes[i];
          pac = (pp.RAZON_SOCIAL && pp.RAZON_SOCIAL !== '-') ? pp.RAZON_SOCIAL : ((pp.NOMBRES||'')+' '+(pp.APELLIDOS||'')); break;
        }
      }
      var comp = '—';
      for (var c = 0; c < comprobantes.length; c++) { if (comprobantes[c].ID_TCOMPROBANTE === v.ID_TCOMPROBANTE) { comp = comprobantes[c].NOMBRE; break; } }
      totalVentas += parseFloat(v.TOTAL) || 0;
      totalIGV += parseFloat(v.IGV) || 0;
      totalDesc += parseFloat(v.DESCUENTO) || 0;
      return {
        FECHA: v.FECHA_VENTA, COMPROBANTE: comp, NUMERO: v.NUMERO_COMPROBANTE,
        PACIENTE: pac, SUBTOTAL: v.SUBTOTAL, DESCUENTO: v.DESCUENTO, IGV: v.IGV, TOTAL: v.TOTAL,
        ESTADO_COMP: v.ESTADO_COMPROBANTE,
      };
    });
    filas.sort(function(a,b){ return (a.FECHA||'') > (b.FECHA||'') ? -1 : 1; });
    return respuestaOK({
      filas: filas,
      totales: { NUM: filas.length, TOTAL: totalVentas.toFixed(2), IGV: totalIGV.toFixed(2), DESCUENTO: totalDesc.toFixed(2) },
    });
  } catch (err) { return respuestaError('Error reporte ventas: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  2. REPORTE DE CITAS
// ════════════════════════════════════════════════════════════
function rptCitas(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_CITA && rpt_inRango_(c.FECHA_CITA, desde, hasta); });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);

    var porEstado = {};
    var filas = citas.map(function(c){
      var pac = '—', med = '—', esp = '—';
      for (var i = 0; i < pacientes.length; i++) { if (pacientes[i].ID_PACIENTE === c.ID_PACIENTE) { var pp = pacientes[i]; pac = (pp.RAZON_SOCIAL && pp.RAZON_SOCIAL !== '-') ? pp.RAZON_SOCIAL : ((pp.NOMBRES||'')+' '+(pp.APELLIDOS||'')); break; } }
      for (var j = 0; j < medicos.length; j++) { if (medicos[j].ID_MEDICO === c.ID_MEDICO) { med = (medicos[j].NOMBRES||'')+' '+(medicos[j].APELLIDOS||''); break; } }
      for (var k = 0; k < especialidades.length; k++) { if (especialidades[k].ID_ESPECIALIDAD === c.ID_ESPECIALIDAD) { esp = especialidades[k].ESPECIALIDAD || '—'; break; } }
      var est = c.ESTADO_CITA || 'SIN ESTADO';
      porEstado[est] = (porEstado[est] || 0) + 1;
      return { FECHA: c.FECHA_CITA, HORA: c.HORA_CITA, PACIENTE: pac, MEDICO: med, ESPECIALIDAD: esp, ESTADO: est, PAGO: c.ESTADO_PAGO || 'PENDIENTE' };
    });
    filas.sort(function(a,b){ return (a.FECHA||'') > (b.FECHA||'') ? -1 : 1; });
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, POR_ESTADO: porEstado } });
  } catch (err) { return respuestaError('Error reporte citas: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  3. REPORTE DE PACIENTES
// ════════════════════════════════════════════════════════════
function rptPacientes(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila)
      .filter(function(p){ return p.ID_PACIENTE && String(p.ID_PACIENTE).trim() !== ''; });
    // Si hay rango, filtrar por fecha de registro
    if (desde || hasta) pacientes = pacientes.filter(function(p){ return rpt_inRango_(p.FECHA_REGISTRO, desde, hasta); });
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var tiposDoc = leerHoja(HOJAS.TIPO_DOCUMENTO).map(limpiarFila);

    var conCitas = 0;
    var filas = pacientes.map(function(p){
      var nombre = (p.RAZON_SOCIAL && p.RAZON_SOCIAL !== '-') ? p.RAZON_SOCIAL : ((p.NOMBRES||'')+' '+(p.APELLIDOS||''));
      var tdoc = 'DOC';
      for (var t = 0; t < tiposDoc.length; t++) { if (String(tiposDoc[t].ID_TIPO_DOCUMENTO) === String(p.ID_TIPO_DOCUMENTO)) { tdoc = tiposDoc[t].TIPO; break; } }
      var numCitas = 0;
      for (var i = 0; i < citas.length; i++) { if (citas[i].ID_PACIENTE === p.ID_PACIENTE) numCitas++; }
      if (numCitas > 0) conCitas++;
      return { NOMBRE: nombre, TDOC: tdoc, DOCUMENTO: p.NUMERO_DOCUMENTO, TELEFONO: p.TELEFONO, CORREO: p.CORREO, NUM_CITAS: numCitas, FECHA_REGISTRO: p.FECHA_REGISTRO, ESTADO: p.ESTADO };
    });
    filas.sort(function(a,b){ return (a.FECHA_REGISTRO||'') > (b.FECHA_REGISTRO||'') ? -1 : 1; });
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, CON_CITAS: conCitas } });
  } catch (err) { return respuestaError('Error reporte pacientes: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  4. REPORTE DE MÉDICOS (con citas atendidas en el rango)
// ════════════════════════════════════════════════════════════
function rptMedicos(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila)
      .filter(function(m){ return m.ID_MEDICO && String(m.ID_MEDICO).trim() !== ''; });
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return rpt_inRango_(c.FECHA_CITA, desde, hasta); });
    var mesp = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);

    var filas = medicos.map(function(m){
      var numCitas = 0, atendidas = 0;
      for (var i = 0; i < citas.length; i++) {
        if (citas[i].ID_MEDICO === m.ID_MEDICO) {
          numCitas++;
          if (String(citas[i].ESTADO_CITA||'').toUpperCase().indexOf('ATENDID') >= 0) atendidas++;
        }
      }
      // especialidades del médico
      var esps = [];
      for (var j = 0; j < mesp.length; j++) {
        if (mesp[j].ID_MEDICO === m.ID_MEDICO) {
          for (var k = 0; k < especialidades.length; k++) { if (especialidades[k].ID_ESPECIALIDAD === mesp[j].ID_ESPECIALIDAD) { esps.push(especialidades[k].ESPECIALIDAD); break; } }
        }
      }
      return { NOMBRE: (m.NOMBRES||'')+' '+(m.APELLIDOS||''), CMP: m.NUMERO_CMP, ESPECIALIDADES: esps.join(', ') || '—', NUM_CITAS: numCitas, ATENDIDAS: atendidas, ESTADO: m.ESTADO };
    });
    filas.sort(function(a,b){ return b.NUM_CITAS - a.NUM_CITAS; });
    var totalCitas = filas.reduce(function(a,f){ return a + f.NUM_CITAS; }, 0);
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, TOTAL_CITAS: totalCitas } });
  } catch (err) { return respuestaError('Error reporte médicos: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  5. REPORTE DE CAJA (movimientos en el rango)
// ════════════════════════════════════════════════════════════
function rptCaja(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
      .filter(function(m){ return m.ID_CAJA && m.ESTADO !== 'ANULADO' && rpt_inRango_(m.FECHA, desde, hasta); });
    var conceptos = leerHoja(HOJAS.TCONCEPTO_CAJA).map(limpiarFila);

    var totalIngresos = 0, totalEgresos = 0;
    var filas = movs.map(function(m){
      var conc = '—';
      for (var c = 0; c < conceptos.length; c++) { if (conceptos[c].ID_TCONCEPTO_CAJA === m.ID_TCONCEPTO_CAJA) { conc = conceptos[c].NOMBRE; break; } }
      var monto = parseFloat(m.MONTO) || 0;
      if (m.TIPO === 'INGRESO') totalIngresos += monto;
      else if (m.TIPO === 'EGRESO') totalEgresos += monto;
      return { FECHA: m.FECHA, HORA: m.HORA, TIPO: m.TIPO, CONCEPTO: (conc !== '—' ? conc : (m.ID_VENTA && m.ID_VENTA !== '-' ? 'Venta ' + m.ID_VENTA : '—')), MODO_PAGO: m.MODO_PAGO, MONTO: m.MONTO, USUARIO: m.USUARIO, OBS: m.OBSERVACIONES };
    });
    filas.sort(function(a,b){ var fa=(a.FECHA||'')+(a.HORA||''), fb=(b.FECHA||'')+(b.HORA||''); return fa > fb ? -1 : 1; });
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, INGRESOS: totalIngresos.toFixed(2), EGRESOS: totalEgresos.toFixed(2), NETO: (totalIngresos - totalEgresos).toFixed(2) } });
  } catch (err) { return respuestaError('Error reporte caja: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  6. REPORTE DE SESIONES (control de sesiones)
// ════════════════════════════════════════════════════════════
function rptSesiones(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var ctrls = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila)
      .filter(function(s){ return s.ID_CONTROL && (!desde && !hasta ? true : rpt_inRango_(s.FECHA_INICIO, desde, hasta)); });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);

    var totalSes = 0, usadas = 0, restantes = 0;
    var filas = ctrls.map(function(s){
      var pac = '—', paq = '—';
      for (var i = 0; i < pacientes.length; i++) { if (pacientes[i].ID_PACIENTE === s.ID_PACIENTE) { var pp = pacientes[i]; pac = (pp.RAZON_SOCIAL && pp.RAZON_SOCIAL !== '-') ? pp.RAZON_SOCIAL : ((pp.NOMBRES||'')+' '+(pp.APELLIDOS||'')); break; } }
      for (var j = 0; j < paquetes.length; j++) { if (paquetes[j].ID_PAQUETE === s.ID_PAQUETE) { paq = paquetes[j].NOMBRE_PAQUETE; break; } }
      totalSes += parseInt(s.TOTAL_SESIONES) || 0;
      usadas += parseInt(s.SESIONES_USADAS) || 0;
      restantes += parseInt(s.SESIONES_RESTANTES) || 0;
      return { PACIENTE: pac, PAQUETE: paq, TOTAL: s.TOTAL_SESIONES, USADAS: s.SESIONES_USADAS, RESTANTES: s.SESIONES_RESTANTES, INICIO: s.FECHA_INICIO, ESTADO: s.ESTADO };
    });
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, TOTAL_SESIONES: totalSes, USADAS: usadas, RESTANTES: restantes } });
  } catch (err) { return respuestaError('Error reporte sesiones: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  7. REPORTE DE PAQUETES VENDIDOS (desde DVENTA tipo PAQUETE)
// ════════════════════════════════════════════════════════════
function rptPaquetes(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ESTADO !== 'ANULADA' && rpt_inRango_(v.FECHA_VENTA, desde, hasta); });
    var ventaIds = {};
    ventas.forEach(function(v){ ventaIds[v.ID_VENTA] = v.FECHA_VENTA; });

    var dventa = leerHoja(HOJAS.DVENTA).map(limpiarFila)
      .filter(function(d){ return d.TIPO === 'PAQUETE' && ventaIds[d.ID_VENTA]; });
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);

    // Agrupar por paquete
    var agrupado = {};
    dventa.forEach(function(d){
      var nombre = '—';
      for (var p = 0; p < paquetes.length; p++) { if (paquetes[p].ID_PAQUETE === d.ID_PAQUETE) { nombre = paquetes[p].NOMBRE_PAQUETE; break; } }
      if (!agrupado[d.ID_PAQUETE]) agrupado[d.ID_PAQUETE] = { NOMBRE: nombre, CANTIDAD: 0, TOTAL: 0 };
      agrupado[d.ID_PAQUETE].CANTIDAD += parseInt(d.CANTIDAD) || 1;
      agrupado[d.ID_PAQUETE].TOTAL += parseFloat(d.SUBTOTAL) || 0;
    });
    var filas = [], totalVendido = 0, totalCant = 0;
    for (var key in agrupado) {
      if (agrupado.hasOwnProperty(key)) {
        var g = agrupado[key];
        totalVendido += g.TOTAL; totalCant += g.CANTIDAD;
        filas.push({ PAQUETE: g.NOMBRE, CANTIDAD: g.CANTIDAD, TOTAL: g.TOTAL.toFixed(2) });
      }
    }
    filas.sort(function(a,b){ return b.CANTIDAD - a.CANTIDAD; });
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, CANTIDAD: totalCant, TOTAL: totalVendido.toFixed(2) } });
  } catch (err) { return respuestaError('Error reporte paquetes: ' + err.message); }
}

// ════════════════════════════════════════════════════════════
//  REPORTE DE HONORARIOS — por personal (médicos y profesionales)
//  Agrupa turnos/horas (asistencia), comisión generada y total pagado
//  dentro del rango de fechas. Mismo patrón que los demás reportes.
// ════════════════════════════════════════════════════════════
function rptHonorarios(params) {
  try {
    var desde = params.fechaDesde, hasta = params.fechaHasta;

    var asistencia = leerHoja(HOJAS.ASISTENCIA_PERSONAL).map(limpiarFila);
    var comisiones = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
    var pagos      = leerHoja(HOJAS.PAGO_HONORARIO).map(limpiarFila);

    // Acumulador por persona: clave = TIPO|ID
    var porPersona = {};
    function obtener(tipo, id, nombre) {
      var k = String(tipo || 'MEDICO') + '|' + String(id || '-');
      if (!porPersona[k]) {
        porPersona[k] = { NOMBRE: nombre || id || '—', TIPO: (tipo === 'PROFESIONAL' ? 'Profesional' : 'Médico'),
                          TURNOS: 0, HORAS: 0, COMISION: 0, PAGADO: 0 };
      }
      // Completar nombre si llegó vacío antes
      if ((!porPersona[k].NOMBRE || porPersona[k].NOMBRE === '—') && nombre) porPersona[k].NOMBRE = nombre;
      return porPersona[k];
    }

    // 1) Asistencia (turnos y horas) en rango
    asistencia.forEach(function(a){
      if (String(a.ESTADO || '').toUpperCase() === 'ANULADO') return;
      if (!rpt_inRango_(a.FECHA, desde, hasta)) return;
      var p = obtener(a.TIPO_PERSONAL, a.ID_PERSONAL, a.NOMBRE_PERSONAL);
      // Solo contar turno si asistió (ASISTIO verdadero / 'SI' / true)
      var asistio = String(a.ASISTIO).toUpperCase();
      if (asistio === 'SI' || asistio === 'TRUE' || a.ASISTIO === true) p.TURNOS += 1;
      p.HORAS += parseFloat(a.HORAS) || 0;
    });

    // 2) Comisiones generadas en rango (por fecha de registro)
    comisiones.forEach(function(co){
      if (String(co.ESTADO || '').toUpperCase() === 'ANULADA') return;
      if (!rpt_inRango_(co.FECHA_REGISTRO, desde, hasta)) return;
      var p = obtener(co.TIPO_EJECUTOR, co.ID_MEDICO, co.NOMBRE_MEDICO);
      p.COMISION += parseFloat(co.MONTO_COMISION) || 0;
    });

    // 3) Pagos de honorarios realizados en rango (por fecha de pago)
    pagos.forEach(function(pg){
      if (String(pg.ESTADO || '').toUpperCase() === 'ANULADO') return;
      if (!rpt_inRango_(pg.FECHA_PAGO, desde, hasta)) return;
      var p = obtener(pg.TIPO_PERSONAL, pg.ID_PERSONAL, pg.NOMBRE_PERSONAL);
      p.PAGADO += parseFloat(pg.MONTO) || 0;
    });

    // Construir filas + totales
    var totTurnos = 0, totComision = 0, totPagado = 0;
    var filas = Object.keys(porPersona).map(function(k){
      var p = porPersona[k];
      totTurnos   += p.TURNOS;
      totComision += p.COMISION;
      totPagado   += p.PAGADO;
      return {
        NOMBRE: p.NOMBRE, TIPO: p.TIPO,
        TURNOS: p.TURNOS, HORAS: (p.HORAS % 1 === 0 ? p.HORAS : p.HORAS.toFixed(1)),
        COMISION: p.COMISION.toFixed(2), PAGADO: p.PAGADO.toFixed(2)
      };
    });
    // Ordenar por total pagado desc, luego comisión desc
    filas.sort(function(a,b){
      var d = parseFloat(b.PAGADO) - parseFloat(a.PAGADO);
      return d !== 0 ? d : (parseFloat(b.COMISION) - parseFloat(a.COMISION));
    });

    return respuestaOK({
      filas: filas,
      totales: {
        NUM: filas.length,
        TOTAL_PAGADO: totPagado.toFixed(2),
        TOTAL_COMISION: totComision.toFixed(2),
        TOTAL_TURNOS: totTurnos
      }
    });
  } catch (err) { return respuestaError('Error reporte honorarios: ' + err.message); }
}


// ════════════════════════════════════════════════════════════════════════
//  REPORTE DE HORARIOS (Médicos y Profesionales de apoyo)
//  params.tipoHorario: 'MEDICO' | 'APOYO' | '' (todos)
// ════════════════════════════════════════════════════════════════════════
function rptHorarios(params) {
  try {
    var filtro = String(params.tipoHorario || '').toUpperCase(); // MEDICO, APOYO o vacío
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);

    function nomMedico(id){ for(var i=0;i<medicos.length;i++){ if(medicos[i].ID_MEDICO===id) return ((medicos[i].NOMBRES||'')+' '+(medicos[i].APELLIDOS||'')).trim(); } return '—'; }
    function nomProf(id){ for(var i=0;i<profs.length;i++){ if(profs[i].ID_PROFESIONAL===id) return ((profs[i].NOMBRES||'')+' '+(profs[i].APELLIDOS||'')).trim(); } return '—'; }
    function nomEsp(id){ for(var i=0;i<especialidades.length;i++){ if(especialidades[i].ID_ESPECIALIDAD===id) return especialidades[i].ESPECIALIDAD||'—'; } return '—'; }
    function nomArea(id){ for(var i=0;i<areas.length;i++){ if(areas[i].ID_AREA_APOYO===id) return areas[i].NOMBRE||'—'; } return '—'; }

    // Orden de días para ordenar la salida
    var ordenDia = { 'LUNES':1,'MARTES':2,'MIERCOLES':3,'MIÉRCOLES':3,'JUEVES':4,'VIERNES':5,'SABADO':6,'SÁBADO':6,'DOMINGO':7 };

    var filas = [];

    // Horarios de médicos
    if (filtro !== 'APOYO') {
      var hMed = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
        .filter(function(h){ return h.ID_HORARIO && String(h.ESTADO||'').toUpperCase() !== 'INACTIVO'; });
      hMed.forEach(function(h){
        filas.push({
          TIPO: 'MÉDICO',
          PROFESIONAL: nomMedico(h.ID_MEDICO),
          AREA_ESP: nomEsp(h.ID_ESPECIALIDAD),
          DIA: h.DIA_SEMANA || '—',
          HORA_INICIO: h.HORA_INICIO || '—',
          HORA_FIN: h.HORA_FIN || '—',
          INTERVALO: (h.INTERVALO_MIN||'—')+' min'
        });
      });
    }

    // Horarios de profesionales de apoyo
    if (filtro !== 'MEDICO') {
      var hApo = leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila)
        .filter(function(h){ return h.ID_HORARIO_APOYO && String(h.ESTADO||'').toUpperCase() !== 'INACTIVO'; });
      hApo.forEach(function(h){
        var quien = (String(h.TIPO_EJECUTOR||'').toUpperCase()==='MEDICO') ? nomMedico(h.ID_MEDICO) : nomProf(h.ID_PROFESIONAL);
        filas.push({
          TIPO: 'APOYO',
          PROFESIONAL: quien,
          AREA_ESP: nomArea(h.ID_AREA_APOYO),
          DIA: h.DIA_SEMANA || '—',
          HORA_INICIO: h.HORA_INICIO || '—',
          HORA_FIN: h.HORA_FIN || '—',
          INTERVALO: (h.INTERVALO_MIN||'—')+' min'
        });
      });
    }

    // Ordenar por profesional y luego por día
    filas.sort(function(a,b){
      if (a.PROFESIONAL !== b.PROFESIONAL) return a.PROFESIONAL < b.PROFESIONAL ? -1 : 1;
      return (ordenDia[String(a.DIA).toUpperCase()]||9) - (ordenDia[String(b.DIA).toUpperCase()]||9);
    });

    var nMed = filas.filter(function(f){ return f.TIPO==='MÉDICO'; }).length;
    var nApo = filas.filter(function(f){ return f.TIPO==='APOYO'; }).length;
    return respuestaOK({ filas: filas, totales: { NUM: filas.length, MEDICOS: nMed, APOYO: nApo } });
  } catch (err) { return respuestaError('Error reporte horarios: ' + err.message); }
}
