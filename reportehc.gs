// ════════════════════════════════════════════════════════════
//  REPORTE DE HISTORIA CLÍNICA — Backend
//  Lista las atenciones (por nombre, fecha, especialidad) y arma
//  el expediente para ver/imprimir: TÓPICO + HISTORIA + RECETA
//  juntos, y el DESCANSO MÉDICO por separado.
// ════════════════════════════════════════════════════════════

// ── Listar atenciones para el reporte (con filtros) ──
function listarReporteHC(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) return respuestaError('Sin permiso.', 'ERR_PERMISO');

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila)
      .filter(function(a){ return a.ESTADO !== 'ANULADO'; });
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);

    var pacIdx = {}; pacientes.forEach(function(p){ pacIdx[p.ID_PACIENTE] = p; });
    var medIdx = {}; medicos.forEach(function(m){ medIdx[m.ID_MEDICO] = m; });

    // Para saber la especialidad, la tomamos del médico o de la venta si estuviera
    // (aquí usamos la del médico como referencia principal)
    var especialidades = {};
    try {
      var medEsp = leerHoja(HOJAS.MEDICO_ESPECIALIDAD).map(limpiarFila);
      var esp = leerHoja(HOJAS.ESPECIALIDAD).map(limpiarFila);
      var espIdx = {}; esp.forEach(function(e){ espIdx[e.ID_ESPECIALIDAD] = e.ESPECIALIDAD || e.NOMBRE || ''; });
      medEsp.forEach(function(me){
        if (!especialidades[me.ID_MEDICO]) especialidades[me.ID_MEDICO] = [];
        if (espIdx[me.ID_ESPECIALIDAD]) especialidades[me.ID_MEDICO].push(espIdx[me.ID_ESPECIALIDAD]);
      });
    } catch(e) { /* si no existen esas hojas, seguimos sin especialidad */ }

    // Filtros
    var q = (params.busqueda || '').toString().toUpperCase().trim();
    var desde = (params.desde || '').toString().substring(0,10);
    var hasta = (params.hasta || '').toString().substring(0,10);

    var filas = atenciones.map(function(a){
      var pac = pacIdx[a.ID_PACIENTE] || {};
      var med = medIdx[a.ID_MEDICO] || {};
      var nombrePac = a.NOMBRE_PACIENTE || ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim();
      var nombreMed = a.NOMBRE_MEDICO || ((med.NOMBRES||'')+' '+(med.APELLIDOS||'')).trim();
      var espTxt = (especialidades[a.ID_MEDICO] && especialidades[a.ID_MEDICO].length) ? especialidades[a.ID_MEDICO].join(', ') : '';
      return {
        ID_ATENCION: a.ID_ATENCION,
        ID_PACIENTE: a.ID_PACIENTE,
        ID_VENTA: a.ID_VENTA || '',
        NOMBRE_PACIENTE: nombrePac,
        DOCUMENTO: pac.NUMERO_DOCUMENTO || '',
        NOMBRE_MEDICO: nombreMed,
        ESPECIALIDAD: espTxt,
        DIAGNOSTICO: (a.DIAGNOSTICO && a.DIAGNOSTICO !== '-') ? a.DIAGNOSTICO : '',
        FECHA: (a.FECHA_ATENCION || a.FECHA_REGISTRO || '').toString().substring(0,10)
      };
    });

    if (q) {
      filas = filas.filter(function(f){
        return (f.NOMBRE_PACIENTE||'').toUpperCase().indexOf(q) >= 0 ||
               (f.DOCUMENTO||'').toUpperCase().indexOf(q) >= 0 ||
               (f.ESPECIALIDAD||'').toUpperCase().indexOf(q) >= 0;
      });
    }
    if (desde) filas = filas.filter(function(f){ return f.FECHA >= desde; });
    if (hasta) filas = filas.filter(function(f){ return f.FECHA <= hasta; });

    filas.sort(function(a,b){ return (b.FECHA||'').localeCompare(a.FECHA||''); });
    if (!q && !desde && !hasta && filas.length > 150) filas = filas.slice(0, 150);

    return respuestaOK(filas, filas.length + ' atención(es).');
  } catch (err) { return respuestaError('Error al listar: ' + err.message); }
}

