// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Medico.gs
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR MÉDICOS
// ════════════════════════════════════════════════════════════
function listarMedicos(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR', 'RECEPCION', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
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
        TELEFONO:           m.TELEFONO,
        EMAIL:              m.EMAIL,
        ESTADO:             m.ESTADO,
        OBSERVACIONES:      m.OBSERVACIONES,
        FECHA_REGISTRO:     m.FECHA_REGISTRO,
        ESPECIALIDAD_NOMBRE: espNombre,
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
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
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
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
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
      .filter(function(h){ return h.ID_MEDICO===params.ID_MEDICO && h.ESTADO==='ACTIVO'; });
    return respuestaOK(horarios);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function guardarHorarioMedico(params) {
  try {
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO || !params.DIA_SEMANA || !params.HORA_INICIO || !params.HORA_FIN) {
      return respuestaError('Campos requeridos: ID_MEDICO, DIA_SEMANA, HORA_INICIO, HORA_FIN.');
    }

    var horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila);
    var ultimos  = horarios.map(function(h){ return parseInt((h.ID_HORARIO||'').replace('HOR-','')); });
    var _filtered = ultimos.filter(function(n){ return !isNaN(n); });
    var siguiente = (_filtered.length ? Math.max.apply(null, _filtered) : 0) + 1;
    var idHorario = 'HOR-' + String(siguiente).padStart(4,'0');

    insertarFila(HOJAS.HORARIO_MEDICO, {
      ID_HORARIO:    idHorario,
      ID_MEDICO:     params.ID_MEDICO,
      DIA_SEMANA:    String(params.DIA_SEMANA).toUpperCase(),
      HORA_INICIO:   params.HORA_INICIO,
      HORA_FIN:      params.HORA_FIN,
      INTERVALO_MIN: parseInt(params.INTERVALO_MIN) || 30,
      ESTADO:        'ACTIVO',
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
      .filter(function(h){ return h.ID_MEDICO===params.ID_MEDICO && h.DIA_SEMANA===dia && h.ESTADO==='ACTIVO'; });
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
    var rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion && params._sesion.ROL ? params._sesion.ROL : '')) {
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
