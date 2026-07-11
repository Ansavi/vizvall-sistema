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

// Detecta si un nombre de rol es de tipo médico (normaliza tildes, busca "MEDICO")
function _hcEsRolMedico(rolNombre) {
  var n = String(rolNombre||'').toUpperCase()
    .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U');
  return n.indexOf('MEDICO') >= 0;
}

// Devuelve las especialidades (IDs) de un médico
function _hcEspecialidadesDeMedico(idMedico) {
  var out = [];
  try {
    var rel = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila);
    for (var i=0;i<rel.length;i++){ if(String(rel[i].ID_MEDICO)===String(idMedico) && rel[i].ID_ESPECIALIDAD) out.push(String(rel[i].ID_ESPECIALIDAD)); }
  } catch(e){}
  return out;
}
// Devuelve las áreas de apoyo (IDs) de un médico
function _hcAreasDeMedico(idMedico) {
  var out = [];
  try {
    var rel = leerHoja(HOJAS.MEDICO_AREA_APOYO).map(limpiarFila);
    for (var i=0;i<rel.length;i++){ if(String(rel[i].ID_MEDICO)===String(idMedico) && String(rel[i].ESTADO||'').toUpperCase()!=='INACTIVO' && rel[i].ID_AREA_APOYO) out.push(String(rel[i].ID_AREA_APOYO)); }
  } catch(e){}
  return out;
}
// Devuelve la cita asociada a una venta (o null)
function _hcCitaDeVenta(idVenta, idCita, citasCache) {
  var citas = citasCache || leerHoja(HOJAS.CITA).map(limpiarFila);
  for (var i=0;i<citas.length;i++){
    if (idCita && idCita!=='-' && citas[i].ID_CITA===idCita) return citas[i];
    if (citas[i].ID_VENTA===idVenta) return citas[i];
  }
  return null;
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
        return {
          ID_MEDICO: medicos[k].ID_MEDICO,
          NOMBRE: ((medicos[k].NOMBRES||'')+' '+(medicos[k].APELLIDOS||'')).trim(),
          NUMERO_CMP: (medicos[k].NUMERO_CMP && medicos[k].NUMERO_CMP!=='-') ? medicos[k].NUMERO_CMP : '',
          NUMERO_RNE: (medicos[k].NUMERO_RNE && medicos[k].NUMERO_RNE!=='-') ? medicos[k].NUMERO_RNE : ''
        };
      }
    }
    return { ID_MEDICO: cita.ID_MEDICO, NOMBRE: cita.ID_MEDICO };
  } catch (e) { return null; }
}

