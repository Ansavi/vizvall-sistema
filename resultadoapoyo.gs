// ════════════════════════════════════════════════════════════
//  RESULTADOS DE APOYO — Backend
//  Servicios de apoyo (Laboratorio, Ecografía, Rayos X) que NO
//  pasan por tópico/médico/receta. Solo lectura de resultados.
//  Prefijo: ra  ·  Tabla: RESULTADO_APOYO
// ════════════════════════════════════════════════════════════

// Devuelve el ID_PROFESIONAL vinculado al usuario logueado (o null)
function _apoyoProfesionalDelUsuario(params) {
  try {
    var idUser = params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO) : null;
    var login  = params._sesion ? params._sesion.USUARIO : (params.usuario || null);
    if (!idUser && !login) return null;
    var usuarios = leerHoja(HOJAS.USUARIO).map(limpiarFila);
    for (var i=0;i<usuarios.length;i++){
      var u = usuarios[i];
      if ((idUser && String(u.ID_USUARIO)===String(idUser)) ||
          (login && String(u.USUARIO).toLowerCase()===String(login).toLowerCase())) {
        return (u.ID_PROFESIONAL && u.ID_PROFESIONAL!=='-' && String(u.ID_PROFESIONAL).trim()!=='') ? u.ID_PROFESIONAL : null;
      }
    }
    return null;
  } catch(e){ return null; }
}

// Devuelve el ID_AREA_APOYO de un profesional de apoyo (o null)
function _apoyoAreaDeProfesional(idProfesional) {
  try {
    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    for (var i=0;i<profs.length;i++){
      if (String(profs[i].ID_PROFESIONAL)===String(idProfesional)) {
        return (profs[i].ID_AREA_APOYO && profs[i].ID_AREA_APOYO!=='-') ? profs[i].ID_AREA_APOYO : null;
      }
    }
    return null;
  } catch(e){ return null; }
}

// Helper: ¿un servicio es de APOYO? (tiene ID_AREA_APOYO, no especialidad)
function _servicioEsApoyo(idServicio, serviciosCache) {
  if (!idServicio || idServicio === '-') return null;
  var servicios = serviciosCache || leerHoja(HOJAS.SERVICIO).map(limpiarFila);
  for (var i = 0; i < servicios.length; i++) {
    if (servicios[i].ID_SERVICIO === idServicio) {
      var area = servicios[i].ID_AREA_APOYO;
      if (area && area !== '-' && String(area).trim() !== '') {
        return { ID_AREA_APOYO: area, NOMBRE_SERVICIO: servicios[i].NOMBRE_SERVICIO || '' };
      }
      return null; // es clínico (especialidad)
    }
  }
  return null;
}

// Helper: nombre del área de apoyo
function _nombreAreaApoyo(idArea, areasCache) {
  if (!idArea || idArea === '-') return '';
  var areas = areasCache || leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
  for (var i = 0; i < areas.length; i++) {
    if (areas[i].ID_AREA_APOYO === idArea) return areas[i].NOMBRE || '';
  }
  return '';
}

