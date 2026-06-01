// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Seguridad.gs
// Descripción: CRUD de Usuarios, Roles y Permisos
// ============================================================

// ════════════════════════════════════════════════════════════
//  MÓDULO: USUARIO
// ════════════════════════════════════════════════════════════

/**
 * Lista todos los usuarios (sin exponer la clave).
 * Solo ADMINISTRADOR puede ver la lista completa.
 */
function listarUsuarios(params) {
  try {
    const sesion = params._sesion;
    if (sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado. Solo el administrador puede listar usuarios.', 'ERR_PERMISO');
    }

    const usuarios = leerHoja(HOJAS.USUARIO).map(u => {
      const { CLAVE, ...sinClave } = u;  // Nunca exponer la clave
      return limpiarFila(sinClave);
    });

    // Agregar nombre de rol a cada usuario
    const usuarioRoles = leerHoja(HOJAS.USUARIO_ROL);
    const roles        = leerHoja(HOJAS.ROL);

    const conRoles = usuarios.map(u => {
      const urs = usuarioRoles.filter(ur => String(ur.ID_USUARIO) === String(u.ID_USUARIO));
      const nombresRoles = urs.map(ur => {
        const rol = roles.find(r => String(r.ID_ROL) === String(ur.ID_ROL));
        return rol ? rol.NOMBRE : '—';
      });
      return { ...u, ROLES: nombresRoles };
    });

    // Filtros opcionales
    let resultado = conRoles;
    if (params.estado) resultado = resultado.filter(u => u.ESTADO === params.estado);
    if (params.query)  resultado = resultado.filter(u =>
      (u.NOMBRES + ' ' + u.APELLIDOS + ' ' + u.USUARIO).toUpperCase().includes(params.query.toUpperCase())
    );

    return respuestaOK(resultado, resultado.length + ' usuario(s) encontrado(s).');

  } catch (err) {
    return respuestaError('Error al listar usuarios: ' + err.message);
  }
}

/**
 * Crea un nuevo usuario.
 * Campos requeridos: NOMBRES, APELLIDOS, USUARIO, CLAVE, ID_ROL
 */
function guardarUsuario(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    // Validar campos requeridos
    const requeridos = ['NOMBRES', 'APELLIDOS', 'USUARIO', 'CLAVE', 'ID_ROL'];
    const { ok, faltantes } = validarCamposRequeridos(params, requeridos);
    if (!ok) return respuestaError('Campos requeridos faltantes: ' + faltantes.join(', '));

    // Validar longitud de clave
    if (String(params.CLAVE).length < 6) {
      return respuestaError('La contraseña debe tener mínimo 6 caracteres.');
    }

    // Verificar UNIQUE de USUARIO
    if (!esUnico(HOJAS.USUARIO, 'USUARIO', params.USUARIO)) {
      return respuestaError('El nombre de usuario "' + params.USUARIO + '" ya está en uso.', 'ERR_DUPLICADO');
    }

    // Verificar UNIQUE de CORREO si viene
    if (params.CORREO && !esUnico(HOJAS.USUARIO, 'CORREO', params.CORREO)) {
      return respuestaError('El correo "' + params.CORREO + '" ya está registrado.', 'ERR_DUPLICADO');
    }

    const idUsuario = generarID(HOJAS.USUARIO, 'ID_USUARIO', 'USR', 3);
    const fecha     = getFecha('fecha');

    // Insertar usuario con clave hasheada
    insertarFila(HOJAS.USUARIO, {
      ID_USUARIO:     idUsuario,
      NOMBRES:        normalizar(params.NOMBRES),
      APELLIDOS:      normalizar(params.APELLIDOS),
      USUARIO:        String(params.USUARIO).toLowerCase().trim(),
      CLAVE:          hashClave(params.CLAVE),
      CORREO:         String(params.CORREO || '').toLowerCase().trim(),
      TELEFONO:       params.TELEFONO || '',
      FOTO:           params.FOTO     || '',
      ESTADO:         'ACTIVO',
      ULTIMO_ACCESO:  '',
      FECHA_REGISTRO: fecha,
    });

    // Asignar rol
    insertarFila(HOJAS.USUARIO_ROL, {
      ID_USUARIO_ROL: generarID(HOJAS.USUARIO_ROL, 'ID_USUARIO_ROL', 'UR', 3),
      ID_USUARIO:     idUsuario,
      ID_ROL:         params.ID_ROL,
    });

    registrarAuditoria(
      params._sesion.ID_USUARIO,
      'SEGURIDAD',
      'CREAR_USUARIO',
      'Usuario creado: ' + params.USUARIO + ' · Rol: ' + params.ID_ROL
    );

    return respuestaOK({ ID_USUARIO: idUsuario }, 'Usuario creado correctamente.');

  } catch (err) {
    return respuestaError('Error al guardar usuario: ' + err.message);
  }
}

