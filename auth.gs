// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: auth.gs
// Descripción: Autenticación, sesión (token), claves y políticas.
//
// NOTA: el CRUD de USUARIOS, ROLES y PERMISOS vive en seguridad.gs.
//       Este archivo NO debe duplicar esas funciones.
// ============================================================

var AUTH_SESION_MIN_DEF = 480;        // duración de sesión por defecto (8 h)
var AUTH_TOKEN_PREFIJO  = 'vzv_tk_';


// ════════════════════════════════════════════════════════════
//  LOGIN
//  Códigos: ERR_USUARIO | ERR_CLAVE | ERR_INACTIVO | ERR_ROL
// ════════════════════════════════════════════════════════════
function login(usuario, clave, rol) {
  try {
    usuario = String(usuario || '').trim();
    clave   = String(clave   || '');
    if (!usuario || !clave) return respuestaError('Ingrese usuario y clave.', 'ERR_USUARIO');

    var usuarios = leerHoja(HOJAS.USUARIO).map(limpiarFila);
    var usr = null;
    for (var i = 0; i < usuarios.length; i++) {
      if (String(usuarios[i].USUARIO || '').toLowerCase() === usuario.toLowerCase()) { usr = usuarios[i]; break; }
    }
    if (!usr) return respuestaError('Usuario no encontrado.', 'ERR_USUARIO');

    if (String(usr.ESTADO || '').toUpperCase() !== 'ACTIVO') {
      return respuestaError('El usuario está inactivo. Contacte al administrador.', 'ERR_INACTIVO');
    }

    // La clave se guarda hasheada (SHA-256). Se tolera texto plano heredado.
    var hash = hashClave(clave);
    var guardada = String(usr.CLAVE || '');
    if (guardada !== hash && guardada !== clave) {
      _authRegistrarIntento(usr, false);
      return respuestaError('Clave incorrecta.', 'ERR_CLAVE');
    }

    var rolNombre = _authRolDeUsuario(usr.ID_USUARIO);
    if (!rolNombre) return respuestaError('El usuario no tiene un rol asignado.', 'ERR_ROL');

    var token = _authCrearToken({
      ID_USUARIO:     usr.ID_USUARIO,
      NOMBRES:        usr.NOMBRES || '',
      APELLIDOS:      usr.APELLIDOS || '',
      USUARIO:        usr.USUARIO,
      ROL:            rolNombre,
      ID_MEDICO:      usr.ID_MEDICO || '-',
      ID_PROFESIONAL: usr.ID_PROFESIONAL || '-'
    });

    try {
      actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', usr.ID_USUARIO, { ULTIMO_ACCESO: getFecha('datetime') });
    } catch (e) {}

    _authRegistrarIntento(usr, true);

    return respuestaOK({
      ID_USUARIO:         usr.ID_USUARIO,
      NOMBRES:            usr.NOMBRES || '',
      APELLIDOS:          usr.APELLIDOS || '',
      USUARIO:            usr.USUARIO,
      ROL:                rolNombre,
      FOTO:               usr.FOTO || '',
      ID_MEDICO:          usr.ID_MEDICO || '-',
      ID_PROFESIONAL:     usr.ID_PROFESIONAL || '-',
      CAMBIO_OBLIGATORIO: String(usr.CAMBIO_OBLIGATORIO || '').toUpperCase() === 'SI',
      TOKEN:              token,
      token:              token
    }, 'Bienvenido.');
  } catch (err) {
    return respuestaError('Error al iniciar sesión: ' + err.message);
  }
}


// ════════════════════════════════════════════════════════════
//  TOKEN / SESIÓN
// ════════════════════════════════════════════════════════════
function verificarToken(token) {
  try {
    if (!token) return { ok: false };
    var crudo = null;
    try { crudo = CacheService.getScriptCache().get(AUTH_TOKEN_PREFIJO + token); } catch (e) {}
    if (!crudo) {
      try { crudo = PropertiesService.getScriptProperties().getProperty(AUTH_TOKEN_PREFIJO + token); } catch (e) {}
    }
    if (!crudo) return { ok: false };

    var ses = JSON.parse(crudo);
    if (ses.EXPIRA && new Date().getTime() > ses.EXPIRA) {
      _authBorrarToken(token);
      return { ok: false };
    }
    ses.TOKEN = token;
    return { ok: true, datos: ses };
  } catch (e) {
    return { ok: false };
  }
}

function logout(params) {
  try {
    var token = (params && (params.token || params.TOKEN)) ? (params.token || params.TOKEN) : '';
    if (token) _authBorrarToken(token);
    return respuestaOK({}, 'Sesión cerrada.');
  } catch (err) {
    return respuestaOK({}, 'Sesión cerrada.');
  }
}


