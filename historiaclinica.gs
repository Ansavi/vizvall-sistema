// ============================================================
// VIZVALL — Historia Clínica (Fase 1: Ficha clínica del paciente)
// ============================================================

// ── Obtener la ficha clínica de un paciente (la crea vacía si no existe) ──
// ── HELPER PROPIO: médico de una venta (copia local, no depende de honorarios.gs) ──
// ── HELPER: devuelve la fecha de hace N días en formato YYYY-MM-DD ──
function _hcFechaHaceDias(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  var mm = String(d.getMonth()+1).padStart(2,'0');
  var dd = String(d.getDate()).padStart(2,'0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function _hcMedicoDeVenta(idVenta) {
  try {
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === idVenta) { venta = ventas[i]; break; } }
    if (!venta || !venta.ID_CITA || venta.ID_CITA === '-') return null;
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var cita = null;
    for (var j = 0; j < citas.length; j++) { if (citas[j].ID_CITA === venta.ID_CITA) { cita = citas[j]; break; } }
    if (!cita || !cita.ID_MEDICO || cita.ID_MEDICO === '-') return null;
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    for (var k = 0; k < medicos.length; k++) {
      if (medicos[k].ID_MEDICO === cita.ID_MEDICO) {
        return { ID_MEDICO: medicos[k].ID_MEDICO, NOMBRE: ((medicos[k].NOMBRES||'')+' '+(medicos[k].APELLIDOS||'')).trim() };
      }
    }
    return { ID_MEDICO: cita.ID_MEDICO, NOMBRE: cita.ID_MEDICO };
  } catch (e) { return null; }
}

function obtenerFichaClinica(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PACIENTE) return respuestaError('Seleccione el paciente.');

    // Datos del paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var i = 0; i < pacientes.length; i++) { if (pacientes[i].ID_PACIENTE === params.ID_PACIENTE) { pac = pacientes[i]; break; } }
    if (!pac) return respuestaError('Paciente no encontrado.');

    // Buscar ficha existente
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var ficha = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === params.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { ficha = fichas[f]; break; }
    }

    var datosPac = {
      ID_PACIENTE: pac.ID_PACIENTE,
      NOMBRE: ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim(),
      DOCUMENTO: pac.NUMERO_DOCUMENTO || '-',
      SEXO: pac.SEXO || '-',
      FECHA_NACIMIENTO: pac.FECHA_NACIMIENTO || '-',
      TELEFONO: pac.TELEFONO || '-',
    };

    if (!ficha) {
      return respuestaOK({ paciente: datosPac, ficha: null, existe: false }, 'Sin ficha clínica aún.');
    }
    return respuestaOK({ paciente: datosPac, ficha: ficha, existe: true }, 'Ficha encontrada.');
  } catch (err) {
    return respuestaError('Error al obtener ficha: ' + err.message);
  }
}

