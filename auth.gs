// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: Auth.gs
// Descripción: Autenticación, sesiones y control de acceso
// ============================================================

// ── CONFIGURACIÓN DE SESIONES ────────────────────────────
const SESSION_CONFIG = {
  DURACION_HORAS:   8,           // Sesión expira en 8 horas
  PREFIJO_CACHE:    'VZV_SES_',  // Prefijo en CacheService
  MAX_INTENTOS:     5,           // Intentos antes de bloquear
  BLOQUEO_MINUTOS:  15,          // Tiempo de bloqueo
};

// ── LOGIN ────────────────────────────────────────────────
/**
 * Autentica un usuario contra la hoja USUARIO.
 * Verifica clave SHA-256, estado, y rol asignado.
 *
 * @param {string} usuario  - Nombre de usuario
 * @param {string} clave    - Contraseña en texto plano
 * @param {string} rolSolicitado - Rol con el que intenta ingresar
 * @returns {Object} respuestaOK con datos de sesión | respuestaError
 */
function login(usuario, clave, rolSolicitado) {
  try {
    // 1. Validar parámetros
    if (!usuario || !clave) {
      return respuestaError('Usuario y clave son requeridos.', 'ERR_PARAMS');
    }

    // 2. Verificar intentos fallidos (bloqueo temporal)
    const bloqueado = verificarBloqueo_(usuario);
    if (bloqueado.ok === false) return bloqueado;

    // 3. Buscar usuario en hoja USUARIO
    const usuarios  = leerHoja(HOJAS.USUARIO);
    const usuarioObj = usuarios.find(u =>
      String(u.USUARIO).toLowerCase().trim() === usuario.toLowerCase().trim()
    );

    if (!usuarioObj) {
      registrarIntentoFallido_(usuario);
      return respuestaError('Usuario no encontrado. Verifique sus datos.', 'ERR_USUARIO');
    }

    // 4. Verificar estado
    if (String(usuarioObj.ESTADO).toUpperCase() !== 'ACTIVO') {
      return respuestaError(
        'Su cuenta está ' + usuarioObj.ESTADO + '. Contacte al administrador.',
        'ERR_INACTIVO'
      );
    }

    // 5. Verificar clave (SHA-256)
    if (!verificarClave(clave, String(usuarioObj.CLAVE))) {
      registrarIntentoFallido_(usuario);
      const intentos = getIntentosRestantes_(usuario);
      return respuestaError(
        'Contraseña incorrecta. Intentos restantes: ' + intentos,
        'ERR_CLAVE'
      );
    }

    // 6. Determinar el rol del usuario
    //    - Si NO se especifica rol (login automático): tomar el rol asignado.
    //    - Si se especifica: validar que lo tenga (compatibilidad).
    const rolesUsuario = obtenerRolesDeUsuario_(usuarioObj.ID_USUARIO);
    if (!rolesUsuario.length) {
      return respuestaError('Su usuario no tiene un rol asignado. Contacte al administrador.', 'ERR_ROL');
    }
    if (!rolSolicitado || String(rolSolicitado).trim() === '') {
      // Login automático: usar el primer rol asignado
      rolSolicitado = rolesUsuario[0];
    } else {
      // Login con rol específico: validar
      if (rolesUsuario.indexOf(String(rolSolicitado).toUpperCase()) < 0) {
        return respuestaError('No tiene acceso con el rol "' + rolSolicitado + '". Contacte al administrador.', 'ERR_ROL');
      }
      rolSolicitado = String(rolSolicitado).toUpperCase();
    }

    // 7. Limpiar intentos fallidos tras login exitoso
    limpiarIntentos_(usuario);

    // 8. Obtener permisos del rol
    const permisos = obtenerPermisosRol_(rolSolicitado);

    // 9. Generar token de sesión
    const token     = generarToken_();
    const expira    = new Date();
    expira.setHours(expira.getHours() + SESSION_CONFIG.DURACION_HORAS);

    const datosSesion = {
      token:          token,
      ID_USUARIO:     usuarioObj.ID_USUARIO,
      NOMBRES:        usuarioObj.NOMBRES,
      APELLIDOS:      usuarioObj.APELLIDOS,
      USUARIO:        usuarioObj.USUARIO,
      CORREO:         usuarioObj.CORREO,
      ROL:            rolSolicitado,
      PERMISOS:       permisos,
      ULTIMO_ACCESO:  getFecha('datetime'),
      EXPIRA:         expira.toISOString(),
    };

    // 10. Guardar sesión en CacheService (disponible server-side)
    guardarSesionCache_(token, datosSesion);

    // 11. Actualizar ULTIMO_ACCESO en hoja USUARIO
    actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', usuarioObj.ID_USUARIO, {
      ULTIMO_ACCESO: getFecha('datetime'),
    });

    // 12. Registrar en AUDITORIA
    registrarAuditoria(
      usuarioObj.ID_USUARIO,
      'AUTH',
      'LOGIN',
      'Inicio de sesión exitoso · Rol: ' + rolSolicitado
    );

    return respuestaOK(datosSesion, 'Bienvenido, ' + usuarioObj.NOMBRES);

  } catch (err) {
    Logger.log('ERROR en login: ' + err.message);
    return respuestaError('Error interno al autenticar: ' + err.message, 'ERR_INTERNO');
  }
}