// ── Obtener el expediente completo de una atención (para ver/imprimir) ──
// Devuelve: datos del paciente, tópico (signos), historia clínica,
// receta (si existe) y descanso (si existe). El frontend arma los PDF.
function obtenerExpedienteHC(params) {
  try {
    if (!_puedeModulo(params, 'Historia Clínica')) return respuestaError('Sin permiso.', 'ERR_PERMISO');
    if (!params.ID_ATENCION) return respuestaError('Atención requerida.');

    var atenciones = leerHoja(HOJAS.ATENCION_MEDICA).map(limpiarFila);
    var at = null;
    for (var i = 0; i < atenciones.length; i++) {
      if (atenciones[i].ID_ATENCION === params.ID_ATENCION) { at = atenciones[i]; break; }
    }
    if (!at) return respuestaError('No se encontró la atención.');

    // Datos del paciente
    var pacientes = leerHoja(HOJAS.PACIENTE).map(limpiarFila);
    var pac = null;
    for (var p = 0; p < pacientes.length; p++) { if (pacientes[p].ID_PACIENTE === at.ID_PACIENTE) { pac = pacientes[p]; break; } }

    // Datos del médico
    var medicos = leerHoja(HOJAS.MEDICO).map(limpiarFila);
    var med = null;
    for (var m = 0; m < medicos.length; m++) { if (medicos[m].ID_MEDICO === at.ID_MEDICO) { med = medicos[m]; break; } }

    // Config empresa
    var emp = {};
    try {
      var cfg = leerHoja(HOJAS.CONFIG_EMPRESA).map(limpiarFila);
      if (cfg.length) emp = cfg[0];
    } catch(e) {}

    // ¿Tiene signos vitales (tópico)?
    var tieneTopico = (at.PA && at.PA !== '-') || (at.PESO && at.PESO !== '-') ||
                      (at.TALLA && at.TALLA !== '-') || (at.TEMPERATURA && at.TEMPERATURA !== '-') ||
                      (at.FREC_CARDIACA && at.FREC_CARDIACA !== '-') || (at.SAT_O2 && at.SAT_O2 !== '-');

    // ¿Tiene historia clínica (diagnóstico)?
    var tieneHC = (at.DIAGNOSTICO && at.DIAGNOSTICO !== '-');

    // Receta asociada a esta atención
    var receta = null;
    try {
      var recetas = leerHoja(HOJAS.RECETA_MEDICA).map(limpiarFila);
      for (var r = 0; r < recetas.length; r++) {
        if (recetas[r].ID_ATENCION === at.ID_ATENCION && recetas[r].ESTADO !== 'ANULADO') { receta = recetas[r]; break; }
      }
    } catch(e) {}

    // Descanso asociado a esta atención
    var descanso = null;
    try {
      var descansos = leerHoja(HOJAS.DESCANSO_MEDICO).map(limpiarFila);
      for (var d = 0; d < descansos.length; d++) {
        if (descansos[d].ID_ATENCION === at.ID_ATENCION && descansos[d].ESTADO !== 'ANULADO') { descanso = descansos[d]; break; }
      }
    } catch(e) {}

    var edad = pac ? _rhcCalcularEdad(pac.FECHA_NACIMIENTO) : '';

    return respuestaOK({
      // Paciente
      NOMBRE_PACIENTE: at.NOMBRE_PACIENTE || (pac ? ((pac.NOMBRES||'')+' '+(pac.APELLIDOS||'')).trim() : ''),
      DOCUMENTO: pac ? (pac.NUMERO_DOCUMENTO || '') : '',
      TIPO_DOCUMENTO: pac ? (pac.ID_TIPO_DOCUMENTO || 'DNI') : 'DNI',
      EDAD: edad,
      SEXO: pac ? (pac.SEXO || '') : '',
      FECHA_NACIMIENTO: pac ? (pac.FECHA_NACIMIENTO || '') : '',
      // Médico
      NOMBRE_MEDICO: at.NOMBRE_MEDICO || (med ? ((med.NOMBRES||'')+' '+(med.APELLIDOS||'')).trim() : ''),
      MEDICO_CMP: med ? (med.NUMERO_CMP || '') : '',
      MEDICO_RNE: med ? (med.NUMERO_RNE || '') : '',
      // Atención
      ID_ATENCION: at.ID_ATENCION,
      FECHA_ATENCION: (at.FECHA_ATENCION || at.FECHA_REGISTRO || '').toString().substring(0,10),
      // Flags de disponibilidad
      TIENE_TOPICO: tieneTopico,
      TIENE_HC: tieneHC,
      TIENE_RECETA: !!receta,
      TIENE_DESCANSO: !!descanso,
      // Tópico (signos vitales)
      TOPICO: {
        PA: at.PA || '', TEMPERATURA: at.TEMPERATURA || '', PESO: at.PESO || '', TALLA: at.TALLA || '',
        FREC_CARDIACA: at.FREC_CARDIACA || '', FREC_RESPIRATORIA: at.FREC_RESPIRATORIA || '', SAT_O2: at.SAT_O2 || ''
      },
      // Historia clínica
      HC: {
        MOTIVO: at.MOTIVO || '', ENFERMEDAD_ACTUAL: at.ENFERMEDAD_ACTUAL || '',
        ANT_CARDIOPULMONAR: at.ANT_CARDIOPULMONAR || '', ANT_RENAL: at.ANT_RENAL || '',
        ANT_DIABETES: at.ANT_DIABETES || '', ANT_ALERGIAS: at.ANT_ALERGIAS || '', ANT_OTROS: at.ANT_OTROS || '',
        ANT_NO_PATOLOGICOS: at.ANT_NO_PATOLOGICOS || '', ANT_FAMILIARES: at.ANT_FAMILIARES || '',
        EXPLORACION_FISICA: at.EXPLORACION_FISICA || '', LABORATORIOS_IMAGENES: at.LABORATORIOS_IMAGENES || '',
        DIAGNOSTICO: at.DIAGNOSTICO || '', CIE10: at.CIE10 || '', ORDENES: at.ORDENES || '',
        OBSERVACIONES_HC: at.OBSERVACIONES_HC || '', PROXIMO_CONTROL: at.PROXIMO_CONTROL || ''
      },
      // Receta
      RECETA: receta ? {
        FECHA: (receta.FECHA_RECETA || '').toString().substring(0,10),
        DIAGNOSTICO: receta.DIAGNOSTICO || '',
        MEDICAMENTOS_JSON: receta.MEDICAMENTOS_JSON || '[]',
        INDICACIONES: receta.INDICACIONES || '',
        DIAS_TRATAMIENTO: receta.DIAS_TRATAMIENTO || '',
        PROXIMO_CONTROL: receta.PROXIMO_CONTROL || ''
      } : null,
      // Descanso
      DESCANSO: descanso ? {
        DIAS: descanso.DIAS || '', DESDE: descanso.DESDE || '', HASTA: descanso.HASTA || '',
        TIPO: descanso.TIPO || '', DIAGNOSTICO: descanso.DIAGNOSTICO || '', CIE10: descanso.CIE10 || '',
        INDICACION: descanso.INDICACION || '', OBSERVACION: descanso.OBSERVACION || ''
      } : null,
      // Empresa
      EMPRESA: {
        NOMBRE: emp.NOMBRE || '', RUC: emp.RUC || '', DIRECCION: emp.DIRECCION || '',
        TELEFONO: emp.TELEFONO || '', LOGO_URL: emp.LOGO_URL || '', LEMA: emp.LEMA || '',
        DISTRITO: emp.DISTRITO || '', CIUDAD: emp.CIUDAD || ''
      }
    });
  } catch (err) { return respuestaError('Error al obtener expediente: ' + err.message); }
}

// Helper: edad desde fecha de nacimiento
function _rhcCalcularEdad(fechaNac) {
  try {
    if (!fechaNac) return '';
    var f = new Date(fechaNac);
    if (isNaN(f.getTime())) return '';
    var hoy = new Date();
    var edad = hoy.getFullYear() - f.getFullYear();
    var mes = hoy.getMonth() - f.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < f.getDate())) edad--;
    return edad >= 0 ? edad : '';
  } catch (e) { return ''; }
}