/**
 * Actualiza datos de un usuario existente.
 * No actualiza la clave (usar cambiarClave para eso).
 */
function actualizarUsuario(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_USUARIO) return respuestaError('ID_USUARIO requerido.');

    // Verificar UNIQUE de USUARIO (excluyendo el actual)
    if (params.USUARIO && !esUnico(HOJAS.USUARIO, 'USUARIO', params.USUARIO, params.ID_USUARIO, 'ID_USUARIO')) {
      return respuestaError('El nombre de usuario ya está en uso.', 'ERR_DUPLICADO');
    }

    const datosActualizar = {};
    if (params.NOMBRES)   datosActualizar.NOMBRES   = normalizar(params.NOMBRES);
    if (params.APELLIDOS) datosActualizar.APELLIDOS  = normalizar(params.APELLIDOS);
    if (params.USUARIO)   datosActualizar.USUARIO    = String(params.USUARIO).toLowerCase().trim();
    if (params.CORREO)    datosActualizar.CORREO     = String(params.CORREO).toLowerCase().trim();
    if (params.TELEFONO)  datosActualizar.TELEFONO   = params.TELEFONO;
    if (params.FOTO)      datosActualizar.FOTO       = params.FOTO;

    const actualizado = actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', params.ID_USUARIO, datosActualizar);
    if (!actualizado) return respuestaError('Usuario no encontrado.');

    // Actualizar rol si viene
    if (params.ID_ROL) {
      const usuarioRoles = leerHoja(HOJAS.USUARIO_ROL);
      const urExistente  = usuarioRoles.find(ur => String(ur.ID_USUARIO) === String(params.ID_USUARIO));
      if (urExistente) {
        actualizarFila(HOJAS.USUARIO_ROL, 'ID_USUARIO_ROL', urExistente.ID_USUARIO_ROL, { ID_ROL: params.ID_ROL });
      } else {
        insertarFila(HOJAS.USUARIO_ROL, {
          ID_USUARIO_ROL: generarID(HOJAS.USUARIO_ROL, 'ID_USUARIO_ROL', 'UR', 3),
          ID_USUARIO: params.ID_USUARIO,
          ID_ROL:     params.ID_ROL,
        });
      }
    }

    registrarAuditoria(params._sesion.ID_USUARIO, 'SEGURIDAD', 'EDITAR_USUARIO', 'Usuario ID: ' + params.ID_USUARIO);
    return respuestaOK(null, 'Usuario actualizado correctamente.');

  } catch (err) {
    return respuestaError('Error al actualizar usuario: ' + err.message);
  }
}

/**
 * Cambia el estado de un usuario: ACTIVO | INACTIVO
 */