function obtenerFichaClinica(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Historia Clínica'))
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
      registrarTrazaHC_(params, pac.ID_PACIENTE, datosPac.NOMBRE, 'CONSULTA', 'Consultó ficha clínica (sin ficha previa)');
      return respuestaOK({ paciente: datosPac, ficha: null, existe: false }, 'Sin ficha clínica aún.');
    }
    registrarTrazaHC_(params, pac.ID_PACIENTE, datosPac.NOMBRE, 'CONSULTA', 'Consultó ficha clínica');
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
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
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
      registrarTrazaHC_(params, params.ID_PACIENTE, params.NOMBRE_PACIENTE || '-', 'EDICION', 'Actualizó la ficha clínica');
      lock.releaseLock();
      return respuestaOK({ ID_FICHA: existente.ID_FICHA }, 'Ficha clínica actualizada.');
    }

    var id = generarID(HOJAS.FICHA_CLINICA, 'ID_FICHA', 'FC', 4);
    campos.ID_FICHA = id;
    campos.ID_PACIENTE = params.ID_PACIENTE;
    campos.ESTADO = 'ACTIVO';
    campos.FECHA_REGISTRO = getFecha('datetime');
    insertarFila(HOJAS.FICHA_CLINICA, campos);
    registrarTrazaHC_(params, params.ID_PACIENTE, params.NOMBRE_PACIENTE || '-', 'CREACION', 'Creó la ficha clínica');
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
    if (!_puedeModulo(params, 'Historia Clínica'))
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
      MEDICO_CMP: medico ? (medico.NUMERO_CMP||'') : '',
      MEDICO_RNE: medico ? (medico.NUMERO_RNE||'') : '',
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
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Solo médico o administrador.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }
    if (!params.DIAGNOSTICO || String(params.DIAGNOSTICO).trim()==='') { lock.releaseLock(); return respuestaError('El diagnóstico es obligatorio.'); }
    // SEGURIDAD: un médico solo puede registrar/editar SUS atenciones (no las de otro médico)
    // El ADMINISTRADOR está exento: puede registrar/editar cualquier atención.
    if (String(rol).toUpperCase() !== 'ADMINISTRADOR' && _hcEsRolMedico(rol)) {
      var miMedG = _hcMedicoDelUsuario(params);
      if (!miMedG) { lock.releaseLock(); return respuestaError('Su usuario no está vinculado a un médico. Contacte al administrador.', 'ERR_PERMISO'); }
      var medVenta = _hcMedicoDeVenta(params.ID_VENTA);
      if (medVenta && String(medVenta.ID_MEDICO) !== String(miMedG)) {
        lock.releaseLock();
        return respuestaError('No puede modificar la atención de otro médico.', 'ERR_PERMISO');
      }
    }

    var campos = {
      MOTIVO:          String(params.MOTIVO || '-').toUpperCase(),
      PA:              String(params.PA || '-'),
      TEMPERATURA:     String(params.TEMPERATURA || '-'),
      PESO:            String(params.PESO || '-'),
      TALLA:           String(params.TALLA || '-'),
      FREC_CARDIACA:   String(params.FREC_CARDIACA || '-'),
      FREC_RESPIRATORIA: String(params.FREC_RESPIRATORIA || '-'),
      SAT_O2:          String(params.SAT_O2 || '-'),
      ENFERMEDAD_ACTUAL:  String(params.ENFERMEDAD_ACTUAL || '-').toUpperCase(),
      PED_PESO_NACER:     String(params.PED_PESO_NACER || '-'),
      PED_TALLA_NACER:    String(params.PED_TALLA_NACER || '-'),
      PED_APGAR:          String(params.PED_APGAR || '-'),
      PED_TIPO_PARTO:     String(params.PED_TIPO_PARTO || '-').toUpperCase(),
      PED_SEM_GESTACION:  String(params.PED_SEM_GESTACION || '-'),
      PED_NUM_EMBARAZO:   String(params.PED_NUM_EMBARAZO || '-'),
      PED_CONTROLES_PRENATALES: String(params.PED_CONTROLES_PRENATALES || '-'),
      PED_LACTANCIA:      String(params.PED_LACTANCIA || '-').toUpperCase(),
      PED_PERIMETRO_CEFALICO: String(params.PED_PERIMETRO_CEFALICO || '-'),
      PED_PERCENTIL:      String(params.PED_PERCENTIL || '-'),
      PED_DESARROLLO_PSICOMOTOR: String(params.PED_DESARROLLO_PSICOMOTOR || '-').toUpperCase(),
      PED_VACUNAS:        String(params.PED_VACUNAS || '-').toUpperCase(),
      ANT_CARDIOPULMONAR: String(params.ANT_CARDIOPULMONAR || 'NO'),
      ANT_RENAL:          String(params.ANT_RENAL || 'NO'),
      ANT_DIABETES:       String(params.ANT_DIABETES || 'NO'),
      ANT_ALERGIAS:       String(params.ANT_ALERGIAS || 'NO'),
      ANT_OTROS:          String(params.ANT_OTROS || '-').toUpperCase(),
      ANT_NO_PATOLOGICOS: String(params.ANT_NO_PATOLOGICOS || '-').toUpperCase(),
      ANT_FAMILIARES:     String(params.ANT_FAMILIARES || '-').toUpperCase(),
      EXPLORACION_FISICA: String(params.EXPLORACION_FISICA || '-').toUpperCase(),
      LABORATORIOS_IMAGENES: String(params.LABORATORIOS_IMAGENES || '-').toUpperCase(),
      OBSERVACIONES_HC:   String(params.OBSERVACIONES_HC || '-').toUpperCase(),
      CIE10:           String(params.CIE10 || '-').toUpperCase(),
      DM_DIAS:         String(params.DM_DIAS || '-'),
      DM_DESDE:        String(params.DM_DESDE || '-'),
      DM_HASTA:        String(params.DM_HASTA || '-'),
      DM_TIPO:         String(params.DM_TIPO || '-'),
      DIAGNOSTICO:     String(params.DIAGNOSTICO || '-').toUpperCase(),
      TRATAMIENTO:     String(params.TRATAMIENTO || '-').toUpperCase(),
      INDICACIONES:    String(params.INDICACIONES || '-').toUpperCase(),
      ORDENES:         String(params.ORDENES || '-').toUpperCase(),
      PROXIMO_CONTROL: String(params.PROXIMO_CONTROL || '-'),
      TIPO_ATENCION_MED: String(params.TIPO_ATENCION_MED || 'CONTROL').toUpperCase(),
      REQUIERE_DESCANSO: String(params.REQUIERE_DESCANSO || 'NO').toUpperCase(),
    };

    // ¿Ya existe? → actualizar; si no → crear
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var existente = null;
    for (var a = 0; a < atenciones.length; a++) {
      if (atenciones[a].ID_VENTA === params.ID_VENTA && atenciones[a].ESTADO !== 'ANULADA') { existente = atenciones[a]; break; }
    }

    if (existente) {
      // Si en la edición se envía/corrige el médico, aplicarlo; si no, conservar el existente
      if (params.ID_MEDICO && params.ID_MEDICO !== '-' && String(params.ID_MEDICO).trim() !== '') {
        campos.ID_MEDICO = params.ID_MEDICO;
        campos.NOMBRE_MEDICO = String(params.NOMBRE_MEDICO || existente.NOMBRE_MEDICO || '-').toUpperCase();
      } else if ((!existente.ID_MEDICO || existente.ID_MEDICO === '-')) {
        // No había médico y no se envió: intentar heredar del usuario logueado
        var miMedU = _hcMedicoDelUsuario(params);
        if (miMedU) {
          campos.ID_MEDICO = miMedU;
          var _medsU = leerHoja(HOJAS.MEDICO).map(limpiarFila);
          for (var _mu = 0; _mu < _medsU.length; _mu++) {
            if (String(_medsU[_mu].ID_MEDICO) === String(miMedU)) { campos.NOMBRE_MEDICO = (((_medsU[_mu].NOMBRES||'')+' '+(_medsU[_mu].APELLIDOS||'')).trim()).toUpperCase(); break; }
          }
        }
      }
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
    // Médico que atendió: prioridad → el que envía el frontend (cita o selección manual);
    // si no viene, se hereda del usuario logueado (si es un médico). Así siempre queda asociado.
    var idMedFinal = (params.ID_MEDICO && params.ID_MEDICO !== '-' && String(params.ID_MEDICO).trim() !== '') ? params.ID_MEDICO : '';
    var nomMedFinal = (params.NOMBRE_MEDICO && params.NOMBRE_MEDICO !== '—' && String(params.NOMBRE_MEDICO).trim() !== '') ? params.NOMBRE_MEDICO : '';
    if (!idMedFinal) {
      var miMed = _hcMedicoDelUsuario(params);
      if (miMed) {
        idMedFinal = miMed;
        // Resolver el nombre del médico heredado
        var _meds = leerHoja(HOJAS.MEDICO).map(limpiarFila);
        for (var _m = 0; _m < _meds.length; _m++) {
          if (String(_meds[_m].ID_MEDICO) === String(miMed)) { nomMedFinal = ((_meds[_m].NOMBRES||'')+' '+(_meds[_m].APELLIDOS||'')).trim(); break; }
        }
      }
    }
    campos.ID_MEDICO       = idMedFinal || '-';
    campos.NOMBRE_MEDICO   = String(nomMedFinal || '-').toUpperCase();
    campos.ID_CITA         = params.ID_CITA || '-';
    campos.FECHA_ATENCION  = getFecha('datetime');
    campos.ESTADO          = 'ACTIVO';
    campos.USUARIO         = params.usuario || '-';
    campos.FECHA_REGISTRO  = getFecha('datetime');
    insertarFila(HOJAS.ATENCION_MEDICA, campos);
    _marcarCitaAtendida(params.ID_VENTA, params.ID_CITA); // cerrar la cita
    registrarTrazaHC_(params, params.ID_PACIENTE || '-', params.NOMBRE_PACIENTE || '-', 'ATENCION', 'Registró atención médica');
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
    if (!_puedeModulo(params, 'Historia Clínica'))
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_PACIENTE) return respuestaError('Paciente requerido.');
    var lista = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila)
      .filter(function(a){ return a.ID_PACIENTE === params.ID_PACIENTE && a.ESTADO !== 'ANULADA'; });
    // Marcar EDITABLE: el médico solo edita las suyas; admin edita todas; recepción ninguna
    var miMed = _hcEsRolMedico(rol) ? _hcMedicoDelUsuario(params) : null;
    lista = lista.map(function(a){
      var editable;
      if (rol === 'ADMINISTRADOR') editable = true;
      else if (_hcEsRolMedico(rol)) editable = (miMed && String(a.ID_MEDICO) === String(miMed));
      else editable = false; // recepción: solo lectura
      a.EDITABLE = editable;
      return a;
    });
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
    if (!_puedeModulo(params, 'Historia Clínica'))
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

    // Datos del paciente para el encabezado del documento (DNI, edad, sexo) — SIN dirección
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var p = 0; p < pacientes.length; p++) { if (pacientes[p].ID_PACIENTE === at.ID_PACIENTE) { pac = pacientes[p]; break; } }
    var edad = '';
    if (pac && pac.FECHA_NACIMIENTO && pac.FECHA_NACIMIENTO !== '-') {
      try {
        var fn = new Date(pac.FECHA_NACIMIENTO);
        if (!isNaN(fn.getTime())) {
          var hoy = new Date();
          edad = hoy.getFullYear() - fn.getFullYear();
          var m = hoy.getMonth() - fn.getMonth();
          if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) edad--;
          edad = edad + ' años';
        }
      } catch(e) {}
    }
    var pacienteDatos = {
      DOCUMENTO: pac ? (pac.NUMERO_DOCUMENTO || '-') : '-',
      EDAD: edad || '-',
      SEXO: pac ? (pac.SEXO || '-') : '-',
    };

    return respuestaOK({
      ID_VENTA: at.ID_VENTA, ID_PACIENTE: at.ID_PACIENTE, NOMBRE_PACIENTE: at.NOMBRE_PACIENTE,
      ID_MEDICO: at.ID_MEDICO, NOMBRE_MEDICO: at.NOMBRE_MEDICO, ID_CITA: at.ID_CITA,
      pacienteDatos: pacienteDatos,
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
    if (!_puedeModulo(params, 'Historia Clínica'))
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var dventaAll = leerHoja(HOJAS.DVENTA).map(limpiarFila);
    // Recetas activas por ID_VENTA (para marcar las atenciones que ya tienen receta)
    var recetasAll = leerHoja(HOJAS.RECETA_MEDICA).map(limpiarFila);
    var ventaConReceta = {};
    for (var rr = 0; rr < recetasAll.length; rr++) {
      if (recetasAll[rr].ESTADO !== 'ANULADA' && recetasAll[rr].ID_VENTA) {
        ventaConReceta[recetasAll[rr].ID_VENTA] = true;
      }
    }
    // Ventas con resultado de apoyo cargado (lab/eco/rayos X)
    var ventaConResultado = {};
    try {
      var resultadosAll = leerHoja(HOJAS.RESULTADO_APOYO).map(limpiarFila);
      for (var rs = 0; rs < resultadosAll.length; rs++) {
        if (resultadosAll[rs].ESTADO !== 'ANULADO' && resultadosAll[rs].ID_VENTA) {
          ventaConResultado[resultadosAll[rs].ID_VENTA] = true;
        }
      }
    } catch (eRes) { /* si la hoja no existe aún, sin resultados */ }

    // Ventas con descanso médico emitido (indicador adicional en el badge)
    var ventaConDescanso = {};
    try {
      var descansosAll = leerHoja(HOJAS.DESCANSO_MEDICO).map(limpiarFila);
      for (var dd = 0; dd < descansosAll.length; dd++) {
        if (descansosAll[dd].ESTADO !== 'ANULADO' && descansosAll[dd].ID_VENTA) {
          ventaConDescanso[descansosAll[dd].ID_VENTA] = true;
        }
      }
    } catch (eDesc) { /* si la hoja no existe aún, sin descansos */ }

    var mapa = {};
    for (var i = 0; i < atenciones.length; i++) {
      var a = atenciones[i];
      if (!a.ID_VENTA || a.ESTADO === 'ANULADA') continue;
      var tieneDx = a.DIAGNOSTICO && String(a.DIAGNOSTICO).trim() !== '' && a.DIAGNOSTICO !== '-';
      // Si ya tiene receta, es el estado más avanzado
      if (mapa[a.ID_VENTA] === 'CON_RECETA') continue;
      if (tieneDx && ventaConReceta[a.ID_VENTA]) { mapa[a.ID_VENTA] = 'CON_RECETA'; continue; }
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
    // Marcar ventas de apoyo que ya tienen su informe cargado
    for (var vr in ventaConResultado) {
      if (ventaConResultado.hasOwnProperty(vr) && !mapa[vr]) {
        mapa[vr] = 'CON_RESULTADO';
      }
    }
    return respuestaOK({ estados: mapa, descansos: ventaConDescanso }, 'Estados de atención.');
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
  var serviciosCache = null;
  for (var i = 0; i < dventa.length; i++) {
    if (dventa[i].ID_VENTA === idVenta) {
      var tipo = String(dventa[i].TIPO || '').toUpperCase();
      // PAQUETE: es clínico SALVO que sea de modalidad "por sesiones" (fisio, nutrición, psicología…)
      if (tipo === 'PAQUETE') {
        var idPaq = dventa[i].ID_PAQUETE;
        if (idPaq && idPaq !== '-') {
          var paquetes = leerHoja(HOJAS.PAQUETE).map(limpiarFila);
          for (var p = 0; p < paquetes.length; p++) {
            if (paquetes[p].ID_PAQUETE === idPaq) {
              if (String(paquetes[p].TIPO || '').toUpperCase() === 'SESIONES') return false; // directo a sesiones, no a tópico
              break;
            }
          }
        }
        return true; // paquete clínico → sí pasa por el flujo clínico
      }
      if (tipo === 'SERVICIO') {
        // Un servicio cuenta como clínico SOLO si NO es de apoyo (lab/eco/rayos X)
        if (typeof _servicioEsApoyo === 'function') {
          if (!serviciosCache) serviciosCache = leerHoja(HOJAS.SERVICIO).map(limpiarFila);
          if (!_servicioEsApoyo(dventa[i].ID_SERVICIO, serviciosCache)) return true; // es clínico
          // si es de apoyo, sigue buscando otro ítem clínico
        } else {
          return true; // sin el helper, comportamiento anterior (seguro)
        }
      }
    }
  }
  return false; // solo tenía servicios de apoyo (o productos) → no va al flujo clínico
}

// ── Listar las ventas del día con su estado de atención (para tópico) ──
function listarTopicoDelDia(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Historia Clínica'))
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
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Solo enfermera, médico o administrador.', 'ERR_PERMISO'); }
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
    if (!_puedeModulo(params, 'Historia Clínica'))
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
// Devuelve el ID_MEDICO vinculado al usuario logueado (o null si no tiene)
function _hcMedicoDelUsuario(params) {
  try {
    var idUser = params._sesion ? (params._sesion.ID_USUARIO || params._sesion.USUARIO) : null;
    var login = params._sesion ? params._sesion.USUARIO : (params.usuario || null);
    if (!idUser && !login) return null;
    var usuarios = leerHoja(HOJAS.USUARIO).map(limpiarFila);
    for (var i = 0; i < usuarios.length; i++) {
      var u = usuarios[i];
      if ((idUser && String(u.ID_USUARIO) === String(idUser)) ||
          (login && String(u.USUARIO).toLowerCase() === String(login).toLowerCase())) {
        return (u.ID_MEDICO && u.ID_MEDICO !== '-' && String(u.ID_MEDICO).trim() !== '') ? u.ID_MEDICO : null;
      }
    }
    return null;
  } catch (e) { return null; }
}

function listarBandejaMedico(params) {
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Historia Clínica'))
      return respuestaError('Sin permiso.', 'ERR_PERMISO');
    var fechaFiltro = params.fecha || null;
    var hace7 = _hcFechaHaceDias(7);
    var hoyBandeja = getFecha('fecha');   // YYYY-MM-DD de hoy, para clasificar futuras/pasadas
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

    // PRIVACIDAD: si el rol es MEDICO, solo ve SUS atenciones.
    // Admin y Recepcion ven todo. Médico no vinculado → no ve nada.
    // El ADMINISTRADOR ve todo el sistema, nunca se le aplica el filtro por médico
    var esAdmin = String(rol).toUpperCase() === 'ADMINISTRADOR';
    var filtrarPorMedico = !esAdmin && _hcEsRolMedico(rol);
    var miMedico = filtrarPorMedico ? _hcMedicoDelUsuario(params) : null;
    if (filtrarPorMedico && !miMedico) {
      return respuestaOK([], 'Su usuario no está vinculado a un médico. Contacte al administrador.');
    }
    // Especialidades y áreas del médico logueado (para ver citas libres que puede tomar)
    var misEsps = filtrarPorMedico ? _hcEspecialidadesDeMedico(miMedico) : [];
    var misAreas = filtrarPorMedico ? _hcAreasDeMedico(miMedico) : [];

    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila).filter(function(v){
      if (!v.ID_VENTA || String(v.ESTADO||'').toUpperCase()==='ANULADA') return false;
      if (!_ventaEsMedica(v.ID_VENTA, dventaAll)) return false;
      // Filtro por médico: ve las SUYAS + las SIN asignar de su especialidad/área
      if (filtrarPorMedico) {
        var medV = _hcMedicoDeVenta(v.ID_VENTA);
        if (medV) {
          // Cita asignada a un médico: solo se ve si es el logueado
          if (String(medV.ID_MEDICO) !== String(miMedico)) return false;
        } else {
          // Cita SIN médico asignado: se ve si su especialidad/área coincide con las del médico
          var ctA = _hcCitaDeVenta(v.ID_VENTA, v.ID_CITA, citas);
          var espCita = ctA ? String(ctA.ID_ESPECIALIDAD||'') : '';
          var areaCita = ctA ? String(ctA.ID_AREA_APOYO||'') : '';
          var tieneReq = (espCita && espCita!=='-') || (areaCita && areaCita!=='-');
          if (tieneReq) {
            var matchEsp = espCita && espCita!=='-' && misEsps.indexOf(espCita)>=0;
            var matchArea = areaCita && areaCita!=='-' && misAreas.indexOf(areaCita)>=0;
            if (!matchEsp && !matchArea) return false;
          }
          // Si la cita libre no tiene especialidad ni área definida, es genérica → visible a todos
        }
      }
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
      var fCitaItem = ct?String(ct.FECHA_CITA||'').substring(0,10):'';
      // Clasificación temporal para la bandeja (HOY / FUTURA / PASADA)
      var cuando = 'HOY';
      if (fCitaItem) {
        if (fCitaItem > hoyBandeja) cuando = 'FUTURA';
        else if (fCitaItem < hoyBandeja) cuando = 'PASADA';
      }
      return {
        ID_VENTA: v.ID_VENTA, ID_ATENCION: at?at.ID_ATENCION:'', ID_PACIENTE: v.ID_PACIENTE,
        NOMBRE_PACIENTE: nomPac(v.ID_PACIENTE), NOMBRE_MEDICO: medico?medico.NOMBRE:'—',
        FECHA_CITA: fCitaItem,
        CUANDO: cuando,
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

// ════════════════════════════════════════════════════════════════════════
//  TOMAR ATENCIÓN (auto-asignación al hacer clic en "Atender")
//  Asigna la cita/atención al médico logueado SOLO si está libre.
//  Si ya tiene médico asignado, se respeta (no se reasigna).
// ════════════════════════════════════════════════════════════════════════
function tomarAtencion(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (!_puedeModulo(params, 'Historia Clínica')) { lock.releaseLock(); return respuestaError('Sin permiso.', 'ERR_PERMISO'); }
    if (!params.ID_VENTA) { lock.releaseLock(); return respuestaError('Venta requerida.'); }

    // Solo aplica a usuarios que son médicos
    var miMed = _hcMedicoDelUsuario(params);
    if (!miMed) { lock.releaseLock(); return respuestaOK({ asignado:false }, 'Usuario no es médico; sin auto-asignación.'); }

    // Buscar la venta y su cita
    var ventas = leerHoja(HOJAS.VENTA).map(limpiarFila);
    var venta = null;
    for (var i=0;i<ventas.length;i++){ if(ventas[i].ID_VENTA===params.ID_VENTA){ venta=ventas[i]; break; } }
    if (!venta) { lock.releaseLock(); return respuestaError('Venta no encontrada.'); }

    var idCita = venta.ID_CITA;
    if (!idCita || idCita==='-') { lock.releaseLock(); return respuestaOK({ asignado:false }, 'La venta no tiene cita asociada.'); }

    var citas = leerHoja(HOJAS.CITA).map(limpiarFila);
    var cita = null;
    for (var j=0;j<citas.length;j++){ if(citas[j].ID_CITA===idCita){ cita=citas[j]; break; } }
    if (!cita) { lock.releaseLock(); return respuestaOK({ asignado:false }, 'Cita no encontrada.'); }

    // Si la cita YA tiene médico asignado → respetar (no reasignar)
    if (cita.ID_MEDICO && cita.ID_MEDICO !== '-' && String(cita.ID_MEDICO).trim() !== '') {
      lock.releaseLock();
      var esMio = String(cita.ID_MEDICO) === String(miMed);
      return respuestaOK({ asignado:esMio, yaAsignada:true }, esMio ? 'Cita ya asignada a usted.' : 'Cita ya asignada a otro médico.');
    }

    // Cita libre → asignar al médico logueado
    actualizarFila(HOJAS.CITA, 'ID_CITA', idCita, { ID_MEDICO: miMed });

    // Si ya existe una atención para esta venta sin médico, actualizarla también
    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    for (var a=0;a<atenciones.length;a++){
      if (atenciones[a].ID_VENTA===params.ID_VENTA && atenciones[a].ESTADO!=='ANULADA') {
        if (!atenciones[a].ID_MEDICO || atenciones[a].ID_MEDICO==='-') {
          var nom = '';
          var meds = leerHoja(HOJAS.MEDICO).map(limpiarFila);
          for (var m=0;m<meds.length;m++){ if(String(meds[m].ID_MEDICO)===String(miMed)){ nom=((meds[m].NOMBRES||'')+' '+(meds[m].APELLIDOS||'')).trim(); break; } }
          actualizarFila(HOJAS.ATENCION_MEDICA, 'ID_ATENCION', atenciones[a].ID_ATENCION, { ID_MEDICO: miMed, NOMBRE_MEDICO: String(nom||'-').toUpperCase() });
        }
        break;
      }
    }

    registrarAuditoria(params._sesion ? params._sesion.ID_USUARIO : '-', 'HISTORIA CLINICA', 'TOMAR_ATENCION',
      'Médico tomó la cita ' + idCita + ' (venta ' + params.ID_VENTA + ')');

    lock.releaseLock();
    return respuestaOK({ asignado:true }, 'Atención asignada.');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error al tomar atención: ' + err.message);
  }
}