// ── Guardar/actualizar la ficha clínica ──
function guardarFichaClinica(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_PACIENTE) { lock.releaseLock(); return respuestaError('Paciente requerido.'); }

    var campos = {
      GRUPO_SANGUINEO:         String(params.GRUPO_SANGUINEO || '-').toUpperCase(),
      ALERGIAS:                String(params.ALERGIAS || '-').toUpperCase(),
      ENFERMEDADES_CRONICAS:   String(params.ENFERMEDADES_CRONICAS || '-').toUpperCase(),
      CIRUGIAS_PREVIAS:        String(params.CIRUGIAS_PREVIAS || '-').toUpperCase(),
      MEDICACION_HABITUAL:     String(params.MEDICACION_HABITUAL || '-').toUpperCase(),
      ANTECEDENTES_FAMILIARES: String(params.ANTECEDENTES_FAMILIARES || '-').toUpperCase(),
      OBSERVACIONES:           String(params.OBSERVACIONES || '-').toUpperCase(),
      USUARIO_ACTUALIZA:       params.usuario || '-',
      FECHA_ACTUALIZACION:     getFecha('datetime'),
    };

    // ¿Ya existe ficha? → actualizar; si no → crear
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var existente = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === params.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { existente = fichas[f]; break; }
    }

    if (existente) {
      actualizarFila(HOJAS.FICHA_CLINICA, 'ID_FICHA', existente.ID_FICHA, campos);
      lock.releaseLock();
      return respuestaOK({ ID_FICHA: existente.ID_FICHA }, 'Ficha clínica actualizada.');
    }

    var id = generarID(HOJAS.FICHA_CLINICA, 'ID_FICHA', 'FC', 4);
    campos.ID_FICHA = id;
    campos.ID_PACIENTE = params.ID_PACIENTE;
    campos.ESTADO = 'ACTIVO';
    campos.FECHA_REGISTRO = getFecha('datetime');
    insertarFila(HOJAS.FICHA_CLINICA, campos);
    lock.releaseLock();
    return respuestaOK({ ID_FICHA: id }, 'Ficha clínica creada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar ficha: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  FASE 2 — ATENCIONES MÉDICAS (diagnóstico por visita)
// ════════════════════════════════════════════════════════════

// ── Obtener la atención de una venta (+ ficha clínica del paciente) ──
function obtenerAtencionDeVenta(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_VENTA) return respuestaError('Venta requerida.');

    // Datos de la venta
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) return respuestaError('Venta no encontrada.');

    // Paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var p = 0; p < pacientes.length; p++) { if (pacientes[p].ID_PACIENTE === venta.ID_PACIENTE) { pac = pacientes[p]; break; } }
    var nombrePac = pac ? ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim() : '—';

    // Médico (de la cita asociada)
    var medico = _hcMedicoDeVenta(params.ID_VENTA);

    // Ficha clínica (para mostrar alergias/crónicas)
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var ficha = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === venta.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { ficha = fichas[f]; break; }
    }
    var resumenFicha = ficha ? {
      ALERGIAS: (ficha.ALERGIAS && ficha.ALERGIAS!=='-') ? ficha.ALERGIAS : '',
      ENFERMEDADES_CRONICAS: (ficha.ENFERMEDADES_CRONICAS && ficha.ENFERMEDADES_CRONICAS!=='-') ? ficha.ENFERMEDADES_CRONICAS : '',
      MEDICACION_HABITUAL: (ficha.MEDICACION_HABITUAL && ficha.MEDICACION_HABITUAL!=='-') ? ficha.MEDICACION_HABITUAL : '',
    } : null;

    // ¿Ya existe atención para esta venta?
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var atencion = null;
    for (var a = 0; a < atenciones.length; a++) {
      if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { atencion = atenciones[a]; break; }
    }

    return respuestaOK({
      ID_VENTA: params.ID_VENTA,
      ID_PACIENTE: venta.ID_PACIENTE,
      NOMBRE_PACIENTE: nombrePac,
      ID_MEDICO: medico ? medico.ID_MEDICO : '-',
      NOMBRE_MEDICO: medico ? medico.NOMBRE : '—',
      ID_CITA: venta.ID_CITA || '-',
      ficha: resumenFicha,
      atencion: atencion,
      existe: !!atencion,
    }, atencion ? 'Atención encontrada.' : 'Sin atención aún.');
  } catch (err) {
    return respuestaError('Error al obtener atención: ' + err.message);
  }
}

// ── Guardar/actualizar la atención médica de una venta ──
// ── HELPER: marca la cita de una venta como ATENDIDA (al cerrar el diagnóstico) ──
function _marcarCitaAtendida(idVenta, idCita) {
  try {
    var idC = idCita;
    // Si no viene el ID_CITA, buscarlo desde la venta
    if (!idC || idC === '-') {
      var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
      for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === idVenta) { idC = ventas[i].ID_CITA; break; } }
    }
    if (!idC || idC === '-') return; // venta sin cita: nada que actualizar
    // Verificar que la cita exista y no esté cancelada
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    for (var j = 0; j < citas.length; j++) {
      if (citas[j].ID_CITA === idC) {
        var est = String(citas[j].ESTADO_CITA || '').toUpperCase();
        if (est === 'CANCELADA') return; // no tocar canceladas
        actualizarFila(HOJAS.CITA, 'ID_CITA', idC, { ESTADO_CITA: 'ATENDIDA' });
        return;
      }
    }
  } catch (e) { /* silencioso: no bloquear el guardado de la atención */ }
}