// ── LOGOUT ───────────────────────────────────────────────
/**
 * Cierra la sesión invalidando el token en caché.
 * @param {Object} sesion - Objeto de sesión con token
 */
function logout(sesion) {
  try {
    if (!sesion || !sesion.token) {
      return respuestaError('Token de sesión requerido.', 'ERR_TOKEN');
    }

    // Eliminar del caché
    CacheService.getScriptCache().remove(SESSION_CONFIG.PREFIJO_CACHE + sesion.token);

    // Registrar auditoría
    registrarAuditoria(
      sesion.ID_USUARIO || 'DESCONOCIDO',
      'AUTH',
      'LOGOUT',
      'Cierre de sesión · Usuario: ' + (sesion.USUARIO || '—')
    );

    return respuestaOK(null, 'Sesión cerrada correctamente.');

  } catch (err) {
    return respuestaError('Error al cerrar sesión: ' + err.message);
  }
}

// ── VERIFICAR SESIÓN ─────────────────────────────────────
/**
 * Verifica si un token de sesión es válido y no ha expirado.
 * Se llama en cada operación protegida desde ejecutar().
 * @param {string} token
 * @returns {{ ok: boolean, datos: Object }}
 */
function verificarToken(token) {
  try {
    if (!token) return { ok: false, mensaje: 'Token no proporcionado.' };

    const cache  = CacheService.getScriptCache();
    const stored = cache.get(SESSION_CONFIG.PREFIJO_CACHE + token);

    if (!stored) {
      return { ok: false, mensaje: 'Sesión expirada. Inicie sesión nuevamente.' };
    }

    const sesion = JSON.parse(stored);

    // Verificar expiración
    if (new Date() > new Date(sesion.EXPIRA)) {
      cache.remove(SESSION_CONFIG.PREFIJO_CACHE + token);
      return { ok: false, mensaje: 'Sesión expirada por inactividad.' };
    }

    // Renovar tiempo en caché
    const segundosRestantes = SESSION_CONFIG.DURACION_HORAS * 3600;
    cache.put(SESSION_CONFIG.PREFIJO_CACHE + token, stored, segundosRestantes);

    return { ok: true, datos: sesion };

  } catch (err) {
    return { ok: false, mensaje: 'Error al verificar sesión: ' + err.message };
  }
}

// ── CAMBIAR CONTRASEÑA ───────────────────────────────────
/**
 * Permite al usuario cambiar su propia contraseña.
 * @param {Object} params - { token, claveActual, claveNueva, confirmarClave }
 */
