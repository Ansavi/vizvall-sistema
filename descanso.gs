// ════════════════════════════════════════════════════════════
//  DESCANSO MÉDICO — Backend
//  Módulo independiente. El descanso es un acto médico propio:
//  se genera después de la atención (con o sin receta), cuando
//  el médico evalúa que amerita reposo. Fecha = día de emisión.
// ════════════════════════════════════════════════════════════

// ── Listar pacientes con atención médica registrada (para dar descanso) ──
// Devuelve las atenciones recientes con datos del paciente y diagnóstico.
function listarPacientesParaDescanso(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) return respuestaError('Sin permiso.', 'ERR_PERMISO');

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila)
      .filter(function(a){ return a.ESTADO !== 'ANULADO'; })
      // Solo pacientes cuyo médico marcó "requiere descanso médico" en la atención
      .filter(function(a){ return String(a.REQUIERE_DESCANSO || '').toUpperCase() === 'SI'; });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);

    // Índices rápidos
    var pacIdx = {}; pacientes.forEach(function(p){ pacIdx[p.ID_PACIENTE] = p; });
    var medIdx = {}; medicos.forEach(function(m){ medIdx[m.ID_MEDICO] = m; });

    // Filtro opcional por texto (nombre o documento) y por fecha
    var q = (params.busqueda || '').toString().toUpperCase().trim();
    var fechaFiltro = (params.fecha || '').toString().substring(0,10);

    var filas = atenciones.map(function(a){
      var pac = pacIdx[a.ID_PACIENTE] || {};
      var med = medIdx[a.ID_MEDICO] || {};
      var nombrePac = a.NOMBRE_PACIENTE || ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim();
      var nombreMed = a.NOMBRE_MEDICO || ((med.NOMBRES||'')+' '+(med.APELLIDOS||'')).trim();
      return {
        ID_ATENCION: a.ID_ATENCION,
        ID_VENTA: a.ID_VENTA || '',
        ID_PACIENTE: a.ID_PACIENTE,
        NOMBRE_PACIENTE: nombrePac,
        DOCUMENTO: pac.NUMERO_DOCUMENTO || '',
        DIAGNOSTICO: (a.DIAGNOSTICO && a.DIAGNOSTICO !== '-') ? a.DIAGNOSTICO : '',
        CIE10: (a.CIE10 && a.CIE10 !== '-') ? a.CIE10 : '',
        ID_MEDICO: a.ID_MEDICO || '',
        NOMBRE_MEDICO: nombreMed,
        FECHA: (a.FECHA_ATENCION || a.FECHA_REGISTRO || '').toString().substring(0,10)
      };
    });

    // Aplicar filtros
    if (q) {
      filas = filas.filter(function(f){
        return (f.NOMBRE_PACIENTE||'').toUpperCase().indexOf(q) >= 0 ||
               (f.DOCUMENTO||'').toUpperCase().indexOf(q) >= 0;
      });
    }
    if (fechaFiltro) {
      filas = filas.filter(function(f){ return f.FECHA === fechaFiltro; });
    }

    // Ordenar por fecha desc (más recientes primero)
    filas.sort(function(a,b){ return (b.FECHA||'').localeCompare(a.FECHA||''); });

    // Limitar a los 100 más recientes si no hay filtro (rendimiento)
    if (!q && !fechaFiltro && filas.length > 100) filas = filas.slice(0, 100);

    return respuestaOK(filas, filas.length + ' paciente(s).');
  } catch (err) { return respuestaError('Error al listar: ' + err.message); }
}