// ── BANDEJA: exámenes de apoyo pendientes de resultado (últimos 7 días) ──
function listarBandejaResultados(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica'))
      return respuestaError('Sin permiso.', 'ERR_PERMISO');

    var hace7 = (typeof _hcFechaHaceDias === 'function') ? _hcFechaHaceDias(7) : null;

    // Filtro por área: si el usuario está vinculado a un profesional de apoyo (y NO es admin),
    // solo ve los servicios de apoyo de SU área.
    var rolBR = (params._sesion && params._sesion.ROL) ? params._sesion.ROL : '';
    var esAdminBR = String(rolBR).toUpperCase() === 'ADMINISTRADOR';
    var miAreaApoyo = null;
    if (!esAdminBR) {
      var idProf = _apoyoProfesionalDelUsuario(params);
      if (idProf) miAreaApoyo = _apoyoAreaDeProfesional(idProf);
    }

    var ventas    = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var dventa    = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var servicios = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
    var areas     = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var resultados= leerHoja(HOJAS.RESULTADO_APOYO).map(limpiarFila);

    // Mapa fecha + paciente por venta (solo ventas reales, no proformas)
    var infoVenta = {};
    ventas.forEach(function(v){
      var est = String(v.ESTADO||'').toUpperCase();
      if (est === 'PROFORMA' || est === 'CONVERTIDA' || est === 'ANULADA') return;
      infoVenta[v.ID_VENTA] = {
        fecha: String(v.FECHA_VENTA||'').substring(0,10),
        idPac: v.ID_PACIENTE
      };
    });

    function nomPac(id){
      for (var i=0;i<pacientes.length;i++){ if(pacientes[i].ID_PACIENTE===id) return ((pacientes[i].NOMBRES||'')+' '+(pacientes[i].APELLIDOS||'')).trim(); }
      return '—';
    }
    // ¿este ítem (detalle) ya tiene resultado?
    function resultadoDeDetalle(idDventa){
      for (var i=0;i<resultados.length;i++){
        if (resultados[i].ID_DVENTA === idDventa && resultados[i].ESTADO !== 'ANULADA') return resultados[i];
      }
      return null;
    }

    var lista = [];
    dventa.forEach(function(d){
      if (String(d.TIPO||'').toUpperCase() !== 'SERVICIO') return;
      var info = infoVenta[d.ID_VENTA];
      if (!info) return;
      // Filtro 7 días
      if (hace7 && info.fecha && info.fecha < hace7) return;
      // ¿Es servicio de apoyo?
      var apoyo = _servicioEsApoyo(d.ID_SERVICIO, servicios);
      if (!apoyo) return;

      // Filtro por área: si el usuario es de un área específica, solo ve la suya
      if (miAreaApoyo && String(apoyo.ID_AREA_APOYO) !== String(miAreaApoyo)) return;

      var res = resultadoDeDetalle(d.ID_DVENTA);
      lista.push({
        ID_DVENTA:       d.ID_DVENTA,
        ID_VENTA:        d.ID_VENTA,
        ID_PACIENTE:     info.idPac,
        NOMBRE_PACIENTE: nomPac(info.idPac),
        ID_SERVICIO:     d.ID_SERVICIO,
        SERVICIO_NOMBRE: apoyo.NOMBRE_SERVICIO,
        ID_AREA_APOYO:   apoyo.ID_AREA_APOYO,
        AREA_NOMBRE:     _nombreAreaApoyo(apoyo.ID_AREA_APOYO, areas),
        FECHA_VENTA:     info.fecha,
        TIENE_RESULTADO: !!res,
        ID_RESULTADO:    res ? res.ID_RESULTADO : ''
      });
    });

    lista.sort(function(a,b){ return (a.FECHA_VENTA||'') > (b.FECHA_VENTA||'') ? -1 : 1; });
    return respuestaOK(lista, lista.length + ' examen(es) de apoyo.');
  } catch (err) {
    return respuestaError('Error al listar bandeja de resultados: ' + err.message);
  }
}

// ── Preparar datos para el informe (al abrir un examen de la bandeja) ──
function prepararResultadoApoyo(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica'))
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_DVENTA) return respuestaError('Detalle de venta requerido.');

    var dventa = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    var det = null;
    for (var i=0;i<dventa.length;i++){ if(dventa[i].ID_DVENTA===params.ID_DVENTA){ det=dventa[i]; break; } }
    if (!det) return respuestaError('No se encontró el ítem.');

    var apoyo = _servicioEsApoyo(det.ID_SERVICIO);
    if (!apoyo) return respuestaError('Este servicio no es de apoyo.');

    // Datos de la venta y paciente
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var v=0;v<ventas.length;v++){ if(ventas[v].ID_VENTA===det.ID_VENTA){ venta=ventas[v]; break; } }
    var idPac = venta ? venta.ID_PACIENTE : '-';
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var nomPac='—', edad='', fnac='';
    for (var p=0;p<pacientes.length;p++){
      if(pacientes[p].ID_PACIENTE===idPac){
        nomPac=((pacientes[p].NOMBRES||'')+' '+(pacientes[p].APELLIDOS||'')).trim();
        fnac=pacientes[p].FECHA_NACIMIENTO||''; break;
      }
    }
    if (fnac && fnac!=='-'){
      var fn=new Date(String(fnac).substring(0,10));
      if(!isNaN(fn.getTime())){ var h=new Date(); edad=h.getFullYear()-fn.getFullYear(); var mm=h.getMonth()-fn.getMonth(); if(mm<0||(mm===0&&h.getDate()<fn.getDate()))edad--; }
    }

    // ¿Ya existe resultado para este ítem? (para editar)
    var resultados = leerHoja(HOJAS.RESULTADO_APOYO).map(limpiarFila);
    var existente = null;
    for (var r=0;r<resultados.length;r++){ if(resultados[r].ID_DVENTA===params.ID_DVENTA && resultados[r].ESTADO!=='ANULADA'){ existente=resultados[r]; break; } }

    return respuestaOK({
      ID_DVENTA:       det.ID_DVENTA,
      ID_VENTA:        det.ID_VENTA,
      ID_PACIENTE:     idPac,
      NOMBRE_PACIENTE: nomPac,
      EDAD:            edad,
      ID_SERVICIO:     det.ID_SERVICIO,
      SERVICIO_NOMBRE: apoyo.NOMBRE_SERVICIO,
      ID_AREA_APOYO:   apoyo.ID_AREA_APOYO,
      AREA_NOMBRE:     _nombreAreaApoyo(apoyo.ID_AREA_APOYO),
      RESULTADO_EXISTENTE: existente
    }, 'Datos preparados.');
  } catch (err) {
    return respuestaError('Error al preparar resultado: ' + err.message);
  }
}

