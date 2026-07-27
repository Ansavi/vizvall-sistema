// ════════════════════════════════════════════════════════════════════════
//  INDICADORES DE GESTIÓN (KPIs)
//  Reemplaza el antiguo "Tablero BI" (que solo guardaba un enlace externo).
//  Calcula 4 indicadores desde los datos del propio sistema:
//    1. Tasa de ocupación   (citas atendidas / agendadas)
//    2. Ticket promedio      (venta media)
//    3. Ingreso por especialidad / servicio
//    4. Comparativo mes actual vs mes anterior
//  Solo ADMINISTRADOR.
// ════════════════════════════════════════════════════════════════════════

function obtenerIndicadores(params) {
  try {
    params = params || {};
    var rol = (params._sesion && params._sesion.ROL) ? params._sesion.ROL : (params.rol || '');
    if (rol !== 'ADMINISTRADOR') {
      return respuestaError('Solo gerencia puede ver los indicadores.', 'ERR_PERMISO');
    }

    var hoy = getFecha('fecha');
    var periodo = String(params.periodo || 'MES').toUpperCase();
    var rango = _rangoPeriodo(periodo, hoy);
    var desde = rango.desde, hasta = rango.hasta;

    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== ''; });
    var dventas = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_CITA && String(c.ID_CITA).trim() !== ''; });
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);

    var servPorId = {};
    servicios.forEach(function(s){ servPorId[s.ID_SERVICIO] = s; });
    var espNombre = {};
    especialidades.forEach(function(e){ espNombre[e.ID_ESPECIALIDAD] = e.NOMBRE || e.NOMBRE_ESPECIALIDAD || e.ID_ESPECIALIDAD; });

    // 1. TASA DE OCUPACION
    var citasPeriodo = citas.filter(function(c){
      var f = String(c.FECHA_CITA || '').substring(0, 10);
      return f >= desde && f <= hasta;
    });
    var agendadas = 0, atendidas = 0, canceladas = 0;
    citasPeriodo.forEach(function(c){
      var est = String(c.ESTADO_CITA || '').toUpperCase();
      if (est === 'CANCELADA') { canceladas++; return; }
      agendadas++;
      if (est === 'ATENDIDA' || est === 'COMPLETADA' || est === 'REALIZADA') atendidas++;
    });
    var ocupacion = agendadas > 0 ? Math.round((atendidas / agendadas) * 1000) / 10 : 0;

    // 2. TICKET PROMEDIO
    var ventasPeriodo = ventas.filter(function(v){
      var f = String(v.FECHA_VENTA || '').substring(0, 10);
      return f >= desde && f <= hasta;
    });
    var totalVentas = 0, pacientesSet = {};
    ventasPeriodo.forEach(function(v){
      totalVentas += (parseFloat(v.TOTAL) || 0);
      if (v.ID_PACIENTE) pacientesSet[v.ID_PACIENTE] = true;
    });
    var nVentas = ventasPeriodo.length;
    var ticketPromedio = nVentas > 0 ? Math.round((totalVentas / nVentas) * 100) / 100 : 0;
    var nPacientes = Object.keys(pacientesSet).length;

    // 3. INGRESO POR ESPECIALIDAD / SERVICIO
    var ventaEnRango = {};
    ventasPeriodo.forEach(function(v){ ventaEnRango[v.ID_VENTA] = true; });
    var ingEsp = {}, ingServ = {};
    dventas.forEach(function(d){
      if (!ventaEnRango[d.ID_VENTA]) return;
      var sub = parseFloat(d.SUBTOTAL) || 0;
      var serv = servPorId[d.ID_SERVICIO];
      var nombreServ = serv ? (serv.NOMBRE_SERVICIO || d.ID_SERVICIO) : (d.ID_SERVICIO || 'Otro');
      if (d.TIPO === 'PAQUETE') nombreServ = 'Paquete';
      ingServ[nombreServ] = (ingServ[nombreServ] || 0) + sub;
      var esp = serv && serv.ID_ESPECIALIDAD ? (espNombre[serv.ID_ESPECIALIDAD] || 'Sin especialidad') : 'Sin especialidad';
      ingEsp[esp] = (ingEsp[esp] || 0) + sub;
    });
    var topEsp = _kpiOrdenar(ingEsp);
    var topServ = _kpiOrdenar(ingServ).slice(0, 8);

    // 4. COMPARATIVO MES ACTUAL vs MES ANTERIOR
    var rMes = _rangoPeriodo('MES', hoy);
    var rPrev = _rangoPeriodo('MES_PASADO', hoy);
    var comp = {
      ventasActual:   _kpiSumaVentas(ventas, rMes.desde, rMes.hasta),
      ventasPrev:     _kpiSumaVentas(ventas, rPrev.desde, rPrev.hasta),
      citasActual:    _kpiCuentaCitas(citas, rMes.desde, rMes.hasta),
      citasPrev:      _kpiCuentaCitas(citas, rPrev.desde, rPrev.hasta),
      pacientesActual:_kpiCuentaPacientes(ventas, rMes.desde, rMes.hasta),
      pacientesPrev:  _kpiCuentaPacientes(ventas, rPrev.desde, rPrev.hasta)
    };
    comp.ventasVar    = _kpiVariacion(comp.ventasActual, comp.ventasPrev);
    comp.citasVar     = _kpiVariacion(comp.citasActual, comp.citasPrev);
    comp.pacientesVar = _kpiVariacion(comp.pacientesActual, comp.pacientesPrev);

    return respuestaOK({
      periodo: periodo, periodoEtiqueta: rango.etiqueta, desde: desde, hasta: hasta,
      ocupacion: ocupacion, agendadas: agendadas, atendidas: atendidas, canceladas: canceladas,
      ticketPromedio: ticketPromedio, totalVentas: Math.round(totalVentas * 100) / 100,
      nVentas: nVentas, nPacientes: nPacientes,
      ingresoEspecialidad: topEsp, ingresoServicio: topServ,
      comparativo: comp
    }, 'Indicadores calculados.');

  } catch (e) {
    return respuestaError('Error al calcular indicadores: ' + e.message);
  }
}

