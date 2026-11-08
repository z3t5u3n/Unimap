import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Asegurar registro de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Renderiza una gráfica de Chart.js en un canvas en memoria con fondo blanco nítido para PDF
 */
function renderizarGraficaAImagen(type, chartData, customOptions = {}) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');

    const pluginFondoBlanco = {
      id: 'custom_canvas_background_color',
      beforeDraw: (chart) => {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    };

    const chartInstance = new ChartJS(canvas, {
      type,
      data: chartData,
      plugins: [pluginFondoBlanco],
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: 2,
        plugins: {
          legend: {
            display: type === 'doughnut' || type === 'pie',
            position: 'right',
            labels: {
              boxWidth: 14,
              font: { size: 12, family: 'Helvetica' },
              color: '#1e293b'
            }
          },
          tooltip: { enabled: false }
        },
        scales: type === 'bar' ? {
          y: {
            beginAtZero: true,
            ticks: { font: { size: 11, family: 'Helvetica' }, color: '#475569' },
            grid: { color: '#e2e8f0' }
          },
          x: {
            ticks: { font: { size: 11, family: 'Helvetica' }, color: '#475569', maxRotation: 25 },
            grid: { display: false }
          }
        } : undefined,
        ...customOptions
      }
    });

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    chartInstance.destroy();
    return dataUrl;
  } catch (err) {
    console.warn('Aviso renderizado offscreen:', err);
    return null;
  }
}

/**
 * Captura las imágenes de las gráficas actualmente montadas en el DOM
 */
function capturarGraficasDelDOM() {
  const cards = document.querySelectorAll('.cardGraficaAdmin');
  const graficas = [];

  cards.forEach((card) => {
    const titulo = card.querySelector('.cardGraficaHeader h4')?.textContent?.trim() || 'Gráfica Analítica';
    const canvas = card.querySelector('canvas');
    if (canvas) {
      try {
        // Dibujar en un canvas blanco para máxima legibilidad en papel/PDF
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(canvas, 0, 0);

        const imagen = tempCanvas.toDataURL('image/png', 1.0);
        graficas.push({ titulo, imagen });
      } catch (e) {
        console.warn('Error capturando canvas:', e);
      }
    }
  });

  return graficas;
}

/**
 * Generador maestro de Reportes PDF con Gráficas para UniMap
 */
