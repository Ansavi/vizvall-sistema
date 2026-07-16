// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Medico.gs
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR MÉDICOS
// ════════════════════════════════════════════════════════════
function listarMedicos(params) {
  try {
    if (!_puedeModulo(params, 'Personal')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila)
      .filter(function(m) {
        // Solo filas con ID_MEDICO y NOMBRES válidos
        return m.ID_MEDICO && String(m.ID_MEDICO).trim() !== '' &&
               m.NOMBRES   && String(m.NOMBRES).trim()   !== '';
      });

    // Enriquecer con especialidad principal desde MEDICO_ESPECIALIDAD
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var medicosEsp     = [];
    try {
      medicosEsp = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila);
    } catch(e) {
      // Tabla aún no creada - continuar sin especialidades
    }

    // Modalidad(es) de trabajo del medico (horarios medicos + horarios de apoyo)
    var _modPorMed = {};
    function _modReal(h){
      var m = String(h.MODALIDAD_TRABAJO||'').toUpperCase();
      if (m) return m;
      // Respaldo: si no hay modalidad pero el dia/hora dicen volante
      if (String(h.DIA_SEMANA||'').toUpperCase()==='VOLANTE' || String(h.HORA_INICIO||'').trim()==='-') return 'VOLANTE';
      return 'FIJO';
    }
    function _addMod(id, mod){
      if (!id) return;
      mod = String(mod||'FIJO').toUpperCase();
      if (!_modPorMed[id]) _modPorMed[id] = [];
      if (_modPorMed[id].indexOf(mod) < 0) _modPorMed[id].push(mod);
    }
    try {
      leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila).forEach(function(h){
        if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
        _addMod(h.ID_MEDICO, _modReal(h));
      });
    } catch(e) {}
    try {
      leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila).forEach(function(h){
        if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
        if (String(h.TIPO_EJECUTOR||'').toUpperCase()!=='MEDICO') return;
        _addMod(h.ID_MEDICO, _modReal(h));
      });
    } catch(e) {}

    var _cfgMed = _medDatosConfig();
    var _pagoPorMed = _cfgMed.pago;

    // Bloques de horario por medico (para el resumen legible)
    var _bloqPorMed = {};
    function _addBloq(id, h){
      if (!id) return;
      var ini = String(h.HORA_INICIO||'').trim(), fin = String(h.HORA_FIN||'').trim();
      if (!ini || !fin || ini === '-' || fin === '-') return;
      var dia = String(h.DIA_SEMANA||'').toUpperCase();
      if (_MED_DIAS_ORD.indexOf(dia) < 0) return;
      if (!_bloqPorMed[id]) _bloqPorMed[id] = [];
      _bloqPorMed[id].push({ dia: dia, ini: ini, fin: fin });
    }
    try {
      leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila).forEach(function(h){
        if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
        _addBloq(h.ID_MEDICO, h);
      });
    } catch(e) {}
    try {
      leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila).forEach(function(h){
        if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
        if (String(h.TIPO_EJECUTOR||'').toUpperCase()!=='MEDICO') return;
        _addBloq(h.ID_MEDICO, h);
      });
    } catch(e) {}

    medicos = medicos.map(function(m) {
      var mesps = medicosEsp.filter(function(me) {
        return me.ID_MEDICO === m.ID_MEDICO && me.ESTADO === 'ACTIVO';
      });
      var principal = null;
      for (var i = 0; i < mesps.length; i++) {
        if (mesps[i].ESPECIALIDAD_PRINCIPAL === 'SI') { principal = mesps[i]; break; }
      }
      if (!principal && mesps.length > 0) principal = mesps[0];

      var espNombre = '—';
      if (principal) {
        for (var j = 0; j < especialidades.length; j++) {
          if (especialidades[j].ID_ESPECIALIDAD === principal.ID_ESPECIALIDAD) {
            espNombre = especialidades[j].ESPECIALIDAD || '—';
            break;
          }
        }
      }

      // Retornar objeto simple sin spread ni arrays anidados
      return {
        ID_MEDICO:          m.ID_MEDICO,
        ID_TIPO_DOCUMENTO:  m.ID_TIPO_DOCUMENTO,
        NUMERO_DOCUMENTO:   m.NUMERO_DOCUMENTO,
        NOMBRES:            m.NOMBRES,
        APELLIDOS:          m.APELLIDOS,
        FECHA_NACIMIENTO:   m.FECHA_NACIMIENTO,
        SEXO:               m.SEXO,
        NUMERO_CMP:         m.NUMERO_CMP,
        NUMERO_RNE:         m.NUMERO_RNE || '',
        TELEFONO:           m.TELEFONO,
        EMAIL:              m.EMAIL,
        ESTADO:             m.ESTADO,
        OBSERVACIONES:      m.OBSERVACIONES,
        FECHA_REGISTRO:     m.FECHA_REGISTRO,
        ESPECIALIDAD_NOMBRE: espNombre,
        MODALIDADES:        (_modPorMed[m.ID_MEDICO] || []),
        HORARIO_RESUMEN:    _medResumenHorario(_bloqPorMed[m.ID_MEDICO]),
        PAGO_MODALIDAD:     (_pagoPorMed[m.ID_MEDICO] ? _pagoPorMed[m.ID_MEDICO].MODALIDAD : ''),
        PAGO_MONTO:         (_pagoPorMed[m.ID_MEDICO] ? _pagoPorMed[m.ID_MEDICO].MONTO : 0),
        PAGO_COMISION:      (_pagoPorMed[m.ID_MEDICO] ? _pagoPorMed[m.ID_MEDICO].COMISION : false),
      };
    });

    // Filtros
    if (params.estado) {
      medicos = medicos.filter(function(m){ return String(m.ESTADO).toUpperCase() === params.estado.toUpperCase(); });
    }
    // Filtro por especialidad: aplica después del enriquecimiento con MEDICO_ESPECIALIDAD
    if (params.especialidad) {
      medicos = medicos.filter(function(m){ return m.ESPECIALIDAD_NOMBRE && m.ID_ESPECIALIDAD_PRINCIPAL === String(params.especialidad); });
    }
    if (params.query) {
      var q = params.query.toUpperCase().trim();
      medicos = medicos.filter(function(m){ return (m.NOMBRES+' '+m.APELLIDOS+' '+m.NUMERO_CMP+' '+m.ID_MEDICO).toUpperCase().includes(q); });
    }

    var limite  = parseInt(params.limite) || 50;
    var pagina  = parseInt(params.pagina) || 1;
    var total   = medicos.length;
    var inicio  = (pagina - 1) * limite;
    var datos   = medicos.slice(inicio, inicio + limite);

    return respuestaOK({ datos, total, pagina, limite, paginas: Math.ceil(total / limite) },
      total + ' médico(s) encontrado(s).');

  } catch (err) {
    return respuestaError('Error al listar médicos: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  OBTENER MÉDICO
// ════════════════════════════════════════════════════════════
function obtenerMedico(id) {
  try {
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var m = null; for(var _i=0;_i<medicos.length;_i++){ if(medicos[_i].ID_MEDICO===id){m=medicos[_i];break;} }
    if (!m) return respuestaError('Médico no encontrado.');
    return respuestaOK(m);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  BUSCAR MÉDICO (búsqueda rápida)
// ════════════════════════════════════════════════════════════
function buscarMedico(query) {
  try {
    var q = String(query || '').toUpperCase().trim();
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila)
      .filter(function(m){ return m.ESTADO === 'ACTIVO'; })
      .filter(function(m){ return (m.NOMBRES+' '+m.APELLIDOS+' '+m.NUMERO_CMP).toUpperCase().includes(q); })
      .slice(0, 10);
    return respuestaOK(medicos);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR MÉDICO
// ════════════════════════════════════════════════════════════
function guardarMedico(params) {
  try {
    if (!_puedeModulo(params, 'Personal')) {
      return respuestaError('Solo el Administrador puede registrar médicos.', 'ERR_PERMISO');
    }

    // Validar campos requeridos
    var requeridos = ['ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO','NOMBRES','APELLIDOS','NUMERO_CMP','ESTADO'];
    for (var _r = 0; _r < requeridos.length; _r++) {
      var campo = requeridos[_r];
      if (!params[campo] || String(params[campo]).trim() === '') {
        return respuestaError('El campo ' + campo + ' es requerido.');
      }
    }

    // Verificar CMP duplicado
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var cmpDup = null; for(var _j=0;_j<medicos.length;_j++){ if(String(medicos[_j].NUMERO_CMP).toUpperCase().trim()===String(params.NUMERO_CMP).toUpperCase().trim()){cmpDup=medicos[_j];break;} }
    if (cmpDup) {
      return respuestaError('El número CMP ' + params.NUMERO_CMP + ' ya está registrado (' + cmpDup.ID_MEDICO + ').');
    }

    // Verificar documento duplicado
    var docDup = null; for(var _k=0;_k<medicos.length;_k++){ if(String(medicos[_k].ID_TIPO_DOCUMENTO)===String(params.ID_TIPO_DOCUMENTO)&&String(medicos[_k].NUMERO_DOCUMENTO).toUpperCase()===String(params.NUMERO_DOCUMENTO).toUpperCase()){docDup=medicos[_k];break;} }
    if (docDup) {
      return respuestaError('El documento ya está registrado (' + docDup.ID_MEDICO + ').');
    }

    // ── VALIDAR TELÉFONO ──
    if (params.TELEFONO && params.TELEFONO !== '-') {
      var vTel = validarTelefono_(params.TELEFONO, 'Teléfono');
      if (!vTel.ok) return respuestaError(vTel.mensaje);
    }

    // Generar ID
    var ultimos = medicos.map(function(m){ var n=parseInt((m.ID_MEDICO||'').replace('MED-','')); return isNaN(n)?0:n; });
    var siguiente = (ultimos.length ? Math.max.apply(null, ultimos) : 0) + 1;
    var idMedico  = 'MED-' + String(siguiente).padStart(4, '0');
    var fecha     = getFecha('fecha');

    insertarFila(HOJAS.MEDICO, {
      ID_MEDICO:          idMedico,
      ID_TIPO_DOCUMENTO:  params.ID_TIPO_DOCUMENTO,
      NUMERO_DOCUMENTO:   String(params.NUMERO_DOCUMENTO).toUpperCase().trim(),
      NOMBRES:            normalizar(params.NOMBRES),
      APELLIDOS:          normalizar(params.APELLIDOS),
      FECHA_NACIMIENTO:   params.FECHA_NACIMIENTO || '-',
      SEXO:               String(params.SEXO || '-').toUpperCase(),
      NUMERO_CMP:         String(params.NUMERO_CMP).toUpperCase().trim(),
      NUMERO_RNE:         String(params.NUMERO_RNE || '').toUpperCase().trim(),
      // Especialidades se gestionan en MEDICO_ESPECIALIDAD
      TELEFONO:           String(params.TELEFONO || '-').replace(/\s/g, '') || '-',
      EMAIL:              String(params.EMAIL || '-').toUpperCase().trim() || '-',
      ESTADO:             String(params.ESTADO).toUpperCase(),
      OBSERVACIONES:      String(params.OBSERVACIONES || '-').trim(),
      FECHA_REGISTRO:     fecha,
    });

    return respuestaOK({ ID_MEDICO: idMedico }, 'Médico registrado correctamente.');

  } catch (err) {
    return respuestaError('Error al guardar médico: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR MÉDICO
// ════════════════════════════════════════════════════════════
function actualizarMedico(params) {
  try {
    if (!_puedeModulo(params, 'Personal')) {
      return respuestaError('Solo el Administrador puede editar médicos.', 'ERR_PERMISO');
    }

    if (!params.ID_MEDICO) return respuestaError('ID_MEDICO requerido.');

    // ── VALIDAR TELÉFONO ──
    if (params.TELEFONO && params.TELEFONO !== '-') {
      var vTel = validarTelefono_(params.TELEFONO, 'Teléfono');
      if (!vTel.ok) return respuestaError(vTel.mensaje);
    }

    var datos = {};
    if (params.NOMBRES)           datos.NOMBRES           = normalizar(params.NOMBRES);
    if (params.APELLIDOS)         datos.APELLIDOS         = normalizar(params.APELLIDOS);
    if (params.FECHA_NACIMIENTO)  datos.FECHA_NACIMIENTO  = params.FECHA_NACIMIENTO;
    if (params.SEXO)              datos.SEXO              = String(params.SEXO).toUpperCase();
    if (params.NUMERO_CMP)        datos.NUMERO_CMP        = String(params.NUMERO_CMP).toUpperCase().trim();
    if (params.NUMERO_RNE !== undefined) datos.NUMERO_RNE   = String(params.NUMERO_RNE || '').toUpperCase().trim();
    // ID_ESPECIALIDAD ahora en MEDICO_ESPECIALIDAD
    if (params.TELEFONO !== undefined)    datos.TELEFONO  = String(params.TELEFONO || '-').replace(/\s/g, '') || '-';
    if (params.EMAIL !== undefined)       datos.EMAIL     = String(params.EMAIL || '-').toUpperCase().trim() || '-';
    if (params.OBSERVACIONES !== undefined) datos.OBSERVACIONES = String(params.OBSERVACIONES || '-').trim();
    if (params.ESTADO)            datos.ESTADO            = String(params.ESTADO).toUpperCase();

    actualizarFila(HOJAS.MEDICO, 'ID_MEDICO', params.ID_MEDICO, datos);
    return respuestaOK({ ID_MEDICO: params.ID_MEDICO }, 'Médico actualizado correctamente.');

  } catch (err) {
    return respuestaError('Error al actualizar médico: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CAMBIAR ESTADO
// ════════════════════════════════════════════════════════════
function cambiarEstadoMedico(params) {
  try {
    if (!params.ID_MEDICO || !params.ESTADO) return respuestaError('ID y ESTADO requeridos.');
    actualizarFila(HOJAS.MEDICO, 'ID_MEDICO', params.ID_MEDICO, {
      ESTADO: String(params.ESTADO).toUpperCase()
    });
    return respuestaOK({}, 'Estado actualizado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  HORARIOS
// ════════════════════════════════════════════════════════════
function listarHorariosMedico(params) {
  try {
    if (!params.ID_MEDICO) return respuestaError('ID_MEDICO requerido.');
    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
      .filter(function(h){ return h.ID_MEDICO===params.ID_MEDICO && (h.ESTADO===undefined||h.ESTADO===''||h.ESTADO==='ACTIVO'); });
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var enriched = horarios.map(function(h){
      var espNombre = '—';
      for (var i = 0; i < especialidades.length; i++) {
        if (especialidades[i].ID_ESPECIALIDAD === h.ID_ESPECIALIDAD) {
          espNombre = especialidades[i].ESPECIALIDAD || '—';
          break;
        }
      }
      return {
        ID_HORARIO:          h.ID_HORARIO,
        ID_MEDICO:           h.ID_MEDICO,
        ID_ESPECIALIDAD:     h.ID_ESPECIALIDAD,
        ESPECIALIDAD_NOMBRE: espNombre,
        DIA_SEMANA:          h.DIA_SEMANA,
        HORA_INICIO:         h.HORA_INICIO,
        HORA_FIN:            h.HORA_FIN,
        INTERVALO_MIN:       h.INTERVALO_MIN,
        ESTADO:              h.ESTADO,
      };
    });
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function guardarHorarioMedico(params) {
  try {
    if (!_puedeModulo(params, 'Personal')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO || !params.ID_ESPECIALIDAD || !params.DIA_SEMANA || !params.HORA_INICIO || !params.HORA_FIN) {
      return respuestaError('Campos requeridos: ID_MEDICO, ID_ESPECIALIDAD, DIA_SEMANA, HORA_INICIO, HORA_FIN.');
    }

    // Validar que el médico tenga esa especialidad asignada
    var medEsps = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila)
      .filter(function(me){ return me.ID_MEDICO===params.ID_MEDICO && me.ID_ESPECIALIDAD===params.ID_ESPECIALIDAD && me.ESTADO==='ACTIVO'; });
    if (!medEsps.length) {
      return respuestaError('El médico no tiene asignada esa especialidad. Asígnala primero.');
    }

    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila);
    var ultimos  = horarios.map(function(h){ return parseInt((h.ID_HORARIO||'').replace('HOR-','')); });
    var _filtered = ultimos.filter(function(n){ return !isNaN(n); });
    var siguiente = (_filtered.length ? Math.max.apply(null, _filtered) : 0) + 1;
    var idHorario = 'HOR-' + String(siguiente).padStart(4,'0');

    // ANTI-DUPLICADO: si ya existe horario ACTIVO para mismo medico+especialidad+dia, se ACTUALIZA
    var _dia = String(params.DIA_SEMANA).toUpperCase();
    var _dup = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila).filter(function(h){
      return h.ID_MEDICO===params.ID_MEDICO &&
             h.ID_ESPECIALIDAD===params.ID_ESPECIALIDAD &&
             String(h.DIA_SEMANA||'').toUpperCase()===_dia &&
             String(h.ESTADO||'').toUpperCase()!=='INACTIVO';
    });
    if (_dup.length) {
      actualizarFila(HOJAS.HORARIO_MEDICO, 'ID_HORARIO', _dup[0].ID_HORARIO, {
        HORA_INICIO:       params.HORA_INICIO,
        HORA_FIN:          params.HORA_FIN,
        INTERVALO_MIN:     parseInt(params.INTERVALO_MIN) || 30,
        ESTADO:            'ACTIVO',
        MODALIDAD_TRABAJO: String(params.MODALIDAD_TRABAJO || 'FIJO').toUpperCase()
      });
      // Desactivar sobrantes si habia mas de uno
      for (var _i=1;_i<_dup.length;_i++){
        actualizarFila(HOJAS.HORARIO_MEDICO, 'ID_HORARIO', _dup[_i].ID_HORARIO, { ESTADO:'INACTIVO' });
      }
      return respuestaOK({ ID_HORARIO: _dup[0].ID_HORARIO }, 'Horario actualizado.');
    }

    insertarFila(HOJAS.HORARIO_MEDICO, {
      ID_HORARIO:      idHorario,
      ID_MEDICO:       params.ID_MEDICO,
      ID_ESPECIALIDAD: params.ID_ESPECIALIDAD,
      DIA_SEMANA:      String(params.DIA_SEMANA).toUpperCase(),
      HORA_INICIO:     params.HORA_INICIO,
      HORA_FIN:        params.HORA_FIN,
      INTERVALO_MIN:   parseInt(params.INTERVALO_MIN) || 30,
      ESTADO:          'ACTIVO',
      MODALIDAD_TRABAJO: String(params.MODALIDAD_TRABAJO || 'FIJO').toUpperCase(),
    });
    return respuestaOK({ ID_HORARIO: idHorario }, 'Horario guardado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function eliminarHorarioMedico(params) {
  try {
    if (!params.ID_HORARIO) return respuestaError('ID_HORARIO requerido.');
    actualizarFila(HOJAS.HORARIO_MEDICO, 'ID_HORARIO', params.ID_HORARIO, { ESTADO: 'INACTIVO' });
    return respuestaOK({}, 'Horario eliminado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function obtenerSlotsDisponibles(params) {
  try {
    if (!params.ID_MEDICO || !params.FECHA) return respuestaError('ID_MEDICO y FECHA requeridos.');
    var fecha  = new Date(params.FECHA);
    var dias   = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
    var dia    = dias[fecha.getDay()];
    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
      .filter(function(h){ return h.ID_MEDICO===params.ID_MEDICO && h.DIA_SEMANA===dia && (h.ESTADO===undefined||h.ESTADO===''||h.ESTADO==='ACTIVO'); });
    if (!horarios.length) return respuestaOK([], 'Sin horarios para ese día.');

    // Generar slots
    var citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(function(c){ return c.ID_MEDICO===params.ID_MEDICO && c.FECHA_CITA===params.FECHA && ['PROGRAMADA','CONFIRMADA'].indexOf(c.ESTADO_CITA)>=0; });
    var citasHoras = citas.map(function(c){ return c.HORA_CITA; });

    var slots = [];
    horarios.forEach(function(h) {
      var [hI, mI] = h.HORA_INICIO.split(':').map(Number);
      var [hF, mF] = h.HORA_FIN.split(':').map(Number);
      var intervalo = parseInt(h.INTERVALO_MIN) || 30;
      while (hI * 60 + mI < hF * 60 + mF) {
        var hora = String(hI).padStart(2,'0') + ':' + String(mI).padStart(2,'0');
        slots.push({ hora, disponible: !citasHoras.includes(hora) });
        mI += intervalo;
        if (mI >= 60) { hI++; mI -= 60; }
      }
    });
    return respuestaOK(slots);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  REPORTE MÉDICOS
// ════════════════════════════════════════════════════════════
function reporteMedicos(params) {
  try {
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var resumen = {
      total:    medicos.length,
      activos:  medicos.filter(function(m){ return m.ESTADO==='ACTIVO'; }).length,
      inactivos:medicos.filter(function(m){ return m.ESTADO==='INACTIVO'; }).length,
    };
    return respuestaOK({ medicos, resumen });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  HELPERS LOCALES
// ════════════════════════════════════════════════════════════
// validarTelefono_ está definida en Paciente.gs (scope global compartido)

// ════════════════════════════════════════════════════════════
//  MÉDICO - ESPECIALIDADES (MEDICO_ESPECIALIDAD)
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  LISTAR TODOS LOS HORARIOS (vista global tipo calendario)
// ════════════════════════════════════════════════════════════
function listarTodosHorarios(params) {
  try {
    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
      .filter(function(h){ return h.ID_HORARIO && String(h.ID_HORARIO).trim() !== '' && (h.ESTADO===undefined||h.ESTADO===''||h.ESTADO === 'ACTIVO'); });
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);

    var enriched = horarios.map(function(h){
      var medNombre = '—', medCmp = '';
      for (var i = 0; i < medicos.length; i++) {
        if (medicos[i].ID_MEDICO === h.ID_MEDICO) {
          medNombre = (medicos[i].NOMBRES || '') + ' ' + (medicos[i].APELLIDOS || '');
          medCmp = medicos[i].NUMERO_CMP || '';
          break;
        }
      }
      var espNombre = '—';
      for (var j = 0; j < especialidades.length; j++) {
        if (especialidades[j].ID_ESPECIALIDAD === h.ID_ESPECIALIDAD) {
          espNombre = especialidades[j].ESPECIALIDAD || '—';
          break;
        }
      }
      return {
        ID_HORARIO:          h.ID_HORARIO,
        ID_MEDICO:           h.ID_MEDICO,
        MEDICO_NOMBRE:       medNombre,
        MEDICO_CMP:          medCmp,
        ID_ESPECIALIDAD:     h.ID_ESPECIALIDAD,
        ESPECIALIDAD_NOMBRE: espNombre,
        DIA_SEMANA:          h.DIA_SEMANA,
        HORA_INICIO:         h.HORA_INICIO,
        HORA_FIN:            h.HORA_FIN,
        INTERVALO_MIN:       h.INTERVALO_MIN,
        ESTADO:              h.ESTADO,
      };
    });
    return respuestaOK(enriched, enriched.length + ' horario(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  LISTAR TODOS LOS MÉDICOS CON SUS ESPECIALIDADES (vista gestión)
// ════════════════════════════════════════════════════════════
function listarTodasEspecialidadesMedicos(params) {
  try {
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila)
      .filter(function(m){ return m.ID_MEDICO && String(m.ID_MEDICO).trim() !== ''; });
    var medEsps = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila)
      .filter(function(me){ return me.ESTADO === 'ACTIVO'; });
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    // Áreas de apoyo del médico
    var medAreas = leerHoja(HOJAS.MEDICO_AREA_APOYO).map(limpiarFila)
      .filter(function(ma){ return ma.ESTADO === 'ACTIVO'; });
    var areasApoyo = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);

    var _cfg = _medDatosConfig();

    var resultado = medicos.map(function(m){
      var esps = [];
      for (var i = 0; i < medEsps.length; i++) {
        if (medEsps[i].ID_MEDICO === m.ID_MEDICO) {
          var espNombre = '—';
          for (var j = 0; j < especialidades.length; j++) {
            if (especialidades[j].ID_ESPECIALIDAD === medEsps[i].ID_ESPECIALIDAD) {
              espNombre = especialidades[j].ESPECIALIDAD || '—';
              break;
            }
          }
          esps.push({
            ID_MEDICO_ESPECIALIDAD: medEsps[i].ID_MEDICO_ESPECIALIDAD,
            ID_ESPECIALIDAD:        medEsps[i].ID_ESPECIALIDAD,
            ESPECIALIDAD_NOMBRE:    espNombre,
            PRINCIPAL:              medEsps[i].ESPECIALIDAD_PRINCIPAL === 'SI',
          });
        }
      }
      // Áreas de apoyo de este médico
      var areas = [];
      for (var a = 0; a < medAreas.length; a++) {
        if (medAreas[a].ID_MEDICO === m.ID_MEDICO) {
          var areaNom = '—';
          for (var b = 0; b < areasApoyo.length; b++) {
            if (areasApoyo[b].ID_AREA_APOYO === medAreas[a].ID_AREA_APOYO) {
              areaNom = areasApoyo[b].NOMBRE || '—'; break;
            }
          }
          areas.push({ ID_AREA_APOYO: medAreas[a].ID_AREA_APOYO, AREA_NOMBRE: areaNom });
        }
      }
      return {
        ID_MEDICO:     m.ID_MEDICO,
        NOMBRES:       m.NOMBRES,
        APELLIDOS:     m.APELLIDOS,
        NUMERO_CMP:    m.NUMERO_CMP,
        ESTADO:        m.ESTADO,
        ESPECIALIDADES: esps,
        AREAS_APOYO:    areas,
        MODALIDADES:    (_cfg.mods[m.ID_MEDICO] || []),
        HORARIO_RESUMEN:_medResumenHorario(_cfg.bloq[m.ID_MEDICO]),
        PAGO_MODALIDAD: (_cfg.pago[m.ID_MEDICO] ? _cfg.pago[m.ID_MEDICO].MODALIDAD : ''),
        PAGO_MONTO:     (_cfg.pago[m.ID_MEDICO] ? _cfg.pago[m.ID_MEDICO].MONTO : 0),
        PAGO_COMISION:  (_cfg.pago[m.ID_MEDICO] ? _cfg.pago[m.ID_MEDICO].COMISION : false),
      };
    });
    return respuestaOK(resultado, resultado.length + ' médico(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function listarEspecialidadesMedico(params) {
  try {
    if (!params.ID_MEDICO) return respuestaError('ID_MEDICO requerido.');
    var medicosEsp = [];
    try {
      medicosEsp = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila)
        .filter(function(me) { return me.ID_MEDICO === params.ID_MEDICO && me.ESTADO === 'ACTIVO'; });
    } catch(e) {}
    var especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    var enriched = medicosEsp.map(function(me) {
      var espNombre = '—';
      for (var i = 0; i < especialidades.length; i++) {
        if (especialidades[i].ID_ESPECIALIDAD === me.ID_ESPECIALIDAD) {
          espNombre = especialidades[i].ESPECIALIDAD || '—';
          break;
        }
      }
      return {
        ID_MEDICO_ESPECIALIDAD: me.ID_MEDICO_ESPECIALIDAD,
        ID_MEDICO:              me.ID_MEDICO,
        ID_ESPECIALIDAD:        me.ID_ESPECIALIDAD,
        ESPECIALIDAD_PRINCIPAL: me.ESPECIALIDAD_PRINCIPAL,
        ESTADO:                 me.ESTADO,
        FECHA_REGISTRO:         me.FECHA_REGISTRO,
        ESPECIALIDAD_NOMBRE:    espNombre,
        PRINCIPAL:              me.ESPECIALIDAD_PRINCIPAL === 'SI',
      };
    });
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function agregarEspecialidadMedico(params) {
  try {
    if (!_puedeModulo(params, 'Personal')) {
      return respuestaError('Solo el Administrador puede gestionar especialidades.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO || !params.ID_ESPECIALIDAD) {
      return respuestaError('ID_MEDICO e ID_ESPECIALIDAD son requeridos.');
    }

    // Verificar si ya existe
    var existentes = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila);
    var dup = null; for(var _d=0;_d<existentes.length;_d++){ if(existentes[_d].ID_MEDICO===params.ID_MEDICO&&existentes[_d].ID_ESPECIALIDAD===params.ID_ESPECIALIDAD&&existentes[_d].ESTADO==='ACTIVO'){dup=existentes[_d];break;} }
    if (dup) return respuestaError('Esta especialidad ya está asignada al médico.');

    // Si es principal, desmarcar las anteriores
    if (params.ESPECIALIDAD_PRINCIPAL === 'SI') {
      existentes.filter(function(me){ return me.ID_MEDICO===params.ID_MEDICO&&me.ESTADO==='ACTIVO'; })
        .forEach(function(me){
          actualizarFila(HOJAS.MEDICO_ESPECIALIDAD, 'ID_MEDICO_ESPECIALIDAD',
            me.ID_MEDICO_ESPECIALIDAD, { ESPECIALIDAD_PRINCIPAL: 'NO' });
        });
    }

    var ultimos  = existentes.map(function(me){ return parseInt((me.ID_MEDICO_ESPECIALIDAD||'').replace('ME-','')); });
    var _filtered = ultimos.filter(function(n){ return !isNaN(n); });
    var siguiente = (_filtered.length ? Math.max.apply(null, _filtered) : 0) + 1;
    var id = 'ME-' + String(siguiente).padStart(4,'0');

    insertarFila(HOJAS.MEDICO_ESPECIALIDAD, {
      ID_MEDICO_ESPECIALIDAD: id,
      ID_MEDICO:              params.ID_MEDICO,
      ID_ESPECIALIDAD:        params.ID_ESPECIALIDAD,
      ESPECIALIDAD_PRINCIPAL: params.ESPECIALIDAD_PRINCIPAL || 'NO',
      ESTADO:                 'ACTIVO',
      FECHA_REGISTRO:         getFecha('fecha'),
    });

    return respuestaOK({ ID_MEDICO_ESPECIALIDAD: id }, 'Especialidad asignada correctamente.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function quitarEspecialidadMedico(params) {
  try {
    if (!params.ID_MEDICO_ESPECIALIDAD) return respuestaError('ID_MEDICO_ESPECIALIDAD requerido.');
    actualizarFila(HOJAS.MEDICO_ESPECIALIDAD, 'ID_MEDICO_ESPECIALIDAD',
      params.ID_MEDICO_ESPECIALIDAD, { ESTADO: 'INACTIVO' });
    return respuestaOK({}, 'Especialidad removida.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }


// ── FIN Medico.gs ──

}

// ════════════════════════════════════════════════════════════
//  IMPORTACIÓN MASIVA de médicos desde filas (CSV parseado).
// ════════════════════════════════════════════════════════════
function importarMedicosMasivo(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    var rol = params._sesion && params._sesion.ROL ? params._sesion.ROL : '';
    if (rol !== 'ADMINISTRADOR') { lock.releaseLock(); return respuestaError('Solo el Administrador puede importar médicos.', 'ERR_PERMISO'); }

    var filas = params.filas;
    if (!filas || !Array.isArray(filas) || !filas.length) { lock.releaseLock(); return respuestaError('No hay filas para importar.'); }
    if (filas.length > 500) { lock.releaseLock(); return respuestaError('Máximo 500 médicos por importación.'); }

    var creados = 0, errores = [];
    var tipos = leerHoja(HOJAS.TIPO_DOCUMENTO).map(limpiarFila);
    var medicosExist = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var docsReg = {}, cmpReg = {};
    medicosExist.forEach(function(m){
      docsReg[String(m.ID_TIPO_DOCUMENTO)+'-'+normalizar(String(m.NUMERO_DOCUMENTO))] = true;
      if(m.NUMERO_CMP) cmpReg[normalizar(String(m.NUMERO_CMP))] = true;
    });
    var ultimos = medicosExist.map(function(m){ var n=parseInt((m.ID_MEDICO||'').replace('MED-','')); return isNaN(n)?0:n; });
    var sig = (ultimos.length ? Math.max.apply(null, ultimos) : 0);

    for (var i = 0; i < filas.length; i++) {
      var f = filas[i], nfila = i + 2;
      try {
        var tipoDoc = null;
        var tdInput = sinTildes(String(f.TIPO_DOCUMENTO || f.ID_TIPO_DOCUMENTO || ''));
        for (var t = 0; t < tipos.length; t++) {
          if (String(tipos[t].ID_TIPO_DOCUMENTO).toUpperCase() === tdInput || sinTildes(String(tipos[t].TIPO||'')) === tdInput) { tipoDoc = tipos[t]; break; }
        }
        if (!tipoDoc) { errores.push('Fila ' + nfila + ': tipo de documento inválido ("' + tdInput + '").'); continue; }

        var ndoc = normalizar(String(f.NUMERO_DOCUMENTO || '').trim());
        if (!ndoc) { errores.push('Fila ' + nfila + ': falta número de documento.'); continue; }
        if (!f.NOMBRES || !String(f.NOMBRES).trim()) { errores.push('Fila ' + nfila + ': falta nombres.'); continue; }
        if (!f.APELLIDOS || !String(f.APELLIDOS).trim()) { errores.push('Fila ' + nfila + ': falta apellidos.'); continue; }
        var cmp = normalizar(String(f.NUMERO_CMP || '').trim());
        if (!cmp) { errores.push('Fila ' + nfila + ': falta número de CMP.'); continue; }

        var claveDoc = String(tipoDoc.ID_TIPO_DOCUMENTO)+'-'+ndoc;
        if (docsReg[claveDoc]) { errores.push('Fila ' + nfila + ': ya existe médico con ' + tipoDoc.TIPO + ' ' + ndoc + '.'); continue; }
        if (cmpReg[cmp]) { errores.push('Fila ' + nfila + ': ya existe médico con CMP ' + cmp + '.'); continue; }

        var sexo = String(f.SEXO || 'O').trim().toUpperCase();
        if (['M','F','O'].indexOf(sexo) < 0) sexo = 'O';

        sig++;
        var idMedico = 'MED-' + String(sig).padStart(4, '0');
        insertarFila(HOJAS.MEDICO, {
          ID_MEDICO:         idMedico,
          ID_TIPO_DOCUMENTO: tipoDoc.ID_TIPO_DOCUMENTO,
          NUMERO_DOCUMENTO:  ndoc,
          NOMBRES:           normalizar(f.NOMBRES),
          APELLIDOS:         normalizar(f.APELLIDOS),
          FECHA_NACIMIENTO:  String(f.FECHA_NACIMIENTO || '').trim(),
          SEXO:              sexo,
          NUMERO_CMP:        cmp,
          TELEFONO:          String(f.TELEFONO || '-').trim(),
          EMAIL:             String(f.EMAIL || f.CORREO || '-').trim(),
          ESTADO:            'ACTIVO',
          OBSERVACIONES:     '-',
          FECHA_REGISTRO:    getFecha('datetime'),
        });
        docsReg[claveDoc] = true; cmpReg[cmp] = true;
        creados++;
      } catch (eFila) { errores.push('Fila ' + nfila + ': ' + eFila.message); }
    }
    lock.releaseLock();
    return respuestaOK({ creados: creados, errores: errores, totalFilas: filas.length }, creados + ' médico(s) importado(s).');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error en importación: ' + err.message);
  }
}


// ════════════════════════════════════════════════════════════════════════
//  Reemplazar el HORARIO SEMANAL completo de un médico
//  Borra los horarios activos previos e inserta los nuevos.
//  params: ID_MEDICO, ID_ESPECIALIDAD, MODALIDAD_TRABAJO, INTERVALO_MIN,
//          ITEMS=[{dia,ini,fin}]
// ════════════════════════════════════════════════════════════════════════
function reemplazarHorarioMedico(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!params.ID_MEDICO) { lock.releaseLock(); return respuestaError('ID_MEDICO requerido.'); }
    if (!params.ID_ESPECIALIDAD) { lock.releaseLock(); return respuestaError('ID_ESPECIALIDAD requerido.'); }

    var modalidad = String(params.MODALIDAD_TRABAJO || 'FIJO').toUpperCase();
    var items = params.ITEMS || [];
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch(e){ items = []; } }
    if (modalidad !== 'VOLANTE' && !items.length) { lock.releaseLock(); return respuestaError('Debe activar al menos un día.'); }

    var ss = SpreadsheetApp.openById('1mddw5yEyvY4U-7dvBBOyFHKmnMnSRGsn6KjfY-DtX9o');
    var hoja = ss.getSheetByName('HORARIO_MEDICO');
    if (!hoja) { lock.releaseLock(); return respuestaError('No existe HORARIO_MEDICO.'); }

    // Asegurar columna ESTADO
    var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    if (cab.indexOf('ESTADO') < 0) {
      hoja.insertColumnAfter(hoja.getLastColumn());
      hoja.getRange(1, hoja.getLastColumn()).setValue('ESTADO');
      var ult0 = hoja.getLastRow();
      if (ult0 > 1) {
        var vv = [];
        for (var k = 2; k <= ult0; k++) vv.push(['ACTIVO']);
        hoja.getRange(2, hoja.getLastColumn(), vv.length, 1).setValues(vv);
      }
      cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    }
    var colEstado = cab.indexOf('ESTADO') + 1;
    var colMed    = cab.indexOf('ID_MEDICO') + 1;

    // 1) Marcar INACTIVO los horarios previos del médico
    var ultima = hoja.getLastRow();
    var borrados = 0;
    if (ultima > 1) {
      var rango = hoja.getRange(2, 1, ultima - 1, hoja.getLastColumn()).getValues();
      for (var r = 0; r < rango.length; r++) {
        var estadoAct = rango[r][colEstado - 1];
        if (rango[r][colMed - 1] === params.ID_MEDICO && (estadoAct === '' || estadoAct === 'ACTIVO' || estadoAct === undefined)) {
          hoja.getRange(r + 2, colEstado).setValue('INACTIVO');
          borrados++;
        }
      }
    }
    _invalidarCacheHoja_('HORARIO_MEDICO');

    // 2) Insertar los nuevos
    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila);
    var nums = horarios.map(function(h){ return parseInt(String(h.ID_HORARIO||'').replace('HOR-','')); }).filter(function(n){ return !isNaN(n); });
    var sig = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    var creados = 0;

    if (modalidad === 'VOLANTE') {
      insertarFila(HOJAS.HORARIO_MEDICO, {
        ID_HORARIO: 'HOR-' + String(sig).padStart(4,'0'),
        ID_MEDICO: params.ID_MEDICO, ID_ESPECIALIDAD: params.ID_ESPECIALIDAD,
        DIA_SEMANA: 'VOLANTE', HORA_INICIO: '-', HORA_FIN: '-',
        INTERVALO_MIN: 0, ESTADO: 'ACTIVO', MODALIDAD_TRABAJO: 'VOLANTE',
      });
      creados = 1;
    } else {
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        if (!it || !it.dia || !it.ini || !it.fin) continue;
        if (it.fin <= it.ini) { lock.releaseLock(); return respuestaError('En ' + it.dia + ': la hora fin debe ser mayor que la de inicio.'); }
        insertarFila(HOJAS.HORARIO_MEDICO, {
          ID_HORARIO: 'HOR-' + String(sig + creados).padStart(4,'0'),
          ID_MEDICO: params.ID_MEDICO, ID_ESPECIALIDAD: params.ID_ESPECIALIDAD,
          DIA_SEMANA: String(it.dia).toUpperCase(),
          HORA_INICIO: it.ini, HORA_FIN: it.fin,
          INTERVALO_MIN: parseInt(params.INTERVALO_MIN) || 30,
          ESTADO: 'ACTIVO', MODALIDAD_TRABAJO: modalidad,
        });
        creados++;
      }
    }
    lock.releaseLock();
    return respuestaOK({ creados: creados, reemplazados: borrados }, 'Horario actualizado (' + creados + ' día(s)).');
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error: ' + err.message);
  }
}

// Lee la config de pago tolerando columnas NUEVAS (MODALIDAD_PRESENCIA) y VIEJAS (MODALIDAD).
// Asi funciona aunque no se haya corrido migrarHonorarioConfig().
function _cfgPagoFila(h) {
  h = h || {};   // protección: si se ejecuta suelta desde el editor, no revienta
  var modP = String(h.MODALIDAD_PRESENCIA||'').toUpperCase();
  var modL = String(h.MODALIDAD||'').toUpperCase();          // columna antigua
  var tieneCom = String(h.TIENE_COMISION||'').toUpperCase()==='SI';
  var pctCom   = Number(h.PORCENTAJE_COMISION||0);
  var mod = '', monto = 0;

  if (modP && modP !== 'NINGUNO') {
    mod = modP;
    monto = Number(h.MONTO_PRESENCIA||0);
  } else if (modL) {
    if (modL === 'PORCENTAJE') {          // esquema antiguo: solo comision
      tieneCom = true;
      if (!pctCom) pctCom = Number(h.MONTO||0);
    } else {
      mod = modL;                          // SUELDO_FIJO | POR_TURNO | POR_HORA
      monto = Number(h.MONTO||0);
    }
  }
  if (!monto) monto = Number(h.MONTO_PRESENCIA||0) || Number(h.MONTO||0);
  return { MODALIDAD: mod, MONTO: monto, COMISION: tieneCom, PCT: pctCom };
}

// Datos de PAGO / MODALIDAD / HORARIO por persona (compartido por las listas de medicos)
function _medDatosConfig() {
  var pago = {}, mods = {}, bloq = {};
  try {
    leerHoja(HOJAS.HONORARIO_CONFIG).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()!=='ACTIVO') return;
      if (!h.ID_PERSONAL) return;
      pago[h.ID_PERSONAL] = _cfgPagoFila(h);
    });
  } catch(e) {}
  function addH(id, h){
    if (!id) return;
    var m = String(h.MODALIDAD_TRABAJO||'').toUpperCase();
    if (!m) m = (String(h.DIA_SEMANA||'').toUpperCase()==='VOLANTE' || String(h.HORA_INICIO||'').trim()==='-') ? 'VOLANTE' : 'FIJO';
    if (!mods[id]) mods[id] = [];
    if (mods[id].indexOf(m) < 0) mods[id].push(m);
    var ini = String(h.HORA_INICIO||'').trim(), fin = String(h.HORA_FIN||'').trim();
    var dia = String(h.DIA_SEMANA||'').toUpperCase();
    if (ini && fin && ini !== '-' && fin !== '-' && _MED_DIAS_ORD.indexOf(dia) >= 0) {
      if (!bloq[id]) bloq[id] = [];
      bloq[id].push({ dia: dia, ini: ini, fin: fin });
    }
  }
  try {
    leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
      addH(h.ID_MEDICO, h);
    });
  } catch(e) {}
  try {
    leerHoja(HOJAS.HORARIO_APOYO).map(limpiarFila).forEach(function(h){
      if (String(h.ESTADO||'').toUpperCase()==='INACTIVO') return;
      if (String(h.TIPO_EJECUTOR||'').toUpperCase()!=='MEDICO') return;
      addH(h.ID_MEDICO, h);
    });
  } catch(e) {}
  return { pago: pago, mods: mods, bloq: bloq };
}

// Resumen legible del horario: "Lun-Vie 08:00-18:00 · Sab 08:00-13:00"
var _MED_DIAS_ORD = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'];
var _MED_DIAS_AB  = {LUNES:'Lun',MARTES:'Mar',MIERCOLES:'Mie',JUEVES:'Jue',VIERNES:'Vie',SABADO:'Sab',DOMINGO:'Dom'};
function _medResumenHorario(bloques) {
  if (!bloques || !bloques.length) return '';
  // Agrupar por rango horario
  var grupos = {}, orden = [];
  bloques.forEach(function(b){
    var k = b.ini + '-' + b.fin;
    if (!grupos[k]) { grupos[k] = []; orden.push(k); }
    if (grupos[k].indexOf(b.dia) < 0) grupos[k].push(b.dia);
  });
  var partes = orden.map(function(k){
    var dias = grupos[k].slice().sort(function(a,b){ return _MED_DIAS_ORD.indexOf(a) - _MED_DIAS_ORD.indexOf(b); });
    var idx = dias.map(function(d){ return _MED_DIAS_ORD.indexOf(d); });
    // Comprimir tramos consecutivos de 3 o mas: Lun-Vie
    var out = [], i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j+1] === idx[j] + 1) j++;
      if (j - i >= 2) out.push(_MED_DIAS_AB[_MED_DIAS_ORD[idx[i]]] + '-' + _MED_DIAS_AB[_MED_DIAS_ORD[idx[j]]]);
      else for (var z = i; z <= j; z++) out.push(_MED_DIAS_AB[_MED_DIAS_ORD[idx[z]]]);
      i = j + 1;
    }
    return out.join(',') + ' ' + k;
  });
  return partes.join(' \u00b7 ');
}
