// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Paciente.gs
// Descripción: CRUD completo de la tabla PACIENTE
// ============================================================

// ════════════════════════════════════════════════════════════
//  LISTAR PACIENTES
// ════════════════════════════════════════════════════════════

/**
 * Lista pacientes con filtros y paginación.
 * Roles permitidos: ADMINISTRADOR, MEDICO, RECEPCION
 *
 * @param {Object} params
 *   estado   {string}  ACTIVO | INACTIVO | FALLECIDO
 *   query    {string}  Búsqueda libre (nombre, apellido, documento)
 *   limite   {number}  Registros por página (default 50)
 *   pagina   {number}  Página actual (default 1)
 */
function listarPacientes(params) {
  try {
    if (!_puedeModulo(params, 'Pacientes')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    let pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila)
      .filter(function(p) {
        return p.ID_PACIENTE && String(p.ID_PACIENTE).trim() !== '' &&
               p.NOMBRES     && String(p.NOMBRES).trim()     !== '';
      });

    // Enriquecer con nombre del tipo de documento
    const tiposDoc = leerHoja(HOJAS.TIPO_DOCUMENTO);
    pacientes = pacientes.map(p => ({
      ...p,
      TIPO_DOCUMENTO_NOMBRE: tiposDoc.find(t =>
        String(t.ID_TIPO_DOCUMENTO) === String(p.ID_TIPO_DOCUMENTO)
      )?.TIPO || '—',
    }));

    // Filtros
    if (params.estado) {
      pacientes = pacientes.filter(p =>
        String(p.ESTADO).toUpperCase() === params.estado.toUpperCase()
      );
    }
    if (params.query) {
      const q = params.query.toUpperCase().trim();
      pacientes = pacientes.filter(p =>
        (p.NOMBRES        + ' ' +
         p.APELLIDOS      + ' ' +
         p.NUMERO_DOCUMENTO + ' ' +
         p.ID_PACIENTE).toUpperCase().includes(q)
      );
    }
    if (params.departamento) {
      pacientes = pacientes.filter(p =>
        String(p.DEPARTAMENTO).toUpperCase() === params.departamento.toUpperCase()
      );
    }
    if (params.sexo) {
      pacientes = pacientes.filter(p =>
        String(p.SEXO).toUpperCase() === params.sexo.toUpperCase()
      );
    }

    // Paginación
    const limite = parseInt(params.limite) || 50;
    const pagina = parseInt(params.pagina) || 1;
    const total  = pacientes.length;
    const inicio = (pagina - 1) * limite;
    const datos  = pacientes.slice(inicio, inicio + limite);

    return respuestaOK({ datos, total, pagina, limite, paginas: Math.ceil(total / limite) },
      total + ' paciente(s) encontrado(s).');

  } catch (err) {
    return respuestaError('Error al listar pacientes: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  BUSCAR PACIENTE
// ════════════════════════════════════════════════════════════

/**
 * Búsqueda rápida de paciente por documento o nombre.
 * Usado desde el módulo de Ventas para seleccionar paciente.
 */
function buscarPaciente(query) {
  try {
    if (!query || String(query).trim().length < 3) {
      return respuestaError('Ingrese mínimo 3 caracteres para buscar.');
    }

    const q = String(query).toUpperCase().trim();
    const pacientes  = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    const tiposDoc   = leerHoja(HOJAS.TIPO_DOCUMENTO);

    const resultado = pacientes
      .filter(p =>
        p.ESTADO !== 'INACTIVO' &&
        (p.NOMBRES.toUpperCase().includes(q)          ||
         p.APELLIDOS.toUpperCase().includes(q)         ||
         p.NUMERO_DOCUMENTO.toUpperCase().includes(q)  ||
         (p.NOMBRES + ' ' + p.APELLIDOS).toUpperCase().includes(q))
      )
      .slice(0, 10)
      .map(p => ({
        ...p,
        TIPO_DOCUMENTO_NOMBRE: tiposDoc.find(t =>
          String(t.ID_TIPO_DOCUMENTO) === String(p.ID_TIPO_DOCUMENTO)
        )?.TIPO || '—',
        NOMBRE_COMPLETO: (p.RAZON_SOCIAL && p.RAZON_SOCIAL !== '-')
          ? p.RAZON_SOCIAL
          : (p.NOMBRES + ' ' + p.APELLIDOS),
      }));

    return respuestaOK(resultado, resultado.length + ' resultado(s).');

  } catch (err) {
    return respuestaError('Error al buscar paciente: ' + err.message);
  }
}

/**
 * Obtiene un paciente por su ID.
 */
function obtenerPaciente(idPaciente) {
  try {
    const pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    const paciente  = pacientes.find(p => String(p.ID_PACIENTE) === String(idPaciente));
    if (!paciente) return respuestaError('Paciente no encontrado.', 'ERR_NO_EXISTE');

    const tiposDoc = leerHoja(HOJAS.TIPO_DOCUMENTO);
    paciente.TIPO_DOCUMENTO_NOMBRE = tiposDoc.find(t =>
      String(t.ID_TIPO_DOCUMENTO) === String(paciente.ID_TIPO_DOCUMENTO)
    )?.TIPO || '—';

    return respuestaOK(paciente);
  } catch (err) {
    return respuestaError('Error al obtener paciente: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR PACIENTE (Nuevo)
// ════════════════════════════════════════════════════════════

/**
 * Crea un nuevo paciente con todas las validaciones.
 * Roles: ADMINISTRADOR, RECEPCION, MEDICO
 */
function guardarPaciente(params) {
  try {
    if (!_puedeModulo(params, 'Pacientes')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    // ── VALIDAR CAMPOS REQUERIDOS ──
    const requeridos = [
      'ID_TIPO_DOCUMENTO','NUMERO_DOCUMENTO','NOMBRES',
      'APELLIDOS','FECHA_NACIMIENTO','SEXO',
      'TIPO_VIA','NOMBRE_VIA',
      'DEPARTAMENTO','PROVINCIA','DISTRITO','ESTADO'
    ];
    const { ok, faltantes } = validarCamposRequeridos(params, requeridos);
    if (!ok) return respuestaError('Campos requeridos: ' + faltantes.join(', '));

    // ── VALIDAR TIPO_DOCUMENTO (FK) ──
    const tiposDoc  = leerHoja(HOJAS.TIPO_DOCUMENTO);
    const tipoDoc   = tiposDoc.find(t =>
      String(t.ID_TIPO_DOCUMENTO) === String(params.ID_TIPO_DOCUMENTO)
    );
    if (!tipoDoc) return respuestaError('Tipo de documento inválido.', 'ERR_FK');

    // ── VALIDAR NÚMERO DE DOCUMENTO ──
    const validDoc = validarFormatoDocumento_(
      String(params.NUMERO_DOCUMENTO).trim(),
      tipoDoc.TIPO,
      parseInt(tipoDoc.LONGITUD)
    );
    if (!validDoc.ok) return respuestaError(validDoc.mensaje);

    // ── VALIDAR UNIQUE: tipo + número ──
    const ndoc = normalizar(params.NUMERO_DOCUMENTO);
    const pacientes = leerHoja(HOJAS.PACIENTE);
    const duplicado = pacientes.find(p =>
      String(p.ID_TIPO_DOCUMENTO) === String(params.ID_TIPO_DOCUMENTO) &&
      normalizar(String(p.NUMERO_DOCUMENTO)) === ndoc
    );
    if (duplicado) {
      return respuestaError(
        'Ya existe un paciente registrado con ' + tipoDoc.TIPO + ' N° ' + ndoc +
        ' (ID: ' + duplicado.ID_PACIENTE + ').', 'ERR_DUPLICADO'
      );
    }

    // ── ¿Es RUC? (empresa con razón social en vez de nombres) ──
    var esRUC = String(tipoDoc.TIPO).toUpperCase().indexOf('RUC') >= 0;

    if (esRUC) {
      // Empresa: validar razón social, no nombres
      if (!params.RAZON_SOCIAL || String(params.RAZON_SOCIAL).trim() === '') {
        return respuestaError('La razón social es requerida para RUC.');
      }
    } else {
      // Persona: validar nombres y apellidos
      const validNombres = validarNombreApellido_(params.NOMBRES, 'Nombres');
      if (!validNombres.ok) return respuestaError(validNombres.mensaje);
      const validApellidos = validarNombreApellido_(params.APELLIDOS, 'Apellidos');
      if (!validApellidos.ok) return respuestaError(validApellidos.mensaje);

      // ── VALIDAR FECHA DE NACIMIENTO ──
      const validFecha = validarFechaNacimiento_(params.FECHA_NACIMIENTO);
      if (!validFecha.ok) return respuestaError(validFecha.mensaje);

      // ── VALIDAR SEXO ──
      if (!['M','F','O'].includes(String(params.SEXO).toUpperCase())) {
        return respuestaError('Sexo inválido. Use M, F u O.');
      }
    }

    // ── VALIDAR TELÉFONOS ──
    if (params.TELEFONO && params.TELEFONO !== '-') {
      const vTel = validarTelefono_(params.TELEFONO, 'Teléfono');
      if (!vTel.ok) return respuestaError(vTel.mensaje);
    }
    if (params.TELEFONO_ALTERNATIVO && params.TELEFONO_ALTERNATIVO !== '-') {
      const vTel2 = validarTelefono_(params.TELEFONO_ALTERNATIVO, 'Teléfono alternativo');
      if (!vTel2.ok) return respuestaError(vTel2.mensaje);
      if (String(params.TELEFONO).trim() === String(params.TELEFONO_ALTERNATIVO).trim()) {
        return respuestaError('El teléfono alternativo no puede ser igual al principal.');
      }
    }

    // ── VALIDAR CORREO ──
    if (params.CORREO) {
      const vEmail = validarEmail_(params.CORREO);
      if (!vEmail.ok) return respuestaError(vEmail.mensaje);
    }

    // ── VALIDAR ESTADO ──
    if (!['ACTIVO','INACTIVO','FALLECIDO'].includes(String(params.ESTADO).toUpperCase())) {
      return respuestaError('Estado inválido. Use ACTIVO, INACTIVO o FALLECIDO.');
    }

    // ── GENERAR ID Y REGISTRAR ──
    const idPaciente = generarID(HOJAS.PACIENTE, 'ID_PACIENTE', 'PAC', 4);
    const fecha      = getFecha('fecha');

    // Calcular si es menor de edad
    const esMenor = (() => {
      const fnac = new Date(params.FECHA_NACIMIENTO);
      const edad = Math.floor((new Date() - fnac) / (365.25 * 86400000));
      return edad < 18;
    })();

    // Validar apoderado si es menor
    if (esMenor) {
      if (!params.APO_NOMBRES || !params.APO_APELLIDOS || !params.APO_PARENTESCO || !params.APO_TELEFONO) {
        return respuestaError('El paciente es menor de edad. Datos del apoderado son requeridos.');
      }
    }

    insertarFila(HOJAS.PACIENTE, {
      ID_PACIENTE:          idPaciente,
      ID_TIPO_DOCUMENTO:    params.ID_TIPO_DOCUMENTO,
      NUMERO_DOCUMENTO:     ndoc,
      NOMBRES:              esRUC ? '-' : normalizar(params.NOMBRES),
      APELLIDOS:            esRUC ? '-' : normalizar(params.APELLIDOS),
      RAZON_SOCIAL:         esRUC ? String(params.RAZON_SOCIAL).trim().toUpperCase() : '-',
      FECHA_NACIMIENTO:     esRUC ? '-' : params.FECHA_NACIMIENTO,
      SEXO:                 esRUC ? '-' : String(params.SEXO).toUpperCase(),
      TELEFONO:             String(params.TELEFONO || '').replace(/\s/g,''),
      TELEFONO_ALTERNATIVO: String(params.TELEFONO_ALTERNATIVO || '-').replace(/\s/g,'')||'-',
      CORREO:               String(params.CORREO || '').toUpperCase().trim(),
      // Dirección estructurada
      TIPO_VIA:             normalizar(params.TIPO_VIA || ''),
      NOMBRE_VIA:           normalizar(params.NOMBRE_VIA || ''),
      NUMERO:               String(params.NUMERO || '-').trim(),
      MZ:                   String(params.MZ || '-').toUpperCase().trim(),
      LT:                   String(params.LT || '-').toUpperCase().trim(),
      URBANIZACION:         normalizar(params.URBANIZACION || '-'),
      INTERIOR:             String(params.INTERIOR || '-').toUpperCase().trim(),
      PISO:                 String(params.PISO || '-').toUpperCase().trim(),
      REFERENCIA:           normalizar(params.REFERENCIA || '-'),
      DEPARTAMENTO:         normalizar(params.DEPARTAMENTO),
      PROVINCIA:            normalizar(params.PROVINCIA),
      DISTRITO:             normalizar(params.DISTRITO),
      // Apoderado
      ES_MENOR:             esMenor ? 'SI' : 'NO',
      APO_NOMBRES:          esMenor ? normalizar(params.APO_NOMBRES || '') : '-',
      APO_APELLIDOS:        esMenor ? normalizar(params.APO_APELLIDOS || '') : '-',
      APO_PARENTESCO:       esMenor ? normalizar(params.APO_PARENTESCO || '') : '-',
      APO_TELEFONO:         esMenor ? String(params.APO_TELEFONO || '').replace(/\s/g,'') : '-',
      APO_DNI:              esMenor ? String(params.APO_DNI || '-').trim() : '-',
      // Control
      ESTADO:               String(params.ESTADO).toUpperCase(),
      FECHA_REGISTRO:       fecha,
      // Consentimiento de datos personales (Ley 29733)
      CONSENTIMIENTO_DATOS:   (String(params.CONSENTIMIENTO_DATOS).toUpperCase()==='SI') ? 'SI' : 'NO',
      FECHA_CONSENTIMIENTO:   (String(params.CONSENTIMIENTO_DATOS).toUpperCase()==='SI') ? getFecha('datetime') : '',
      USUARIO_CONSENTIMIENTO: (String(params.CONSENTIMIENTO_DATOS).toUpperCase()==='SI') ? (params._sesion ? params._sesion.USUARIO : (params.usuario||'-')) : '',
    });

    registrarAuditoria(
      params._sesion.ID_USUARIO, 'PACIENTES', 'CREAR',
      'Nuevo paciente: ' + normalizar(params.NOMBRES) + ' ' + normalizar(params.APELLIDOS) +
      ' · Doc: ' + ndoc + ' · ID: ' + idPaciente
    );

    return respuestaOK({ ID_PACIENTE: idPaciente }, 'Paciente registrado correctamente.');

  } catch (err) {
    return respuestaError('Error al guardar paciente: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ACTUALIZAR PACIENTE
// ════════════════════════════════════════════════════════════

/**
 * Actualiza datos de un paciente existente.
 * El ID_PACIENTE y FECHA_REGISTRO no son editables.
 */
function actualizarPaciente(params) {
  try {
    if (!_puedeModulo(params, 'Pacientes')) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_PACIENTE) return respuestaError('ID_PACIENTE es requerido.');

    // Verificar que existe
    const pacientes  = leerHoja(HOJAS.PACIENTE);
    const existente  = pacientes.find(p => String(p.ID_PACIENTE) === String(params.ID_PACIENTE));
    if (!existente) return respuestaError('Paciente no encontrado.', 'ERR_NO_EXISTE');

    // Validaciones de campos que cambian
    const datos = {};

    if (params.NOMBRES) {
      const v = validarNombreApellido_(params.NOMBRES, 'Nombres');
      if (!v.ok) return respuestaError(v.mensaje);
      datos.NOMBRES = normalizar(params.NOMBRES);
    }
    if (params.APELLIDOS) {
      const v = validarNombreApellido_(params.APELLIDOS, 'Apellidos');
      if (!v.ok) return respuestaError(v.mensaje);
      datos.APELLIDOS = normalizar(params.APELLIDOS);
    }
    if (params.FECHA_NACIMIENTO) {
      const v = validarFechaNacimiento_(params.FECHA_NACIMIENTO);
      if (!v.ok) return respuestaError(v.mensaje);
      datos.FECHA_NACIMIENTO = params.FECHA_NACIMIENTO;
    }
    if (params.SEXO) {
      if (!['M','F','O'].includes(params.SEXO.toUpperCase())) {
        return respuestaError('Sexo inválido.');
      }
      datos.SEXO = params.SEXO.toUpperCase();
    }
    if (params.TELEFONO !== undefined) {
      if (params.TELEFONO && !/^\d{9}$/.test(params.TELEFONO.replace(/\s/g,''))) {
        return respuestaError('Teléfono debe tener exactamente 9 dígitos.');
      }
      datos.TELEFONO = String(params.TELEFONO || '').replace(/\s/g,'');
    }
    if (params.TELEFONO_ALTERNATIVO !== undefined) {
      if (params.TELEFONO_ALTERNATIVO && params.TELEFONO_ALTERNATIVO !== '-' &&
          !/^\d{9}$/.test(params.TELEFONO_ALTERNATIVO.replace(/\s/g,''))) {
        return respuestaError('Teléfono alternativo debe tener 9 dígitos.');
      }
      const telPrinc = params.TELEFONO || existente.TELEFONO;
      if (params.TELEFONO_ALTERNATIVO &&
          params.TELEFONO_ALTERNATIVO.replace(/\s/g,'') === telPrinc.replace(/\s/g,'')) {
        return respuestaError('El teléfono alternativo no puede ser igual al principal.');
      }
      datos.TELEFONO_ALTERNATIVO = String(params.TELEFONO_ALTERNATIVO || '-').replace(/\s/g,'')||'-';
    }
    if (params.CORREO !== undefined) {
      if (params.CORREO) {
        const v = validarEmail_(params.CORREO);
        if (!v.ok) return respuestaError(v.mensaje);
      }
      datos.CORREO = String(params.CORREO || '').toUpperCase().trim();
    }
    if (params.DIRECCION   !== undefined) datos.DIRECCION   = String(params.DIRECCION   || '').toUpperCase().trim();
    if (params.DEPARTAMENTO !== undefined) datos.DEPARTAMENTO = normalizar(params.DEPARTAMENTO || '');
    if (params.PROVINCIA    !== undefined) datos.PROVINCIA    = normalizar(params.PROVINCIA    || '');
    if (params.DISTRITO     !== undefined) datos.DISTRITO     = normalizar(params.DISTRITO     || '');
    if (params.ESTADO) {
      if (!['ACTIVO','INACTIVO','FALLECIDO'].includes(params.ESTADO.toUpperCase())) {
        return respuestaError('Estado inválido.');
      }
      datos.ESTADO = params.ESTADO.toUpperCase();
    }

    // Consentimiento de datos personales: registrar si se otorga en la edición
    if (String(params.CONSENTIMIENTO_DATOS).toUpperCase() === 'SI') {
      datos.CONSENTIMIENTO_DATOS   = 'SI';
      datos.FECHA_CONSENTIMIENTO   = getFecha('datetime');
      datos.USUARIO_CONSENTIMIENTO = params._sesion ? params._sesion.USUARIO : (params.usuario||'-');
    }

    if (Object.keys(datos).length === 0) return respuestaError('No hay campos para actualizar.');

    actualizarFila(HOJAS.PACIENTE, 'ID_PACIENTE', params.ID_PACIENTE, datos);

    registrarAuditoria(
      params._sesion.ID_USUARIO, 'PACIENTES', 'EDITAR',
      'Paciente editado: ' + params.ID_PACIENTE + ' · Campos: ' + Object.keys(datos).join(', ')
    );

    return respuestaOK(null, 'Paciente actualizado correctamente.');

  } catch (err) {
    return respuestaError('Error al actualizar paciente: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  CAMBIAR ESTADO
// ════════════════════════════════════════════════════════════

function cambiarEstadoPaciente(params) {
  try {
    if (!['ADMINISTRADOR','RECEPCION'].includes(params._sesion?.ROL)) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_PACIENTE || !params.ESTADO) {
      return respuestaError('ID_PACIENTE y ESTADO son requeridos.');
    }
    if (!['ACTIVO','INACTIVO','FALLECIDO'].includes(params.ESTADO.toUpperCase())) {
      return respuestaError('Estado inválido. Use ACTIVO, INACTIVO o FALLECIDO.');
    }

    const actualizado = actualizarFila(
      HOJAS.PACIENTE, 'ID_PACIENTE', params.ID_PACIENTE,
      { ESTADO: params.ESTADO.toUpperCase() }
    );
    if (!actualizado) return respuestaError('Paciente no encontrado.', 'ERR_NO_EXISTE');

    registrarAuditoria(
      params._sesion.ID_USUARIO, 'PACIENTES', 'ESTADO',
      'Paciente ' + params.ID_PACIENTE + ' → ' + params.ESTADO
    );
    return respuestaOK(null, 'Estado actualizado a ' + params.ESTADO.toUpperCase());

  } catch (err) {
    return respuestaError('Error al cambiar estado: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  HISTORIAL DEL PACIENTE
// ════════════════════════════════════════════════════════════

/**
 * Obtiene el historial completo de un paciente:
 * citas, ventas y sesiones de control.
 */
function obtenerHistorialPaciente(params) {
  try {
    if (!params.ID_PACIENTE) return respuestaError('ID_PACIENTE requerido.');

    const id = String(params.ID_PACIENTE);

    // Datos del paciente
    const pacienteResp = obtenerPaciente(id);
    if (!pacienteResp.ok) return pacienteResp;

    // Citas del paciente
    const citas = leerHoja(HOJAS.CITA)
      .filter(c => String(c.ID_PACIENTE) === id)
      .map(limpiarFila)
      .sort((a, b) => String(b.FECHA_CITA).localeCompare(String(a.FECHA_CITA)));

    // Ventas del paciente
    const ventas = leerHoja(HOJAS.VENTA)
      .filter(v => String(v.ID_PACIENTE) === id)
      .map(limpiarFila)
      .sort((a, b) => String(b.FECHA_VENTA).localeCompare(String(a.FECHA_VENTA)));

    // Sesiones del paciente
    const sesiones = leerHoja(HOJAS.CONTROL_SESIONES)
      .filter(s => String(s.ID_PACIENTE) === id)
      .map(limpiarFila);

    // Estadísticas rápidas
    const stats = {
      totalCitas:     citas.length,
      citasAtendidas: citas.filter(c => String(c.ESTADO_CITA).toUpperCase() === 'ATENDIDA').length,
      totalVentas:    ventas.length,
      totalGastado:   ventas
        .filter(v => String(v.ESTADO).toUpperCase() !== 'ANULADA')
        .reduce((sum, v) => sum + (parseFloat(v.TOTAL) || 0), 0),
      sesionesPendientes: sesiones
        .filter(s => parseInt(s.SESIONES_RESTANTES) > 0).length,
    };

    registrarAuditoria(
      params._sesion?.ID_USUARIO || 'SISTEMA', 'PACIENTES', 'VER_HISTORIAL',
      'Historial del paciente: ' + id
    );

    return respuestaOK({
      paciente: pacienteResp.datos,
      citas,
      ventas,
      sesiones,
      stats,
    }, 'Historial obtenido correctamente.');

  } catch (err) {
    return respuestaError('Error al obtener historial: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  VALIDACIONES PRIVADAS
// ════════════════════════════════════════════════════════════

function validarFormatoDocumento_(numero, tipo, longitud) {
  if (!numero) return { ok: false, mensaje: 'El número de documento es requerido.' };
  const n = numero.replace(/\s/g, '').toUpperCase();
  switch (tipo.toUpperCase()) {
    case 'DNI':
      if (!/^\d{8}$/.test(n)) return { ok: false, mensaje: 'El DNI debe tener exactamente 8 dígitos numéricos.' };
      break;
    case 'RUC':
      if (!/^(10|20)\d{9}$/.test(n)) return { ok: false, mensaje: 'El RUC debe tener 11 dígitos y comenzar con 10 o 20.' };
      break;
    case 'CARNÉ EXTRANJERÍA':
    case 'CE':
      if (!/^[A-Z0-9]{9,12}$/.test(n)) return { ok: false, mensaje: 'El Carné de Extranjería debe tener entre 9 y 12 caracteres alfanuméricos.' };
      break;
    case 'PASAPORTE':
      if (!/^[A-Z0-9]{6,20}$/.test(n)) return { ok: false, mensaje: 'El Pasaporte debe tener entre 6 y 20 caracteres alfanuméricos.' };
      break;
    default:
      if (longitud && n.length > longitud) {
        return { ok: false, mensaje: 'El documento no puede exceder ' + longitud + ' caracteres.' };
      }
  }
  return { ok: true };
}

function validarNombreApellido_(valor, campo) {
  const v = String(valor || '').trim();
  if (v.length < 2) return { ok: false, mensaje: campo + ' debe tener mínimo 2 caracteres.' };
  if (!/^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s']+$/.test(v)) {
    return { ok: false, mensaje: campo + ' solo puede contener letras y espacios.' };
  }
  if (v.length > 80) return { ok: false, mensaje: campo + ' no puede exceder 80 caracteres.' };
  return { ok: true };
}

function validarFechaNacimiento_(fecha, edadMinima, edadMaxima) {
  edadMinima = edadMinima || 0;
  edadMaxima = edadMaxima || 120;
  if (!fecha) return { ok: false, mensaje: 'La fecha de nacimiento es requerida.' };
  const fnac = new Date(fecha);
  const hoy  = new Date();
  if (isNaN(fnac.getTime())) return { ok: false, mensaje: 'Fecha de nacimiento inválida.' };
  if (fnac > hoy) return { ok: false, mensaje: 'La fecha de nacimiento no puede ser futura.' };
  const edad = Math.floor((hoy - fnac) / (365.25 * 24 * 3600 * 1000));
  if (edad > edadMaxima) return { ok: false, mensaje: 'La edad no puede superar ' + edadMaxima + ' años.' };
  if (edad < edadMinima) return { ok: false, mensaje: 'La edad mínima permitida es ' + edadMinima + ' años.' };
  return { ok: true, edad };
}

function validarTelefono_(tel, campo) {
  const t = String(tel || '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(t)) {
    return { ok: false, mensaje: campo + ' debe tener exactamente 9 dígitos numéricos.' };
  }
  return { ok: true };
}

function validarEmail_(email) {
  const e = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return { ok: false, mensaje: 'El correo electrónico no tiene un formato válido.' };
  }
  if (e.length > 100) {
    return { ok: false, mensaje: 'El correo no puede exceder 100 caracteres.' };
  }
  return { ok: true };
}

// ════════════════════════════════════════════════════════════
//  IMPORTACIÓN MASIVA de pacientes desde filas (CSV parseado).
//  params.filas = [{ID_TIPO_DOCUMENTO, NUMERO_DOCUMENTO, NOMBRES, ...}, ...]
//  Devuelve resumen: creados, errores con detalle por fila.
// ════════════════════════════════════════════════════════════
function importarPacientesMasivo(params) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { return respuestaError('Sistema ocupado, intente de nuevo.'); }
  try {
    if (!_puedeModulo(params, 'Pacientes')) { lock.releaseLock(); return respuestaError('Acceso denegado.', 'ERR_PERMISO'); }

    var filas = params.filas;
    if (!filas || !Array.isArray(filas) || !filas.length) { lock.releaseLock(); return respuestaError('No hay filas para importar.'); }
    if (filas.length > 500) { lock.releaseLock(); return respuestaError('Máximo 500 pacientes por importación.'); }

    var creados = 0;
    var errores = [];

    // Cargar referencias una sola vez
    var tipos = leerHoja(HOJAS.TIPO_DOCUMENTO).map(limpiarFila);
    var pacientesExist = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var docsRegistrados = {};
    pacientesExist.forEach(function(p){
      docsRegistrados[String(p.ID_TIPO_DOCUMENTO)+'-'+normalizar(String(p.NUMERO_DOCUMENTO))] = true;
    });

    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      var nfila = i + 2; // +2 porque fila 1 es encabezado
      try {
        // Resolver tipo de documento (acepta el NOMBRE del tipo o el ID)
        var tipoDoc = null;
        var tdInput = sinTildes(String(f.TIPO_DOCUMENTO || f.ID_TIPO_DOCUMENTO || ''));
        for (var t = 0; t < tipos.length; t++) {
          if (String(tipos[t].ID_TIPO_DOCUMENTO).toUpperCase() === tdInput ||
              sinTildes(String(tipos[t].TIPO||'')) === tdInput) { tipoDoc = tipos[t]; break; }
        }
        if (!tipoDoc) { errores.push('Fila ' + nfila + ': tipo de documento inválido ("' + tdInput + '").'); continue; }

        var ndoc = normalizar(String(f.NUMERO_DOCUMENTO || '').trim());
        if (!ndoc) { errores.push('Fila ' + nfila + ': falta número de documento.'); continue; }
        if (!f.NOMBRES || !String(f.NOMBRES).trim()) { errores.push('Fila ' + nfila + ': falta nombres.'); continue; }
        if (!f.APELLIDOS || !String(f.APELLIDOS).trim()) { errores.push('Fila ' + nfila + ': falta apellidos.'); continue; }

        var sexo = String(f.SEXO || '').trim().toUpperCase();
        if (['M','F','O'].indexOf(sexo) < 0) { errores.push('Fila ' + nfila + ': sexo inválido (use M, F u O).'); continue; }

        // Duplicado
        var clave = String(tipoDoc.ID_TIPO_DOCUMENTO)+'-'+ndoc;
        if (docsRegistrados[clave]) { errores.push('Fila ' + nfila + ': ya existe paciente con ' + tipoDoc.TIPO + ' ' + ndoc + '.'); continue; }

        // Crear
        var id = generarID(HOJAS.PACIENTE, 'ID_PACIENTE', 'PAC', 4);
        insertarFila(HOJAS.PACIENTE, {
          ID_PACIENTE:       id,
          ID_TIPO_DOCUMENTO: tipoDoc.ID_TIPO_DOCUMENTO,
          NUMERO_DOCUMENTO:  ndoc,
          NOMBRES:           normalizar(f.NOMBRES),
          APELLIDOS:         normalizar(f.APELLIDOS),
          FECHA_NACIMIENTO:  String(f.FECHA_NACIMIENTO || '').trim(),
          SEXO:              sexo,
          TELEFONO:          String(f.TELEFONO || '-').trim(),
          CORREO:            String(f.CORREO || '-').trim(),
          DEPARTAMENTO:      normalizar(f.DEPARTAMENTO || '-'),
          PROVINCIA:         normalizar(f.PROVINCIA || '-'),
          DISTRITO:          normalizar(f.DISTRITO || '-'),
          ES_MENOR:          'NO',
          ESTADO:            'ACTIVO',
          FECHA_REGISTRO:    getFecha('datetime'),
        });
        docsRegistrados[clave] = true; // evitar duplicados dentro del mismo lote
        creados++;
      } catch (eFila) {
        errores.push('Fila ' + nfila + ': ' + eFila.message);
      }
    }

    lock.releaseLock();
    return respuestaOK(
      { creados: creados, errores: errores, totalFilas: filas.length },
      creados + ' paciente(s) importado(s). ' + errores.length + ' con error.'
    );
  } catch (err) {
    try { lock.releaseLock(); } catch(e){}
    return respuestaError('Error en importación: ' + err.message);
  }
}