// ════════════════════════════════════════════════════════════
//  CLAVES
// ════════════════════════════════════════════════════════════
function cambiarClave(params) {
  try {
    params = params || {};
    var ses = params._sesion || {};
    var idUsuario = params.ID_USUARIO || ses.ID_USUARIO;
    if (!idUsuario) return respuestaError('Sesión no válida.', 'ERR_SESION');

    var actual = String(params.CLAVE_ACTUAL || params.claveActual || '');
    var nueva  = String(params.CLAVE_NUEVA  || params.claveNueva  || '');
    if (!nueva) return respuestaError('Indique la nueva clave.');

    var usuarios = leerHoja(HOJAS.USUARIO).map(limpiarFila);
    var usr = null;
    for (var i = 0; i < usuarios.length; i++) {
      if (usuarios[i].ID_USUARIO === idUsuario) { usr = usuarios[i]; break; }
    }
    if (!usr) return respuestaError('Usuario no encontrado.');

    var obligatorio = String(usr.CAMBIO_OBLIGATORIO || '').toUpperCase() === 'SI';
    if (!obligatorio) {
      var hAct = hashClave(actual);
      if (String(usr.CLAVE) !== hAct && String(usr.CLAVE) !== actual) {
        return respuestaError('La clave actual no es correcta.', 'ERR_CLAVE');
      }
    }

    var pol = _authPoliticas();
    var val = _authValidarClave(nueva, pol);
    if (!val.ok) return respuestaError(val.mensaje);

    var hNueva = hashClave(nueva);
    if (String(usr.CLAVE) === hNueva) return respuestaError('La nueva clave no puede ser igual a la actual.');

    var hist = String(usr.HISTORIAL_CLAVES || '');
    var lista = hist ? hist.split('|') : [];
    if (pol.NO_REPETIR > 0 && lista.slice(0, pol.NO_REPETIR).indexOf(hNueva) >= 0) {
      return respuestaError('No puede reutilizar sus últimas ' + pol.NO_REPETIR + ' claves.');
    }
    lista.unshift(hNueva);
    lista = lista.slice(0, 10);

    actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', idUsuario, {
      CLAVE:              hNueva,
      HISTORIAL_CLAVES:   lista.join('|'),
      FECHA_CAMBIO_CLAVE: getFecha('fecha'),
      CAMBIO_OBLIGATORIO: 'NO'
    });

    try { registrarAuditoria(ses.USUARIO || usr.USUARIO, 'CAMBIAR_CLAVE', 'USUARIO', idUsuario, 'Cambio de clave'); } catch (e) {}
    return respuestaOK({}, 'Clave actualizada correctamente.');
  } catch (err) {
    return respuestaError('Error al cambiar la clave: ' + err.message);
  }
}

function resetearClave(params) {
  try {
    params = params || {};
    var ses = params._sesion || {};
    if (String(ses.ROL || '').toUpperCase() !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede resetear claves.', 'ERR_PERMISO');
    }
    var idUsuario = params.ID_USUARIO;
    if (!idUsuario) return respuestaError('Indique el usuario.');

    var nueva = String(params.CLAVE_NUEVA || params.clave || '').trim();
    if (!nueva) return respuestaError('Indique la nueva clave.');

    var val = _authValidarClave(nueva, _authPoliticas());
    if (!val.ok) return respuestaError(val.mensaje);

    actualizarFila(HOJAS.USUARIO, 'ID_USUARIO', idUsuario, {
      CLAVE:              hashClave(nueva),
      FECHA_CAMBIO_CLAVE: getFecha('fecha'),
      CAMBIO_OBLIGATORIO: 'SI'
    });

    try { registrarAuditoria(ses.USUARIO || '-', 'RESETEAR_CLAVE', 'USUARIO', idUsuario, 'Clave reseteada por el administrador'); } catch (e) {}
    return respuestaOK({}, 'Clave reseteada. El usuario deberá cambiarla al ingresar.');
  } catch (err) {
    return respuestaError('Error al resetear la clave: ' + err.message);
  }
}


// ════════════════════════════════════════════════════════════
//  POLÍTICAS DE SEGURIDAD
// ════════════════════════════════════════════════════════════
function obtenerPoliticasSeguridad(params) {
  try {
    return respuestaOK(_authPoliticas());
  } catch (err) {
    return respuestaError('Error al leer las políticas: ' + err.message);
  }
}

