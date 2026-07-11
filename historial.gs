// ============================================================
// VIZVALL — historial.gs — Historiales (paciente, citas) y seguimiento
// ============================================================

// ════════════════════════════════════════════════════════════
//  HISTORIAL COMPLETO DEL PACIENTE — citas + ventas + sesiones
// ════════════════════════════════════════════════════════════
function historialPaciente(params) {
  try {
    if (!params.ID_PACIENTE) return respuestaError('ID_PACIENTE requerido.');
    var idPac = params.ID_PACIENTE;

    // Datos del paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var i = 0; i < pacientes.length; i++) {
      if (pacientes[i].ID_PACIENTE === idPac) { pac = pacientes[i]; break; }
    }
    if (!pac) return respuestaError('Paciente no encontrado.');
    var nombrePac = (pac.RAZON_SOCIAL && pac.RAZON_SOCIAL !== '-') ? pac.RAZON_SOCIAL : ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||''));

    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);

    // ── CITAS ──
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila).filter(function(c){ return c.ID_PACIENTE === idPac; });
    var citasOut = citas.map(function(c){
      var med = '—', esp = '—';
      for (var j = 0; j < medicos.length; j++) { if (medicos[j].ID_MEDICO === c.ID_MEDICO) { med = (medicos[j].NOMBRES||'')+' '+(medicos[j].APELLIDOS||''); break; } }
      for (var k = 0; k < especialidades.length; k++) { if (especialidades[k].ID_ESPECIALIDAD === c.ID_ESPECIALIDAD) { esp = especialidades[k].ESPECIALIDAD || '—'; break; } }
      return {
        ID_CITA: c.ID_CITA, FECHA_CITA: c.FECHA_CITA, HORA_CITA: c.HORA_CITA,
        MEDICO_NOMBRE: med, ESPECIALIDAD_NOMBRE: esp,
        ESTADO_CITA: c.ESTADO_CITA, ESTADO_PAGO: c.ESTADO_PAGO || 'PENDIENTE',
        MOTIVO_CONSULTA: c.MOTIVO_CONSULTA || '—',
      };
    });
    citasOut.sort(function(a,b){ return (a.FECHA_CITA||'') > (b.FECHA_CITA||'') ? -1 : 1; });

    // ── VENTAS ──
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila).filter(function(v){ return v.ID_PACIENTE === idPac && v.ESTADO !== 'ANULADA'; });
    var comprobantes = leerHoja(HOJAS.TCOMPROBANTE).map(limpiarFila);
    var ventasOut = ventas.map(function(v){
      var compNombre = '—';
      for (var c = 0; c < comprobantes.length; c++) { if (comprobantes[c].ID_TCOMPROBANTE === v.ID_TCOMPROBANTE) { compNombre = comprobantes[c].NOMBRE; break; } }
      return {
        ID_VENTA: v.ID_VENTA, FECHA_VENTA: v.FECHA_VENTA,
        NUMERO_COMPROBANTE: v.NUMERO_COMPROBANTE, COMPROBANTE_NOMBRE: compNombre,
        ESTADO_COMPROBANTE: v.ESTADO_COMPROBANTE, TOTAL: v.TOTAL, ESTADO: v.ESTADO,
      };
    });
    ventasOut.sort(function(a,b){ return (a.FECHA_VENTA||'') > (b.FECHA_VENTA||'') ? -1 : 1; });

    // ── SESIONES (paquetes) ──
    var controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila).filter(function(s){ return s.ID_PACIENTE === idPac; });
    var sesionesOut = controles.map(function(s){
      var paqNombre = '—';
      for (var p = 0; p < paquetes.length; p++) { if (paquetes[p].ID_PAQUETE === s.ID_PAQUETE) { paqNombre = paquetes[p].NOMBRE_PAQUETE; break; } }
      return {
        ID_CONTROL: s.ID_CONTROL, PAQUETE_NOMBRE: paqNombre,
        TOTAL_SESIONES: s.TOTAL_SESIONES, SESIONES_USADAS: s.SESIONES_USADAS,
        SESIONES_RESTANTES: s.SESIONES_RESTANTES, FECHA_INICIO: s.FECHA_INICIO,
        FECHA_FIN: s.FECHA_FIN, ESTADO: s.ESTADO,
      };
    });

    return respuestaOK({
      PACIENTE: { ID_PACIENTE: idPac, NOMBRE: nombrePac, NUMERO_DOCUMENTO: pac.NUMERO_DOCUMENTO, TELEFONO: pac.TELEFONO, CORREO: pac.CORREO },
      CITAS: citasOut,
      VENTAS: ventasOut,
      SESIONES: sesionesOut,
      RESUMEN: { NUM_CITAS: citasOut.length, NUM_VENTAS: ventasOut.length, NUM_SESIONES: sesionesOut.length },
    });
  } catch (err) {
    return respuestaError('Error en historial del paciente: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  HISTORIAL DE CITAS — todas, filtrable
// ════════════════════════════════════════════════════════════
function historialCitas(params) {
  try {
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_CITA && String(c.ID_CITA).trim() !== ''; });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var hoyHist = getFecha('fecha'); // para clasificar vencidas

    // Filtros
    if (params.fechaDesde) citas = citas.filter(function(c){ return (c.FECHA_CITA||'') >= params.fechaDesde; });
    if (params.fechaHasta) citas = citas.filter(function(c){ return (c.FECHA_CITA||'') <= params.fechaHasta; });
    if (params.ID_MEDICO) citas = citas.filter(function(c){ return c.ID_MEDICO === params.ID_MEDICO; });
    if (params.ESTADO_CITA) citas = citas.filter(function(c){ return c.ESTADO_CITA === params.ESTADO_CITA; });

    var out = citas.map(function(c){
      var pacNombre = '—', pacDoc = '—', med = '—', esp = '—';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === c.ID_PACIENTE) {
          var pp = pacientes[i];
          pacNombre = (pp.RAZON_SOCIAL && pp.RAZON_SOCIAL !== '-') ? pp.RAZON_SOCIAL : ((pp.NOMBRES||'')+' '+(pp.APELLIDOS||''));
          pacDoc = pp.NUMERO_DOCUMENTO || '—'; break;
        }
      }
      for (var j = 0; j < medicos.length; j++) { if (medicos[j].ID_MEDICO === c.ID_MEDICO) { med = (medicos[j].NOMBRES||'')+' '+(medicos[j].APELLIDOS||''); break; } }
      for (var k = 0; k < especialidades.length; k++) { if (especialidades[k].ID_ESPECIALIDAD === c.ID_ESPECIALIDAD) { esp = especialidades[k].ESPECIALIDAD || '—'; break; } }
      var fCitaH = String(c.FECHA_CITA||'').substring(0,10);
      var cuandoH = 'HOY';
      if (fCitaH) { if (fCitaH > hoyHist) cuandoH = 'FUTURA'; else if (fCitaH < hoyHist) cuandoH = 'VENCIDA'; }
      return {
        ID_CITA: c.ID_CITA, FECHA_CITA: c.FECHA_CITA, HORA_CITA: c.HORA_CITA,
        PACIENTE_NOMBRE: pacNombre, PACIENTE_DOC: pacDoc,
        MEDICO_NOMBRE: med, ESPECIALIDAD_NOMBRE: esp,
        ESTADO_CITA: c.ESTADO_CITA, ESTADO_PAGO: c.ESTADO_PAGO || 'PENDIENTE',
        CUANDO: cuandoH,
      };
    });
    out.sort(function(a,b){
      var fa = (a.FECHA_CITA||'')+(a.HORA_CITA||''), fb = (b.FECHA_CITA||'')+(b.HORA_CITA||'');
      return fa > fb ? -1 : 1;
    });
    return respuestaOK(out, out.length + ' cita(s).');
  } catch (err) {
    return respuestaError('Error en historial de citas: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CONTROL DE SESIONES — todos los paquetes en seguimiento
//  params.estado: 'ACTIVO' (pendientes) / 'COMPLETADO' / undefined (todas)
// ════════════════════════════════════════════════════════════
function controlSesiones(params) {
  try {
    var controles = leerHoja(HOJAS.CONTROL_SESIONES).map(limpiarFila)
      .filter(function(s){ return s.ID_CONTROL && String(s.ID_CONTROL).trim() !== ''; });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);

    if (params && params.estado) {
      if (params.estado === 'COMPLETADO') {
        controles = controles.filter(function(s){ return s.ESTADO === 'COMPLETADO' || (parseInt(s.SESIONES_RESTANTES)||0) <= 0; });
      } else if (params.estado === 'ACTIVO') {
        controles = controles.filter(function(s){ return s.ESTADO !== 'COMPLETADO' && (parseInt(s.SESIONES_RESTANTES)||0) > 0; });
      }
    }

    var out = controles.map(function(s){
      var pacNombre = '—', paqNombre = '—', medNombre = '—';
      for (var i = 0; i < pacientes.length; i++) {
        if (pacientes[i].ID_PACIENTE === s.ID_PACIENTE) {
          var pp = pacientes[i];
          pacNombre = (pp.RAZON_SOCIAL && pp.RAZON_SOCIAL !== '-') ? pp.RAZON_SOCIAL : ((pp.NOMBRES||'')+' '+(pp.APELLIDOS||''));
          break;
        }
      }
      for (var j = 0; j < paquetes.length; j++) { if (paquetes[j].ID_PAQUETE === s.ID_PAQUETE) { paqNombre = paquetes[j].NOMBRE_PAQUETE; break; } }
      for (var k = 0; k < medicos.length; k++) { if (medicos[k].ID_MEDICO === s.ID_MEDICO) { medNombre = (medicos[k].NOMBRES||'')+' '+(medicos[k].APELLIDOS||''); break; } }
      return {
        ID_CONTROL: s.ID_CONTROL, PACIENTE_NOMBRE: pacNombre, PAQUETE_NOMBRE: paqNombre,
        TOTAL_SESIONES: s.TOTAL_SESIONES, SESIONES_USADAS: s.SESIONES_USADAS, SESIONES_RESTANTES: s.SESIONES_RESTANTES,
        FECHA_INICIO: s.FECHA_INICIO, FECHA_FIN: s.FECHA_FIN, PROXIMA_CITA: s.PROXIMA_CITA,
        MEDICO_NOMBRE: medNombre, ESTADO: s.ESTADO,
      };
    });
    out.sort(function(a,b){ return (a.FECHA_INICIO||'') > (b.FECHA_INICIO||'') ? -1 : 1; });
    return respuestaOK(out, out.length + ' control(es).');
  } catch (err) {
    return respuestaError('Error en control de sesiones: ' + err.message);
  }
}