// ── Guardar el informe del resultado (la comisión se gestiona en Honorarios) ──
function guardarResultadoApoyo(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_DVENTA) { lock.releaseLock(); return respuestaError('Ítem requerido.'); }
    if (!params.INFORME || String(params.INFORME).trim()==='') { lock.releaseLock(); return respuestaError('El informe no puede estar vacío.'); }

    var idUsuario = params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO || '-') : '-';

    var campos = {
      ID_VENTA:        String(params.ID_VENTA || '-'),
      ID_DVENTA:       String(params.ID_DVENTA),
      ID_PACIENTE:     String(params.ID_PACIENTE || '-'),
      NOMBRE_PACIENTE: String(params.NOMBRE_PACIENTE || '-').toUpperCase(),
      ID_SERVICIO:     String(params.ID_SERVICIO || '-'),
      SERVICIO_NOMBRE: String(params.SERVICIO_NOMBRE || '-').toUpperCase(),
      ID_AREA_APOYO:   String(params.ID_AREA_APOYO || '-'),
      AREA_NOMBRE:     String(params.AREA_NOMBRE || '-').toUpperCase(),
      TIPO_EJECUTOR:   String(params.TIPO_EJECUTOR || 'PROFESIONAL'),
      ID_EJECUTOR:     String(params.ID_EJECUTOR || '-'),
      NOMBRE_EJECUTOR: String(params.NOMBRE_EJECUTOR || '-').toUpperCase(),
      FECHA_RESULTADO: getFecha('fecha'),
      INFORME:         String(params.INFORME),
      OBSERVACIONES:   String(params.OBSERVACIONES || '-'),
      ESTADO:          'CON_RESULTADO',
      USUARIO:         String(idUsuario),
      FECHA_REGISTRO:  getFecha('datetime')
    };

    var resultados = leerHoja(HOJAS.RESULTADO_APOYO).map(limpiarFila);
    var existenteId = params.ID_RESULTADO || null;
    if (!existenteId) {
      for (var i=0;i<resultados.length;i++){ if(resultados[i].ID_DVENTA===params.ID_DVENTA && resultados[i].ESTADO!=='ANULADA'){ existenteId=resultados[i].ID_RESULTADO; break; } }
    }

    var idResultado;
    if (existenteId) {
      actualizarFila(HOJAS.RESULTADO_APOYO, 'ID_RESULTADO', existenteId, campos);
      idResultado = existenteId;
    } else {
      idResultado = generarID(HOJAS.RESULTADO_APOYO, 'ID_RESULTADO', 'RES', 4);
      campos.ID_RESULTADO = idResultado;
      insertarFila(HOJAS.RESULTADO_APOYO, campos);
    }

    // Auditoría
    if (typeof registrarAuditoria === 'function')
      registrarAuditoria(idUsuario, 'RESULTADOS', 'GUARDAR_RESULTADO', 'Resultado ' + idResultado + ' · ' + campos.SERVICIO_NOMBRE + ' · ' + campos.NOMBRE_PACIENTE);

    lock.releaseLock();
    return respuestaOK({ ID_RESULTADO: idResultado }, existenteId ? 'Resultado actualizado.' : 'Resultado registrado.');
  } catch (err) {
    lock.releaseLock();
    return respuestaError('Error al guardar resultado: ' + err.message);
  }
}

// ── Obtener un resultado (para ver/imprimir) ──
function obtenerResultadoApoyo(params) {
  try {
    if (!params.ID_RESULTADO) return respuestaError('Resultado requerido.');
    var resultados = leerHoja(HOJAS.RESULTADO_APOYO).map(limpiarFila);
    for (var i=0;i<resultados.length;i++){ if(resultados[i].ID_RESULTADO===params.ID_RESULTADO) return respuestaOK(resultados[i], 'OK'); }
    return respuestaError('No se encontró el resultado.');
  } catch (err) { return respuestaError('Error: ' + err.message); }
}

// ── Listar los ejecutores disponibles (médicos + profesionales de apoyo) ──
function listarEjecutoresApoyo(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var lista = [];
    // Profesionales de apoyo
    var profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    profs.forEach(function(p){
      if (p.ID_PROFESIONAL && String(p.ESTADO||'').toUpperCase()!=='INACTIVO') {
        lista.push({ TIPO:'PROFESIONAL', ID:p.ID_PROFESIONAL, NOMBRE:((p.NOMBRES||'')+' '+(p.APELLIDOS||'')).trim() });
      }
    });
    // Médicos
    var meds = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    meds.forEach(function(m){
      if (m.ID_MEDICO && String(m.ESTADO||'').toUpperCase()!=='INACTIVO') {
        lista.push({ TIPO:'MEDICO', ID:m.ID_MEDICO, NOMBRE:((m.NOMBRES||'')+' '+(m.APELLIDOS||'')).trim() });
      }
    });
    return respuestaOK(lista, lista.length + ' ejecutor(es).');
  } catch (err) { return respuestaError('Error: ' + err.message); }
}