function guardarAtencionMedica(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }
    if (!params.DIAGNOSTICO || String(params.DIAGNOSTICO).trim()==='') { lock.releaseLock(); return respuestaError('El diagnóstico es obligatorio.'); }

    var campos = {
      MOTIVO:          String(params.MOTIVO || '-').toUpperCase(),
      PA:              String(params.PA || '-'),
      TEMPERATURA:     String(params.TEMPERATURA || '-'),
      PESO:            String(params.PESO || '-'),
      TALLA:           String(params.TALLA || '-'),
      FREC_CARDIACA:   String(params.FREC_CARDIACA || '-'),
      SAT_O2:          String(params.SAT_O2 || '-'),
      DIAGNOSTICO:     String(params.DIAGNOSTICO || '-').toUpperCase(),
      TRATAMIENTO:     String(params.TRATAMIENTO || '-').toUpperCase(),
      INDICACIONES:    String(params.INDICACIONES || '-').toUpperCase(),
      ORDENES:         String(params.ORDENES || '-').toUpperCase(),
      PROXIMO_CONTROL: String(params.PROXIMO_CONTROL || '-'),
    };

    // ¿Ya existe? → actualizar; si no → crear
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var existente = null;
    for (var a = 0; a < atenciones.length; a++) {
      if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { existente = atenciones[a]; break; }
    }

    if (existente) {
      actualizarFila(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', existente.ID_ATENCION, campos);
      _marcarCitaAtendida(params.ID_VENTA, params.ID_CITA || existente.ID_CITA); // cerrar la cita
      lock.releaseLock();
      return respuestaOK({ ID_ATENCION: existente.ID_ATENCION }, 'Atención actualizada.');
    }

    var id = generarID(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', 'AT', 4);
    campos.ID_ATENCION     = id;
    campos.ID_VENTA        = params.ID_VENTA;
    campos.ID_PACIENTE     = params.ID_PACIENTE || '-';
    campos.NOMBRE_PACIENTE = String(params.NOMBRE_PACIENTE || '-').toUpperCase();
    campos.ID_MEDICO       = params.ID_MEDICO || '-';
    campos.NOMBRE_MEDICO   = String(params.NOMBRE_MEDICO || '-').toUpperCase();
    campos.ID_CITA         = params.ID_CITA || '-';
    campos.FECHA_ATENCION  = getFecha('datetime');
    campos.ESTADO          = 'ACTIVO';
    campos.USUARIO         = params.usuario || '-';
    campos.FECHA_REGISTRO  = getFecha('datetime');
    insertarFila(HOJAS.ATENCION_MEDICA, campos);
    _marcarCitaAtendida(params.ID_VENTA, params.ID_CITA); // cerrar la cita
    lock.releaseLock();
    return respuestaOK({ ID_ATENCION: id }, 'Atención registrada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar atención: ' + err.message);
  }
}

