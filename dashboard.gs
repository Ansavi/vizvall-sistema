// ============================================================
// VIZVALL — dashboard.gs — Indicadores del panel principal
// 10 indicadores. Los que dependen de tablas futuras (Gastos,
// Obligaciones, Stock, Compras) devuelven PENDIENTE hasta que
// se implementen los módulos de Finanzas/Inventario/Compras.
// ============================================================

function dashboardData(params) {
  try {
    var hoy   = getFecha('fecha');          // YYYY-MM-DD
    var mesAA = hoy.substring(0, 7);         // YYYY-MM

    // ──────────────────────────────────────────────
    // 1. VENTAS DEL MES
    // ──────────────────────────────────────────────
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){ return v.ID_VENTA && String(v.ID_VENTA).trim() !== '' && v.ESTADO !== 'ANULADO'; });
    var ventasMes = 0, ventasMesCount = 0, ventasHoy = 0;
    ventas.forEach(function(v){
      var f = String(v.FECHA_VENTA || '').substring(0, 10);
      var total = parseFloat(v.TOTAL) || 0;
      if (f.substring(0, 7) === mesAA) { ventasMes += total; ventasMesCount++; }
      if (f === hoy) ventasHoy += total;
    });

    // ──────────────────────────────────────────────
    // 2. PACIENTES ATENDIDOS (citas atendidas en el mes)
    // ──────────────────────────────────────────────
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_CITA && String(c.ID_CITA).trim() !== ''; });
    var citasMes = 0, citasHoy = 0, atendidasMes = 0, pacientesSet = {};
    citas.forEach(function(c){
      var f = String(c.FECHA_CITA || '').substring(0, 10);
      var est = String(c.ESTADO_CITA || '').toUpperCase();
      if (f.substring(0, 7) === mesAA) {
        citasMes++;
        if (est === 'ATENDIDA' || est === 'COMPLETADA' || est === 'REALIZADA') {
          atendidasMes++;
          if (c.ID_PACIENTE) pacientesSet[c.ID_PACIENTE] = true;
        }
      }
      if (f === hoy) citasHoy++;
    });
    var pacientesAtendidos = Object.keys(pacientesSet).length;

    // ──────────────────────────────────────────────
    // 3. TOP SERVICIOS VENDIDOS (del mes, por DVENTA)
    // ──────────────────────────────────────────────
    var idsVentaMes = {};
    ventas.forEach(function(v){
      if (String(v.FECHA_VENTA || '').substring(0, 7) === mesAA) idsVentaMes[v.ID_VENTA] = true;
    });
    var dventa = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var contServ = {};
    dventa.forEach(function(d){
      if (!idsVentaMes[d.ID_VENTA]) return;
      if (d.TIPO === 'SERVICIO' && d.ID_SERVICIO) {
        var cant = parseFloat(d.CANTIDAD) || 1;
        contServ[d.ID_SERVICIO] = (contServ[d.ID_SERVICIO] || 0) + cant;
      }
    });
    var topServicios = [];
    for (var sid in contServ) {
      var nom = sid;
      for (var s = 0; s < servicios.length; s++) {
        if (servicios[s].ID_SERVICIO === sid) { nom = servicios[s].NOMBRE_SERVICIO; break; }
      }
      topServicios.push({ nombre: nom, cantidad: contServ[sid] });
    }
    topServicios.sort(function(a, b){ return b.cantidad - a.cantidad; });
    topServicios = topServicios.slice(0, 5);

    // ──────────────────────────────────────────────
    // 4. TOP MÉDICOS (por citas atendidas en el mes)
    // ──────────────────────────────────────────────
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var contMed = {};
    citas.forEach(function(c){
      if (String(c.FECHA_CITA || '').substring(0, 7) !== mesAA) return;
      if (c.ID_MEDICO) contMed[c.ID_MEDICO] = (contMed[c.ID_MEDICO] || 0) + 1;
    });
    var topMedicos = [];
    for (var mid in contMed) {
      var nomMed = mid;
      for (var m = 0; m < medicos.length; m++) {
        if (medicos[m].ID_MEDICO === mid) { nomMed = (medicos[m].NOMBRES || '') + ' ' + (medicos[m].APELLIDOS || ''); break; }
      }
      topMedicos.push({ nombre: nomMed.trim(), cantidad: contMed[mid] });
    }
    topMedicos.sort(function(a, b){ return b.cantidad - a.cantidad; });
    topMedicos = topMedicos.slice(0, 5);

    // ──────────────────────────────────────────────
    // 5. ESTADO DE CAJA (hoy)
    // ──────────────────────────────────────────────
    var cajaEstado = 'CERRADA', cajaEsperado = 0, cajaInicial = 0;
    try {
      var aperturas = leerHoja(HOJAS.APERTURA_CAJA).map(limpiarFila);
      for (var a = 0; a < aperturas.length; a++) {
        if (aperturas[a].ESTADO === 'ABIERTA') {
          cajaEstado = 'ABIERTA';
          cajaInicial = parseFloat(aperturas[a].MONTO_INICIAL) || 0;
          var movs = leerHoja(HOJAS.CAJA).map(limpiarFila)
            .filter(function(mv){ return mv.ID_APERTURA === aperturas[a].ID_APERTURA && mv.ESTADO !== 'ANULADO'; });
          var ing = 0, egr = 0;
          movs.forEach(function(mv){
            var mo = parseFloat(mv.MONTO) || 0;
            if (mv.TIPO === 'INGRESO') ing += mo; else if (mv.TIPO === 'EGRESO') egr += mo;
          });
          cajaEsperado = cajaInicial + ing - egr;
          break;
        }
      }
    } catch (eCaja) {}

    // ──────────────────────────────────────────────
    // 6. SESIONES PENDIENTES (control de sesiones activas)
    // ──────────────────────────────────────────────
    var sesionesPendientes = 0;
    try {
      var controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila);
      controles.forEach(function(ct){
        var rest = parseFloat(ct.SESIONES_RESTANTES) || 0;
        if (String(ct.ESTADO || '').toUpperCase() === 'ACTIVO' && rest > 0) sesionesPendientes += rest;
      });
    } catch (eSes) {}

    // ──────────────────────────────────────────────
    // INDICADORES PENDIENTES (tablas futuras)
    // ──────────────────────────────────────────────
    var PENDIENTE = { pendiente: true };

    return respuestaOK({
      // Indicadores con datos reales
      VENTAS_MES:          ventasMes.toFixed(2),
      VENTAS_MES_COUNT:    ventasMesCount,
      VENTAS_HOY:          ventasHoy.toFixed(2),
      CITAS_HOY:           citasHoy,
      CITAS_MES:           citasMes,
      PACIENTES_ATENDIDOS: pacientesAtendidos,
      SESIONES_PENDIENTES: sesionesPendientes,
      TOP_SERVICIOS:       topServicios,
      TOP_MEDICOS:         topMedicos,
      CAJA_ESTADO:         cajaEstado,
      CAJA_ESPERADO:       cajaEsperado.toFixed(2),
      CAJA_INICIAL:        cajaInicial.toFixed(2),
      // Indicadores pendientes (se activan con módulos futuros)
      GASTOS_MES:          PENDIENTE,
      UTILIDAD_MES:        PENDIENTE,
      OBLIG_PENDIENTES:    PENDIENTE,
      OBLIG_VENCIDAS:      PENDIENTE,
      STOCK_BAJO:          PENDIENTE,
      COMPRAS_MES:         PENDIENTE,
      // Meta
      MES:                 mesAA,
      FECHA:               hoy,
    }, 'Dashboard cargado.');
  } catch (err) {
    return respuestaError('Error al cargar dashboard: ' + err.message);
  }
}