function cambiarEstadoUsuario(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_USUARIO || !params.ESTADO) {
      return respuestaError('ID_USUARIO y ESTADO son requeridos.');
    }
    if (!['ACTIVO','INACTIVO'].includes(params.ESTADO)) {
      return respuestaError('Estado inválido. Use ACTIVO o INACTIVO.');
    }
    // No puede desactivarse a sí mismo
    if (String(params.ID_USUARIO) === String(params._sesion.ID_USUARIO)) {
      return respuestaError('No puede cambiar el estado de su propia cuenta.');
    }

    actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', params.ID_USUARIO, { ESTADO: params.ESTADO });
    registrarAuditoria(
      params._sesion.ID_USUARIO, 'SEGURIDAD', 'ESTADO_USUARIO',
      'Usuario ' + params.ID_USUARIO + ' → ' + params.ESTADO
    );
    return respuestaOK(null, 'Estado actualizado a ' + params.ESTADO);

  } catch (err) {
    return respuestaError('Error al cambiar estado: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  MÓDULO: ROL
// ════════════════════════════════════════════════════════════

/** Lista todos los roles */
function listarRoles(params) {
  try {
    const roles = leerHoja(HOJAS.ROL).map(limpiarFila);
    return respuestaOK(roles);
  } catch (err) {
    return respuestaError('Error al listar roles: ' + err.message);
  }
}

/** Crea o actualiza un rol */
function guardarRol(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.NOMBRE) return respuestaError('El nombre del rol es requerido.');

    const nombre = normalizar(params.NOMBRE);

    if (params.ID_ROL) {
      // Actualizar
      if (!esUnico(HOJAS.ROL, 'NOMBRE', nombre, params.ID_ROL, 'ID_ROL')) {
        return respuestaError('Ya existe un rol con ese nombre.', 'ERR_DUPLICADO');
      }
      actualizarFila(HOJAS.ROL, 'ID_ROL', params.ID_ROL, {
        NOMBRE:      nombre,
        DESCRIPCION: normalizar(params.DESCRIPCION || ''),
        ESTADO:      params.ESTADO || 'ACTIVO',
      });
      registrarAuditoria(params._sesion.ID_USUARIO, 'SEGURIDAD', 'EDITAR_ROL', 'Rol: ' + nombre);
      return respuestaOK(null, 'Rol actualizado.');

    } else {
      // Crear
      if (!esUnico(HOJAS.ROL, 'NOMBRE', nombre)) {
        return respuestaError('Ya existe un rol con ese nombre.', 'ERR_DUPLICADO');
      }
      const idRol = generarID(HOJAS.ROL, 'ID_ROL', 'ROL', 3);
      insertarFila(HOJAS.ROL, {
        ID_ROL:      idRol,
        NOMBRE:      nombre,
        DESCRIPCION: normalizar(params.DESCRIPCION || ''),
        ESTADO:      'ACTIVO',
      });
      registrarAuditoria(params._sesion.ID_USUARIO, 'SEGURIDAD', 'CREAR_ROL', 'Rol: ' + nombre);
      return respuestaOK({ ID_ROL: idRol }, 'Rol creado correctamente.');
    }

  } catch (err) {
    return respuestaError('Error al guardar rol: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  MÓDULO: PERMISO
// ════════════════════════════════════════════════════════════

/** Lista todos los permisos */
function listarPermisos(params) {
  try {
    const permisos = leerHoja(HOJAS.PERMISO).map(limpiarFila);
    return respuestaOK(permisos);
  } catch (err) {
    return respuestaError('Error al listar permisos: ' + err.message);
  }
}

/** Crea o actualiza un permiso */
function guardarPermiso(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.MODULO || !params.ACCION) {
      return respuestaError('MODULO y ACCION son requeridos.');
    }

    if (params.ID_PERMISO) {
      actualizarFila(HOJAS.PERMISO, 'ID_PERMISO', params.ID_PERMISO, {
        MODULO:      normalizar(params.MODULO),
        ACCION:      normalizar(params.ACCION),
        DESCRIPCION: params.DESCRIPCION || '',
        ESTADO:      params.ESTADO || 'ACTIVO',
      });
      return respuestaOK(null, 'Permiso actualizado.');
    } else {
      const idPermiso = generarID(HOJAS.PERMISO, 'ID_PERMISO', 'PER', 3);
      insertarFila(HOJAS.PERMISO, {
        ID_PERMISO:  idPermiso,
        MODULO:      normalizar(params.MODULO),
        ACCION:      normalizar(params.ACCION),
        DESCRIPCION: params.DESCRIPCION || '',
        ESTADO:      'ACTIVO',
      });
      return respuestaOK({ ID_PERMISO: idPermiso }, 'Permiso creado.');
    }

  } catch (err) {
    return respuestaError('Error al guardar permiso: ' + err.message);
  }
}

/** Asigna un permiso a un rol */
function asignarPermisoRol(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_ROL || !params.ID_PERMISO) {
      return respuestaError('ID_ROL e ID_PERMISO son requeridos.');
    }

    // Verificar que no esté ya asignado
    const rolPermisos = leerHoja(HOJAS.ROL_PERMISO);
    const yaExiste = rolPermisos.find(rp =>
      String(rp.ID_ROL) === String(params.ID_ROL) &&
      String(rp.ID_PERMISO) === String(params.ID_PERMISO)
    );
    if (yaExiste) return respuestaError('El permiso ya está asignado a este rol.', 'ERR_DUPLICADO');

    insertarFila(HOJAS.ROL_PERMISO, {
      ID_ROL_PERMISO: generarID(HOJAS.ROL_PERMISO, 'ID_ROL_PERMISO', 'RP', 3),
      ID_ROL:         params.ID_ROL,
      ID_PERMISO:     params.ID_PERMISO,
    });

    registrarAuditoria(
      params._sesion.ID_USUARIO, 'SEGURIDAD', 'ASIGNAR_PERMISO',
      'Rol: ' + params.ID_ROL + ' · Permiso: ' + params.ID_PERMISO
    );
    return respuestaOK(null, 'Permiso asignado al rol correctamente.');

  } catch (err) {
    return respuestaError('Error al asignar permiso: ' + err.message);
  }
}