// ── Listar las atenciones de un paciente (para la línea de tiempo, Fase 3) ──
function listarAtencionesPaciente(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PACIENTE) return respuestaError('Paciente requerido.');
    var lista = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila)
      .filter(function(a){ return a.ID_PACIENTE === params.ID_PACIENTE && a.ESTADO !== 'ANULADA'; });
    lista.sort(function(a,b){ return (a.FECHA_ATENCION||'') > (b.FECHA_ATENCION||'') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' atención(es).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}


// ── Obtener una atención por su ID + ficha del paciente (para editar desde Historia Clínica) ──
function obtenerAtencionPorId(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_ATENCION) return respuestaError('Atención requerida.');

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var at = null;
    for (var a = 0; a < atenciones.length; a++) { if (atenciones[a].ID_ATENCION === params.ID_ATENCION) { at = atenciones[a]; break; } }
    if (!at) return respuestaError('Atención no encontrada.');

    // Ficha del paciente (alergias)
    var fichas = leerHoja(HOJAS.FICHA_CLINICA).map(limpiarFila);
    var ficha = null;
    for (var f = 0; f < fichas.length; f++) {
      if (fichas[f].ID_PACIENTE === at.ID_PACIENTE && fichas[f].ESTADO !== 'ANULADO') { ficha = fichas[f]; break; }
    }
    var resumenFicha = ficha ? {
      ALERGIAS: (ficha.ALERGIAS && ficha.ALERGIAS!=='-') ? ficha.ALERGIAS : '',
      ENFERMEDADES_CRONICAS: (ficha.ENFERMEDADES_CRONICAS && ficha.ENFERMEDADES_CRONICAS!=='-') ? ficha.ENFERMEDADES_CRONICAS : '',
      MEDICACION_HABITUAL: (ficha.MEDICACION_HABITUAL && ficha.MEDICACION_HABITUAL!=='-') ? ficha.MEDICACION_HABITUAL : '',
    } : null;

    return respuestaOK({
      ID_VENTA: at.ID_VENTA, ID_PACIENTE: at.ID_PACIENTE, NOMBRE_PACIENTE: at.NOMBRE_PACIENTE,
      ID_MEDICO: at.ID_MEDICO, NOMBRE_MEDICO: at.NOMBRE_MEDICO, ID_CITA: at.ID_CITA,
      ficha: resumenFicha, atencion: at, existe: true,
    }, 'Atención encontrada.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
// ── Estado de atención de las ventas (para el badge en Ventas) ──
// Devuelve un mapa { ID_VENTA: 'COMPLETADA' | 'PENDIENTE' }
// COMPLETADA = la atención tiene diagnóstico; PENDIENTE = no existe o sin diagnóstico
function estadoAtencionVentas(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','RECEPCION','CAJERO','ENFERMERA'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var dventaAll = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var mapa = {};
    for (var i = 0; i < atenciones.length; i++) {
      var a = atenciones[i];
      if (!a.ID_VENTA || a.ESTADO === 'ANULADA') continue;
      var tieneDx = a.DIAGNOSTICO && String(a.DIAGNOSTICO).trim() !== '' && a.DIAGNOSTICO !== '-';
      if (mapa[a.ID_VENTA] === 'COMPLETADA') continue;
      mapa[a.ID_VENTA] = tieneDx ? 'COMPLETADA' : 'EN_PROCESO';
    }
    // Para ventas médicas sin atención aún → marcar PENDIENTE; las de solo-productos quedan fuera (sin badge)
    var ventasAll = leerHoja(HOJAS.VENTA).map(limpiarFila);
    for (var v = 0; v < ventasAll.length; v++) {
      var idv = ventasAll[v].ID_VENTA;
      if (!idv || mapa[idv]) continue;
      if (String(ventasAll[v].ESTADO||'').toUpperCase() === 'ANULADA') continue;
      if (_ventaEsMedica(idv, dventaAll)) mapa[idv] = 'PENDIENTE';
    }
    return respuestaOK(mapa, 'Estados de atención.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  TÓPICO (enfermera) — signos vitales por venta del día
// ════════════════════════════════════════════════════════════

// ── HELPER: ¿la venta necesita atención médica? (tiene SERVICIO o PAQUETE) ──
function _ventaEsMedica(idVenta, dventaCache) {
  var dventa = dventaCache || leerHoja(HOJAS.DVENTA).map(limpiarFila);
  for (var i = 0; i < dventa.length; i++) {
    if (dventa[i].ID_VENTA === idVenta) {
      var tipo = String(dventa[i].TIPO || '').toUpperCase();
      if (tipo === 'SERVICIO' || tipo === 'PAQUETE') return true;
    }
  }
  return false;
}

// ── Listar las ventas del día con su estado de atención (para tópico) ──
function listarTopicoDelDia(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','ENFERMERA','RECEPCION','MEDICO'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');

    // fecha opcional: si viene, filtra por FECHA_CITA de ese día; si no, muestra TODAS las pendientes
    var fechaFiltro = params.fecha || null;
    var hace7 = _hcFechaHaceDias(7);
    var dventaAll = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    function citaDeVenta(idV, idCita){
      // por ID_CITA de la venta, o buscando la cita que apunta a la venta
      for (var i=0;i<citas.length;i++){
        if (idCita && idCita!=='-' && citas[i].ID_CITA===idCita) return citas[i];
        if (citas[i].ID_VENTA===idV) return citas[i];
      }
      return null;
    }

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    function atDeVenta(idV){ for(var i=0;i<atenciones.length;i++){ if(atenciones[i].ID_VENTA===idV && atenciones[i].ESTADO!=='ANULADA') return atenciones[i]; } return null; }

    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila)
      .filter(function(v){
        if (!v.ID_VENTA || String(v.ID_VENTA).trim()==='') return false;
        if (String(v.ESTADO||'').toUpperCase() === 'ANULADA') return false;
        if (!_ventaEsMedica(v.ID_VENTA, dventaAll)) return false; // solo servicio/paquete médico
        // ¿ya está completada (con diagnóstico)? → no se muestra como pendiente
        var atv = atDeVenta(v.ID_VENTA);
        var dxCompleto = atv && atv.DIAGNOSTICO && atv.DIAGNOSTICO!=='-' && String(atv.DIAGNOSTICO).trim()!=='';
        // Si se pidió una fecha específica, filtrar por fecha de la CITA
        if (fechaFiltro) {
          var ct = citaDeVenta(v.ID_VENTA, v.ID_CITA);
          var fCita = ct ? String(ct.FECHA_CITA||'').substring(0,10) : String(v.FECHA_VENTA||'').substring(0,10);
          if (fCita !== fechaFiltro) return false;
          return true; // en modo fecha, mostrar todas (pendientes y completadas) de ese día
        }
        // Sin fecha: PENDIENTES (todas, sin límite) + ATENDIDAS de los últimos 7 días
        if (!dxCompleto) return true; // pendientes: siempre
        // atendidas: solo si la atención es de los últimos 7 días
        var fAt = atv ? String(atv.FECHA_ATENCION||'').substring(0,10) : '';
        return fAt >= hace7;
      });

    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    function nomPac(id){ for(var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); } return '—'; }

    var lista = ventas.map(function(v){
      var at = atDeVenta(v.ID_VENTA);
      var medico = _hcMedicoDeVenta(v.ID_VENTA);
      var ct = citaDeVenta(v.ID_VENTA, v.ID_CITA);
      var tieneSignos = at && ((at.PESO&&at.PESO!=='-') || (at.PA&&at.PA!=='-') || (at.TALLA&&at.TALLA!=='-'));
      var tieneDx = at && at.DIAGNOSTICO && at.DIAGNOSTICO!=='-' && String(at.DIAGNOSTICO).trim()!=='';
      var estado = tieneDx ? 'COMPLETADA' : (tieneSignos ? 'EN_PROCESO' : 'PENDIENTE');
      var fechaCita = ct ? String(ct.FECHA_CITA||'').substring(0,10) : '';
      var horaCita = ct ? (ct.HORA_CITA||'') : '';
      return {
        ID_VENTA: v.ID_VENTA,
        ID_ATENCION: at ? at.ID_ATENCION : '',
        ID_PACIENTE: v.ID_PACIENTE,
        NOMBRE_PACIENTE: nomPac(v.ID_PACIENTE),
        NOMBRE_MEDICO: medico ? medico.NOMBRE : '—',
        FECHA_CITA: fechaCita,
        HORA: horaCita || String(v.FECHA_VENTA||'').substring(11,16),
        FECHA_PAGO: String(v.FECHA_VENTA||'').substring(0,10),
        ESTADO_ATENCION: estado,
      };
    });
    // Pendientes primero; dentro de cada grupo, por fecha de cita
    var orden = { 'PENDIENTE':0, 'EN_PROCESO':1, 'COMPLETADA':2 };
    lista.sort(function(a,b){
      var d = (orden[a.ESTADO_ATENCION]||0) - (orden[b.ESTADO_ATENCION]||0);
      if (d!==0) return d;
      return (a.FECHA_CITA||'') < (b.FECHA_CITA||'') ? -1 : 1;
    });

    return respuestaOK(lista, lista.length + ' consulta(s) pendiente(s).');
  } catch (err) {
    return respuestaError('Error en tópico: ' + err.message);
  }
}

// ── Guardar SOLO los signos vitales de una venta (crea o actualiza la atención) ──
function guardarSignosVitales(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','ENFERMERA','MEDICO'].indexOf(rol) < 0) { lock.releaseLock(); return respuestaError('Solo enfermera, médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }

    var signos = {
      PA:            String(params.PA || '-'),
      TEMPERATURA:   String(params.TEMPERATURA || '-'),
      PESO:          String(params.PESO || '-'),
      TALLA:         String(params.TALLA || '-'),
      FREC_CARDIACA: String(params.FREC_CARDIACA || '-'),
      SAT_O2:        String(params.SAT_O2 || '-'),
    };

    // ¿Ya existe atención para esta venta? → actualizar solo signos; si no → crear
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var existente = null;
    for (var a = 0; a < atenciones.length; a++) {
      if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { existente = atenciones[a]; break; }
    }

    if (existente) {
      actualizarFila(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', existente.ID_ATENCION, signos);
      lock.releaseLock();
      return respuestaOK({ ID_ATENCION: existente.ID_ATENCION }, 'Signos vitales actualizados.');
    }

    // Crear la atención con los signos (datos de venta/paciente/médico)
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i = 0; i < ventas.length; i++) { if (ventas[i].ID_VENTA === params.ID_VENTA) { venta = ventas[i]; break; } }
    if (!venta) { lock.releaseLock(); return respuestaError('Venta no encontrada.'); }
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var nomPac = '—';
    for (var p = 0; p < pacientes.length; p++) { if (pacientes[p].ID_PACIENTE === venta.ID_PACIENTE) { nomPac = ((pacientes[p].NOMBRES||'')+' '+(pacientes[p].APELLIDOS||'')).trim(); break; } }
    var medico = _hcMedicoDeVenta(params.ID_VENTA);

    var id = generarID(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', 'AT', 4);
    insertarFila(HOJAS.ATENCION_MEDICA, {
      ID_ATENCION: id, ID_VENTA: params.ID_VENTA, ID_PACIENTE: venta.ID_PACIENTE, NOMBRE_PACIENTE: String(nomPac).toUpperCase(),
      ID_MEDICO: medico?medico.ID_MEDICO:'-', NOMBRE_MEDICO: medico?String(medico.NOMBRE).toUpperCase():'-', ID_CITA: venta.ID_CITA||'-',
      FECHA_ATENCION: getFecha('datetime'),
      MOTIVO: '-', PA: signos.PA, TEMPERATURA: signos.TEMPERATURA, PESO: signos.PESO, TALLA: signos.TALLA,
      FREC_CARDIACA: signos.FREC_CARDIACA, SAT_O2: signos.SAT_O2,
      DIAGNOSTICO: '-', TRATAMIENTO: '-', INDICACIONES: '-', ORDENES: '-', PROXIMO_CONTROL: '-',
      ESTADO: 'ACTIVO', USUARIO: params.usuario||'-', FECHA_REGISTRO: getFecha('datetime'),
    });
    lock.releaseLock();
    return respuestaOK({ ID_ATENCION: id }, 'Signos vitales registrados.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al guardar signos: ' + err.message);
  }
}