// ── Guardar un descanso médico ──
function guardarDescanso(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_PACIENTE) { lock.releaseLock(); return respuestaError('Paciente requerido.'); }
    if (!params.DIAS || parseInt(params.DIAS,10) <= 0) { lock.releaseLock(); return respuestaError('Los días de reposo son obligatorios.'); }
    if (!params.DESDE || !params.HASTA) { lock.releaseLock(); return respuestaError('Las fechas desde/hasta son obligatorias.'); }

    // Médico: el del usuario logueado (si es médico), o el de la atención de origen
    var idMedico = params.ID_MEDICO || '';
    var nombreMedico = params.NOMBRE_MEDICO || '';
    var miMed = _hcMedicoDelUsuario(params);
    if (miMed) {
      idMedico = miMed;
      var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
      for (var m = 0; m < medicos.length; m++) {
        if (medicos[m].ID_MEDICO === miMed) { nombreMedico = ((medicos[m].NOMBRES||'')+' '+(medicos[m].APELLIDOS||'')).trim(); break; }
      }
    }

    var idDescanso = generarID(HOJAS.DESCANSO_MEDICO, 'ID_DESCANSO', 'DM', 5);
    insertarFila(HOJAS.DESCANSO_MEDICO, {
      ID_DESCANSO:     idDescanso,
      ID_PACIENTE:     params.ID_PACIENTE,
      NOMBRE_PACIENTE: (params.NOMBRE_PACIENTE || '').toUpperCase(),
      ID_ATENCION:     params.ID_ATENCION || '',
      ID_VENTA:        params.ID_VENTA || '',
      DIAGNOSTICO:     (params.DIAGNOSTICO || '').toUpperCase(),
      CIE10:           params.CIE10 || '',
      DIAS:            parseInt(params.DIAS, 10),
      DESDE:           params.DESDE,
      HASTA:           params.HASTA,
      TIPO:            params.TIPO || 'DOMICILIARIO',
      ID_MEDICO:       idMedico,
      NOMBRE_MEDICO:   (nombreMedico || '').toUpperCase(),
      OBSERVACION:     (params.OBSERVACION || '').toUpperCase(),
      INDICACION:      (params.INDICACION || '').toUpperCase(),
      ESTADO:          'ACTIVO',
      USUARIO:         params._sesion ? params._sesion.USUARIO : (params.usuario || ''),
      FECHA_REGISTRO:  getFecha()
    });

    lock.releaseLock();
    return respuestaOK({ ID_DESCANSO: idDescanso }, 'Descanso médico registrado: ' + idDescanso);
  } catch (err) { if (lock) lock.releaseLock(); return respuestaError('Error al guardar: ' + err.message); }
}

// ── Listar descansos ya emitidos (historial) ──
function listarDescansos(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var lista = leerHoja(HOJAS.DESCANSO_MEDICO).map(limpiarFila)
      .filter(function(d){ return d.ESTADO !== 'ANULADO'; });

    var q = (params.busqueda || '').toString().toUpperCase().trim();
    if (q) {
      lista = lista.filter(function(d){
        return (d.NOMBRE_PACIENTE||'').toUpperCase().indexOf(q) >= 0;
      });
    }
    lista.sort(function(a,b){ return (b.FECHA_REGISTRO||'').localeCompare(a.FECHA_REGISTRO||''); });
    if (lista.length > 200) lista = lista.slice(0, 200);
    return respuestaOK(lista, lista.length + ' descanso(s).');
  } catch (err) { return respuestaError('Error al listar descansos: ' + err.message); }
}

// ── Obtener un descanso por ID (para reimprimir) ──
function obtenerDescanso(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_DESCANSO) return respuestaError('ID requerido.');
    var lista = leerHoja(HOJAS.DESCANSO_MEDICO).map(limpiarFila);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].ID_DESCANSO === params.ID_DESCANSO) {
        // Enriquecer con datos del paciente y médico para el documento
        var d = lista[i];
        var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
        var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
        var pac = null, med = null;
        for (var p = 0; p < pacientes.length; p++) { if (pacientes[p].ID_PACIENTE === d.ID_PACIENTE) { pac = pacientes[p]; break; } }
        for (var m = 0; m < medicos.length; m++) { if (medicos[m].ID_MEDICO === d.ID_MEDICO) { med = medicos[m]; break; } }
        d.DOCUMENTO = pac ? (pac.NUMERO_DOCUMENTO || '') : '';
        d.EDAD = pac ? _dmCalcularEdad(pac.FECHA_NACIMIENTO) : '';
        d.SEXO = pac ? (pac.SEXO || '') : '';
        d.MEDICO_CMP = med ? (med.NUMERO_CMP || '') : '';
        d.MEDICO_RNE = med ? (med.NUMERO_RNE || '') : '';
        return respuestaOK(d);
      }
    }
    return respuestaError('Descanso no encontrado.');
  } catch (err) { return respuestaError('Error: ' + err.message); }
}

// ── Anular un descanso ──
function anularDescanso(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) { return respuestaError('Sistema ocupado.'); }
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_DESCANSO) { lock.releaseLock(); return respuestaError('ID requerido.'); }
    var ok = actualizarFila(HOJAS.DESCANSO_MEDICO, 'ID_DESCANSO', params.ID_DESCANSO, { ESTADO: 'ANULADO' });
    lock.releaseLock();
    return ok ? respuestaOK({}, 'Descanso anulado.') : respuestaError('No se encontró el descanso.');
  } catch (err) { if (lock) lock.releaseLock(); return respuestaError('Error: ' + err.message); }
}

// Helper: calcular edad desde fecha de nacimiento
function _dmCalcularEdad(fechaNac) {
  try {
    if (!fechaNac) return '';
    var f = new Date(fechaNac);
    if (isNaN(f.getTime())) return '';
    var hoy = new Date();
    var edad = hoy.getFullYear() - f.getFullYear();
    var mes = hoy.getMonth() - f.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < f.getDate())) edad--;
    return edad >= 0 ? (edad + ' años') : '';
  } catch (e) { return ''; }
}