function cambiarClave(params) {
  try {
    const sesionCheck = verificarToken(params.token);
    if (!sesionCheck.ok) return respuestaError(sesionCheck.mensaje);

    const sesion = sesionCheck.datos;

    // Validar parámetros
    if (!params.claveActual || !params.claveNueva || !params.confirmarClave) {
      return respuestaError('Todos los campos de contraseña son requeridos.');
    }
    if (params.claveNueva !== params.confirmarClave) {
      return respuestaError('La nueva contraseña y su confirmación no coinciden.');
    }
    if (params.claveNueva.length < 6) {
      return respuestaError('La nueva contraseña debe tener mínimo 6 caracteres.');
    }
    if (params.claveNueva === params.claveActual) {
      return respuestaError('La nueva contraseña no puede ser igual a la actual.');
    }

    // Buscar usuario y verificar clave actual
    const usuarios   = leerHoja(HOJAS.USUARIO);
    const usuarioObj = usuarios.find(u => u.ID_USUARIO === sesion.ID_USUARIO);
    if (!usuarioObj) return respuestaError('Usuario no encontrado.');

    if (!verificarClave(params.claveActual, String(usuarioObj.CLAVE))) {
      return respuestaError('La contraseña actual es incorrecta.');
    }

    // Actualizar con nueva clave hasheada
    actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', sesion.ID_USUARIO, {
      CLAVE: hashClave(params.claveNueva),
    });

    registrarAuditoria(sesion.ID_USUARIO, 'AUTH', 'CAMBIO_CLAVE', 'Contraseña actualizada');

    return respuestaOK(null, 'Contraseña actualizada correctamente.');

  } catch (err) {
    return respuestaError('Error al cambiar contraseña: ' + err.message);
  }
}

// ── RESETEAR CONTRASEÑA (Admin) ──────────────────────────
/**
 * El administrador resetea la contraseña de un usuario.
 * @param {Object} params - { token, idUsuario, claveNueva }
 */
function resetearClave(params) {
  try {
    const sesionCheck = verificarToken(params.token);
    if (!sesionCheck.ok) return respuestaError(sesionCheck.mensaje);
    if (sesionCheck.datos.ROL !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede resetear contraseñas.', 'ERR_PERMISO');
    }
    if (!params.idUsuario || !params.claveNueva) {
      return respuestaError('ID de usuario y nueva contraseña son requeridos.');
    }
    if (params.claveNueva.length < 6) {
      return respuestaError('La contraseña debe tener mínimo 6 caracteres.');
    }

    actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', params.idUsuario, {
      CLAVE: hashClave(params.claveNueva),
    });

    registrarAuditoria(
      sesionCheck.datos.ID_USUARIO,
      'AUTH',
      'RESET_CLAVE',
      'Reset de contraseña para usuario ID: ' + params.idUsuario
    );

    return respuestaOK(null, 'Contraseña reseteada correctamente.');

  } catch (err) {
    return respuestaError('Error al resetear contraseña: ' + err.message);
  }
}

// ── FUNCIONES PRIVADAS ───────────────────────────────────

/** Genera un token UUID v4 aleatorio */
function generarToken_() {
  return Utilities.getUuid();
}

/** Guarda sesión en CacheService */
function guardarSesionCache_(token, datos) {
  const segundos = SESSION_CONFIG.DURACION_HORAS * 3600;
  CacheService.getScriptCache().put(
    SESSION_CONFIG.PREFIJO_CACHE + token,
    JSON.stringify(datos),
    Math.min(segundos, 21600)  // CacheService max = 6 horas (21600 seg)
  );
}

/** Verifica si el usuario tiene asignado el rol solicitado */
// Obtiene la lista de roles (nombres) asignados a un usuario
function obtenerRolesDeUsuario_(idUsuario) {
  const usuarioRoles = leerHoja(HOJAS.USUARIO_ROL);
  const roles        = leerHoja(HOJAS.ROL);
  return usuarioRoles
    .filter(ur => String(ur.ID_USUARIO) === String(idUsuario))
    .map(ur => {
      const rol = roles.find(r => String(r.ID_ROL) === String(ur.ID_ROL));
      return rol ? String(rol.NOMBRE).toUpperCase() : '';
    })
    .filter(function(n){ return n !== ''; });
}

