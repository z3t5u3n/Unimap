import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import Header from "./Component/Header";
import { API_BASE_URL } from "../config";
import "../CSS/global.css";
import "../CSS/admin.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

// Registrar componentes globales de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Admin() {
  const navigate = useNavigate();

  // 1. Estado de Autenticación Administrativa
  const [adminSesion, setAdminSesion] = useState(() => {
    try {
      const guardado = localStorage.getItem("unimap_admin_session");
      return guardado ? JSON.parse(guardado) : null;
    } catch (e) {
      return null;
    }
  });

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [loginCargando, setLoginCargando] = useState(false);

  // Estados de modales y descargas
  const [modalNuevoAdmin, setModalNuevoAdmin] = useState(false);
  const [formNuevoAdmin, setFormNuevoAdmin] = useState({
    username: "",
    nombre: "",
    password: "",
    rol: "administrador",
  });
  const [nuevoAdminCargando, setNuevoAdminCargando] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [filtroTipoAuditoria, setFiltroTipoAuditoria] = useState("TODOS");

  // Estados de Notificaciones y Encuestas
  const [modalNuevaNoti, setModalNuevaNoti] = useState(false);
  const [formNoti, setFormNoti] = useState({
    titulo: "",
    mensaje: "",
    tipo: "aviso",
    activo: true,
  });
  const [notiCargando, setNotiCargando] = useState(false);

  const [modalNuevaEncuesta, setModalNuevaEncuesta] = useState(false);
  const [formEncuesta, setFormEncuesta] = useState({
    titulo: "",
    descripcion: "",
    activo: true,
  });
  const [encuestaCargando, setEncuestaCargando] = useState(false);

  // Estados principales de datos
  const [data, setData] = useState({
    usuarios: [],
    sesiones: [],
    recorridos: [],
    reportes: [],
    admins: [],
    admin_sesiones: [],
    admin_auditorias: [],
    tipos_usuario: [],
    ranking_lugares: [],
    notificaciones: [],
    encuestas: [],
    encuestas_stats: {
      total_respuestas: 0,
      promedio_general: 0,
      promedio_facilidad: 0,
      promedio_mapa_3d: 0,
      estrellas: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      comentarios: [],
    },
    metricas: {
      total_usuarios: 0,
      total_sesiones: 0,
      total_recorridos: 0,
      total_reportes: 0,
      reportes_pendientes: 0,
      reportes_resueltos: 0,
      reportes_en_revision: 0,
      total_admins: 0,
      total_auditorias: 0,
      total_notificaciones: 0,
      total_notificaciones_activas: 0,
      total_encuestas_respuestas: 0,
      satisfaccion_promedio: 0,
      mes_top: null,
      dia_top: null,
      bloque_top: null,
    },
    estadisticas: {
      meses: [],
      dias_semana: [],
      bloques: [],
    },
  });
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState("usuarios");
  const [busqueda, setBusqueda] = useState("");

  // Iniciar sesión administrativa
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(loginForm),
      });
      const res = await response.json();
      if (response.ok) {
        const sesion = { ...res.admin, id_sesion: res.id_sesion };
        setAdminSesion(sesion);
        localStorage.setItem("unimap_admin_session", JSON.stringify(sesion));
      } else {
        setLoginError(res.message || "Credenciales administrativas incorrectas.");
      }
    } catch (err) {
      setLoginError("Error de conexión con el servidor.");
    } finally {
      setLoginCargando(false);
    }
  };

  // Cerrar sesión administrativa
  const handleAdminLogout = async () => {
    try {
      if (adminSesion) {
        await fetch(`${API_BASE_URL}/admin/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            id_sesion: adminSesion.id_sesion,
            admin_username: adminSesion.username,
          }),
        });
      }
    } catch (err) {
      console.error("Error al cerrar sesión admin:", err);
    } finally {
      localStorage.removeItem("unimap_admin_session");
      setAdminSesion(null);
    }
  };

  // Cargar datos desde Laravel
  const cargarDashboard = useCallback(async () => {
    setCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard`);
      const json = await response.json();
      if (response.ok) {
        setData(json);
      } else {
        alert("Error al cargar datos del panel: " + (json.message || ""));
      }
    } catch (err) {
      console.error("Error de conexión al cargar admin dashboard:", err);
    } finally {
      setCargando(false);
    }
  }, []);

  // Garantizar captura y desbloqueo de teclado frente a instancias de Unity WebGL
  useEffect(() => {
    const handleKeyShield = (e) => {
      const tag = e.target && e.target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target && e.target.isContentEditable)
      ) {
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
      }
    };
    window.addEventListener("keydown", handleKeyShield, true);
    window.addEventListener("keyup", handleKeyShield, true);
    window.addEventListener("keypress", handleKeyShield, true);
    document.addEventListener("keydown", handleKeyShield, true);
    document.addEventListener("keyup", handleKeyShield, true);
    document.addEventListener("keypress", handleKeyShield, true);

    return () => {
      window.removeEventListener("keydown", handleKeyShield, true);
      window.removeEventListener("keyup", handleKeyShield, true);
      window.removeEventListener("keypress", handleKeyShield, true);
      document.removeEventListener("keydown", handleKeyShield, true);
      document.removeEventListener("keyup", handleKeyShield, true);
      document.removeEventListener("keypress", handleKeyShield, true);
    };
  }, []);

  useEffect(() => {
    if (adminSesion) {
      cargarDashboard();
    }
  }, [adminSesion, cargarDashboard]);

  // Mapeo de nombres legibles para reportes PDF
  const nombresSeccion = {
    usuarios: "Usuarios",
    sesiones: "Sesiones_Usuarios",
    recorridos: "Recorridos_Campus",
    reportes: "Incidencias_Mapa",
    notificaciones: "Notificaciones_Sistema",
    encuestas: "Encuestas_Satisfaccion",
    admins: "Administradores",
    auditorias: "Auditoria_Cambios",
    admin_sesiones: "Sesiones_Admin",
  };

  const etiquetasTab = {
    usuarios: "Usuarios",
    sesiones: "Sesiones",
    recorridos: "Recorridos",
    reportes: "Incidencias",
    notificaciones: "Notificaciones",
    encuestas: "Encuestas",
    admins: "Admins",
    auditorias: "Auditoría",
    admin_sesiones: "Sesiones Admin",
  };

  // Referencias a los componentes de gráficas para exportación/descarga
  const chartUsuariosRolRef = useRef(null);
  const chartUsuariosMesRef = useRef(null);
  const chartSesionesDiaRef = useRef(null);
  const chartSesionesDispRef = useRef(null);
  const chartRecorridosBloqueRef = useRef(null);
  const chartRecorridosTopRef = useRef(null);
  const chartReportesEstadoRef = useRef(null);
  const chartReportesTipoRef = useRef(null);
  const chartEncuestasEstrellasRef = useRef(null);
  const chartEncuestasAspectosRef = useRef(null);

  // Helper para capturar dataURL (base64) de una gráfica Chart.js
  const capturarDataUrlGrafica = (chartRef) => {
    if (!chartRef || !chartRef.current) return null;
    const chart = chartRef.current;
    if (typeof chart.toBase64Image === "function") {
      return chart.toBase64Image();
    }
    if (chart.canvas && typeof chart.canvas.toDataURL === "function") {
      return chart.canvas.toDataURL("image/png");
    }
    return null;
  };

  // Helper para obtener las métricas KPI de cualquier sección para el reporte PDF
  const obtenerKpisSeccion = (seccion) => {
    switch (seccion) {
      case "usuarios":
        return [
          { label: "Total Usuarios", valor: data.metricas.total_usuarios },
          {
            label: "Estudiantes ITFIP",
            valor: data.usuarios.filter((u) => u.id_tipo_usuario === 2 || u.nombre_tipo?.toLowerCase().includes("estudiante")).length,
          },
          {
            label: "Visitantes",
            valor: data.usuarios.filter((u) => u.id_tipo_usuario === 1 || u.nombre_tipo?.toLowerCase().includes("general")).length,
          },
          { label: "Roles Registrados", valor: data.tipos_usuario?.length || 3 },
        ];
      case "sesiones":
        return [
          { label: "Total Sesiones", valor: data.metricas.total_sesiones },
          { label: "Día Más Activo", valor: data.metricas.dia_top?.nombre || "N/A" },
          { label: "Sesiones PC", valor: data.sesiones.filter((s) => !/Android|iPhone|Mobile/i.test(s.dispositivo || "")).length },
          { label: "Sesiones Móvil", valor: data.sesiones.filter((s) => /Android|iPhone|Mobile/i.test(s.dispositivo || "")).length },
        ];
      case "recorridos":
        return [
          { label: "Total Recorridos", valor: data.metricas.total_recorridos },
          { label: "Zona Más Frecuente", valor: data.metricas.bloque_top?.bloque || "N/A" },
          { label: "Top Lugares", valor: data.ranking_lugares?.length || 0 },
        ];
      case "reportes":
        return [
          { label: "Total Reportes", valor: data.metricas.total_reportes },
          { label: "Resueltos", valor: data.metricas.reportes_resueltos },
          { label: "En Revisión", valor: data.metricas.reportes_en_revision },
          { label: "Pendientes", valor: data.metricas.reportes_pendientes },
        ];
      case "notificaciones":
        return [
          { label: "Total Avisos", valor: data.notificaciones?.length || 0 },
          { label: "Activos", valor: data.notificaciones?.filter((n) => n.activo).length || 0 },
          { label: "Inactivos", valor: data.notificaciones?.filter((n) => !n.activo).length || 0 },
          { label: "Mantenimientos", valor: data.notificaciones?.filter((n) => n.tipo === "mantenimiento").length || 0 },
        ];
      case "encuestas":
        return [
          { label: "Total Respuestas", valor: data.encuestas_stats?.total_respuestas || 0 },
          { label: "Satisfacción Promedio", valor: `${data.encuestas_stats?.promedio_general || 0} / 5` },
          { label: "Facilidad de Uso", valor: `${data.encuestas_stats?.promedio_facilidad || 0} / 5` },
          { label: "Calidad Mapa 3D", valor: `${data.encuestas_stats?.promedio_mapa_3d || 0} / 5` },
        ];
      case "admins":
        return [
          { label: "Total Admins", valor: data.admins?.length || 0 },
          { label: "Superadmins", valor: data.admins?.filter((a) => a.rol === "superadmin").length || 0 },
          { label: "Administradores", valor: data.admins?.filter((a) => a.rol === "administrador").length || 0 },
          { label: "Cuentas Activas", valor: data.admins?.filter((a) => a.activo).length || 0 },
        ];
      case "auditorias":
        return [
          { label: "Total Eventos", valor: data.metricas.total_auditorias },
          { label: "Bugs Resueltos", valor: data.admin_auditorias?.filter((a) => a.tipo_accion === "RESOLUCION_BUG").length || 0 },
          { label: "Notificaciones", valor: data.admin_auditorias?.filter((a) => a.tipo_accion?.includes("NOTIFICACION")).length || 0 },
          { label: "Inicios Sesión", valor: data.admin_auditorias?.filter((a) => a.tipo_accion === "INICIO_SESION").length || 0 },
        ];
      case "admin_sesiones":
        return [
          { label: "Sesiones Totales", valor: data.admin_sesiones?.length || 0 },
          { label: "Activas en Curso", valor: data.admin_sesiones?.filter((s) => s.estado === "activa").length || 0 },
          { label: "Sesiones Cerradas", valor: data.admin_sesiones?.filter((s) => s.estado === "cerrada").length || 0 },
        ];
      default:
        return [];
    }
  };

  // Helper para mapear las gráficas de la sección activa
  const obtenerGraficasSeccion = (seccion) => {
    switch (seccion) {
      case "usuarios":
        return [
          { titulo: "Distribución de Usuarios por Rol", ref: chartUsuariosRolRef },
          { titulo: "Registros de Usuarios por Mes", ref: chartUsuariosMesRef },
        ];
      case "sesiones":
        return [
          { titulo: "Inicios de Sesión por Día de la Semana", ref: chartSesionesDiaRef },
          { titulo: "Dispositivos y Plataformas de Acceso", ref: chartSesionesDispRef },
        ];
      case "recorridos":
        return [
          { titulo: "Distribución de Búsquedas por Bloque / Zona", ref: chartRecorridosBloqueRef },
          { titulo: "Top Lugares Más Frecuentados", ref: chartRecorridosTopRef },
        ];
      case "reportes":
        return [
          { titulo: "Estado de Resolución de Reportes", ref: chartReportesEstadoRef },
          { titulo: "Incidencias por Tipo de Problema", ref: chartReportesTipoRef },
        ];
      case "encuestas":
        return [
          { titulo: "Distribución de Calificaciones (1 a 5 Estrellas)", ref: chartEncuestasEstrellasRef },
          { titulo: "Promedios por Aspectos Evaluados (1 a 5)", ref: chartEncuestasAspectosRef },
        ];
      default:
        return [];
    }
  };

  // Descargar Reporte en PDF por sección activa
  const handleDescargarPDF = async (seccionObjetivo = tabActiva) => {
    setDescargandoPdf(true);
    try {
      const nombreSec = nombresSeccion[seccionObjetivo] || "General";
      const graficasItems = obtenerGraficasSeccion(seccionObjetivo);

      // Si la sección no tiene gráficas (admins, auditorias, admin_sesiones), descargar desde el backend oficial
      if (!graficasItems || graficasItems.length === 0) {
        const url = `${API_BASE_URL}/admin/reportes/pdf?seccion=${encodeURIComponent(
          seccionObjetivo
        )}&admin_username=${encodeURIComponent(adminSesion?.username || "admin@Unimap")}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Error al generar PDF del servidor");
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute(
          "download",
          `Reporte_${nombreSec}_UniMap_${new Date().toISOString().slice(0, 10)}.pdf`
        );
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        return;
      }

      // Si tiene gráficas interactivas, renderizar con jsPDF de alta fidelidad
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = 14;

      // Encabezado principal elegante
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(margin, y, pageWidth - margin * 2, 22, "F");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text("UNIMAP 3D ITFIP - REPORTE OFICIAL", margin + 6, y + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Sección: ${etiquetasTab[seccionObjetivo] || nombreSec}  |  Responsable: ${adminSesion?.username || "admin@Unimap"}  |  Fecha: ${new Date().toLocaleString()}`,
        margin + 6,
        y + 16
      );

      y += 28;

      // Métricas KPI destacadas
      const kpis = obtenerKpisSeccion(seccionObjetivo);
      if (kpis && kpis.length > 0) {
        const cardWidth = (pageWidth - margin * 2 - (kpis.length - 1) * 3) / kpis.length;
        kpis.forEach((kpi, idx) => {
          const xCard = margin + idx * (cardWidth + 3);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(xCard, y, cardWidth, 16, 2, 2, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(String(kpi.valor), xCard + cardWidth / 2, y + 7, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(kpi.label, xCard + cardWidth / 2, y + 13, { align: "center" });
        });
        y += 22;
      }

      // Gráficas de la sección capturadas desde Canvas
      graficasItems.forEach((g) => {
        const imgBase64 = capturarDataUrlGrafica(g.ref);
        if (imgBase64) {
          if (y + 92 > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }

          // Título de la Gráfica
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(30, 41, 59);
          doc.text(g.titulo, margin, y);
          y += 4;

          // Recuadro contenedor de la gráfica
          const chartBoxWidth = pageWidth - margin * 2;
          const chartBoxHeight = 84;

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin, y, chartBoxWidth, chartBoxHeight, 2, 2, "FD");

          doc.addImage(
            imgBase64,
            "PNG",
            margin + 4,
            y + 3,
            chartBoxWidth - 8,
            chartBoxHeight - 6,
            undefined,
            "FAST"
          );

          y += chartBoxHeight + 8;
        }
      });

      // Pie de Página
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("UniMap 3D ITFIP • Campus Universitario El Espinal, Tolima", margin, pageHeight - 8);

      doc.save(`Reporte_${nombreSec}_UniMap_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      alert("No se pudo generar el reporte en PDF: " + err.message);
    } finally {
      setDescargandoPdf(false);
    }
  };

  // Handlers para Notificaciones y Encuestas
  const handleCrearNotificacion = async (e) => {
    e.preventDefault();
    setNotiCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...formNoti,
          admin_username: adminSesion?.username || "admin@Unimap",
        }),
      });
      const res = await response.json();
      if (response.ok) {
        alert("¡Notificación oficial creada y transmitida a los usuarios!");
        setModalNuevaNoti(false);
        setFormNoti({ titulo: "", mensaje: "", tipo: "aviso", activo: true });
        cargarDashboard();
      } else {
        alert(res.mensaje || "Error al crear la notificación.");
      }
    } catch (err) {
      alert("Error de conexión al guardar notificación.");
    } finally {
      setNotiCargando(false);
    }
  };

  const handleToggleNotificacion = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notificaciones/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ admin_username: adminSesion?.username || "admin@Unimap" }),
      });
      if (response.ok) {
        cargarDashboard();
      } else {
        alert("No se pudo cambiar el estado de la notificación.");
      }
    } catch (err) {
      alert("Error de conexión al alternar notificación.");
    }
  };

  const handleEliminarNotificacion = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta notificación del sistema?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notificaciones/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ admin_username: adminSesion?.username || "admin@Unimap" }),
      });
      if (response.ok) {
        cargarDashboard();
      } else {
        alert("No se pudo eliminar la notificación.");
      }
    } catch (err) {
      alert("Error de conexión al eliminar notificación.");
    }
  };

  const handleCrearEncuesta = async (e) => {
    e.preventDefault();
    setEncuestaCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/encuestas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...formEncuesta,
          admin_username: adminSesion?.username || "admin@Unimap",
        }),
      });
      const res = await response.json();
      if (response.ok) {
        alert("¡Encuesta creada exitosamente!");
        setModalNuevaEncuesta(false);
        setFormEncuesta({ titulo: "", descripcion: "", activo: true });
        cargarDashboard();
      } else {
        alert(res.mensaje || "Error al crear la encuesta.");
      }
    } catch (err) {
      alert("Error de conexión al crear encuesta.");
    } finally {
      setEncuestaCargando(false);
    }
  };

  const handleToggleEncuesta = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/encuestas/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ admin_username: adminSesion?.username || "admin@Unimap" }),
      });
      if (response.ok) {
        cargarDashboard();
      } else {
        alert("No se pudo cambiar el estado de la encuesta.");
      }
    } catch (err) {
      alert("Error de conexión al alternar encuesta.");
    }
  };

  // Registrar nuevo administrador
  const handleCrearAdmin = async (e) => {
    e.preventDefault();
    setNuevoAdminCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/crear`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...formNuevoAdmin,
          creador_username: adminSesion?.username || "admin@Unimap",
        }),
      });
      const res = await response.json();
      if (response.ok) {
        alert("¡Administrador registrado exitosamente!");
        setModalNuevoAdmin(false);
        setFormNuevoAdmin({ username: "", nombre: "", password: "", rol: "administrador" });
        cargarDashboard();
      } else {
        alert(res.message || "Error al crear administrador.");
      }
    } catch (err) {
      alert("Error de conexión al registrar administrador.");
    } finally {
      setNuevoAdminCargando(false);
    }
  };

  // Actualizar estado de reporte con AUDITORÍA AUTOMÁTICA
  const handleCambiarEstado = async (idReporte, nuevoEstado) => {
    let notaAdmin = "";
    if (nuevoEstado === "resuelto") {
      const resp = prompt("Ingresa una nota breve sobre cómo se resolvió este error/bug (opcional):");
      if (resp === null) return;
      notaAdmin = resp;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/reportes/${idReporte}/estado`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            estado: nuevoEstado,
            admin_username: adminSesion?.username || "admin@Unimap",
            id_admin: adminSesion?.id_admin || 1,
            nota_admin: notaAdmin,
          }),
        }
      );
      const res = await response.json();
      if (response.ok) {
        setData((prev) => {
          const nuevosReportes = (prev.reportes || []).map((r) =>
            r.id_reporte === idReporte ? { ...r, estado: nuevoEstado } : r
          );
          const pendientes = nuevosReportes.filter((r) => r.estado === "pendiente").length;
          const resueltos = nuevosReportes.filter((r) => r.estado === "resuelto").length;
          const revision = nuevosReportes.filter((r) => r.estado === "en_revision").length;
          
          const nuevasAuditorias = res.auditoria
            ? [res.auditoria, ...(prev.admin_auditorias || [])]
            : (prev.admin_auditorias || []);

          return {
            ...prev,
            reportes: nuevosReportes,
            admin_auditorias: nuevasAuditorias,
            metricas: {
              ...prev.metricas,
              reportes_pendientes: pendientes,
              reportes_resueltos: resueltos,
              reportes_en_revision: revision,
              total_auditorias: (prev.metricas?.total_auditorias || 0) + 1,
            },
          };
        });
        alert(`Incidencia #${idReporte} actualizada a '${nuevoEstado}' y registrada en la tabla de auditoría.`);
      } else {
        alert("No se pudo actualizar el estado del reporte: " + (res.message || ""));
      }
    } catch (err) {
      console.error("Error al actualizar estado del reporte:", err);
      alert("Error de conexión al actualizar estado.");
    }
  };

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return data.usuarios;
    const q = busqueda.toLowerCase();
    return data.usuarios.filter(
      (u) =>
        (u.id_usuario && u.id_usuario.toLowerCase().includes(q)) ||
        (u.nombres && u.nombres.toLowerCase().includes(q)) ||
        (u.apellidos && u.apellidos.toLowerCase().includes(q)) ||
        (u.numero_documento && u.numero_documento.includes(q)) ||
        (u.correo_institucional && u.correo_institucional.toLowerCase().includes(q))
    );
  }, [busqueda, data.usuarios]);

  // Filtrado de sesiones
  const sesionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return data.sesiones;
    const q = busqueda.toLowerCase();
    return data.sesiones.filter(
      (s) =>
        (s.id_usuario && s.id_usuario.toLowerCase().includes(q)) ||
        (s.nombres && s.nombres.toLowerCase().includes(q)) ||
        (s.ip_acceso && s.ip_acceso.toLowerCase().includes(q))
    );
  }, [busqueda, data.sesiones]);

  // Filtrado de recorridos
  const recorridosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return data.recorridos;
    const q = busqueda.toLowerCase();
    return data.recorridos.filter(
      (r) =>
        (r.id_usuario && r.id_usuario.toLowerCase().includes(q)) ||
        (r.lugar_mesh && r.lugar_mesh.toLowerCase().includes(q)) ||
        (r.nombres && r.nombres.toLowerCase().includes(q)) ||
        (r.origen_busqueda && r.origen_busqueda.toLowerCase().includes(q))
    );
  }, [busqueda, data.recorridos]);

  // Estadísticas derivadas de los recorridos de la base de datos
  const estadisticasRecorridos = useMemo(() => {
    const lista = data.recorridos || [];
    const conteo = {};
    lista.forEach((r) => {
      const nom = r.lugar_mesh || "Lugar no especificado";
      conteo[nom] = (conteo[nom] || 0) + 1;
    });

    const ranking = Object.entries(conteo)
      .map(([lugar, total]) => ({ lugar, total }))
      .sort((a, b) => b.total - a.total);

    return {
      totalRecorridos: lista.length,
      lugaresUnicos: ranking.length,
      lugarTop: ranking[0] || null,
      topCinco: ranking.slice(0, 5),
    };
  }, [data.recorridos]);

  // Filtrado de reportes de bugs
  const reportesFiltrados = useMemo(() => {
    if (!data.reportes) return [];
    if (!busqueda.trim()) return data.reportes;
    const q = busqueda.toLowerCase();
    return data.reportes.filter(
      (r) =>
        (r.id_usuario && r.id_usuario.toLowerCase().includes(q)) ||
        (r.nombres && r.nombres.toLowerCase().includes(q)) ||
        (r.tipo_error && r.tipo_error.toLowerCase().includes(q)) ||
        (r.lugar_afectado && r.lugar_afectado.toLowerCase().includes(q)) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q)) ||
        (r.estado && r.estado.toLowerCase().includes(q))
    );
  }, [busqueda, data.reportes]);

  // Filtrado de administradores
  const adminsFiltrados = useMemo(() => {
    if (!data.admins) return [];
    if (!busqueda.trim()) return data.admins;
    const q = busqueda.toLowerCase();
    return data.admins.filter(
      (a) =>
        (a.username && a.username.toLowerCase().includes(q)) ||
        (a.nombre && a.nombre.toLowerCase().includes(q)) ||
        (a.rol && a.rol.toLowerCase().includes(q))
    );
  }, [busqueda, data.admins]);

  // Filtrado de auditorías
  const auditoriasFiltradas = useMemo(() => {
    if (!data.admin_auditorias) return [];
    let lista = data.admin_auditorias;
    if (filtroTipoAuditoria !== "TODOS") {
      lista = lista.filter((aud) => aud.tipo_accion === filtroTipoAuditoria);
    }
    if (!busqueda.trim()) return lista;
    const q = busqueda.toLowerCase();
    return lista.filter(
      (aud) =>
        (aud.admin_username && aud.admin_username.toLowerCase().includes(q)) ||
        (aud.tipo_accion && aud.tipo_accion.toLowerCase().includes(q)) ||
        (aud.modulo && aud.modulo.toLowerCase().includes(q)) ||
        (aud.descripcion && aud.descripcion.toLowerCase().includes(q)) ||
        (aud.ip_origen && aud.ip_origen.includes(q))
    );
  }, [busqueda, data.admin_auditorias, filtroTipoAuditoria]);

  // Filtrado de sesiones de administradores
  const adminSesionesFiltradas = useMemo(() => {
    if (!data.admin_sesiones) return [];
    if (!busqueda.trim()) return data.admin_sesiones;
    const q = busqueda.toLowerCase();
    return data.admin_sesiones.filter(
      (s) =>
        (s.username && s.username.toLowerCase().includes(q)) ||
        (s.ip_acceso && s.ip_acceso.includes(q)) ||
        (s.dispositivo && s.dispositivo.toLowerCase().includes(q)) ||
        (s.estado && s.estado.toLowerCase().includes(q))
    );
  }, [busqueda, data.admin_sesiones]);

  // Filtrado de notificaciones
  const notificacionesFiltradas = useMemo(() => {
    if (!data.notificaciones) return [];
    if (!busqueda.trim()) return data.notificaciones;
    const q = busqueda.toLowerCase();
    return data.notificaciones.filter(
      (n) =>
        (n.titulo && n.titulo.toLowerCase().includes(q)) ||
        (n.mensaje && n.mensaje.toLowerCase().includes(q)) ||
        (n.tipo && n.tipo.toLowerCase().includes(q)) ||
        (n.creado_por && n.creado_por.toLowerCase().includes(q))
    );
  }, [busqueda, data.notificaciones]);

  // Filtrado de comentarios de encuestas
  const comentariosFiltrados = useMemo(() => {
    const list = data.encuestas_stats?.comentarios || [];
    if (!busqueda.trim()) return list;
    const q = busqueda.toLowerCase();
    return list.filter(
      (c) =>
        (c.comentarios && c.comentarios.toLowerCase().includes(q)) ||
        (c.nombres && c.nombres.toLowerCase().includes(q)) ||
        (c.apellidos && c.apellidos.toLowerCase().includes(q))
    );
  }, [busqueda, data.encuestas_stats]);

  // ==========================================
  // CONFIGURACIÓN DE TEMA Y ESTADÍSTICAS GRÁFICAS
  // ==========================================
  const [tema, setTema] = useState(() => {
    return localStorage.getItem("unimap_theme") || "dark";
  });

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail && e.detail.tema) {
        setTema(e.detail.tema);
      } else {
        setTema(localStorage.getItem("unimap_theme") || "dark");
      }
    };
    window.addEventListener("unimap_theme_changed", handleThemeChange);
    return () => window.removeEventListener("unimap_theme_changed", handleThemeChange);
  }, []);

  const esOscuro = tema === "dark";
  const colorTexto = esOscuro ? "#94a3b8" : "#475569";
  const colorBordeGrid = esOscuro ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const colorTooltipBg = esOscuro ? "#1e293b" : "#ffffff";
  const colorTooltipTexto = esOscuro ? "#f8fafc" : "#0f172a";

  const getBarOptions = (horizontal = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colorTooltipBg,
        titleColor: colorTooltipTexto,
        bodyColor: colorTooltipTexto,
        borderColor: colorBordeGrid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        ticks: { color: colorTexto, font: { size: 11 } },
        grid: { color: colorBordeGrid, drawBorder: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: colorTexto, font: { size: 11 }, precision: 0 },
        grid: { color: colorBordeGrid, drawBorder: false },
      },
    },
  });

  const getDoughnutOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: colorTexto,
          font: { size: 11 },
          padding: 14,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: colorTooltipBg,
        titleColor: colorTooltipTexto,
        bodyColor: colorTooltipTexto,
        borderColor: colorBordeGrid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    cutout: "68%",
  });

  // 1. Gráficas de Usuarios
  const graficaUsuariosRol = useMemo(() => {
    const conteo = {};
    (data.usuarios || []).forEach((u) => {
      const rol = u.nombre_tipo || (u.id_tipo_usuario === 2 ? "Estudiante" : "Visitante / General");
      conteo[rol] = (conteo[rol] || 0) + 1;
    });
    const labels = Object.keys(conteo);
    const valores = Object.values(conteo);
    return {
      labels: labels.length ? labels : ["Sin datos"],
      datasets: [
        {
          data: valores.length ? valores : [0],
          backgroundColor: ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"],
          borderColor: esOscuro ? "#1e293b" : "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [data.usuarios, esOscuro]);

  const graficaUsuariosMes = useMemo(() => {
    const meses = data.estadisticas?.meses || [];
    if (!meses.length) {
      return {
        labels: ["Sin registros"],
        datasets: [{ data: [0], backgroundColor: "#3b82f6" }],
      };
    }
    return {
      labels: meses.map((m) => m.nombre || m.clave),
      datasets: [
        {
          label: "Usuarios Registrados",
          data: meses.map((m) => m.cantidad),
          backgroundColor: "rgba(59, 130, 246, 0.75)",
          borderColor: "#3b82f6",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [data.estadisticas?.meses]);

  // 2. Gráficas de Sesiones
  const graficaSesionesDia = useMemo(() => {
    const dias = data.estadisticas?.dias_semana || [];
    return {
      labels: dias.map((d) => d.nombre),
      datasets: [
        {
          label: "Inicios de Sesión",
          data: dias.map((d) => d.cantidad),
          backgroundColor: "rgba(99, 102, 241, 0.75)",
          borderColor: "#6366f1",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [data.estadisticas?.dias_semana]);

  const graficaSesionesDispositivo = useMemo(() => {
    const conteo = {};
    (data.sesiones || []).forEach((s) => {
      const dev = s.dispositivo || "Navegador Web";
      let categoria = "Escritorio (PC)";
      if (/Android|iPhone|Mobile|iPad/i.test(dev)) {
        categoria = "Móvil / Tablet";
      } else if (/Chrome/i.test(dev)) {
        categoria = "Chrome Desktop";
      } else if (/Firefox/i.test(dev)) {
        categoria = "Firefox Desktop";
      } else if (/Safari/i.test(dev)) {
        categoria = "Safari Desktop";
      } else if (/Edge/i.test(dev)) {
        categoria = "Edge Desktop";
      }
      conteo[categoria] = (conteo[categoria] || 0) + 1;
    });
    const labels = Object.keys(conteo);
    const valores = Object.values(conteo);
    return {
      labels: labels.length ? labels : ["Web General"],
      datasets: [
        {
          data: valores.length ? valores : [data.sesiones.length || 1],
          backgroundColor: ["#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981"],
          borderColor: esOscuro ? "#1e293b" : "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [data.sesiones, esOscuro]);

  // 3. Gráficas de Recorridos
  const graficaRecorridosBloque = useMemo(() => {
    const bloques = data.estadisticas?.bloques || [];
    return {
      labels: bloques.map((b) => b.bloque),
      datasets: [
        {
          label: "Búsquedas / Visitas",
          data: bloques.map((b) => b.cantidad),
          backgroundColor: [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#8b5cf6",
            "#ec4899",
            "#06b6d4",
            "#64748b",
          ],
          borderColor: esOscuro ? "#1e293b" : "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [data.estadisticas?.bloques, esOscuro]);

  const graficaRecorridosTop = useMemo(() => {
    const top = (estadisticasRecorridos.topCinco || []).slice(0, 6);
    return {
      labels: top.map((t) => t.lugar),
      datasets: [
        {
          label: "Visitas Registradas",
          data: top.map((t) => t.total),
          backgroundColor: "rgba(245, 158, 11, 0.75)",
          borderColor: "#f59e0b",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [estadisticasRecorridos.topCinco]);

  // 4. Gráficas de Reportes
  const graficaReportesEstado = useMemo(() => {
    const pendientes = (data.reportes || []).filter((r) => r.estado === "pendiente").length;
    const revision = (data.reportes || []).filter((r) => r.estado === "en_revision").length;
    const resueltos = (data.reportes || []).filter((r) => r.estado === "resuelto").length;
    return {
      labels: ["Pendientes", "En Revisión", "Resueltos"],
      datasets: [
        {
          data: [pendientes, revision, resueltos],
          backgroundColor: ["#f59e0b", "#3b82f6", "#10b981"],
          borderColor: esOscuro ? "#1e293b" : "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [data.reportes, esOscuro]);

  const graficaReportesTipo = useMemo(() => {
    const conteo = {};
    (data.reportes || []).forEach((r) => {
      const t = r.tipo_error || "general";
      const format = t.charAt(0).toUpperCase() + t.slice(1);
      conteo[format] = (conteo[format] || 0) + 1;
    });
    const labels = Object.keys(conteo);
    const valores = Object.values(conteo);
    return {
      labels: labels.length ? labels : ["Sin reportes"],
      datasets: [
        {
          label: "Incidencias Reportadas",
          data: valores.length ? valores : [0],
          backgroundColor: "rgba(239, 68, 68, 0.75)",
          borderColor: "#ef4444",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [data.reportes]);

  // 5. Gráficas de Encuestas de Satisfacción
  const graficaEncuestasEstrellas = useMemo(() => {
    const estrellas = data.encuestas_stats?.estrellas || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return {
      labels: ["1 Estrella", "2 Estrellas", "3 Estrellas", "4 Estrellas", "5 Estrellas"],
      datasets: [
        {
          label: "Votos Recibidos",
          data: [
            estrellas[1] || 0,
            estrellas[2] || 0,
            estrellas[3] || 0,
            estrellas[4] || 0,
            estrellas[5] || 0,
          ],
          backgroundColor: [
            "rgba(239, 68, 68, 0.8)",
            "rgba(249, 115, 22, 0.8)",
            "rgba(234, 179, 8, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
          ],
          borderColor: ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#10b981"],
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [data.encuestas_stats]);

  const graficaEncuestasAspectos = useMemo(() => {
    const stats = data.encuestas_stats || {};
    return {
      labels: ["Satisfacción General", "Facilidad de Uso", "Calidad Mapa 3D"],
      datasets: [
        {
          label: "Puntuación Promedio (1 a 5)",
          data: [
            stats.promedio_general || 0,
            stats.promedio_facilidad || 0,
            stats.promedio_mapa_3d || 0,
          ],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(139, 92, 246, 0.8)",
          ],
          borderColor: ["#3b82f6", "#10b981", "#8b5cf6"],
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  }, [data.encuestas_stats]);


  // Si no hay sesión administrativa iniciada, mostrar el formulario de acceso
  if (!adminSesion) {
    return (
      <div className="AdminPage">
        <Header />
        <div className="adminLoginWrapper">
          <div className="adminLoginCard">
            <div className="adminLoginHeader">
              <h2>Acceso Administrativo</h2>
              <p>Panel de Control y Gestión Central UniMap</p>
            </div>

            {loginError && <div className="adminErrorAlert">{loginError}</div>}

            <form onSubmit={handleAdminLogin} className="adminLoginForm">
              <div className="adminFormGroup">
                <label>Usuario Administrador:</label>
                <input
                  id="admin_username"
                  name="username"
                  type="text"
                  placeholder="admin@Unimap"
                  autoComplete="username"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  required
                />
              </div>

              <div className="adminFormGroup">
                <label>Contraseña:</label>
                <input
                  id="admin_password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  required
                />
              </div>

              <button
                type="submit"
                className="btnAdminLoginSubmit"
                disabled={loginCargando}
              >
                {loginCargando ? "Verificando..." : "Iniciar Sesión"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/Interfaz")}
                className="btnVolverMapa"
              >
                Volver al Campus 3D
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="AdminPage">
      <Header />

      <div className="AdminContainer">
        {/* Barra Superior */}
        <div className="AdminTopBar">
          <div className="AdminTitulo">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <h1>Panel de Administración</h1>
              <span className="adminUserBadge">
                🛡️ <span className="adminName">{adminSesion.nombre || adminSesion.username}</span>
                <span className="adminRoleBadge">{adminSesion.rol || "admin"}</span>
              </span>
            </div>
            <p>Control y estadísticas generales de usuarios, sesiones y auditoría del campus</p>
          </div>

          <div className="AdminAcciones">
            <button
              type="button"
              className="btnAdminPdf"
              onClick={() => handleDescargarPDF(tabActiva)}
              disabled={descargandoPdf}
              title={`Descargar reporte en PDF de la sección activa (${etiquetasTab[tabActiva] || tabActiva})`}
            >
              {descargandoPdf ? "⏳ Generando PDF..." : `📄 Exportar PDF (${etiquetasTab[tabActiva] || "Sección"})`}
            </button>
            <button
              type="button"
              className="btnAdminNav"
              onClick={cargarDashboard}
              title="Recargar datos"
            >
              🔄 Actualizar Datos
            </button>
            <button
              type="button"
              className="btnAdminLogout"
              onClick={handleAdminLogout}
              title="Cerrar sesión administrativa"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Sección de Pestañas y Contenido */}
        <div className="AdminCardMain">
          <div className="AdminMainHeader">
            <div className="AdminTabs">
              <button
                type="button"
                className={`btnTab ${tabActiva === "usuarios" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("usuarios");
                  setBusqueda("");
                }}
              >
                👥 Usuarios ({data.usuarios.length})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "sesiones" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("sesiones");
                  setBusqueda("");
                }}
              >
                🕒 Sesiones Usuarios ({data.sesiones.length})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "recorridos" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("recorridos");
                  setBusqueda("");
                }}
              >
                📍 Lugares Recorridos ({data.recorridos.length})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "reportes" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("reportes");
                  setBusqueda("");
                }}
              >
                🐛 Reportes del Mapa ({data.reportes?.length || 0})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "admins" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("admins");
                  setBusqueda("");
                }}
              >
                🛡️ Administradores ({data.admins?.length || 0})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "auditorias" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("auditorias");
                  setBusqueda("");
                }}
              >
                📜 Auditoría y Cambios ({data.admin_auditorias?.length || 0})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "admin_sesiones" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("admin_sesiones");
                  setBusqueda("");
                }}
              >
                🕒 Sesiones Admin ({data.admin_sesiones?.length || 0})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "notificaciones" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("notificaciones");
                  setBusqueda("");
                }}
              >
                📢 Notificaciones ({data.notificaciones?.length || 0})
              </button>

              <button
                type="button"
                className={`btnTab ${tabActiva === "encuestas" ? "activo" : ""}`}
                onClick={() => {
                  setTabActiva("encuestas");
                  setBusqueda("");
                }}
              >
                ⭐ Encuestas ({data.encuestas_stats?.total_respuestas || 0})
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar registros..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="inputSearchAdmin"
            />
          </div>

          {cargando ? (
            <div className="cargandoDashboard">
              <p>Cargando información del servidor...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: USUARIOS */}
              {tabActiva === "usuarios" && (
                <>
                  <div className="AdminTabStatsGrid">
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Total Usuarios</span>
                        <h3 className="valorMetrica">{data.metricas.total_usuarios}</h3>
                      </div>
                    </div>
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Estudiantes ITFIP</span>
                        <h3 className="valorMetrica">
                          {data.usuarios.filter((u) => u.id_tipo_usuario === 2 || u.nombre_tipo?.toLowerCase().includes("estudiante")).length}
                        </h3>
                      </div>
                    </div>
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Visitantes / Generales</span>
                        <h3 className="valorMetrica">
                          {data.usuarios.filter((u) => u.id_tipo_usuario === 1 || u.nombre_tipo?.toLowerCase().includes("general")).length}
                        </h3>
                      </div>
                    </div>
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Roles en Sistema</span>
                        <h3 className="valorMetrica">{data.tipos_usuario?.length || 3}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Gráficas interactivas de Usuarios */}
                  <div className="AdminGraficasGrid">
                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Distribución de Usuarios por Rol</h4>
                        <span className="cardGraficaBadge">Gráfico Circular</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Doughnut ref={chartUsuariosRolRef} data={graficaUsuariosRol} options={getDoughnutOptions()} />
                      </div>
                    </div>

                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Registros de Usuarios por Mes</h4>
                        <span className="cardGraficaBadge">Gráfico de Barras</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Bar ref={chartUsuariosMesRef} data={graficaUsuariosMes} options={getBarOptions(false)} />
                      </div>
                    </div>
                  </div>

                  <div className="tableResponsive">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th>ID UniMap</th>
                          <th>Nombres y Apellidos</th>
                          <th>Documento</th>
                          <th>Rol / Tipo</th>
                          <th>Programa / Semestre</th>
                          <th>Correo Institucional</th>
                          <th>Fecha de Registro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosFiltrados.length > 0 ? (
                          usuariosFiltrados.map((u) => (
                            <tr key={u.id_general}>
                              <td>
                                <span className="badgeIdUsuario">{u.id_usuario}</span>
                              </td>
                              <td>
                                <b>{u.nombres}</b> {u.apellidos}
                              </td>
                              <td>{u.numero_documento}</td>
                              <td>
                                <span
                                  className={`badgeRolAdmin ${
                                    u.id_tipo_usuario === 1
                                      ? "rolGeneral"
                                      : u.id_tipo_usuario === 2
                                      ? "rolDocente"
                                      : "rolAdmin"
                                  }`}
                                >
                                  {u.nombre_tipo || "Usuario"}
                                </span>
                              </td>
                              <td>
                                {u.nombre_carrera ? (
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{u.nombre_carrera}</span>
                                    {u.nombre_semestre && (
                                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)" }}>
                                        {u.nombre_semestre}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-secondary)" }}>-</span>
                                )}
                              </td>
                              <td>{u.correo_institucional || "-"}</td>
                              <td>{u.fecha_sys || u.fecha_registro}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="sinDatosTabla">
                              No se encontraron usuarios coincidentes con la búsqueda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* TAB 2: SESIONES */}
              {tabActiva === "sesiones" && (
                <>
                  <div className="AdminTabStatsGrid">
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Total Inicios de Sesión</span>
                        <h3 className="valorMetrica">{data.metricas.total_sesiones}</h3>
                      </div>
                    </div>
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Mes con Más Actividad</span>
                        <h3 className="valorMetrica valorMetricaTexto">
                          {data.metricas.mes_top
                            ? `${data.metricas.mes_top.nombre || data.metricas.mes_top.mes} (${data.metricas.mes_top.cantidad || data.metricas.mes_top.total})`
                            : "Sin datos"}
                        </h3>
                      </div>
                    </div>
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Día con Más Accesos</span>
                        <h3 className="valorMetrica valorMetricaTexto">
                          {data.metricas.dia_top
                            ? `${data.metricas.dia_top.nombre || data.metricas.dia_top.dia} (${data.metricas.dia_top.cantidad || data.metricas.dia_top.total})`
                            : "Sin datos"}
                        </h3>
                      </div>
                    </div>
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Sesiones Listadas</span>
                        <h3 className="valorMetrica">{data.sesiones.length}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Gráficas interactivas de Sesiones */}
                  <div className="AdminGraficasGrid">
                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Inicios de Sesión por Día de la Semana</h4>
                        <span className="cardGraficaBadge">Gráfico de Barras</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Bar ref={chartSesionesDiaRef} data={graficaSesionesDia} options={getBarOptions(false)} />
                      </div>
                    </div>

                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Dispositivos y Plataformas de Acceso</h4>
                        <span className="cardGraficaBadge">Gráfico Circular</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Doughnut ref={chartSesionesDispRef} data={graficaSesionesDispositivo} options={getDoughnutOptions()} />
                      </div>
                    </div>
                  </div>

                  <div className="tableResponsive">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th># Sesión</th>
                          <th>ID Usuario</th>
                          <th>Usuario</th>
                          <th>Dirección IP</th>
                          <th>Dispositivo / Navegador</th>
                          <th>Fecha y Hora de Acceso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sesionesFiltradas.length > 0 ? (
                          sesionesFiltradas.map((s) => (
                            <tr key={s.id_sesion}>
                              <td>#{s.id_sesion}</td>
                              <td>
                                <span className="badgeIdUsuario">{s.id_usuario}</span>
                              </td>
                              <td>
                                {s.nombres ? `${s.nombres} ${s.apellidos}` : "Usuario"}
                              </td>
                              <td>
                                <code>{s.ip_acceso || "127.0.0.1"}</code>
                              </td>
                              <td>{s.dispositivo || "Navegador Web"}</td>
                              <td>{s.fecha_inicio}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="sinDatosTabla">
                              No se encontraron sesiones registradas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* TAB 3: LUGARES RECORRIDOS (GESTIÓN VÍA BASE DE DATOS) */}
              {tabActiva === "recorridos" && (
                <div className="contenedorRecorridosDB">
                  {/* Tarjetas de Resumen de Recorridos en DB */}
                  <div className="AdminTabStatsGrid">
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Total Registros</span>
                        <h3 className="valorMetrica">{data.metricas.total_recorridos}</h3>
                      </div>
                    </div>

                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Lugares Únicos</span>
                        <h3 className="valorMetrica">{estadisticasRecorridos.lugaresUnicos}</h3>
                      </div>
                    </div>

                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Lugar Más Recorrido</span>
                        <h3 className="valorMetrica valorMetricaTexto">
                          {estadisticasRecorridos.lugarTop
                            ? `${estadisticasRecorridos.lugarTop.lugar} (${estadisticasRecorridos.lugarTop.total} visitas)`
                            : "Sin datos"}
                        </h3>
                      </div>
                    </div>

                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Bloque con Más Tráfico</span>
                        <h3 className="valorMetrica valorMetricaTexto">
                          {data.metricas.bloque_top
                            ? `${data.metricas.bloque_top.bloque} (${data.metricas.bloque_top.total || data.metricas.bloque_top.cantidad} visitas)`
                            : "Sin datos"}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Gráficas interactivas de Recorridos */}
                  <div className="AdminGraficasGrid">
                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Distribución de Búsquedas por Bloque / Zona</h4>
                        <span className="cardGraficaBadge">Gráfico Circular</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Doughnut ref={chartRecorridosBloqueRef} data={graficaRecorridosBloque} options={getDoughnutOptions()} />
                      </div>
                    </div>

                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Top Lugares Más Frecuentados</h4>
                        <span className="cardGraficaBadge">Gráfico de Barras</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Bar ref={chartRecorridosTopRef} data={graficaRecorridosTop} options={getBarOptions(true)} />
                      </div>
                    </div>
                  </div>

                  {/* Top 5 Lugares más visitados */}
                  {estadisticasRecorridos.topCinco.length > 0 && (
                    <div className="seccionTopLugaresDB">
                      <h4>Top Lugares con Mayor Demanda en la Base de Datos:</h4>
                      <div className="rankingPillsContainer">
                        {estadisticasRecorridos.topCinco.map((top, i) => (
                          <div key={top.lugar} className="pillRankingLugar">
                            <span className="posRanking">#{i + 1}</span>
                            <span className="nombreRanking">{top.lugar}</span>
                            <span className="visitasRanking">{top.total} búsquedas</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tabla completa de auditoría de recorridos */}
                  <div className="tableResponsive">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th># Recorrido</th>
                          <th>ID Usuario</th>
                          <th>Usuario</th>
                          <th>Lugar Destino (Mesh)</th>
                          <th>Origen de Búsqueda</th>
                          <th>Fecha y Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recorridosFiltrados.length > 0 ? (
                          recorridosFiltrados.map((r) => (
                            <tr key={r.id_recorrido}>
                              <td>#{r.id_recorrido}</td>
                              <td>
                                <span className="badgeIdUsuario">{r.id_usuario}</span>
                              </td>
                              <td>
                                {r.nombres ? `${r.nombres} ${r.apellidos}` : "Usuario"}
                              </td>
                              <td>
                                <span className="badgeMesh">{r.lugar_mesh}</span>
                              </td>
                              <td>
                                <span className="badgeOrigen">{r.origen_busqueda}</span>
                              </td>
                              <td>{r.fecha_busqueda}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="sinDatosTabla">
                              Aún no hay lugares recorridos registrados en la base de datos.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: REPORTES DE ERRORES DEL MAPA */}
              {tabActiva === "reportes" && (
                <>
                  <div className="AdminTabStatsGrid">
                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Total Reportes</span>
                        <h3 className="valorMetrica">{data.metricas.total_reportes || data.reportes.length}</h3>
                      </div>
                    </div>

                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Pendientes</span>
                        <h3 className="valorMetrica" style={{ color: "#d97706" }}>
                          {data.reportes.filter((r) => r.estado === "pendiente").length}
                        </h3>
                      </div>
                    </div>

                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">En Revisión</span>
                        <h3 className="valorMetrica" style={{ color: "#2563eb" }}>
                          {data.reportes.filter((r) => r.estado === "en_revision").length}
                        </h3>
                      </div>
                    </div>

                    <div className="cardMetrica">
                      <div className="infoMetrica">
                        <span className="labelMetrica">Resueltos</span>
                        <h3 className="valorMetrica" style={{ color: "#16a34a" }}>
                          {data.reportes.filter((r) => r.estado === "resuelto").length}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Gráficas interactivas de Reportes */}
                  <div className="AdminGraficasGrid">
                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Estado de Resolución de Reportes</h4>
                        <span className="cardGraficaBadge">Gráfico Circular</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Doughnut ref={chartReportesEstadoRef} data={graficaReportesEstado} options={getDoughnutOptions()} />
                      </div>
                    </div>

                    <div className="cardGraficaAdmin">
                      <div className="cardGraficaHeader">
                        <h4 className="cardGraficaTitulo">Incidencias por Tipo de Problema</h4>
                        <span className="cardGraficaBadge">Gráfico de Barras</span>
                      </div>
                      <div className="cardGraficaCanvas">
                        <Bar ref={chartReportesTipoRef} data={graficaReportesTipo} options={getBarOptions(false)} />
                      </div>
                    </div>
                  </div>

                  <div className="tableResponsive">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th># Reporte</th>
                        <th>ID Usuario</th>
                        <th>Usuario</th>
                        <th>Tipo de Error</th>
                        <th>Lugar Afectado</th>
                        <th>Descripción del Problema</th>
                        <th>Fecha</th>
                        <th>Estado / Gestión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportesFiltrados.length > 0 ? (
                        reportesFiltrados.map((rep) => (
                          <tr key={rep.id_reporte}>
                            <td>#{rep.id_reporte}</td>
                            <td>
                              <span className="badgeIdUsuario">{rep.id_usuario}</span>
                            </td>
                            <td>
                              {rep.nombres ? (
                                <>
                                  <b>{rep.nombres}</b> {rep.apellidos}
                                </>
                              ) : (
                                "Usuario"
                              )}
                            </td>
                            <td>
                              <span className="badgeTipoError">
                                {rep.tipo_error}
                              </span>
                            </td>
                            <td>
                              <b>{rep.lugar_afectado || "General / Todo el mapa"}</b>
                            </td>
                            <td style={{ maxWidth: "320px", whiteSpace: "normal", wordBreak: "break-word" }}>
                              {rep.descripcion}
                            </td>
                            <td>{rep.fecha_reporte}</td>
                            <td>
                              <select
                                value={rep.estado}
                                onChange={(e) =>
                                  handleCambiarEstado(rep.id_reporte, e.target.value)
                                }
                                className={`selectEstadoTabla ${rep.estado}`}
                                title="Cambiar estado del reporte"
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="en_revision">En Revisión</option>
                                <option value="resuelto">Resuelto</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="sinDatosTabla">
                            No se han registrado reportes de errores en el mapa.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 5: ADMINISTRADORES */}
            {tabActiva === "admins" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "var(--text-primary)" }}>
                      Gestión de Administradores
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                      Registro y control de usuarios con privilegios de gestión en UniMap
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btnCrearAdmin"
                    onClick={() => setModalNuevoAdmin(true)}
                  >
                    ➕ Registrar Administrador
                  </button>
                </div>

                <div className="AdminTabStatsGrid">
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Total Administradores</span>
                      <h3 className="valorMetrica">{data.admins?.length || 0}</h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Super Administradores</span>
                      <h3 className="valorMetrica">
                        {data.admins?.filter((a) => a.rol === "superadmin").length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Administradores</span>
                      <h3 className="valorMetrica">
                        {data.admins?.filter((a) => a.rol === "administrador").length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Cuentas Activas</span>
                      <h3 className="valorMetrica">
                        {data.admins?.filter((a) => a.activo).length || 0}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="tableResponsive">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Usuario (Login)</th>
                        <th>Nombre Completo</th>
                        <th>Rol Asignado</th>
                        <th>Estado</th>
                        <th>Creado Por</th>
                        <th>Fecha Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminsFiltrados.length > 0 ? (
                        adminsFiltrados.map((adm) => (
                          <tr key={adm.id_admin}>
                            <td>#{adm.id_admin}</td>
                            <td>
                              <span className="badgeIdUsuario">{adm.username}</span>
                            </td>
                            <td>
                              <b>{adm.nombre}</b>
                            </td>
                            <td>
                              <span className={`badgeRol badgeRol-${adm.rol}`}>
                                {adm.rol}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badgeSesionEstado ${
                                  adm.activo ? "badgeSesion-activa" : "badgeSesion-cerrada"
                                }`}
                              >
                                {adm.activo ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td>{adm.creado_por || "Sistema"}</td>
                            <td>
                              {adm.created_at
                                ? new Date(adm.created_at).toLocaleString()
                                : "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="sinDatosTabla">
                            No se encontraron administradores con los filtros aplicados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 6: AUDITORÍA Y CAMBIOS */}
            {tabActiva === "auditorias" && (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "var(--text-primary)" }}>
                    Registro Histórico de Auditoría y Cambios
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                    Trazabilidad inmutable de cambios de estado en incidencias, resoluciones de bugs y sesiones
                  </p>
                </div>

                <div className="AdminTabStatsGrid">
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Total Eventos Registrados</span>
                      <h3 className="valorMetrica">{data.admin_auditorias?.length || 0}</h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Resoluciones de Bugs</span>
                      <h3 className="valorMetrica">
                        {data.admin_auditorias?.filter((a) => a.tipo_accion === "RESOLUCION_BUG").length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Cambios de Estado</span>
                      <h3 className="valorMetrica">
                        {data.admin_auditorias?.filter((a) => a.tipo_accion === "CAMBIO_ESTADO_REPORTE").length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Inicios de Sesión</span>
                      <h3 className="valorMetrica">
                        {data.admin_auditorias?.filter((a) => a.tipo_accion === "LOGIN_ADMIN").length || 0}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Chips de filtro por Tipo de Acción */}
                <div className="auditFilters">
                  <span className="auditFiltersLabel">Filtrar por Acción:</span>
                  {["TODOS", "RESOLUCION_BUG", "CAMBIO_ESTADO_REPORTE", "LOGIN_ADMIN", "LOGOUT_ADMIN", "CREACION_ADMIN"].map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      className={`btnFiltroAuditoria ${filtroTipoAuditoria === tipo ? "activo" : ""}`}
                      onClick={() => setFiltroTipoAuditoria(tipo)}
                    >
                      {tipo === "TODOS" && "Todas"}
                      {tipo === "RESOLUCION_BUG" && "🎯 Resoluciones de Bugs"}
                      {tipo === "CAMBIO_ESTADO_REPORTE" && "🔄 Cambios de Estado"}
                      {tipo === "LOGIN_ADMIN" && "🔑 Logins"}
                      {tipo === "LOGOUT_ADMIN" && "🚪 Logouts"}
                      {tipo === "CREACION_ADMIN" && "👤 Nuevos Admins"}
                    </button>
                  ))}
                </div>

                <div className="tableResponsive">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th># ID</th>
                        <th>Fecha y Hora</th>
                        <th>Administrador</th>
                        <th>Tipo de Acción</th>
                        <th>Módulo</th>
                        <th>Descripción del Cambio</th>
                        <th>Detalles Técnicos / Contexto</th>
                        <th>IP Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditoriasFiltradas.length > 0 ? (
                        auditoriasFiltradas.map((aud) => {
                          let badgeClass = "badgeAccion-sesion";
                          if (aud.tipo_accion === "RESOLUCION_BUG") badgeClass = "badgeAccion-bug";
                          else if (aud.tipo_accion === "CAMBIO_ESTADO_REPORTE") badgeClass = "badgeAccion-estado";
                          else if (aud.tipo_accion === "CREACION_ADMIN") badgeClass = "badgeAccion-admin";

                          return (
                            <tr key={aud.id_auditoria}>
                              <td>#{aud.id_auditoria}</td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                {aud.fecha_accion || aud.created_at
                                  ? new Date(aud.fecha_accion || aud.created_at).toLocaleString()
                                  : "-"}
                              </td>
                              <td>
                                <span className="badgeIdUsuario">{aud.admin_username}</span>
                              </td>
                              <td>
                                <span className={`badgeAccion ${badgeClass}`}>
                                  {aud.tipo_accion}
                                </span>
                              </td>
                              <td>
                                <b>{aud.modulo}</b>
                              </td>
                              <td style={{ maxWidth: "280px", whiteSpace: "normal" }}>
                                {aud.descripcion}
                              </td>
                              <td style={{ maxWidth: "260px" }}>
                                {aud.detalles_json ? (
                                  <pre className="jsonDetallesPre">
                                    {JSON.stringify(aud.detalles_json, null, 2)}
                                  </pre>
                                ) : (
                                  <span style={{ color: "var(--text-secondary)" }}>-</span>
                                )}
                              </td>
                              <td><code>{aud.ip_origen || "-"}</code></td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" className="sinDatosTabla">
                            No hay registros de auditoría que coincidan con la búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 7: SESIONES ADMINISTRATIVAS */}
            {tabActiva === "admin_sesiones" && (
              <>
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "var(--text-primary)" }}>
                    Registro de Sesiones de Administradores
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                    Historial detallado de accesos, direcciones IP, dispositivos y tiempos de actividad en el panel
                  </p>
                </div>

                <div className="AdminTabStatsGrid">
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Total Sesiones Registradas</span>
                      <h3 className="valorMetrica">{data.admin_sesiones?.length || 0}</h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Sesiones Activas</span>
                      <h3 className="valorMetrica">
                        {data.admin_sesiones?.filter((s) => s.estado === "activa").length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Sesiones Finalizadas</span>
                      <h3 className="valorMetrica">
                        {data.admin_sesiones?.filter((s) => s.estado === "cerrada").length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Sesión Actual</span>
                      <h3 className="valorMetrica">#{adminSesion.id_sesion || 1}</h3>
                    </div>
                  </div>
                </div>

                <div className="tableResponsive">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID Sesión</th>
                        <th>Administrador</th>
                        <th>Dirección IP</th>
                        <th>Dispositivo / Navegador</th>
                        <th>Inicio de Sesión</th>
                        <th>Cierre de Sesión</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminSesionesFiltradas.length > 0 ? (
                        adminSesionesFiltradas.map((s) => (
                          <tr key={s.id_sesion}>
                            <td>#{s.id_sesion}</td>
                            <td>
                              <span className="badgeIdUsuario">{s.username}</span>
                              {s.nombre && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{s.nombre}</div>}
                            </td>
                            <td><code>{s.ip_acceso}</code></td>
                            <td style={{ maxWidth: "260px", whiteSpace: "normal" }}>
                              {s.dispositivo || "Navegador Web"}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {s.fecha_inicio ? new Date(s.fecha_inicio).toLocaleString() : "-"}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {s.fecha_cierre ? (
                                new Date(s.fecha_cierre).toLocaleString()
                              ) : s.estado === "activa" ? (
                                <span style={{ color: "#10b981", fontWeight: 600 }}>En curso</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td>
                              <span
                                className={`badgeSesionEstado ${
                                  s.estado === "activa" ? "badgeSesion-activa" : "badgeSesion-cerrada"
                                }`}
                              >
                                {s.estado}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="sinDatosTabla">
                            No hay sesiones administrativas registradas con los filtros actuales.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 8: NOTIFICACIONES (AVISOS Y MANTENIMIENTO) */}
            {tabActiva === "notificaciones" && (
              <>
                <div className="AdminTabStatsGrid">
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Total Notificaciones</span>
                      <h3 className="valorMetrica">{data.notificaciones?.length || 0}</h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Avisos Activos</span>
                      <h3 className="valorMetrica" style={{ color: "#10b981" }}>
                        {data.notificaciones?.filter((n) => n.activo).length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Historial / Inactivos</span>
                      <h3 className="valorMetrica" style={{ color: "var(--text-secondary)" }}>
                        {data.notificaciones?.filter((n) => !n.activo).length || 0}
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Mantenimientos</span>
                      <h3 className="valorMetrica" style={{ color: "#f59e0b" }}>
                        {data.notificaciones?.filter((n) => n.tipo === "mantenimiento").length || 0}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="adminSeccionHeaderRow">
                  <div>
                    <h3 className="adminSeccionTitulo">Comunicaciones y Avisos a Usuarios</h3>
                    <p className="adminSeccionDesc">
                      Transmite avisos de mantenimiento, paradas de servidor o novedades a la comunidad en el visor 3D.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btnNuevoRegistroAdmin"
                    onClick={() => setModalNuevaNoti(true)}
                  >
                    📢 Nueva Notificación
                  </button>
                </div>

                <div className="tablaAdminWrapper">
                  <table className="tablaAdmin">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Tipo</th>
                        <th>Título</th>
                        <th>Mensaje</th>
                        <th>Estado</th>
                        <th>Publicado Por</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificacionesFiltradas.length > 0 ? (
                        notificacionesFiltradas.map((n) => (
                          <tr key={n.id_notificacion}>
                            <td>#{n.id_notificacion}</td>
                            <td>
                              <span className={`badgeTipoNoti badgeNoti-${n.tipo}`}>
                                {n.tipo.toUpperCase()}
                              </span>
                            </td>
                            <td><strong>{n.titulo}</strong></td>
                            <td style={{ maxWidth: "300px", whiteSpace: "normal" }}>{n.mensaje}</td>
                            <td>
                              <button
                                type="button"
                                className={`btnToggleActivo ${n.activo ? "activo" : "inactivo"}`}
                                onClick={() => handleToggleNotificacion(n.id_notificacion)}
                                title="Click para activar o desactivar aviso"
                              >
                                {n.activo ? "✓ Activo" : "✕ Oculto"}
                              </button>
                            </td>
                            <td><span className="badgeIdUsuario">{n.creado_por || "admin"}</span></td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {n.created_at ? new Date(n.created_at).toLocaleString() : "-"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btnAccionEliminar"
                                onClick={() => handleEliminarNotificacion(n.id_notificacion)}
                                title="Eliminar notificación"
                              >
                                🗑️ Eliminar
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="sinDatosTabla">
                            No hay notificaciones registradas con los filtros actuales.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 9: ENCUESTAS DE SATISFACCIÓN */}
            {tabActiva === "encuestas" && (
              <>
                <div className="AdminTabStatsGrid">
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Total Respuestas</span>
                      <h3 className="valorMetrica">{data.encuestas_stats?.total_respuestas || 0}</h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Satisfacción General</span>
                      <h3 className="valorMetrica" style={{ color: "#eab308" }}>
                        {data.encuestas_stats?.promedio_general || 0} / 5 ⭐
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Facilidad de Uso</span>
                      <h3 className="valorMetrica" style={{ color: "#3b82f6" }}>
                        {data.encuestas_stats?.promedio_facilidad || 0} / 5
                      </h3>
                    </div>
                  </div>
                  <div className="cardMetrica">
                    <div className="infoMetrica">
                      <span className="labelMetrica">Calidad Mapa 3D</span>
                      <h3 className="valorMetrica" style={{ color: "#10b981" }}>
                        {data.encuestas_stats?.promedio_mapa_3d || 0} / 5
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Gráficas Estadísticas de Encuestas */}
                <div className="AdminGraficasGrid">
                  <div className="cardGraficaAdmin">
                    <div className="cardGraficaHeader">
                      <h4 className="cardGraficaTitulo">Distribución de 1 a 5 Estrellas</h4>
                      <span className="cardGraficaBadge">Gráfico de Barras</span>
                    </div>
                    <div className="cardGraficaCanvas">
                      <Bar ref={chartEncuestasEstrellasRef} data={graficaEncuestasEstrellas} options={getBarOptions(false)} />
                    </div>
                  </div>

                  <div className="cardGraficaAdmin">
                    <div className="cardGraficaHeader">
                      <h4 className="cardGraficaTitulo">Promedios por Aspectos Evaluados</h4>
                      <span className="cardGraficaBadge">Gráfico Comparativo</span>
                    </div>
                    <div className="cardGraficaCanvas">
                      <Bar ref={chartEncuestasAspectosRef} data={graficaEncuestasAspectos} options={getBarOptions(false)} />
                    </div>
                  </div>
                </div>

                {/* Gestión de Encuestas */}
                <div className="adminSeccionHeaderRow" style={{ marginTop: "24px" }}>
                  <div>
                    <h3 className="adminSeccionTitulo">Encuestas de Satisfacción Configuradas</h3>
                    <p className="adminSeccionDesc">
                      Crea o activa la encuesta que se mostrará a los usuarios en el mapa 3D.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btnNuevoRegistroAdmin"
                    onClick={() => setModalNuevaEncuesta(true)}
                  >
                    ⭐ Nueva Encuesta
                  </button>
                </div>

                <div className="tablaAdminWrapper" style={{ marginBottom: "28px" }}>
                  <table className="tablaAdmin">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Título</th>
                        <th>Descripción</th>
                        <th>Respuestas Recibidas</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.encuestas?.length > 0 ? (
                        data.encuestas.map((enc) => (
                          <tr key={enc.id_encuesta}>
                            <td>#{enc.id_encuesta}</td>
                            <td><strong>{enc.titulo}</strong></td>
                            <td style={{ maxWidth: "280px", whiteSpace: "normal" }}>{enc.descripcion || "-"}</td>
                            <td><span className="badgeIdUsuario">{enc.respuestas_count || 0} respuestas</span></td>
                            <td>
                              <span className={`badgeSesionEstado ${enc.activo ? "badgeSesion-activa" : "badgeSesion-cerrada"}`}>
                                {enc.activo ? "Activa (Visible)" : "Inactiva"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`btnToggleActivo ${enc.activo ? "activo" : "inactivo"}`}
                                onClick={() => handleToggleEncuesta(enc.id_encuesta)}
                              >
                                {enc.activo ? "Desactivar" : "Activar"}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="sinDatosTabla">
                            No hay encuestas configuradas. Haz clic en "Nueva Encuesta" para crear la primera.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Comentarios y Opiniones Recientes de Usuarios */}
                <div className="adminSeccionHeaderRow">
                  <div>
                    <h3 className="adminSeccionTitulo">Opiniones y Sugerencias de Usuarios</h3>
                    <p className="adminSeccionDesc">
                      Retroalimentación directa enviada por los estudiantes y visitantes tras utilizar el campus 3D.
                    </p>
                  </div>
                </div>

                <div className="tablaAdminWrapper">
                  <table className="tablaAdmin">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>General</th>
                        <th>Facilidad</th>
                        <th>Calidad 3D</th>
                        <th>Comentario / Observación</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comentariosFiltrados.length > 0 ? (
                        comentariosFiltrados.map((c) => (
                          <tr key={c.id_respuesta}>
                            <td>
                              <span className="badgeIdUsuario">{c.id_usuario}</span>
                              {(c.nombres || c.apellidos) && (
                                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                  {c.nombres} {c.apellidos}
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ color: "#eab308", fontWeight: 700 }}>
                                {"★".repeat(c.calificacion_general)} ({c.calificacion_general}/5)
                              </span>
                            </td>
                            <td>{c.facilidad_uso}/5</td>
                            <td>{c.calidad_mapa_3d}/5</td>
                            <td style={{ maxWidth: "340px", whiteSpace: "normal" }}>
                              {c.comentarios || <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>Sin comentario adicional</span>}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {c.created_at ? new Date(c.created_at).toLocaleString() : "-"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="sinDatosTabla">
                            Aún no se registran comentarios en encuestas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            </>
          )}
        </div>
      </div>

      {/* Modal Registrar Administrador */}
      {modalNuevoAdmin && (
        <div className="modalAdminOverlay" onClick={() => setModalNuevoAdmin(false)}>
          <div className="modalAdminContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalAdminHeader">
              <h3>Registrar Nuevo Administrador</h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalNuevoAdmin(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearAdmin} className="adminLoginForm">
              <div className="adminFormGroup">
                <label>Nombre Completo:</label>
                <input
                  type="text"
                  placeholder="ej. Carlos Santana"
                  value={formNuevoAdmin.nombre}
                  onChange={(e) =>
                    setFormNuevoAdmin({ ...formNuevoAdmin, nombre: e.target.value })
                  }
                  required
                />
              </div>

              <div className="adminFormGroup">
                <label>Usuario (Username / Login):</label>
                <input
                  type="text"
                  placeholder="ej. carlos@Unimap"
                  value={formNuevoAdmin.username}
                  onChange={(e) =>
                    setFormNuevoAdmin({ ...formNuevoAdmin, username: e.target.value })
                  }
                  required
                />
              </div>

              <div className="adminFormGroup">
                <label>Contraseña:</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formNuevoAdmin.password}
                  onChange={(e) =>
                    setFormNuevoAdmin({ ...formNuevoAdmin, password: e.target.value })
                  }
                  required
                />
              </div>

              <div className="adminFormGroup">
                <label>Rol Administrativo:</label>
                <select
                  value={formNuevoAdmin.rol}
                  onChange={(e) =>
                    setFormNuevoAdmin({ ...formNuevoAdmin, rol: e.target.value })
                  }
                >
                  <option value="administrador">Administrador</option>
                  <option value="superadmin">Super Administrador</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setModalNuevoAdmin(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btnAdminLoginSubmit"
                  style={{ flex: 1 }}
                  disabled={nuevoAdminCargando}
                >
                  {nuevoAdminCargando ? "Guardando..." : "Guardar Administrador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Notificación */}
      {modalNuevaNoti && (
        <div className="modalAdminOverlay" onClick={() => setModalNuevaNoti(false)}>
          <div className="modalAdminContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalAdminHeader">
              <h3>Publicar Nueva Notificación Oficial</h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalNuevaNoti(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearNotificacion} className="adminLoginForm">
              <div className="adminFormGroup">
                <label>Título del Aviso:</label>
                <input
                  type="text"
                  placeholder="ej. Mantenimiento del Servidor 3D este sábado"
                  value={formNoti.titulo}
                  onChange={(e) => setFormNoti({ ...formNoti, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="adminFormGroup">
                <label>Tipo de Notificación:</label>
                <select
                  value={formNoti.tipo}
                  onChange={(e) => setFormNoti({ ...formNoti, tipo: e.target.value })}
                >
                  <option value="aviso">Aviso General</option>
                  <option value="mantenimiento">Mantenimiento Programado</option>
                  <option value="actualizacion">Nueva Actualización</option>
                  <option value="urgente">Aviso Urgente</option>
                </select>
              </div>

              <div className="adminFormGroup">
                <label>Mensaje Detallado:</label>
                <textarea
                  rows={4}
                  placeholder="Escribe la información que verán los usuarios en la campana de notificaciones..."
                  value={formNoti.mensaje}
                  onChange={(e) => setFormNoti({ ...formNoti, mensaje: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg, transparent)",
                    color: "var(--text-primary)",
                    resize: "vertical",
                  }}
                />
              </div>

              <div className="adminFormGroup" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="chkNotiActivo"
                  checked={formNoti.activo}
                  onChange={(e) => setFormNoti({ ...formNoti, activo: e.target.checked })}
                  style={{ width: "18px", height: "18px" }}
                />
                <label htmlFor="chkNotiActivo" style={{ margin: 0, cursor: "pointer" }}>
                  Activar y mostrar inmediatamente a los usuarios
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setModalNuevaNoti(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btnAdminLoginSubmit"
                  style={{ flex: 1 }}
                  disabled={notiCargando}
                >
                  {notiCargando ? "Publicando..." : "Publicar Notificación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Encuesta */}
      {modalNuevaEncuesta && (
        <div className="modalAdminOverlay" onClick={() => setModalNuevaEncuesta(false)}>
          <div className="modalAdminContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalAdminHeader">
              <h3>Crear Encuesta de Satisfacción</h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalNuevaEncuesta(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearEncuesta} className="adminLoginForm">
              <div className="adminFormGroup">
                <label>Título de la Encuesta:</label>
                <input
                  type="text"
                  placeholder="ej. Evaluación de Usabilidad UniMap 3D ITFIP 2026"
                  value={formEncuesta.titulo}
                  onChange={(e) => setFormEncuesta({ ...formEncuesta, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="adminFormGroup">
                <label>Descripción / Instrucciones (opcional):</label>
                <textarea
                  rows={3}
                  placeholder="Tu opinión nos ayuda a mejorar la experiencia visual y fluidez del campus..."
                  value={formEncuesta.descripcion}
                  onChange={(e) => setFormEncuesta({ ...formEncuesta, descripcion: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    background: "var(--input-bg, transparent)",
                    color: "var(--text-primary)",
                    resize: "vertical",
                  }}
                />
              </div>

              <div className="adminFormGroup" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="chkEncuestaActivo"
                  checked={formEncuesta.activo}
                  onChange={(e) => setFormEncuesta({ ...formEncuesta, activo: e.target.checked })}
                  style={{ width: "18px", height: "18px" }}
                />
                <label htmlFor="chkEncuestaActivo" style={{ margin: 0, cursor: "pointer" }}>
                  Establecer como encuesta activa (reemplaza cualquier encuesta previa activa)
                </label>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setModalNuevaEncuesta(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btnAdminLoginSubmit"
                  style={{ flex: 1 }}
                  disabled={encuestaCargando}
                >
                  {encuestaCargando ? "Creando..." : "Crear y Guardar Encuesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