// ── Obtener los signos vitales actuales de una venta (para precargar en tópico) ──
function obtenerSignosVitales(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','ENFERMERA','RECEPCION','MEDICO'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_VENTA) return respuestaError('Venta requerida.');
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var at = null;
    for (var a = 0; a < atenciones.length; a++) { if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { at = atenciones[a]; break; } }
    if (!at) return respuestaOK({ existe:false }, 'Sin signos aún.');
    return respuestaOK({
      existe:true,
      PA: at.PA, TEMPERATURA: at.TEMPERATURA, PESO: at.PESO, TALLA: at.TALLA,
      FREC_CARDIACA: at.FREC_CARDIACA, SAT_O2: at.SAT_O2,
    }, 'Signos encontrados.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}


// ── Bandeja del médico: ventas médicas del día pendientes de diagnóstico ──
function listarBandejaMedico(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (['ADMINISTRADOR','MEDICO','ENFERMERA','RECEPCION'].indexOf(rol) < 0)
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var fechaFiltro = params.fecha || null;
    var hace7 = _hcFechaHaceDias(7);
    var dventaAll = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    function citaDeVenta(idV, idCita){
      for (var i=0;i<citas.length;i++){
        if (idCita && idCita!=='-' && citas[i].ID_CITA===idCita) return citas[i];
        if (citas[i].ID_VENTA===idV) return citas[i];
      }
      return null;
    }
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    function atDeVenta(idV){ for(var i=0;i<atenciones.length;i++){ if(atenciones[i].ID_VENTA===idV && atenciones[i].ESTADO!=='ANULADA') return atenciones[i]; } return null; }

    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila).filter(function(v){
      if (!v.ID_VENTA || String(v.ESTADO||'').toUpperCase()==='ANULADA') return false;
      if (!_ventaEsMedica(v.ID_VENTA, dventaAll)) return false;
      var atv = atDeVenta(v.ID_VENTA);
      var dxCompleto = atv && atv.DIAGNOSTICO && atv.DIAGNOSTICO!=='-' && String(atv.DIAGNOSTICO).trim()!=='';
      if (fechaFiltro) {
        var ct = citaDeVenta(v.ID_VENTA, v.ID_CITA);
        var fCita = ct ? String(ct.FECHA_CITA||'').substring(0,10) : String(v.FECHA_VENTA||'').substring(0,10);
        return fCita === fechaFiltro;
      }
      // sin fecha: PENDIENTES (todas) + ATENDIDAS de los últimos 7 días
      if (!dxCompleto) return true;
      var fAt = atv ? String(atv.FECHA_ATENCION||'').substring(0,10) : '';
      return fAt >= hace7;
    });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    function nomPac(id){ for(var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); } return '—'; }

    var lista = ventas.map(function(v){
      var at = atDeVenta(v.ID_VENTA);
      var medico = _hcMedicoDeVenta(v.ID_VENTA);
      var ct = citaDeVenta(v.ID_VENTA, v.ID_CITA);
      var tieneSignos = at && ((at.PESO&&at.PESO!=='-')||(at.PA&&at.PA!=='-')||(at.TALLA&&at.TALLA!=='-'));
      var tieneDx = at && at.DIAGNOSTICO && at.DIAGNOSTICO!=='-' && String(at.DIAGNOSTICO).trim()!=='';
      var estado = tieneDx ? 'COMPLETADA' : (tieneSignos ? 'EN_PROCESO' : 'PENDIENTE');
      return {
        ID_VENTA: v.ID_VENTA, ID_ATENCION: at?at.ID_ATENCION:'', ID_PACIENTE: v.ID_PACIENTE,
        NOMBRE_PACIENTE: nomPac(v.ID_PACIENTE), NOMBRE_MEDICO: medico?medico.NOMBRE:'—',
        FECHA_CITA: ct?String(ct.FECHA_CITA||'').substring(0,10):'',
        HORA: (ct&&ct.HORA_CITA)?ct.HORA_CITA:String(v.FECHA_ATENCION||v.FECHA_VENTA||'').substring(11,16), ESTADO_ATENCION: estado,
      };
    });
    // Para el médico: primero las que ya tienen signos y faltan diagnóstico (EN_PROCESO), luego completadas
    var orden = { 'EN_PROCESO':0, 'PENDIENTE':1, 'COMPLETADA':2 };
    lista.sort(function(a,b){ return (orden[a.ESTADO_ATENCION]||0)-(orden[b.ESTADO_ATENCION]||0); });
    return respuestaOK(lista, lista.length+' en bandeja.');
  } catch (err) {
    return respuestaError('Error bandeja médico: ' + err.message);
  }
}