export async function generarReportePDFConGraficas({
  seccion = 'general',
  data = {},
  adminUsername = 'admin@Unimap',
  chartConfigs = {}
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  let currentY = 16;

  // 1. ENCABEZADO INSTITUCIONAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 51, 102); // #ff3366 "Uni"
  doc.text('Uni', marginX, currentY);

  doc.setTextColor(37, 99, 235); // #2563eb "Map"
  doc.text('Map', marginX + 13, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CAMPUS VIRTUAL 3D • SISTEMA DE GESTIÓN Y TELEMETRÍA', marginX, currentY + 5);

  // Metadatos a la derecha
  const fechaStr = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.setFontSize(8.5);
  doc.text(`Fecha: ${fechaStr}`, pageWidth - marginX, currentY - 2, { align: 'right' });
  doc.text(`Responsable: ${adminUsername}`, pageWidth - marginX, currentY + 3, { align: 'right' });

  // Línea divisoria decorativa
  currentY += 10;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 6;

  // 2. BANNER DE TÍTULO DE LA SECCIÓN
  const titulosSeccion = {
    usuarios: {
      titulo: 'REPORTE GRÁFICO: USUARIOS Y ROLES EN EL SISTEMA',
      desc: 'Análisis visual de la comunidad universitaria, distribución de roles y tipos de documento.'
    },
    sesiones: {
      titulo: 'REPORTE GRÁFICO: SESIONES E INICIOS DE SESIÓN',
      desc: 'Métricas de acceso, frecuencia temporal de uso y plataformas empleadas.'
    },
    recorridos: {
      titulo: 'REPORTE GRÁFICO: NAVEGACIÓN Y LUGARES RECORRIDOS',
      desc: 'Demanda de espacios en el visor 3D, bloques con mayor afluencia y ranking de áreas.'
    },
    reportes: {
      titulo: 'REPORTE GRÁFICO: INCIDENCIAS Y ESTADO DEL MAPA 3D',
      desc: 'Balance de resolución de fallas técnicas reportadas y clasificación por tipo de error.'
    },
    admins: {
      titulo: 'INFORME GRÁFICO: ADMINISTRADORES DEL SISTEMA',
      desc: 'Distribución de privilegios, roles administrativos y estado operativo de cuentas.'
    },
    auditorias: {
      titulo: 'INFORME GRÁFICO: AUDITORÍA Y TRAZABILIDAD DE CAMBIOS',
      desc: 'Registro inmutable de acciones administrativas agrupadas por módulo y tipo de operación.'
    },
    admin_sesiones: {
      titulo: 'INFORME GRÁFICO: SESIONES Y ACCESOS ADMINISTRATIVOS',
      desc: 'Bitácora de seguridad y concurrencia de sesiones de administradores en el panel.'
    },
    notificaciones: {
      titulo: 'INFORME GRÁFICO: NOTIFICACIONES Y AVISOS A USUARIOS',
      desc: 'Monitoreo de comunicados oficiales, categorías de avisos y estado de visibilidad.'
    },
    encuestas: {
      titulo: 'INFORME GRÁFICO: ENCUESTAS Y SATISFACCIÓN 3D',
      desc: 'Evaluación de usabilidad, distribución de 1 a 5 estrellas y calidad del campus 3D.'
    },
    general: {
      titulo: 'INFORME EJECUTIVO GENERAL CON GRÁFICAS - UNIMAP 3D',
      desc: 'Consolidado visual de estadísticas de las 9 secciones con análisis gráfico de rendimiento.'
    }
  };

  const seccionInfo = titulosSeccion[seccion] || titulosSeccion.general;

  // Caja de título
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 16, 2, 2, 'FD');

  // Acento vertical azul a la izquierda
  doc.setFillColor(37, 99, 235);
  doc.rect(marginX, currentY, 3, 16, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(seccionInfo.titulo, marginX + 6, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(seccionInfo.desc, marginX + 6, currentY + 12);

  currentY += 21;

  // 3. TARJETAS DE KPIs (MÉTRICAS CLAVE)
  const obtenerKPIs = () => {
    switch (seccion) {
      case 'usuarios': {
        const est = (data.usuarios || []).filter((u) => u.tipo_usuario === 2 || (u.nombre_tipo || '').toLowerCase() === 'estudiante').length;
        return [
          { label: 'Total Usuarios', val: (data.usuarios || []).length, col: '#0f172a' },
          { label: 'Estudiantes ITFIP', val: est, col: '#2563eb' },
          { label: 'Visitantes / General', val: (data.usuarios || []).length - est, col: '#10b981' },
          { label: 'Tipos Documento', val: (data.catalogoTiposDocumento || []).length || 3, col: '#8b5cf6' }
        ];
      }
      case 'sesiones': {
        return [
          { label: 'Total Inicios', val: (data.sesiones || []).length, col: '#0f172a' },
          { label: 'Accesos Registrados', val: (data.metricas?.total_sesiones) || (data.sesiones || []).length, col: '#2563eb' },
          { label: 'Usuarios Únicos', val: (data.usuarios || []).length, col: '#10b981' },
          { label: 'Plataformas', val: 'PC & Móvil', col: '#f59e0b' }
        ];
      }
      case 'recorridos': {
        const blqTop = data.estadisticas?.bloques?.[0]?.bloque || 'Bloque E';
        return [
          { label: 'Total Recorridos', val: (data.recorridos || []).length, col: '#0f172a' },
          { label: 'Bloque Más Buscado', val: blqTop, col: '#38bdf8' },
          { label: 'Lugares Únicos', val: (data.ranking_lugares || []).length, col: '#10b981' },
          { label: 'Top Lugar Visitas', val: data.ranking_lugares?.[0]?.total_visitas || 0, col: '#f59e0b' }
        ];
      }
      case 'reportes': {
        const res = (data.reportes || []).filter((r) => r.estado === 'resuelto').length;
        const pend = (data.reportes || []).filter((r) => r.estado === 'pendiente').length;
        return [
          { label: 'Total Incidencias', val: (data.reportes || []).length, col: '#0f172a' },
          { label: 'Bugs Resueltos', val: res, col: '#10b981' },
          { label: 'En Revisión', val: (data.reportes || []).length - res - pend, col: '#f59e0b' },
          { label: 'Pendientes', val: pend, col: '#ef4444' }
        ];
      }
      case 'admins': {
        const sup = (data.admins || []).filter((a) => a.rol === 'superadmin').length;
        return [
          { label: 'Total Admins', val: (data.admins || []).length, col: '#0f172a' },
          { label: 'Superadministradores', val: sup, col: '#8b5cf6' },
          { label: 'Administradores', val: (data.admins || []).length - sup, col: '#2563eb' },
          { label: 'Cuentas Activas', val: (data.admins || []).filter((a) => a.activo !== false).length, col: '#10b981' }
        ];
      }
      case 'auditorias': {
        return [
          { label: 'Eventos Auditados', val: (data.admin_auditorias || []).length, col: '#0f172a' },
          { label: 'Módulos Registrados', val: '6 Módulos', col: '#2563eb' },
          { label: 'Resolución de Bugs', val: (data.admin_auditorias || []).filter((a) => a.tipo_accion === 'RESOLUCION_BUG').length, col: '#10b981' },
          { label: 'Inicios de Sesión Admin', val: (data.admin_auditorias || []).filter((a) => a.tipo_accion === 'LOGIN_ADMIN').length, col: '#64748b' }
        ];
      }
      case 'admin_sesiones': {
        const act = (data.admin_sesiones || []).filter((s) => s.estado === 'activa').length;
        return [
          { label: 'Sesiones Totales', val: (data.admin_sesiones || []).length, col: '#0f172a' },
          { label: 'Sesiones Activas', val: act, col: '#10b981' },
          { label: 'Sesiones Cerradas', val: (data.admin_sesiones || []).length - act, col: '#64748b' },
          { label: 'Administradores', val: (data.admins || []).length, col: '#2563eb' }
        ];
      }
      case 'notificaciones': {
        const act = (data.notificaciones || []).filter((n) => n.activo).length;
        return [
          { label: 'Total Comunicados', val: (data.notificaciones || []).length, col: '#0f172a' },
          { label: 'Visibles en Mapa', val: act, col: '#10b981' },
          { label: 'Ocultas / Archivadas', val: (data.notificaciones || []).length - act, col: '#64748b' },
          { label: 'Alertas Urgentes', val: (data.notificaciones || []).filter((n) => n.tipo === 'urgente').length, col: '#ef4444' }
        ];
      }
      case 'encuestas': {
        const s = data.encuestas_stats || {};
        return [
          { label: 'Total Respuestas', val: s.total_respuestas || 0, col: '#0f172a' },
          { label: 'Calificación General', val: `${s.promedio_general || 0} / 5 ★`, col: '#f59e0b' },
          { label: 'Facilidad de Uso', val: `${s.promedio_facilidad || 0} / 5 ★`, col: '#2563eb' },
          { label: 'Calidad Mapa 3D', val: `${s.promedio_mapa_3d || 0} / 5 ★`, col: '#10b981' }
        ];
      }
      default: { // general
        const s = data.encuestas_stats || {};
        return [
          { label: 'Usuarios Registrados', val: (data.usuarios || []).length, col: '#0f172a' },
          { label: 'Inicios de Sesión', val: (data.sesiones || []).length, col: '#2563eb' },
          { label: 'Recorridos 3D', val: (data.recorridos || []).length, col: '#10b981' },
          { label: 'Satisfacción Promedio', val: `${s.promedio_general || 0} / 5 ★`, col: '#f59e0b' }
        ];
      }
    }
  };

  const kpis = obtenerKPIs();
  const kpiWidth = (pageWidth - marginX * 2 - (kpis.length - 1) * 4) / kpis.length;
  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + idx * (kpiWidth + 4);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(kpiX, currentY, kpiWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.col || '#0f172a');
    doc.text(String(kpi.val), kpiX + kpiWidth / 2, currentY + 6, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label.toUpperCase(), kpiX + kpiWidth / 2, currentY + 11, { align: 'center' });
  });

  currentY += 19;

  // 4. SECCIÓN DE GRÁFICAS ESTADÍSTICAS (IMÁGENES DE CHART.JS)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('VISUALIZACIÓN GRÁFICA INTERACTIVA', marginX, currentY);

  currentY += 4;

  // Obtener imágenes de las gráficas:
  // Intentar primero capturar desde el DOM si la pestaña actual coincide
  let graficasParaPDF = [];
  const graficasDOM = capturarGraficasDelDOM();

  if (seccion === 'general') {
    // Para el reporte general renderizamos 4 gráficas clave
    const g1 = renderizarGraficaAImagen('bar', chartConfigs.recorridosTop5 || { labels: ['Sin datos'], datasets: [{ data: [0] }] });
    const g2 = renderizarGraficaAImagen('doughnut', chartConfigs.recorridosBloques || { labels: ['Sin datos'], datasets: [{ data: [0] }] });
    const g3 = renderizarGraficaAImagen('doughnut', chartConfigs.reportesEstados || { labels: ['Sin datos'], datasets: [{ data: [0] }] });
    const g4 = renderizarGraficaAImagen('bar', chartConfigs.encuestasEstrellas || { labels: ['Sin datos'], datasets: [{ data: [0] }] });

    if (g1) graficasParaPDF.push({ titulo: 'Los 5 Lugares Más Buscados en el Campus 3D', imagen: g1 });
    if (g2) graficasParaPDF.push({ titulo: 'Distribución de Búsquedas por Bloques', imagen: g2 });
    if (g3) graficasParaPDF.push({ titulo: 'Balance de Estados de Reportes y Bugs', imagen: g3 });
    if (g4) graficasParaPDF.push({ titulo: 'Distribución de Calificaciones de 1 a 5 Estrellas', imagen: g4 });
  } else {
    // Renderizado de alta resolución con las configuraciones de la sección
    if (chartConfigs.grafica1 && chartConfigs.grafica1.data) {
      const g1 = renderizarGraficaAImagen(chartConfigs.grafica1.type, chartConfigs.grafica1.data);
      if (g1) graficasParaPDF.push({ titulo: chartConfigs.grafica1.titulo, imagen: g1 });
    }
    if (chartConfigs.grafica2 && chartConfigs.grafica2.data) {
      const g2 = renderizarGraficaAImagen(chartConfigs.grafica2.type, chartConfigs.grafica2.data);
      if (g2) graficasParaPDF.push({ titulo: chartConfigs.grafica2.titulo, imagen: g2 });
    }
    // Fallback: si no hubo datos offscreen, intentar capturar del DOM
    if (graficasParaPDF.length === 0 && graficasDOM.length >= 2) {
      graficasParaPDF = graficasDOM;
    }
  }

  // Insertar las gráficas en el PDF (2 por fila)
  if (graficasParaPDF.length > 0) {
    const chartW = (pageWidth - marginX * 2 - 6) / 2;
    const chartH = 50;

    for (let i = 0; i < Math.min(graficasParaPDF.length, 4); i += 2) {
      const gA = graficasParaPDF[i];
      const gB = graficasParaPDF[i + 1];

      // Gráfica A (Izquierda)
      if (gA && gA.imagen) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, currentY, chartW, chartH + 7, 2, 2, 'FD');

        // Título de la Gráfica
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX + 0.5, currentY + 0.5, chartW - 1, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(gA.titulo, marginX + 3, currentY + 4.5);

        // Imagen de la gráfica
        doc.addImage(gA.imagen, 'PNG', marginX + 2, currentY + 7, chartW - 4, chartH - 2);
      }

      // Gráfica B (Derecha)
      if (gB && gB.imagen) {
        const xB = marginX + chartW + 6;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(xB, currentY, chartW, chartH + 7, 2, 2, 'FD');

        // Título de la Gráfica
        doc.setFillColor(248, 250, 252);
        doc.rect(xB + 0.5, currentY + 0.5, chartW - 1, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(gB.titulo, xB + 3, currentY + 4.5);

        // Imagen de la gráfica
        doc.addImage(gB.imagen, 'PNG', xB + 2, currentY + 7, chartW - 4, chartH - 2);
      }

      currentY += chartH + 11;
    }
  }

  // Si tenemos más de 2 gráficas (ej. reporte general con 4 gráficas), pasamos a página 2 para la tabla
  if (graficasParaPDF.length > 2) {
    doc.addPage();
    currentY = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('REGISTRO CONSOLIDADO Y RESUMEN DE ACTIVIDAD', marginX, currentY);
    currentY += 6;
  }

  // 5. TABLA DE DATOS DETALLADA (AUTOTABLE)
  const generarTablaDetalles = () => {
    switch (seccion) {
      case 'usuarios': {
        const rows = (data.usuarios || []).slice(0, 30).map((u) => [
          u.id_usuario,
          `${u.nombres} ${u.apellidos}`,
          u.numero_documento,
          u.nombre_documento || 'CC',
          (u.tipo_usuario === 2 || (u.nombre_tipo || '').toLowerCase() === 'estudiante') ? 'Estudiante' : 'General',
          u.correo_institucional || '—',
          (u.fecha_sys || '').slice(0, 10)
        ]);
        return {
          head: [['ID Usuario', 'Nombres y Apellidos', 'No. Documento', 'Tipo Doc', 'Rol', 'Correo Inst.', 'Fecha']],
          body: rows
        };
      }
      case 'sesiones': {
        const rows = (data.sesiones || []).slice(0, 35).map((s) => [
          `#${s.id_sesion}`,
          `${s.nombres} ${s.apellidos}`,
          s.ip_acceso || '127.0.0.1',
          (s.dispositivo || 'Navegador Web').slice(0, 40),
          s.fecha_ingreso || '—'
        ]);
        return {
          head: [['ID', 'Usuario', 'IP Acceso', 'Dispositivo / Plataforma', 'Fecha y Hora']],
          body: rows
        };
      }
      case 'recorridos': {
        const rows = (data.recorridos || []).slice(0, 35).map((r) => [
          `#${r.id_recorrido}`,
          r.lugar_mesh,
          r.origen_busqueda || 'buscador',
          `${r.nombres} ${r.apellidos}`,
          r.fecha_busqueda || '—'
        ]);
        return {
          head: [['ID', 'Lugar / Salón Buscado', 'Origen', 'Usuario', 'Fecha Recorrido']],
          body: rows
        };
      }
      case 'reportes': {
        const rows = (data.reportes || []).slice(0, 30).map((rep) => [
          `#${rep.id_reporte}`,
          `${rep.nombres} ${rep.apellidos}`,
          rep.tipo_error,
          rep.lugar_afectado || 'General',
          (rep.estado || '').toUpperCase(),
          (rep.descripcion || '').slice(0, 45),
          rep.fecha_reporte || '—'
        ]);
        return {
          head: [['ID', 'Usuario', 'Tipo Error', 'Lugar Afectado', 'Estado', 'Descripción', 'Fecha']],
          body: rows
        };
      }
      case 'admins': {
        const rows = (data.admins || []).map((a) => [
          `#${a.id_admin}`,
          a.username,
          a.nombre,
          (a.rol || '').toUpperCase(),
          a.activo ? 'ACTIVO' : 'INACTIVO',
          a.ultimo_acceso || 'Sin acceso',
          (a.created_at || '').slice(0, 10)
        ]);
        return {
          head: [['ID', 'Usuario / Correo', 'Nombre', 'Rol', 'Estado', 'Último Acceso', 'Fecha Creación']],
          body: rows
        };
      }
      case 'auditorias': {
        const rows = (data.admin_auditorias || []).slice(0, 35).map((a) => [
          `#${a.id_auditoria}`,
          a.admin_username,
          a.tipo_accion,
          a.modulo,
          (a.descripcion || '').slice(0, 50),
          a.fecha_accion || '—'
        ]);
        return {
          head: [['ID', 'Administrador', 'Acción', 'Módulo', 'Descripción', 'Fecha']],
          body: rows
        };
      }
      case 'admin_sesiones': {
        const rows = (data.admin_sesiones || []).slice(0, 35).map((s) => [
          `#${s.id_sesion}`,
          s.username,
          s.ip_acceso || '127.0.0.1',
          (s.dispositivo || 'Navegador Web').slice(0, 35),
          s.fecha_inicio || '—',
          s.fecha_cierre || '—',
          (s.estado || '').toUpperCase()
        ]);
        return {
          head: [['ID', 'Admin', 'IP Acceso', 'Dispositivo', 'Inicio', 'Cierre', 'Estado']],
          body: rows
        };
      }
      case 'notificaciones': {
        const rows = (data.notificaciones || []).map((n) => [
          `#${n.id_notificacion}`,
          n.titulo,
          (n.tipo || '').toUpperCase(),
          n.activo ? 'VISIBLE' : 'OCULTA',
          (n.mensaje || '').slice(0, 50),
          (n.created_at || '').slice(0, 10)
        ]);
        return {
          head: [['ID', 'Título', 'Categoría', 'Estado', 'Mensaje Resumen', 'Fecha']],
          body: rows
        };
      }
      case 'encuestas': {
        const comentarios = data.encuestas_stats?.comentarios || [];
        const rows = comentarios.slice(0, 25).map((c) => [
          c.id_usuario,
          `${c.calificacion_general} / 5 ★`,
          `${c.facilidad_uso} / 5`,
          `${c.calidad_mapa_3d} / 5`,
          `"${(c.comentarios || 'Sin observaciones').slice(0, 55)}"`,
          c.created_at || '—'
        ]);
        return {
          head: [['Usuario', 'General', 'Facilidad', 'Mapa 3D', 'Comentario Abierto', 'Fecha']],
          body: rows
        };
      }
      default: { // general
        const rows = (data.admin_auditorias || []).slice(0, 25).map((a) => [
          `#${a.id_auditoria}`,
          a.admin_username,
          a.modulo,
          a.tipo_accion,
          (a.descripcion || '').slice(0, 50),
          a.fecha_accion || '—'
        ]);
        return {
          head: [['ID', 'Administrador', 'Módulo', 'Acción', 'Resumen de Auditoría', 'Fecha']],
          body: rows
        };
      }
    }
  };

  const tablaDetalles = generarTablaDetalles();

  // Si la tabla no cabe en la primera página, autoTable maneja la paginación automáticamente
  autoTable(doc, {
    startY: currentY,
    head: tablaDetalles.head,
    body: tablaDetalles.body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: marginX, right: marginX }
  });

  // 6. NUMERACIÓN DE PÁGINAS Y PIE DE PÁGINA INSTITUCIONAL
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `UniMap 3D • Sistema Centralizado de Gestión del Campus • Página ${i} de ${totalPaginas}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // 7. DESCARGA DEL ARCHIVO PDF
  const timestamp = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Reporte_${seccion}_Graficas_UniMap_${timestamp}.pdf`;
  doc.save(nombreArchivo);
}