function _kpiOrdenar(obj) {
  var arr = [];
  for (var k in obj) { if (obj.hasOwnProperty(k)) arr.push({ nombre: k, monto: Math.round(obj[k] * 100) / 100 }); }
  arr.sort(function(a, b){ return b.monto - a.monto; });
  return arr;
}
function _kpiSumaVentas(ventas, desde, hasta) {
  var t = 0;
  ventas.forEach(function(v){
    var f = String(v.FECHA_VENTA || '').substring(0, 10);
    if (f >= desde && f <= hasta) t += (parseFloat(v.TOTAL) || 0);
  });
  return Math.round(t * 100) / 100;
}
function _kpiCuentaCitas(citas, desde, hasta) {
  var n = 0;
  citas.forEach(function(c){
    var f = String(c.FECHA_CITA || '').substring(0, 10);
    var est = String(c.ESTADO_CITA || '').toUpperCase();
    if (f >= desde && f <= hasta && est !== 'CANCELADA') n++;
  });
  return n;
}
function _kpiCuentaPacientes(ventas, desde, hasta) {
  var set = {};
  ventas.forEach(function(v){
    var f = String(v.FECHA_VENTA || '').substring(0, 10);
    if (f >= desde && f <= hasta && v.ID_PACIENTE) set[v.ID_PACIENTE] = true;
  });
  return Object.keys(set).length;
}
function _kpiVariacion(actual, previo) {
  if (previo === 0) return actual > 0 ? 100 : 0;
  return Math.round(((actual - previo) / previo) * 1000) / 10;
}

// ▶ Renombra el permiso "Tablero BI" a "Indicadores" conservando el ID.
function migrarPermisoIndicadores() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var hoja = ss.getSheetByName('PERMISO');
  if (!hoja) return 'X No existe la hoja PERMISO.';
  var datos = hoja.getDataRange().getValues();
  var iMod = datos[0].indexOf('MODULO');
  var iAcc = datos[0].indexOf('ACCION');
  if (iMod < 0 || iAcc < 0) return 'X Faltan columnas.';
  for (var r = 1; r < datos.length; r++) {
    var mod = String(datos[r][iMod] || '').toUpperCase();
    var acc = String(datos[r][iAcc] || '');
    if (mod === 'REPORTES' && acc === 'Tablero BI') {
      hoja.getRange(r + 1, iAcc + 1).setValue('Indicadores');
      var msg = 'Permiso "Tablero BI" renombrado a "Indicadores" (fila ' + (r + 1) + ').';
      Logger.log(msg);
      return msg;
    }
  }
  return 'No se encontro el permiso "Tablero BI". Quiza ya se renombro.';
}
