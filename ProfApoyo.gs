// ============================================================
// VIZVALL — Sistema de Gestión Médica
// Archivo: ProfApoyo.gs
// Profesionales de Área de Apoyo
// ============================================================

function listarProfesionalApoyo(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR','RECEPCION','CAJERO'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }

    let profs = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    const areas = leerHoja(HOJAS.AREA_APOYO).map(limpiarFila);

    profs = profs.map(p => ({
      ...p,
      AREA_NOMBRE: areas.find(a => a.ID_AREA_APOYO === p.ID_AREA_APOYO)?.NOMBRE || '—',
    }));

    if (params.estado)     profs = profs.filter(p => p.ESTADO === params.estado.toUpperCase());
    if (params.area)       profs = profs.filter(p => p.ID_AREA_APOYO === params.area);
    if (params.query) {
      const q = params.query.toUpperCase();
      profs = profs.filter(p =>
        (p.NOMBRES+' '+p.APELLIDOS+' '+p.PROFESION+' '+p.ID_PROFESIONAL).toUpperCase().includes(q)
      );
    }

    const limite  = parseInt(params.limite) || 50;
    const pagina  = parseInt(params.pagina) || 1;
    const total   = profs.length;
    const datos   = profs.slice((pagina-1)*limite, pagina*limite);

    return respuestaOK({ datos, total, pagina, limite, paginas: Math.ceil(total/limite) },
      total + ' profesional(es) encontrado(s).');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function guardarProfesionalApoyo(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Solo el Administrador puede registrar profesionales.', 'ERR_PERMISO');
    }

    const requeridos = ['NOMBRES','APELLIDOS','ID_AREA_APOYO','PROFESION','ESTADO'];
    for (const campo of requeridos) {
      if (!params[campo]) return respuestaError('El campo ' + campo + ' es requerido.');
    }

    const profs   = leerHoja(HOJAS.PROFESIONAL_APOYO).map(limpiarFila);
    const ultimos = profs.map(p => parseInt((p.ID_PROFESIONAL||'').replace('PAP-','')));
    const sig     = (ultimos.length ? Math.max(...ultimos.filter(n=>!isNaN(n))) : 0) + 1;
    const id      = 'PAP-' + String(sig).padStart(3,'0');
    const fecha   = getFecha('fecha');

    insertarFila(HOJAS.PROFESIONAL_APOYO, {
      ID_PROFESIONAL:    id,
      ID_TIPO_DOCUMENTO: params.ID_TIPO_DOCUMENTO || '-',
      NUMERO_DOCUMENTO:  String(params.NUMERO_DOCUMENTO || '-').toUpperCase().trim(),
      NOMBRES:           normalizar(params.NOMBRES),
      APELLIDOS:         normalizar(params.APELLIDOS),
      ID_AREA_APOYO:     params.ID_AREA_APOYO,
      PROFESION:         normalizar(params.PROFESION),
      TELEFONO:          String(params.TELEFONO || '-').replace(/\s/g,'') || '-',
      EMAIL:             String(params.EMAIL || '-').toUpperCase().trim() || '-',
      ESTADO:            String(params.ESTADO).toUpperCase(),
      FECHA_REGISTRO:    fecha,
    });

    return respuestaOK({ ID_PROFESIONAL: id }, 'Profesional registrado correctamente.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}

function actualizarProfesionalApoyo(params) {
  try {
    const rolesPermitidos = ['ADMINISTRADOR'];
    if (!rolesPermitidos.includes(params._sesion?.ROL)) {
      return respuestaError('Acceso denegado.', 'ERR_PERMISO');
    }
    if (!params.ID_PROFESIONAL) return respuestaError('ID_PROFESIONAL requerido.');

    const datos = {};
    if (params.NOMBRES)           datos.NOMBRES      = normalizar(params.NOMBRES);
    if (params.APELLIDOS)         datos.APELLIDOS     = normalizar(params.APELLIDOS);
    if (params.ID_AREA_APOYO)     datos.ID_AREA_APOYO = params.ID_AREA_APOYO;
    if (params.PROFESION)         datos.PROFESION     = normalizar(params.PROFESION);
    if (params.TELEFONO !== undefined) datos.TELEFONO = String(params.TELEFONO || '-').replace(/\s/g,'') || '-';
    if (params.EMAIL !== undefined)    datos.EMAIL    = String(params.EMAIL || '-').toUpperCase().trim() || '-';
    if (params.ESTADO)            datos.ESTADO        = String(params.ESTADO).toUpperCase();

    actualizarFila(HOJAS.PROFESIONAL_APOYO, 'ID_PROFESIONAL', params.ID_PROFESIONAL, datos);
    return respuestaOK({}, 'Profesional actualizado.');
  } catch (err) {
    return respuestaError('Error: ' + err.message);
  }
}
