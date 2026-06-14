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

    // ── TOP PAQUETES VENDIDOS (del mes, por DVENTA TIPO=PAQUETE) ──
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);
    var contPaq = {};
    dventa.forEach(function(d){
      if (!idsVentaMes[d.ID_VENTA]) return;
      if (d.TIPO === 'PAQUETE' && d.ID_PAQUETE && d.ID_PAQUETE !== '-') {
        var cant = parseFloat(d.CANTIDAD) || 1;
        contPaq[d.ID_PAQUETE] = (contPaq[d.ID_PAQUETE] || 0) + cant;
      }
    });
    var topPaquetes = [];
    for (var pid in contPaq) {
      var nomP = pid;
      for (var p = 0; p < paquetes.length; p++) {
        if (paquetes[p].ID_PAQUETE === pid) { nomP = paquetes[p].NOMBRE_PAQUETE; break; }
      }
      topPaquetes.push({ nombre: nomP, cantidad: contPaq[pid] });
    }
    topPaquetes.sort(function(a, b){ return b.cantidad - a.cantidad; });
    topPaquetes = topPaquetes.slice(0, 5);

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

    // ── TOP PROFESIONALES DE APOYO (por citas del mes con ID_PROFESIONAL) ──
    var profesionales = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    var contProf = {};
    citas.forEach(function(c){
      if (String(c.FECHA_CITA || '').substring(0, 7) !== mesAA) return;
      if (c.ID_PROFESIONAL && c.ID_PROFESIONAL !== '-') contProf[c.ID_PROFESIONAL] = (contProf[c.ID_PROFESIONAL] || 0) + 1;
    });
    var topProfesionales = [];
    for (var pfid in contProf) {
      var nomPf = pfid;
      for (var pf = 0; pf < profesionales.length; pf++) {
        if (profesionales[pf].ID_PROFESIONAL === pfid) { nomPf = (profesionales[pf].NOMBRES || '') + ' ' + (profesionales[pf].APELLIDOS || ''); break; }
      }
      topProfesionales.push({ nombre: nomPf.trim(), cantidad: contProf[pfid] });
    }
    topProfesionales.sort(function(a, b){ return b.cantidad - a.cantidad; });
    topProfesionales = topProfesionales.slice(0, 5);

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
    // 7. GASTOS DEL MES (pagos de obligaciones del mes)
    // ──────────────────────────────────────────────
    var gastosMes = 0;
    try {
      var pagos = leerHoja(HOJAS.PAGO_OBLIGACION).map(limpiarFila)
        .filter(function(p){ return p.ID_PAGO_OBLIGACION && p.ESTADO !== 'ANULADO'; });
      pagos.forEach(function(p){
        if (String(p.FECHA_PAGO||'').substring(0,7) === mesAA) gastosMes += parseFloat(p.MONTO)||0;
      });
    } catch (eg) {}

    // ──────────────────────────────────────────────
    // 8. OBLIGACIONES pendientes y vencidas
    // ──────────────────────────────────────────────
    var obligPendientes = 0, obligVencidas = 0, montoPendiente = 0;
    try {
      var obls = leerHoja(HOJAS.OBLIGACION).map(limpiarFila)
        .filter(function(o){ return o.ID_OBLIGACION && o.ESTADO !== 'ANULADO' && o.ESTADO !== 'PAGADO'; });
      obls.forEach(function(o){
        var pend = parseFloat(o.MONTO_PENDIENTE)||0;
        if (pend > 0) {
          obligPendientes++;
          montoPendiente += pend;
          if (String(o.FECHA_VENCIMIENTO||'') < hoy) obligVencidas++;
        }
      });
    } catch (eo) {}

    // ──────────────────────────────────────────────
    // 9. STOCK BAJO MÍNIMO
    // ──────────────────────────────────────────────
    var stockBajo = 0;
    try {
      var prodsStock = leerHoja(HOJAS.PRODUCTO_INSUMO).map(limpiarFila)
        .filter(function(p){ return p.ID_PRODUCTO && p.ESTADO === 'ACTIVO'; });
      prodsStock.forEach(function(p){
        if ((parseFloat(p.STOCK)||0) <= (parseFloat(p.STOCK_MINIMO)||0)) stockBajo++;
      });
    } catch (es) {}

    // ──────────────────────────────────────────────
    // 10. COMPRAS DEL MES
    // ──────────────────────────────────────────────
    var comprasMes = 0, comprasMesCount = 0;
    try {
      var compras = leerHoja(HOJAS.COMPRA_INSUMO).map(limpiarFila)
        .filter(function(co){ return co.ID_COMPRA && co.ESTADO !== 'ANULADO'; });
      compras.forEach(function(co){
        if (String(co.FECHA_COMPRA||'').substring(0,7) === mesAA) { comprasMes += parseFloat(co.TOTAL)||0; comprasMesCount++; }
      });
    } catch (ec) {}

    // UTILIDAD = Ventas - Gastos del mes
    var utilidadMes = ventasMes - gastosMes;

    // ── Comisiones pendientes (Honorarios) ──
    var comisionesPend = 0, comisionesCount = 0;
    try {
      var comisiones = leerHoja(HOJAS.COMISION_VENTA).map(limpiarFila);
      for (var ci = 0; ci < comisiones.length; ci++) {
        if (comisiones[ci].ESTADO === 'PENDIENTE') {
          comisionesPend += (parseFloat(comisiones[ci].MONTO_COMISION) || 0);
          comisionesCount++;
        }
      }
    } catch (e) { /* tabla puede no existir aún */ }

    // ── Citas atendidas sin pagar (alerta de cobro) ──
    var citasSinPagar = 0;
    try {
      for (var cp = 0; cp < citas.length; cp++) {
        var estC = String(citas[cp].ESTADO_CITA || '').toUpperCase();
        var pagC = String(citas[cp].ESTADO_PAGO || '').toUpperCase();
        if (estC.indexOf('ATENDID') >= 0 && pagC !== 'PAGADO') citasSinPagar++;
      }
    } catch (e) {}

    // ── CUENTAS POR COBRAR (ventas con saldo pendiente) ──
    var porCobrar = 0, porCobrarCount = 0;
    for (var vc = 0; vc < ventas.length; vc++) {
      var estV = String(ventas[vc].ESTADO || '').toUpperCase();
      if (estV === 'ANULADA') continue;
      var saldo = parseFloat(ventas[vc].SALDO) || 0;
      if (saldo > 0) { porCobrar += saldo; porCobrarCount++; }
    }

    // ── AGENDA DE HOY (citas programadas para hoy) ──
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    function nombrePac(id){ for(var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); } return id; }
    function nombreMed2(id){ for(var i=0;i<medicos.length;i++){ if(medicos[i].ID_MEDICO===id) return 'Dr. '+((medicos[i].NOMBRES||'')+' '+(medicos[i].APELLIDOS||'')).trim(); } return '—'; }
    var agendaHoy = [];
    for (var ag = 0; ag < citas.length; ag++) {
      var fc = String(citas[ag].FECHA_CITA || '').substring(0, 10);
      if (fc !== hoy) continue;
      var estAg = String(citas[ag].ESTADO_CITA || '').toUpperCase();
      if (estAg === 'CANCELADA') continue;
      agendaHoy.push({
        hora: citas[ag].HORA_CITA || '—',
        paciente: nombrePac(citas[ag].ID_PACIENTE),
        medico: citas[ag].ID_MEDICO && citas[ag].ID_MEDICO!=='-' ? nombreMed2(citas[ag].ID_MEDICO) : '—',
        estado: estAg,
        pago: String(citas[ag].ESTADO_PAGO || 'PENDIENTE').toUpperCase(),
      });
    }
    agendaHoy.sort(function(a,b){ return (a.hora||'') > (b.hora||'') ? 1 : -1; });

    // ── VENTAS POR DÍA (gráfico, mes en curso) ──
    var ventasPorDia = {};
    for (var vd = 0; vd < ventas.length; vd++) {
      var estVd = String(ventas[vd].ESTADO || '').toUpperCase();
      if (estVd === 'ANULADA') continue;
      var fVd = String(ventas[vd].FECHA_VENTA || '').substring(0, 10);
      if (fVd.substring(0,7) !== mesAA) continue;
      ventasPorDia[fVd] = (ventasPorDia[fVd] || 0) + (parseFloat(ventas[vd].TOTAL) || 0);
    }
    var serieVentas = Object.keys(ventasPorDia).sort().map(function(dia){
      return { fecha: dia, monto: ventasPorDia[dia] };
    });

    // ── INGRESOS POR ESPECIALIDAD (gráfico, mes en curso) ──
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    function nomEsp(id){ for(var i=0;i<especialidades.length;i++){ if(especialidades[i].ID_ESPECIALIDAD===id) return especialidades[i].ESPECIALIDAD; } return 'Sin especialidad'; }
    function servEsp(idServ){ for(var i=0;i<servicios.length;i++){ if(servicios[i].ID_SERVICIO===idServ) return servicios[i].ID_ESPECIALIDAD; } return null; }
    var ingresoEsp = {};
    dventa.forEach(function(d){
      if (!idsVentaMes[d.ID_VENTA]) return;
      if (d.ID_SERVICIO && d.ID_SERVICIO !== '-') {
        var ie = servEsp(d.ID_SERVICIO);
        var nomE = (ie && ie !== '-') ? nomEsp(ie) : 'Sin especialidad';
        ingresoEsp[nomE] = (ingresoEsp[nomE] || 0) + (parseFloat(d.SUBTOTAL) || 0);
      }
    });
    var serieEsp = Object.keys(ingresoEsp).map(function(e){ return { nombre: e, monto: ingresoEsp[e] }; })
      .sort(function(a,b){ return b.monto - a.monto; }).slice(0, 6);

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
      TOP_PAQUETES:        topPaquetes,
      TOP_PROFESIONALES:   topProfesionales,
      TOP_MEDICOS:         topMedicos,
      CAJA_ESTADO:         cajaEstado,
      CAJA_ESPERADO:       cajaEsperado.toFixed(2),
      CAJA_INICIAL:        cajaInicial.toFixed(2),
      // Indicadores de Finanzas/Inventario/Compras (ya activos)
      GASTOS_MES:          gastosMes.toFixed(2),
      UTILIDAD_MES:        utilidadMes.toFixed(2),
      OBLIG_PENDIENTES:    obligPendientes,
      OBLIG_MONTO_PEND:    montoPendiente.toFixed(2),
      OBLIG_VENCIDAS:      obligVencidas,
      STOCK_BAJO:          stockBajo,
      COMPRAS_MES:         comprasMes.toFixed(2),
      COMPRAS_MES_COUNT:   comprasMesCount,
      // Gráficos
      SERIE_VENTAS:        serieVentas,
      SERIE_ESPECIALIDAD:  serieEsp,
      // Cuentas por cobrar
      POR_COBRAR:          porCobrar.toFixed(2),
      POR_COBRAR_COUNT:    porCobrarCount,
      // Agenda de hoy
      AGENDA_HOY:          agendaHoy,
      // Alertas de Honorarios
      COMISIONES_PEND:     comisionesPend.toFixed(2),
      COMISIONES_COUNT:    comisionesCount,
      CITAS_SIN_PAGAR:     citasSinPagar,
      // Meta
      MES:                 mesAA,
      FECHA:               hoy,
    }, 'Dashboard cargado.');
  } catch (err) {
    return respuestaError('Error al cargar dashboard: ' + err.message);
  }
}