function verificarRolUsuario_(idUsuario, rolSolicitado) {
  const usuarioRoles = leerHoja(HOJAS.USUARIO_ROL);
  const roles        = leerHoja(HOJAS.ROL);

  const rolesDelUsuario = usuarioRoles
    .filter(ur => String(ur.ID_USUARIO) === String(idUsuario))
    .map(ur => {
      const rol = roles.find(r => String(r.ID_ROL) === String(ur.ID_ROL));
      return rol ? String(rol.NOMBRE).toUpperCase() : '';
    });

  return rolesDelUsuario.includes(rolSolicitado.toUpperCase());
}

/** Obtiene los permisos del rol (módulos y acciones) */
// CACHÉ #3: los permisos de un rol se calculan UNA vez por ejecución.
// Como una misma función puede validar permisos varias veces con el mismo rol,
// esto evita recalcular el filter/map/find repetidamente. Se renueva en cada
// request (las globales se reinician), así un cambio de permisos se ve al instante
// en la siguiente operación. No cambia la lógica: mismo resultado.
var _permisosRolCache_ = {};
function obtenerPermisosRol_(rolNombre) {
  var clave = String(rolNombre || '').toUpperCase();
  if (_permisosRolCache_[clave]) return _permisosRolCache_[clave];

  const roles    = leerHoja(HOJAS.ROL);
  const rol      = roles.find(r => String(r.NOMBRE).toUpperCase() === clave);
  if (!rol) { _permisosRolCache_[clave] = []; return []; }

  const rolPermisos = leerHoja(HOJAS.ROL_PERMISO);
  const permisos    = leerHoja(HOJAS.PERMISO);

  var resultado = rolPermisos
    .filter(rp => String(rp.ID_ROL) === String(rol.ID_ROL))
    .map(rp => {
      const p = permisos.find(pm => String(pm.ID_PERMISO) === String(rp.ID_PERMISO));
      return p ? { modulo: p.MODULO, accion: p.ACCION } : null;
    })
    .filter(Boolean);
  _permisosRolCache_[clave] = resultado;
  return resultado;
}

/** Bloqueo por intentos fallidos usando PropertiesService */
function verificarBloqueo_(usuario) {
  const props = PropertiesService.getScriptProperties();
  const key   = 'BLOQUEO_' + usuario.toLowerCase();
  const data  = props.getProperty(key);
  if (!data) return { ok: true };

  const info = JSON.parse(data);
  if (info.intentos >= SESSION_CONFIG.MAX_INTENTOS) {
    const bloqueadoHasta = new Date(info.hasta);
    if (new Date() < bloqueadoHasta) {
      const minRestantes = Math.ceil((bloqueadoHasta - new Date()) / 60000);
      return respuestaError(
        'Cuenta bloqueada temporalmente. Intente en ' + minRestantes + ' minuto(s).',
        'ERR_BLOQUEADO'
      );
    } else {
      props.deleteProperty(key); // Desbloquear automáticamente
    }
  }
  return { ok: true };
}

function registrarIntentoFallido_(usuario) {
  const props = PropertiesService.getScriptProperties();
  const key   = 'BLOQUEO_' + usuario.toLowerCase();
  const data  = props.getProperty(key);
  let info    = data ? JSON.parse(data) : { intentos: 0 };
  info.intentos++;
  if (info.intentos >= SESSION_CONFIG.MAX_INTENTOS) {
    const hasta = new Date();
    hasta.setMinutes(hasta.getMinutes() + SESSION_CONFIG.BLOQUEO_MINUTOS);
    info.hasta = hasta.toISOString();
  }
  props.setProperty(key, JSON.stringify(info));
}

function getIntentosRestantes_(usuario) {
  const props = PropertiesService.getScriptProperties();
  const data  = props.getProperty('BLOQUEO_' + usuario.toLowerCase());
  if (!data) return SESSION_CONFIG.MAX_INTENTOS - 1;
  const info  = JSON.parse(data);
  return Math.max(0, SESSION_CONFIG.MAX_INTENTOS - info.intentos);
}

function limpiarIntentos_(usuario) {
  PropertiesService.getScriptProperties()
    .deleteProperty('BLOQUEO_' + usuario.toLowerCase());
}