function guardarPoliticasSeguridad(params) {
  try {
    params = params || {};
    var ses = params._sesion || {};
    if (String(ses.ROL || '').toUpperCase() !== 'ADMINISTRADOR') {
      return respuestaError('Solo el administrador puede cambiar las políticas.', 'ERR_PERMISO');
    }
    var pol = {
      LONGITUD_MIN:   parseInt(params.LONGITUD_MIN, 10)   || 6,
      EXIGE_MAYUS:    String(params.EXIGE_MAYUS    || 'NO').toUpperCase() === 'SI',
      EXIGE_NUMERO:   String(params.EXIGE_NUMERO   || 'NO').toUpperCase() === 'SI',
      EXIGE_ESPECIAL: String(params.EXIGE_ESPECIAL || 'NO').toUpperCase() === 'SI',
      NO_REPETIR:     parseInt(params.NO_REPETIR, 10)     || 0,
      DIAS_CADUCIDAD: parseInt(params.DIAS_CADUCIDAD, 10) || 0,
      SESION_MIN:     parseInt(params.SESION_MIN, 10)     || AUTH_SESION_MIN_DEF
    };
    PropertiesService.getScriptProperties().setProperty('vzv_politicas', JSON.stringify(pol));
    try { registrarAuditoria(ses.USUARIO || '-', 'GUARDAR_POLITICAS', 'SEGURIDAD', '-', 'Políticas de seguridad actualizadas'); } catch (e) {}
    return respuestaOK(pol, 'Políticas guardadas.');
  } catch (err) {
    return respuestaError('Error al guardar las políticas: ' + err.message);
  }
}


// ════════════════════════════════════════════════════════════
//  APOYO INTERNO — no ejecutar sueltas
// ════════════════════════════════════════════════════════════
function _authPoliticas() {
  var def = {
    LONGITUD_MIN: 6, EXIGE_MAYUS: false, EXIGE_NUMERO: false, EXIGE_ESPECIAL: false,
    NO_REPETIR: 0, DIAS_CADUCIDAD: 0, SESION_MIN: AUTH_SESION_MIN_DEF
  };
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('vzv_politicas');
    if (!raw) return def;
    var p = JSON.parse(raw);
    for (var k in def) { if (p[k] === undefined) p[k] = def[k]; }
    return p;
  } catch (e) { return def; }
}

function _authValidarClave(clave, pol) {
  clave = String(clave || '');
  pol = pol || _authPoliticas();
  if (clave.length < pol.LONGITUD_MIN)                    return { ok: false, mensaje: 'La clave debe tener al menos ' + pol.LONGITUD_MIN + ' caracteres.' };
  if (pol.EXIGE_MAYUS    && !/[A-Z]/.test(clave))         return { ok: false, mensaje: 'La clave debe incluir al menos una mayúscula.' };
  if (pol.EXIGE_NUMERO   && !/[0-9]/.test(clave))         return { ok: false, mensaje: 'La clave debe incluir al menos un número.' };
  if (pol.EXIGE_ESPECIAL && !/[^A-Za-z0-9]/.test(clave))  return { ok: false, mensaje: 'La clave debe incluir al menos un carácter especial.' };
  return { ok: true };
}

function _authRolDeUsuario(idUsuario) {
  try {
    var ur = leerHoja(HOJAS.USUARIO_ROL).map(limpiarFila);
    var idRol = '';
    for (var i = 0; i < ur.length; i++) {
      if (ur[i].ID_USUARIO === idUsuario) { idRol = ur[i].ID_ROL; break; }
    }
    if (!idRol) return '';
    var roles = leerHoja(HOJAS.ROL).map(limpiarFila);
    for (var j = 0; j < roles.length; j++) {
      if (roles[j].ID_ROL === idRol) {
        if (String(roles[j].ESTADO || 'ACTIVO').toUpperCase() === 'INACTIVO') return '';
        return String(roles[j].NOMBRE || '').toUpperCase();
      }
    }
    return '';
  } catch (e) { return ''; }
}

function _authCrearToken(datos) {
  var pol = _authPoliticas();
  var token = Utilities.getUuid().replace(/-/g, '');
  datos.EXPIRA = new Date().getTime() + (pol.SESION_MIN * 60 * 1000);
  var crudo = JSON.stringify(datos);
  try { CacheService.getScriptCache().put(AUTH_TOKEN_PREFIJO + token, crudo, 21600); } catch (e) {}
  try { PropertiesService.getScriptProperties().setProperty(AUTH_TOKEN_PREFIJO + token, crudo); } catch (e) {}
  return token;
}

function _authBorrarToken(token) {
  try { CacheService.getScriptCache().remove(AUTH_TOKEN_PREFIJO + token); } catch (e) {}
  try { PropertiesService.getScriptProperties().deleteProperty(AUTH_TOKEN_PREFIJO + token); } catch (e) {}
}

function _authRegistrarIntento(usr, ok) {
  try {
    registrarAuditoria(usr.USUARIO || '-', ok ? 'LOGIN' : 'LOGIN_FALLIDO', 'USUARIO',
      usr.ID_USUARIO || '-', ok ? 'Inicio de sesión' : 'Intento fallido de inicio de sesión');
  } catch (e) {}
}