/** Retira un permiso de un rol */
function retirarPermisoRol(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    const hoja       = getHoja(HOJAS.ROL_PERMISO);
    const todos      = hoja.getDataRange().getValues();
    const cabecera   = todos[0];
    const idxRol     = cabecera.indexOf('ID_ROL');
    const idxPermiso = cabecera.indexOf('ID_PERMISO');

    for (let i = todos.length - 1; i >= 1; i--) {
      if (String(todos[i][idxRol])     === String(params.ID_ROL) &&
          String(todos[i][idxPermiso]) === String(params.ID_PERMISO)) {
        hoja.deleteRow(i + 1);
        break;
      }
    }

    registrarAuditoria(
      params._sesion.ID_USUARIO, 'SEGURIDAD', 'RETIRAR_PERMISO',
      'Rol: ' + params.ID_ROL + ' · Permiso: ' + params.ID_PERMISO
    );
    return respuestaOK(null, 'Permiso retirado del rol.');

  } catch (err) {
    return respuestaError('Error al retirar permiso: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  AUDITORÍA
// ════════════════════════════════════════════════════════════

/**
 * Lista el registro de auditoría con filtros opcionales.
 * Solo ADMINISTRADOR puede consultarlo.
 */
function listarAuditoria(params) {
  try {
    if (params._sesion?.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    let registros = leerHoja(HOJAS.AUDITORIA).map(limpiarFila);

    // Filtros
    if (params.modulo)   registros = registros.filter(r => String(r.MODULO).toUpperCase() === params.modulo.toUpperCase());
    if (params.accion)   registros = registros.filter(r => String(r.ACCION).toUpperCase()  === params.accion.toUpperCase());
    if (params.usuario)  registros = registros.filter(r => String(r.ID_USUARIO) === String(params.usuario));
    if (params.fechaDesde) registros = registros.filter(r => r.FECHA >= params.fechaDesde);
    if (params.fechaHasta) registros = registros.filter(r => r.FECHA <= params.fechaHasta);

    // Limitar resultados (por rendimiento)
    const limite  = params.limite || 200;
    const pagina  = params.pagina || 1;
    const inicio  = (pagina - 1) * limite;
    const total   = registros.length;
    registros     = registros.slice(inicio, inicio + limite);

    return respuestaOK({ registros, total, pagina, limite }, total + ' registro(s) de auditoría.');

  } catch (err) {
    return respuestaError('Error al listar auditoría: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  PERMISOS INICIALES (ejecutar una vez desde Setup)
// ════════════════════════════════════════════════════════════

/**
 * Carga los permisos predefinidos del sistema.
 * Llamar desde inicializarSistema() en Setup.gs
 */
// ════════════════════════════════════════════════════════════
//  OBTENER PERMISOS DE UN ROL (para mostrar checkboxes)
// ════════════════════════════════════════════════════════════
function obtenerPermisosDeRol(params) {
  try {
    if (params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_ROL) return respuestaError('ID_ROL requerido.');

    var todosPermisos = leerHoja(HOJAS.PERMISO).map(limpiarFila)
      .filter(function(p){ return p.ID_PERMISO && String(p.ID_PERMISO).trim() !== ''; });
    var rolPermisos = leerHoja(HOJAS.ROL_PERMISO).map(limpiarFila)
      .filter(function(rp){ return String(rp.ID_ROL) === String(params.ID_ROL); });

    var asignados = {};
    for (var i = 0; i < rolPermisos.length; i++) {
      asignados[String(rolPermisos[i].ID_PERMISO)] = true;
    }

    var resultado = todosPermisos.map(function(p){
      return {
        ID_PERMISO:  p.ID_PERMISO,
        MODULO:      p.MODULO,
        ACCION:      p.ACCION,
        DESCRIPCION: p.DESCRIPCION,
        ASIGNADO:    asignados[String(p.ID_PERMISO)] === true,
      };
    });

    return respuestaOK(resultado, resultado.length + ' permiso(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  GUARDAR PERMISOS DE UN ROL (lista completa de golpe)
// ════════════════════════════════════════════════════════════
function guardarPermisosRol(params) {
  try {
    if (params._sesion && params._sesion.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el Administrador puede gestionar permisos.', 'ERR_PERMISO');
    }
    if (!params.ID_ROL) return respuestaError('ID_ROL requerido.');

    // params.permisos viene como array de ID_PERMISO marcados (string JSON o array)
    var marcados = params.permisos;
    if (typeof marcados === 'string') {
      try { marcados = JSON.parse(marcados); } catch(e) { marcados = []; }
    }
    if (!Array.isArray(marcados)) marcados = [];

    // Borrar TODOS los permisos actuales del rol
    var hoja     = getHoja(HOJAS.ROL_PERMISO);
    var todos    = hoja.getDataRange().getValues();
    var cabecera = todos[0];
    var idxRol   = cabecera.indexOf('ID_ROL');
    for (var i = todos.length - 1; i >= 1; i--) {
      if (String(todos[i][idxRol]) === String(params.ID_ROL)) {
        hoja.deleteRow(i + 1);
      }
    }

    // Insertar los marcados
    var contador = 0;
    var existentes = leerHoja(HOJAS.ROL_PERMISO).map(limpiarFila);
    var maxNum = 0;
    for (var k = 0; k < existentes.length; k++) {
      var n = parseInt(String(existentes[k].ID_ROL_PERMISO || '').replace('RP-', ''));
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    for (var j = 0; j < marcados.length; j++) {
      maxNum++;
      insertarFila(HOJAS.ROL_PERMISO, {
        ID_ROL_PERMISO: 'RP-' + String(maxNum).padStart(3, '0'),
        ID_ROL:         params.ID_ROL,
        ID_PERMISO:     marcados[j],
      });
      contador++;
    }

    try {
      registrarAuditoria(
        params._sesion ? params._sesion.ID_USUARIO : 'USR-000',
        'SEGURIDAD', 'GUARDAR_PERMISOS_ROL',
        'Rol ' + params.ID_ROL + ': ' + contador + ' permiso(s) asignado(s).'
      );
    } catch(e) {}

    return respuestaOK({ asignados: contador }, contador + ' permiso(s) guardado(s) para el rol.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function cargarPermisosIniciales() {
  const roles    = leerHoja(HOJAS.ROL);
  const admin    = roles.find(r => r.NOMBRE === 'ADMINISTRADOR');
  const cajero   = roles.find(r => r.NOMBRE === 'CAJERO');
  const medico   = roles.find(r => r.NOMBRE === 'MEDICO');
  const recep    = roles.find(r => r.NOMBRE === 'RECEPCION');
  if (!admin) { Logger.log('⚠ Roles no encontrados. Ejecuta inicializarSistema() primero.'); return; }

  // Definir permisos
  const PERMISOS_BASE = [
    // DASHBOARD
    { ID_PERMISO:'PER-001', MODULO:'DASHBOARD',          ACCION:'VER',    DESCRIPCION:'Ver dashboard',                ESTADO:'ACTIVO' },
    // PACIENTES
    { ID_PERMISO:'PER-010', MODULO:'PACIENTES',          ACCION:'VER',    DESCRIPCION:'Ver lista pacientes',          ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-011', MODULO:'PACIENTES',          ACCION:'CREAR',  DESCRIPCION:'Crear paciente',               ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-012', MODULO:'PACIENTES',          ACCION:'EDITAR', DESCRIPCION:'Editar paciente',              ESTADO:'ACTIVO' },
    // MÉDICOS
    { ID_PERMISO:'PER-020', MODULO:'MEDICOS',            ACCION:'VER',    DESCRIPCION:'Ver lista médicos',            ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-021', MODULO:'MEDICOS',            ACCION:'CREAR',  DESCRIPCION:'Crear médico',                 ESTADO:'ACTIVO' },
    // CITAS
    { ID_PERMISO:'PER-030', MODULO:'CITAS',              ACCION:'VER',    DESCRIPCION:'Ver agenda de citas',          ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-031', MODULO:'CITAS',              ACCION:'CREAR',  DESCRIPCION:'Crear cita',                   ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-032', MODULO:'CITAS',              ACCION:'EDITAR', DESCRIPCION:'Editar y reprogramar cita',    ESTADO:'ACTIVO' },
    // VENTAS
    { ID_PERMISO:'PER-040', MODULO:'VENTAS',             ACCION:'VER',    DESCRIPCION:'Ver historial de ventas',      ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-041', MODULO:'VENTAS',             ACCION:'CREAR',  DESCRIPCION:'Registrar venta',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-042', MODULO:'VENTAS',             ACCION:'ANULAR', DESCRIPCION:'Anular venta',                 ESTADO:'ACTIVO' },
    // CAJA
    { ID_PERMISO:'PER-050', MODULO:'CAJA',               ACCION:'VER',    DESCRIPCION:'Ver caja diaria',              ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-051', MODULO:'CAJA',               ACCION:'CREAR',  DESCRIPCION:'Registrar movimiento caja',    ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-052', MODULO:'CAJA',               ACCION:'CERRAR', DESCRIPCION:'Cerrar caja del día',          ESTADO:'ACTIVO' },
    // SESIONES
    { ID_PERMISO:'PER-060', MODULO:'SESIONES',           ACCION:'VER',    DESCRIPCION:'Ver control de sesiones',      ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-061', MODULO:'SESIONES',           ACCION:'CREAR',  DESCRIPCION:'Registrar sesión',             ESTADO:'ACTIVO' },
    // REPORTES
    { ID_PERMISO:'PER-070', MODULO:'REPORTES',           ACCION:'VER',    DESCRIPCION:'Ver reportes',                 ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-071', MODULO:'REPORTES',           ACCION:'EXPORTAR',DESCRIPCION:'Exportar reportes',           ESTADO:'ACTIVO' },
    // SEGURIDAD
    { ID_PERMISO:'PER-080', MODULO:'SEGURIDAD',          ACCION:'VER',    DESCRIPCION:'Ver usuarios y roles',         ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-081', MODULO:'SEGURIDAD',          ACCION:'CREAR',  DESCRIPCION:'Crear usuarios y roles',       ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-082', MODULO:'SEGURIDAD',          ACCION:'EDITAR', DESCRIPCION:'Editar usuarios y roles',      ESTADO:'ACTIVO' },
    // CONFIGURACIÓN
    { ID_PERMISO:'PER-090', MODULO:'CONFIGURACION',      ACCION:'VER',    DESCRIPCION:'Ver tablas maestras',          ESTADO:'ACTIVO' },
    { ID_PERMISO:'PER-091', MODULO:'CONFIGURACION',      ACCION:'EDITAR', DESCRIPCION:'Editar tablas maestras',       ESTADO:'ACTIVO' },
  ];

  // Insertar permisos
  if (getHoja(HOJAS.PERMISO).getLastRow() <= 1) {
    PERMISOS_BASE.forEach(p => insertarFila(HOJAS.PERMISO, p));
    Logger.log('✓ ' + PERMISOS_BASE.length + ' permisos creados');
  }

  // Asignar permisos por rol
  const asignaciones = {
    [admin.ID_ROL]:  PERMISOS_BASE.map(p => p.ID_PERMISO),  // Admin: todos
    [cajero.ID_ROL]: ['PER-001','PER-040','PER-041','PER-042','PER-050','PER-051','PER-052','PER-070'],
    [medico.ID_ROL]: ['PER-001','PER-010','PER-011','PER-012','PER-030','PER-031','PER-032','PER-060','PER-061','PER-070'],
    [recep.ID_ROL]:  ['PER-001','PER-010','PER-011','PER-020','PER-030','PER-031'],
  };

  if (getHoja(HOJAS.ROL_PERMISO).getLastRow() <= 1) {
    let contador = 0;
    Object.entries(asignaciones).forEach(([idRol, permisos]) => {
      permisos.forEach((idPermiso, i) => {
        insertarFila(HOJAS.ROL_PERMISO, {
          ID_ROL_PERMISO: 'RP-' + String(++contador).padStart(3, '0'),
          ID_ROL:         idRol,
          ID_PERMISO:     idPermiso,
        });
      });
    });
    Logger.log('✓ Permisos asignados a roles');
  }
}
