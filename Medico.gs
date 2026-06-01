// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Medico.gs
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR MÉDICOS
// ════════════════════════════════════════════════════════════
function listarMedicos(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR', 'RECEPCION', 'CAJERO'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    let medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);

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
      medicos = medicos.filter(m =>
        String(m.ESTADO).toUpperCase() === params.estado.toUpperCase()
      );
    }
    if (params.especialidad) {
      medicos = medicos.filter(m =>
        String(m.ID_ESPECIALIDAD) === String(params.especialidad)
      );
    }
    if (params.query) {
      const q = params.query.toUpperCase().trim();
      medicos = medicos.filter(m =>
        (m.NOMBRES + ' ' + m.APELLIDOS + ' ' +
         m.NUMERO_CMP + ' ' + m.ID_MEDICO).toUpperCase().includes(q)
      );
    }

    const limite  = parseInt(params.limite) || 50;
    const pagina  = parseInt(params.pagina) || 1;
    const total   = medicos.length;
    const inicio  = (pagina - 1) * limite;
    const datos   = medicos.slice(inicio, inicio + limite);

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
    const medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    const m = medicos.find(x => x.ID_MEDICO === id);
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
    const q = String(query || '').toUpperCase().trim();
    let medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila)
      .filter(m => m.ESTADO === 'ACTIVO')
      .filter(m =>
        (m.NOMBRES + ' ' + m.APELLIDOS + ' ' + m.NUMERO_CMP).toUpperCase().includes(q)
      ).slice(0, 10);
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
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Solo el Administrador puede registrar médicos.', 'ERR_PERMISO');
    }

    // Validar campos requeridos
    const requeridos = ['ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO','NOMBRES','APELLIDOS','NUMERO_CMP','ESTADO'];
    for (const campo of requeridos) {
      if (!params[campo] || String(params[campo]).trim() === '') {
        return respuestaError('El campo ' + campo + ' es requerido.');
      }
    }

    // Verificar CMP duplicado
    const medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    const cmpDup = medicos.find(m =>
      String(m.NUMERO_CMP).toUpperCase().trim() === String(params.NUMERO_CMP).toUpperCase().trim()
    );
    if (cmpDup) {
      return respuestaError('El número CMP ' + params.NUMERO_CMP + ' ya está registrado (' + cmpDup.ID_MEDICO + ').');
    }

    // Verificar documento duplicado
    const docDup = medicos.find(m =>
      String(m.ID_TIPO_DOCUMENTO) === String(params.ID_TIPO_DOCUMENTO) &&
      String(m.NUMERO_DOCUMENTO).toUpperCase() === String(params.NUMERO_DOCUMENTO).toUpperCase()
    );
    if (docDup) {
      return respuestaError('El documento ya está registrado (' + docDup.ID_MEDICO + ').');
    }

    // ── VALIDAR TELÉFONO ──
    if (params.TELEFONO && params.TELEFONO !== '-') {
      const vTel = validarTelefono_(params.TELEFONO, 'Teléfono');
      if (!vTel.ok) return respuestaError(vTel.mensaje);
    }

    // Generar ID
    const ultimos = medicos.map(m => {
      const n = parseInt((m.ID_MEDICO || '').replace('MED-', ''));
      return isNaN(n) ? 0 : n;
    });
    const siguiente = (ultimos.length ? Math.max(...ultimos) : 0) + 1;
    const idMedico  = 'MED-' + String(siguiente).padStart(3, '0');
    const fecha     = getFecha('fecha');

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
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Solo el Administrador puede editar médicos.', 'ERR_PERMISO');
    }

    if (!params.ID_MEDICO) return respuestaError('ID_MEDICO requerido.');

    // ── VALIDAR TELÉFONO ──
    if (params.TELEFONO && params.TELEFONO !== '-') {
      const vTel = validarTelefono_(params.TELEFONO, 'Teléfono');
      if (!vTel.ok) return respuestaError(vTel.mensaje);
    }

    const datos = {};
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
    const horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
      .filter(h => h.ID_MEDICO === params.ID_MEDICO && h.ESTADO === 'ACTIVO');
    return respuestaOK(horarios);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function guardarHorarioMedico(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO || !params.DIA_SEMANA || !params.HORA_INICIO || !params.HORA_FIN) {
      return respuestaError('Campos requeridos: ID_MEDICO, DIA_SEMANA, HORA_INICIO, HORA_FIN.');
    }

    const horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila);
    const ultimos  = horarios.map(h => parseInt((h.ID_HORARIO||'').replace('HOR-','')));
    const siguiente = (ultimos.length ? Math.max(...ultimos.filter(n=>!isNaN(n))) : 0) + 1;
    const idHorario = 'HOR-' + String(siguiente).padStart(3,'0');

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
    const fecha  = new Date(params.FECHA);
    const dias   = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
    const dia    = dias[fecha.getDay()];
    const horarios = leerHoja(HOJAS.HORARIO_MEDICO).map(limpiarFila)
      .filter(h => h.ID_MEDICO === params.ID_MEDICO && h.DIA_SEMANA === dia && h.ESTADO === 'ACTIVO');
    if (!horarios.length) return respuestaOK([], 'Sin horarios para ese día.');

    // Generar slots
    const citas = leerHoja(HOJAS.CITA).map(limpiarFila)
      .filter(c => c.ID_MEDICO === params.ID_MEDICO && c.FECHA_CITA === params.FECHA &&
                   ['PROGRAMADA','CONFIRMADA'].includes(c.ESTADO_CITA));
    const citasHoras = citas.map(c => c.HORA_CITA);

    const slots = [];
    horarios.forEach(h => {
      let [hI, mI] = h.HORA_INICIO.split(':').map(Number);
      const [hF, mF] = h.HORA_FIN.split(':').map(Number);
      const intervalo = parseInt(h.INTERVALO_MIN) || 30;
      while (hI * 60 + mI < hF * 60 + mF) {
        const hora = String(hI).padStart(2,'0') + ':' + String(mI).padStart(2,'0');
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
    const medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    const resumen = {
      total:    medicos.length,
      activos:  medicos.filter(m => m.ESTADO === 'ACTIVO').length,
      inactivos:medicos.filter(m => m.ESTADO === 'INACTIVO').length,
    };
    return respuestaOK({ medicos, resumen });
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  HELPERS LOCALES
// ════════════════════════════════════════════════════════════
function validarTelefono_(tel, campo) {
  const t = String(tel || '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(t)) {
    return { ok: false, mensaje: campo + ' debe tener exactamente 9 dígitos numéricos.' };
  }
  return { ok: true };
}

// ════════════════════════════════════════════════════════════
//  MÉDICO - ESPECIALIDADES (MEDICO_ESPECIALIDAD)
// ════════════════════════════════════════════════════════════
function listarEspecialidadesMedico(params) {
  try {
    if (!params.ID_MEDICO) return respuestaError('ID_MEDICO requerido.');
    let medicosEsp = [];
    try {
      medicosEsp = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila)
                   .filter(me => me.ID_MEDICO === params.ID_MEDICO && me.ESTADO === 'ACTIVO');
    } catch(e) {}
    const especialidades = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
    const enriched = medicosEsp.map(me => ({
      ...me,
      ESPECIALIDAD_NOMBRE: especialidades.find(e => e.ID_ESPECIALIDAD === me.ID_ESPECIALIDAD)?.ESPECIALIDAD || '—',
    }));
    return respuestaOK(enriched);
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function agregarEspecialidadMedico(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Solo el Administrador puede gestionar especialidades.', 'ERR_PERMISO');
    }
    if (!params.ID_MEDICO || !params.ID_ESPECIALIDAD) {
      return respuestaError('ID_MEDICO e ID_ESPECIALIDAD son requeridos.');
    }

    // Verificar si ya existe
    const existentes = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila);
    const dup = existentes.find(me =>
      me.ID_MEDICO === params.ID_MEDICO &&
      me.ID_ESPECIALIDAD === params.ID_ESPECIALIDAD &&
      me.ESTADO === 'ACTIVO'
    );
    if (dup) return respuestaError('Esta especialidad ya está asignada al médico.');

    // Si es principal, desmarcar las anteriores
    if (params.ESPECIALIDAD_PRINCIPAL === 'SI') {
      existentes.filter(me => me.ID_MEDICO === params.ID_MEDICO && me.ESTADO === 'ACTIVO')
        .forEach(me => {
          actualizarFila(HOJAS.MEDICO_ESPECIALIDAD, 'ID_MEDICO_ESPECIALIDAD',
            me.ID_MEDICO_ESPECIALIDAD, { ESPECIALIDAD_PRINCIPAL: 'NO' });
        });
    }

    const ultimos  = existentes.map(me => parseInt((me.ID_MEDICO_ESPECIALIDAD||'').replace('ME-','')));
    const siguiente = (ultimos.length ? Math.max(...ultimos.filter(n=>!isNaN(n))) : 0) + 1;
    const id = 'ME-' + String(siguiente).padStart(3,'0');

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
}
