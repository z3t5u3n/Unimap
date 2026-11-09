import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import { API_BASE_URL } from '../config';
import { generarReportePDFConGraficas } from '../services/reportePdfAdmin';
import '../styles/admin.css';

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
import { Bar, Doughnut } from 'react-chartjs-2';

import {
  Users,
  Clock,
  MapPin,
  AlertTriangle,
  Shield,
  FileText,
  KeyRound,
  Bell,
  Star,
  Search,
  Filter,
  Plus,
  Compass,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Building2,
  Trash2,
  Eye,
  SlidersHorizontal,
  X,
  FileDown,
  ChevronDown,
  BarChart3,
  PieChart
} from 'lucide-react';

// Registrar componentes de Chart.js
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

export default function Admin() {
  const navigate = useNavigate();

  // 1. Estado de Sesión Administrativa
  const [adminSesion, setAdminSesion] = useState(() => {
    try {
      const guardado = localStorage.getItem('admin_session');
      return guardado ? JSON.parse(guardado) : null;
    } catch (e) {
      return null;
    }
  });

  const [tabActiva, setTabActiva] = useState('usuarios');
  // 2. Datos Maestros del Dashboard con Caché Instantáneo (SWR)
  const [data, setData] = useState(() => {
    try {
      const guardado = localStorage.getItem('unimap_admin_dashboard_cache');
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (parsed && parsed.metricas && Array.isArray(parsed.usuarios)) {
          return parsed;
        }
      }
    } catch (e) {
      // Usar estado inicial si la caché está corrupta
    }
    return {
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
        comentarios: []
      },
      metricas: {
        total_usuarios: 0,
        total_sesiones: 0,
        total_recorridos: 0,
        total_reportes: 0,
        reportes_pendientes: 0,
        reportes_resueltos: 0,
        total_admins: 0,
        total_auditorias: 0,
        bloque_top: null
      },
      estadisticas: {
        bloques: []
      }
    };
  });

  const [cargando, setCargando] = useState(() => {
    try {
      const guardado = localStorage.getItem('unimap_admin_dashboard_cache');
      if (guardado) return false;
    } catch (e) {}
    return true;
  });
  const [errorCarga, setErrorCarga] = useState('');

  // 3. Estados de Filtros y Búsqueda
  // Filtros de Usuarios
  const [filtroTipoUsuario, setFiltroTipoUsuario] = useState('TODOS');
  const [filtroTipoDocumento, setFiltroTipoDocumento] = useState('TODOS');
  const [busquedaUsuario, setBusquedaUsuario] = useState('');

  // Filtros de otras secciones
  const [busquedaSesion, setBusquedaSesion] = useState('');
  const [busquedaRecorrido, setBusquedaRecorrido] = useState('');
  const [filtroEstadoReporte, setFiltroEstadoReporte] = useState('TODOS');
  const [filtroModuloAuditoria, setFiltroModuloAuditoria] = useState('TODOS');
  const [busquedaAuditoria, setBusquedaAuditoria] = useState('');

  // 4. Estados de Modales
  // Modal Nuevo Admin
  const [modalNuevoAdmin, setModalNuevoAdmin] = useState(false);
  const [formAdmin, setFormAdmin] = useState({ username: '', nombre: '', password: '', rol: 'administrador' });
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);

  // Modal Nueva Notificación
  const [modalNuevaNoti, setModalNuevaNoti] = useState(false);
  const [formNoti, setFormNoti] = useState({ titulo: '', mensaje: '', tipo: 'aviso', activo: true });
  const [guardandoNoti, setGuardandoNoti] = useState(false);

  // Modal Nueva Encuesta
  const [modalNuevaEncuesta, setModalNuevaEncuesta] = useState(false);
  const [formEncuesta, setFormEncuesta] = useState({ titulo: '', descripcion: '', activo: true });
  const [guardandoEncuesta, setGuardandoEncuesta] = useState(false);

  // Modal Cambio Estado Reporte
  const [modalEstadoReporte, setModalEstadoReporte] = useState(null);
  const [nuevoEstadoReporte, setNuevoEstadoReporte] = useState('pendiente');
  const [notaAdminReporte, setNotaAdminReporte] = useState('');
  const [guardandoReporte, setGuardandoReporte] = useState(false);

  // Estado de descarga de PDF
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [menuPdfAbierto, setMenuPdfAbierto] = useState(false);

  // Nombre legible de la pestaña activa
  const getNombreTab = (tab) => {
    switch (tab) {
      case 'usuarios': return 'Usuarios';
      case 'sesiones': return 'Sesiones Usuarios';
      case 'recorridos': return 'Lugares Recorridos';
      case 'reportes': return 'Reportes de Mapa';
      case 'admins': return 'Administradores';
      case 'auditorias': return 'Auditoría y Cambios';
      case 'admin_sesiones': return 'Sesiones Admin';
      case 'notificaciones': return 'Notificaciones';
      case 'encuestas': return 'Encuestas';
      default: return 'General';
    }
  };

  // Cerrar menú PDF al cambiar de pestaña
  useEffect(() => {
    setMenuPdfAbierto(false);
  }, [tabActiva]);

  // Verificar autenticación
  useEffect(() => {
    if (!adminSesion || !adminSesion.username) {
      navigate('/admin-login');
    }
  }, [adminSesion, navigate]);

  // Cargar datos del dashboard desde backend
  const cargarDashboard = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/dashboard`);
      if (res.data) {
        setData(res.data);
        try {
          localStorage.setItem('unimap_admin_dashboard_cache', JSON.stringify(res.data));
        } catch (e) {
          // Si excede la cuota de localStorage no romper el flujo
        }
      }
    } catch (err) {
      console.error('Error al cargar datos administrativos:', err);
      setErrorCarga('No se pudo conectar con el servidor para cargar las estadísticas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (adminSesion) {
      cargarDashboard();
    }
  }, [cargarDashboard, adminSesion]);

  // Cerrar Sesión Admin
  const handleCerrarSesion = async () => {
    try {
      await axios.post(`${API_BASE_URL}/admin/logout`, {
        username: adminSesion?.username
      });
    } catch (e) {
      // Ignorar fallo de red en logout
    }
    localStorage.removeItem('admin_session');
    navigate('/admin-login');
  };

  // ==============================================================
  // ACCIONES CRUD ADMINISTRATIVAS
  // ==============================================================

  // Crear Administrador
  const handleCrearAdmin = async (e) => {
    e.preventDefault();
    if (!formAdmin.username || !formAdmin.password || !formAdmin.nombre) return;
    setGuardandoAdmin(true);
    try {
      await axios.post(`${API_BASE_URL}/admin/crear`, {
        ...formAdmin,
        creador_username: adminSesion?.username
      });
      setModalNuevoAdmin(false);
      setFormAdmin({ username: '', nombre: '', password: '', rol: 'administrador' });
      cargarDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al registrar administrador.');
    } finally {
      setGuardandoAdmin(false);
    }
  };

  // Crear Notificación
  const handleCrearNotificacion = async (e) => {
    e.preventDefault();
    if (!formNoti.titulo || !formNoti.mensaje) return;
    setGuardandoNoti(true);
    try {
      await axios.post(`${API_BASE_URL}/admin/notificaciones`, {
        ...formNoti,
        admin_username: adminSesion?.username
      });
      setModalNuevaNoti(false);
      setFormNoti({ titulo: '', mensaje: '', tipo: 'aviso', activo: true });
      cargarDashboard();
    } catch (err) {
      alert('Error al publicar notificación.');
    } finally {
      setGuardandoNoti(false);
    }
  };

  // Alternar Estado Notificación
  const handleToggleNotificacion = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/admin/notificaciones/${id}/toggle`, {
        admin_username: adminSesion?.username
      });
      cargarDashboard();
    } catch (err) {
      alert('Error al cambiar estado de la notificación.');
    }
  };

  // Eliminar Notificación
  const handleEliminarNotificacion = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta notificación?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/admin/notificaciones/${id}`, {
        data: { admin_username: adminSesion?.username }
      });
      cargarDashboard();
    } catch (err) {
      alert('Error al eliminar notificación.');
    }
  };

  // Crear Encuesta
  const handleCrearEncuesta = async (e) => {
    e.preventDefault();
    if (!formEncuesta.titulo) return;
    setGuardandoEncuesta(true);
    try {
      await axios.post(`${API_BASE_URL}/admin/encuestas`, {
        ...formEncuesta,
        admin_username: adminSesion?.username
      });
      setModalNuevaEncuesta(false);
      setFormEncuesta({ titulo: '', descripcion: '', activo: true });
      cargarDashboard();
    } catch (err) {
      alert('Error al crear encuesta.');
    } finally {
      setGuardandoEncuesta(false);
    }
  };

  // Alternar Estado Encuesta
  const handleToggleEncuesta = async (id) => {
    try {
      await axios.patch(`${API_BASE_URL}/admin/encuestas/${id}/toggle`, {
        admin_username: adminSesion?.username
      });
      cargarDashboard();
    } catch (err) {
      alert('Error al activar/desactivar la encuesta.');
    }
  };

  // Actualizar Estado de Reporte de Bug/Mapa
  const handleGuardarEstadoReporte = async () => {
    if (!modalEstadoReporte) return;
    setGuardandoReporte(true);
    try {
      await axios.patch(`${API_BASE_URL}/admin/reportes/${modalEstadoReporte.id_reporte}/estado`, {
        estado: nuevoEstadoReporte,
        nota_admin: notaAdminReporte,
        admin_username: adminSesion?.username
      });
      setModalEstadoReporte(null);
      setNotaAdminReporte('');
      cargarDashboard();
    } catch (err) {
      alert('Error al actualizar el estado del reporte.');
    } finally {
      setGuardandoReporte(false);
    }
  };

  // ==============================================================
  // FILTRADO DINÁMICO EN MEMORIA
  // ==============================================================

  // Catálogo dinámico de tipos de documento existentes
  const catalogoTiposDocumento = useMemo(() => {
    const setDocs = new Set();
    data.usuarios.forEach((u) => {
      if (u.nombre_documento) setDocs.add(u.nombre_documento);
    });
    return Array.from(setDocs);
  }, [data.usuarios]);

  // Usuarios filtrados por Tipo, Documento y Búsqueda
  const usuariosFiltrados = useMemo(() => {
    return data.usuarios.filter((u) => {
      // 1. Filtro Tipo de Usuario
      if (filtroTipoUsuario !== 'TODOS') {
        if ((u.nombre_tipo || '').toLowerCase() !== filtroTipoUsuario.toLowerCase()) {
          return false;
        }
      }

      // 2. Filtro Tipo de Documento
      if (filtroTipoDocumento !== 'TODOS') {
        if ((u.nombre_documento || '').toLowerCase() !== filtroTipoDocumento.toLowerCase()) {
          return false;
        }
      }

      // 3. Búsqueda por número de documento o nombre/apellidos
      if (busquedaUsuario.trim()) {
        const query = busquedaUsuario.toLowerCase().trim();
        const doc = (u.numero_documento || '').toLowerCase();
        const nombres = `${u.nombres || ''} ${u.apellidos || ''}`.toLowerCase();
        const correo = (u.correo_institucional || '').toLowerCase();
        return doc.includes(query) || nombres.includes(query) || correo.includes(query);
      }

      return true;
    });
  }, [data.usuarios, filtroTipoUsuario, filtroTipoDocumento, busquedaUsuario]);

  // Sesiones filtradas
  const sesionesFiltradas = useMemo(() => {
    if (!busquedaSesion.trim()) return data.sesiones;
    const q = busquedaSesion.toLowerCase();
    return data.sesiones.filter(
      (s) =>
        `${s.nombres} ${s.apellidos}`.toLowerCase().includes(q) ||
        (s.ip_acceso || '').toLowerCase().includes(q) ||
        (s.dispositivo || '').toLowerCase().includes(q)
    );
  }, [data.sesiones, busquedaSesion]);

  // Recorridos filtrados
  const recorridosFiltrados = useMemo(() => {
    if (!busquedaRecorrido.trim()) return data.recorridos;
    const q = busquedaRecorrido.toLowerCase();
    return data.recorridos.filter(
      (r) =>
        (r.lugar_mesh || '').toLowerCase().includes(q) ||
        `${r.nombres} ${r.apellidos}`.toLowerCase().includes(q)
    );
  }, [data.recorridos, busquedaRecorrido]);

  // Reportes filtrados
  const reportesFiltrados = useMemo(() => {
    return data.reportes.filter((rep) => {
      if (filtroEstadoReporte !== 'TODOS' && rep.estado !== filtroEstadoReporte) {
        return false;
      }
      return true;
    });
  }, [data.reportes, filtroEstadoReporte]);

  // Auditorías filtradas
  const auditoriasFiltradas = useMemo(() => {
    return data.admin_auditorias.filter((aud) => {
      if (filtroModuloAuditoria !== 'TODOS' && aud.modulo !== filtroModuloAuditoria) {
        return false;
      }
      if (busquedaAuditoria.trim()) {
        const q = busquedaAuditoria.toLowerCase();
        return (
          (aud.descripcion || '').toLowerCase().includes(q) ||
          (aud.admin_username || '').toLowerCase().includes(q) ||
          (aud.tipo_accion || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data.admin_auditorias, filtroModuloAuditoria, busquedaAuditoria]);

  // ==============================================================
  // CONFIGURACIÓN DE GRÁFICAS DE CHART.JS PARA TODAS LAS 9 SECCIONES
  // ==============================================================

  const chartDoughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 12, font: { size: 11, family: 'Poppins' }, color: '#94a3b8' }
      }
    }
  }), []);

  const chartBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: { font: { size: 10, family: 'Poppins' }, color: '#94a3b8' }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, family: 'Poppins' }, color: '#94a3b8', maxRotation: 35 }
      }
    }
  }), []);

  // 1. USUARIOS: Distribución por Rol y por Tipo de Documento
  const chartDataUsuariosRol = useMemo(() => {
    let estudiantes = 0;
    let generales = 0;
    data.usuarios.forEach((u) => {
      if ((u.tipo_usuario === 2 || (u.nombre_tipo || '').toLowerCase() === 'estudiante')) {
        estudiantes++;
      } else {
        generales++;
      }
    });
    return {
      labels: ['Estudiantes ITFIP', 'Visitantes / General'],
      datasets: [
        {
          data: [estudiantes, generales],
          backgroundColor: ['#2563eb', '#10b981'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.usuarios]);

  const chartDataUsuariosDoc = useMemo(() => {
    const mapDoc = {};
    data.usuarios.forEach((u) => {
      const doc = u.nombre_documento || 'Documento';
      mapDoc[doc] = (mapDoc[doc] || 0) + 1;
    });
    return {
      labels: Object.keys(mapDoc),
      datasets: [
        {
          label: 'Usuarios Registrados',
          data: Object.values(mapDoc),
          backgroundColor: '#38bdf8',
          borderRadius: 8
        }
      ]
    };
  }, [data.usuarios]);

  // 2. SESIONES USUARIOS: Dispositivos y Frecuencia de Accesos Recientes
  const chartDataSesionesDispositivos = useMemo(() => {
    let pc = 0, movil = 0, otros = 0;
    data.sesiones.forEach((s) => {
      const d = (s.dispositivo || '').toLowerCase();
      if (d.includes('android') || d.includes('iphone') || d.includes('mobile')) {
        movil++;
      } else if (d.includes('windows') || d.includes('macintosh') || d.includes('linux')) {
        pc++;
      } else {
        otros++;
      }
    });
    if (pc === 0 && movil === 0 && otros === 0 && data.sesiones.length > 0) {
      pc = Math.ceil(data.sesiones.length * 0.65);
      movil = data.sesiones.length - pc;
    }
    return {
      labels: ['Computador / PC', 'Smartphone / Móvil', 'Otros Dispositivos'],
      datasets: [
        {
          data: [pc, movil, otros],
          backgroundColor: ['#38bdf8', '#f59e0b', '#8b5cf6'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.sesiones]);

  const chartDataSesionesFechas = useMemo(() => {
    const mapFechas = {};
    data.sesiones.forEach((s) => {
      const f = (s.fecha_ingreso || '').slice(0, 10) || 'Reciente';
      mapFechas[f] = (mapFechas[f] || 0) + 1;
    });
    const entries = Object.entries(mapFechas).slice(-7);
    return {
      labels: entries.map(([f]) => f.slice(5) || f),
      datasets: [
        {
          label: 'Inicios de Sesión',
          data: entries.map(([, c]) => c),
          backgroundColor: '#818cf8',
          borderRadius: 8
        }
      ]
    };
  }, [data.sesiones]);

  // 3. LUGARES RECORRIDOS: Bloques (Doughnut) y Top 5 (Bar)
  const chartDataBloques = useMemo(() => {
    const bloques = data.estadisticas?.bloques || [];
    return {
      labels: bloques.map((b) => b.bloque),
      datasets: [
        {
          label: 'Búsquedas',
          data: bloques.map((b) => b.cantidad),
          backgroundColor: [
            '#38bdf8',
            '#818cf8',
            '#34d399',
            '#fbbf24',
            '#f472b6',
            '#fb923c',
            '#a78bfa',
            '#94a3b8'
          ],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.estadisticas]);

  const chartDataTop5Lugares = useMemo(() => {
    const top5 = (data.ranking_lugares || []).slice(0, 5);
    return {
      labels: top5.map((l) => l.lugar_mesh),
      datasets: [
        {
          label: 'Total Visitas / Búsquedas',
          data: top5.map((l) => parseInt(l.total_visitas, 10)),
          backgroundColor: '#38bdf8',
          borderRadius: 8,
          hoverBackgroundColor: '#0284c7'
        }
      ]
    };
  }, [data.ranking_lugares]);

  // 4. REPORTES DE MAPA: Balance por Estados y por Tipo de Error
  const chartDataReportesEstados = useMemo(() => {
    const resueltos = data.reportes.filter((r) => r.estado === 'resuelto').length;
    const enRev = data.reportes.filter((r) => r.estado === 'en_revision').length;
    const pend = data.reportes.filter((r) => r.estado === 'pendiente').length;
    return {
      labels: ['Resueltos', 'En Revisión', 'Pendientes'],
      datasets: [
        {
          data: [resueltos, enRev, pend],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.reportes]);

  const chartDataReportesTipos = useMemo(() => {
    const mapTipos = {};
    data.reportes.forEach((r) => {
      const tipo = r.tipo_error || 'Otro';
      mapTipos[tipo] = (mapTipos[tipo] || 0) + 1;
    });
    return {
      labels: Object.keys(mapTipos),
      datasets: [
        {
          label: 'Incidencias',
          data: Object.values(mapTipos),
          backgroundColor: '#f87171',
          borderRadius: 8
        }
      ]
    };
  }, [data.reportes]);

  // 5. ADMINISTRADORES: Distribución por Rol y Estado de Cuentas
  const chartDataAdminsRoles = useMemo(() => {
    const supers = data.admins.filter((a) => a.rol === 'superadmin').length;
    const regs = data.admins.length - supers;
    return {
      labels: ['Superadministrador', 'Administrador'],
      datasets: [
        {
          data: [supers, regs],
          backgroundColor: ['#8b5cf6', '#38bdf8'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.admins]);

  const chartDataAdminsEstado = useMemo(() => {
    const activos = data.admins.filter((a) => a.activo !== false && a.activo !== 0).length;
    const inactivos = data.admins.length - activos;
    return {
      labels: ['Activos', 'Inactivos'],
      datasets: [
        {
          label: 'Cuentas Admin',
          data: [activos, inactivos],
          backgroundColor: ['#10b981', '#64748b'],
          borderRadius: 8
        }
      ]
    };
  }, [data.admins]);

  // 6. AUDITORÍA Y CAMBIOS: Acciones por Módulo y Tipos de Acción
  const chartDataAuditoriasModulos = useMemo(() => {
    const mapMod = {};
    data.admin_auditorias.forEach((a) => {
      const m = a.modulo || 'General';
      mapMod[m] = (mapMod[m] || 0) + 1;
    });
    return {
      labels: Object.keys(mapMod),
      datasets: [
        {
          data: Object.values(mapMod),
          backgroundColor: ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#94a3b8'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.admin_auditorias]);

  const chartDataAuditoriasTipos = useMemo(() => {
    const mapTipos = {};
    data.admin_auditorias.forEach((a) => {
      const t = a.tipo_accion || 'ACCIÓN';
      mapTipos[t] = (mapTipos[t] || 0) + 1;
    });
    const keys = Object.keys(mapTipos).slice(0, 6);
    return {
      labels: keys,
      datasets: [
        {
          label: 'Operaciones',
          data: keys.map((k) => mapTipos[k]),
          backgroundColor: '#38bdf8',
          borderRadius: 8
        }
      ]
    };
  }, [data.admin_auditorias]);

  // 7. SESIONES ADMIN: Estado Activas vs Cerradas y Accesos por Usuario
  const chartDataAdminSesionesEstado = useMemo(() => {
    const activas = data.admin_sesiones.filter((s) => s.estado === 'activa').length;
    const cerradas = data.admin_sesiones.filter((s) => s.estado === 'cerrada').length;
    return {
      labels: ['Sesiones Activas', 'Sesiones Cerradas'],
      datasets: [
        {
          data: [activas, cerradas],
          backgroundColor: ['#10b981', '#64748b'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.admin_sesiones]);

  const chartDataAdminSesionesUser = useMemo(() => {
    const mapUser = {};
    data.admin_sesiones.forEach((s) => {
      const u = s.username || 'Admin';
      mapUser[u] = (mapUser[u] || 0) + 1;
    });
    return {
      labels: Object.keys(mapUser),
      datasets: [
        {
          label: 'Sesiones Iniciadas',
          data: Object.values(mapUser),
          backgroundColor: '#818cf8',
          borderRadius: 8
        }
      ]
    };
  }, [data.admin_sesiones]);

  // 8. NOTIFICACIONES: Por Categoría y Estado
  const chartDataNotificacionesTipos = useMemo(() => {
    let avisos = 0, mant = 0, urg = 0, act = 0;
    data.notificaciones.forEach((n) => {
      const t = (n.tipo || '').toLowerCase();
      if (t === 'mantenimiento') mant++;
      else if (t === 'urgente') urg++;
      else if (t === 'actualizacion') act++;
      else avisos++;
    });
    return {
      labels: ['Avisos Generales', 'Mantenimiento', 'Urgentes', 'Actualizaciones'],
      datasets: [
        {
          data: [avisos, mant, urg, act],
          backgroundColor: ['#38bdf8', '#f59e0b', '#ef4444', '#10b981'],
          borderWidth: 2,
          borderColor: '#0f172a'
        }
      ]
    };
  }, [data.notificaciones]);

  const chartDataNotificacionesEstado = useMemo(() => {
    const activas = data.notificaciones.filter((n) => n.activo).length;
    const inactivas = data.notificaciones.length - activas;
    return {
      labels: ['Activas en el Mapa', 'Inactivas / Archivadas'],
      datasets: [
        {
          label: 'Comunicados',
          data: [activas, inactivas],
          backgroundColor: ['#10b981', '#64748b'],
          borderRadius: 8
        }
      ]
    };
  }, [data.notificaciones]);

  // 9. ENCUESTAS: Votos por Estrellas y Comparativa de Dimensiones
  const chartDataEncuestasEstrellas = useMemo(() => {
    const est = data.encuestas_stats?.estrellas || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return {
      labels: ['1 ★', '2 ★★', '3 ★★★', '4 ★★★★', '5 ★★★★★'],
      datasets: [
        {
          label: 'Votos',
          data: [est[1] || 0, est[2] || 0, est[3] || 0, est[4] || 0, est[5] || 0],
          backgroundColor: ['#ef4444', '#f97316', '#facc15', '#a3e635', '#22c55e'],
          borderRadius: 8
        }
      ]
    };
  }, [data.encuestas_stats]);

  const chartDataEncuestasDimensiones = useMemo(() => {
    const s = data.encuestas_stats || {};
    return {
      labels: ['Calificación General', 'Facilidad de Uso', 'Calidad Mapa 3D'],
      datasets: [
        {
          label: 'Promedio (sobre 5.0 ★)',
          data: [
            parseFloat(s.promedio_general || 0),
            parseFloat(s.promedio_facilidad || 0),
            parseFloat(s.promedio_mapa_3d || 0)
          ],
          backgroundColor: ['#f59e0b', '#2563eb', '#10b981'],
          borderRadius: 8
        }
      ]
    };
  }, [data.encuestas_stats]);

  // Construir mapa de configuraciones de gráficas para el generador de PDF
  const obtenerChartConfigs = useCallback((seccion) => {
    switch (seccion) {
      case 'usuarios':
        return {
          grafica1: { type: 'doughnut', titulo: 'Distribución por Rol de Usuario', data: chartDataUsuariosRol },
          grafica2: { type: 'bar', titulo: 'Distribución por Tipo de Documento', data: chartDataUsuariosDoc }
        };
      case 'sesiones':
        return {
          grafica1: { type: 'doughnut', titulo: 'Dispositivos de Acceso al Campus', data: chartDataSesionesDispositivos },
          grafica2: { type: 'bar', titulo: 'Inicios de Sesión Recientes por Fecha', data: chartDataSesionesFechas }
        };
      case 'recorridos':
        return {
          grafica1: { type: 'doughnut', titulo: 'Búsquedas por Bloques del Campus', data: chartDataBloques },
          grafica2: { type: 'bar', titulo: 'Top 5 Lugares Más Frecuentados en 3D', data: chartDataTop5Lugares }
        };
      case 'reportes':
        return {
          grafica1: { type: 'doughnut', titulo: 'Balance de Estados de Incidencias', data: chartDataReportesEstados },
          grafica2: { type: 'bar', titulo: 'Incidencias por Tipo de Error', data: chartDataReportesTipos }
        };
      case 'admins':
        return {
          grafica1: { type: 'doughnut', titulo: 'Distribución de Roles de Administración', data: chartDataAdminsRoles },
          grafica2: { type: 'bar', titulo: 'Estado Operativo de Cuentas', data: chartDataAdminsEstado }
        };
      case 'auditorias':
        return {
          grafica1: { type: 'doughnut', titulo: 'Acciones por Módulo del Sistema', data: chartDataAuditoriasModulos },
          grafica2: { type: 'bar', titulo: 'Tipos de Acción Más Frecuentes', data: chartDataAuditoriasTipos }
        };
      case 'admin_sesiones':
        return {
          grafica1: { type: 'doughnut', titulo: 'Estado de Sesiones Administrativas', data: chartDataAdminSesionesEstado },
          grafica2: { type: 'bar', titulo: 'Conexiones por Usuario Administrador', data: chartDataAdminSesionesUser }
        };
      case 'notificaciones':
        return {
          grafica1: { type: 'doughnut', titulo: 'Categorías de Avisos y Alertas', data: chartDataNotificacionesTipos },
          grafica2: { type: 'bar', titulo: 'Visibilidad de Notificaciones', data: chartDataNotificacionesEstado }
        };
      case 'encuestas':
        return {
          grafica1: { type: 'bar', titulo: 'Distribución de Calificaciones de 1 a 5 Estrellas', data: chartDataEncuestasEstrellas },
          grafica2: { type: 'bar', titulo: 'Promedios por Dimensión de Satisfacción', data: chartDataEncuestasDimensiones }
        };
      case 'general':
      default:
        return {
          recorridosTop5: chartDataTop5Lugares,
          recorridosBloques: chartDataBloques,
          reportesEstados: chartDataReportesEstados,
          encuestasEstrellas: chartDataEncuestasEstrellas
        };
    }
  }, [
    chartDataUsuariosRol,
    chartDataUsuariosDoc,
    chartDataSesionesDispositivos,
    chartDataSesionesFechas,
    chartDataBloques,
    chartDataTop5Lugares,
    chartDataReportesEstados,
    chartDataReportesTipos,
    chartDataAdminsRoles,
    chartDataAdminsEstado,
    chartDataAuditoriasModulos,
    chartDataAuditoriasTipos,
    chartDataAdminSesionesEstado,
    chartDataAdminSesionesUser,
    chartDataNotificacionesTipos,
    chartDataNotificacionesEstado,
    chartDataEncuestasEstrellas,
    chartDataEncuestasDimensiones
  ]);

  // Descarga del reporte PDF con gráficas en alta resolución
  const handleDescargarPDF = async (seccion = tabActiva) => {
    setDescargandoPdf(true);
    setMenuPdfAbierto(false);
    try {
      const chartConfigs = obtenerChartConfigs(seccion);
      await generarReportePDFConGraficas({
        seccion,
        data,
        adminUsername: adminSesion?.username || 'admin@Unimap',
        chartConfigs
      });
    } catch (err) {
      console.error('Error al generar reporte PDF con gráficas:', err);
      alert('Ocurrió un error al generar el reporte PDF con las gráficas. Intenta nuevamente.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  // Renderizar Estrellas
  const renderEstrellas = (calificacion) => {
    const cant = Math.round(calificacion || 0);
    return (
      <span style={{ color: '#fbbf24', letterSpacing: '2px' }}>
        {'★'.repeat(cant)}
        {'☆'.repeat(5 - cant)}
      </span>
    );
  };

  return (
    <div className="AdminPage">
      <Header />

      <div className="AdminContainer">
        {/* BARRA SUPERIOR DE ADMINISTRACIÓN */}
        <div className="AdminTopBar">
          <div className="AdminTitulo">
            <h1>
              <Shield size={24} color="#38bdf8" />
              Panel de Administración UniMap
            </h1>
            <p>
              Gestión centralizada del campus 3D, usuarios, reportes y encuestas de satisfacción
            </p>
          </div>

          <div className="AdminAccionesTop">
            <span className="badgeAdminUser">
              <KeyRound size={13} />
              {adminSesion?.nombre || adminSesion?.username || 'Administrador'}
            </span>

            <button
              type="button"
              className="btnAdminAccionTop btnDescargarPdfAdmin"
              style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
              onClick={cargarDashboard}
              title="Refrescar estadísticas del panel"
            >
              <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>

            {/* OPCIÓN DE DESCARGA DE REPORTES PDF */}
            <div className="dropdownPdfWrapper">
              <button
                type="button"
                className="btnAdminAccionTop btnDescargarPdfAdmin"
                onClick={() => setMenuPdfAbierto((prev) => !prev)}
                disabled={descargandoPdf}
                title="Descargar Reporte de Gráficas en Formato PDF"
              >
                <FileDown size={15} className={descargandoPdf ? 'animate-spin' : ''} />
                <span>{descargandoPdf ? 'Generando PDF...' : 'Descargar Reporte PDF'}</span>
                <ChevronDown size={13} />
              </button>

              {menuPdfAbierto && (
                <div className="menuDesplegablePdf">
                  <button
                    type="button"
                    className="itemDropdownPdf"
                    onClick={() => handleDescargarPDF(tabActiva)}
                  >
                    <FileDown size={15} color="#10b981" />
                    <span>Reporte PDF de esta Sección ({getNombreTab(tabActiva)})</span>
                  </button>

                  <button
                    type="button"
                    className="itemDropdownPdf"
                    onClick={() => handleDescargarPDF('general')}
                  >
                    <FileText size={15} color="#38bdf8" />
                    <span>Reporte Ejecutivo General (Todas las Secciones)</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="btnAdminAccionTop btnCerrarSesionAdmin"
              onClick={handleCerrarSesion}
              title="Cerrar sesión de administrador"
            >
              <LogOut size={15} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* TARJETAS DE MÉTRICAS GLOBALES (KPIs) */}
        <div className="AdminMetricasGrid">
          <div className="cardMetrica">
            <div className="headerMetrica">
              <span className="labelMetrica">Usuarios</span>
              <span className="iconoMetrica">👥</span>
            </div>
            <div className="valorMetrica">{data.metricas.total_usuarios}</div>
            <span className="subtextoMetrica">Registrados en la plataforma</span>
          </div>

          <div className="cardMetrica">
            <div className="headerMetrica">
              <span className="labelMetrica">Inicios de Sesión</span>
              <span className="iconoMetrica">🕒</span>
            </div>
            <div className="valorMetrica">{data.metricas.total_sesiones}</div>
            <span className="subtextoMetrica">Accesos totales de usuarios</span>
          </div>

          <div className="cardMetrica">
            <div className="headerMetrica">
              <span className="labelMetrica">Lugares Recorridos</span>
              <span className="iconoMetrica">📍</span>
            </div>
            <div className="valorMetrica">{data.metricas.total_recorridos}</div>
            <span className="subtextoMetrica">Búsquedas y rutas guiadas</span>
          </div>

          <div className="cardMetrica">
            <div className="headerMetrica">
              <span className="labelMetrica">Reportes del Mapa</span>
              <span className="iconoMetrica">⚠️</span>
            </div>
            <div className="valorMetrica">
              {data.metricas.total_reportes}
              {data.metricas.reportes_pendientes > 0 && (
                <span className="badgePendientesMetricas">
                  {data.metricas.reportes_pendientes} pend.
                </span>
              )}
            </div>
            <span className="subtextoMetrica">Incidencias reportadas</span>
          </div>

          <div className="cardMetrica">
            <div className="headerMetrica">
              <span className="labelMetrica">Satisfacción 3D</span>
              <span className="iconoMetrica">⭐</span>
            </div>
            <div className="valorMetrica">
              {data.encuestas_stats.promedio_general || 0} / 5
            </div>
            <span className="subtextoMetrica">
              {data.encuestas_stats.total_respuestas} respuestas recibidas
            </span>
          </div>
        </div>

        {/* TARJETA PRINCIPAL CON LAS 9 PESTAÑAS SOLICITADAS */}
        <div className="AdminCardMain">
          {/* NAVEGACIÓN POR PESTAÑAS (ÚNICAMENTE LAS 9 SOLICITADAS) */}
          <div className="AdminTabsContainer">
            {/* 1. Usuarios */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'usuarios' ? 'activo' : ''}`}
              onClick={() => setTabActiva('usuarios')}
            >
              <Users size={16} />
              <span>Usuarios</span>
              <span className="badgeTabCount">{data.usuarios.length}</span>
            </button>

            {/* 2. Sesiones Usuarios */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'sesiones' ? 'activo' : ''}`}
              onClick={() => setTabActiva('sesiones')}
            >
              <Clock size={16} />
              <span>Sesiones Usuarios</span>
              <span className="badgeTabCount">{data.sesiones.length}</span>
            </button>

            {/* 3. Lugares Recorridos */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'recorridos' ? 'activo' : ''}`}
              onClick={() => setTabActiva('recorridos')}
            >
              <MapPin size={16} />
              <span>Lugares Recorridos</span>
              <span className="badgeTabCount">{data.recorridos.length}</span>
            </button>

            {/* 4. Reportes de Mapa */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'reportes' ? 'activo' : ''}`}
              onClick={() => setTabActiva('reportes')}
            >
              <AlertTriangle size={16} />
              <span>Reportes de Mapa</span>
              <span className="badgeTabCount">{data.reportes.length}</span>
            </button>

            {/* 5. Administradores */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'admins' ? 'activo' : ''}`}
              onClick={() => setTabActiva('admins')}
            >
              <Shield size={16} />
              <span>Administradores</span>
              <span className="badgeTabCount">{data.admins.length}</span>
            </button>

            {/* 6. Auditoría y Cambios */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'auditorias' ? 'activo' : ''}`}
              onClick={() => setTabActiva('auditorias')}
            >
              <FileText size={16} />
              <span>Auditoría y Cambios</span>
              <span className="badgeTabCount">{data.admin_auditorias.length}</span>
            </button>

            {/* 7. Sesiones Admin */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'admin_sesiones' ? 'activo' : ''}`}
              onClick={() => setTabActiva('admin_sesiones')}
            >
              <KeyRound size={16} />
              <span>Sesiones Admin</span>
              <span className="badgeTabCount">{data.admin_sesiones.length}</span>
            </button>

            {/* 8. Notificaciones */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'notificaciones' ? 'activo' : ''}`}
              onClick={() => setTabActiva('notificaciones')}
            >
              <Bell size={16} />
              <span>Notificaciones</span>
              <span className="badgeTabCount">{data.notificaciones.length}</span>
            </button>

            {/* 9. Encuestas */}
            <button
              type="button"
              className={`btnTab ${tabActiva === 'encuestas' ? 'activo' : ''}`}
              onClick={() => setTabActiva('encuestas')}
            >
              <Star size={16} />
              <span>Encuestas</span>
              <span className="badgeTabCount">{data.encuestas.length}</span>
            </button>
          </div>

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 1: USUARIOS
              ============================================================== */}
          {tabActiva === 'usuarios' && (
            <>
              {/* Gráficas Estadísticas de Usuarios */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <Users size={17} color="#2563eb" />
                      Distribución por Rol Institucional
                    </h4>
                    <span>Estudiantes vs Visitantes</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataUsuariosRol} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <FileText size={17} color="#38bdf8" />
                      Tipos de Documento de Identidad
                    </h4>
                    <span>Cédula, Tarjeta y otros</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataUsuariosDoc} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  {/* Búsqueda por documento o nombre */}
                  <input
                    type="text"
                    className="inputSearchAdmin"
                    placeholder="🔍 Buscar por nombre o número de documento..."
                    value={busquedaUsuario}
                    onChange={(e) => setBusquedaUsuario(e.target.value)}
                  />

                  {/* Filtro por Tipo de Usuario */}
                  <select
                    className="selectFiltroAdmin"
                    value={filtroTipoUsuario}
                    onChange={(e) => setFiltroTipoUsuario(e.target.value)}
                  >
                    <option value="TODOS">Todos los Tipos de Usuario</option>
                    {data.tipos_usuario.map((t) => (
                      <option key={t.id_tipo} value={t.tipo_usuario}>
                        {t.tipo_usuario}
                      </option>
                    ))}
                  </select>

                  {/* Filtro por Tipo de Documento */}
                  <select
                    className="selectFiltroAdmin"
                    value={filtroTipoDocumento}
                    onChange={(e) => setFiltroTipoDocumento(e.target.value)}
                  >
                    <option value="TODOS">Todos los Tipos de Documento</option>
                    {catalogoTiposDocumento.map((doc) => (
                      <option key={doc} value={doc}>
                        {doc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="AdminFiltrosRight">
                  <span className="badgeTabCount">
                    Mostrando {usuariosFiltrados.length} de {data.usuarios.length}
                  </span>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Nombre Completo</th>
                      <th>Tipo Usuario</th>
                      <th>Carrera / Semestre</th>
                      <th>Correo Institucional</th>
                      <th>Fecha Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.length > 0 ? (
                      usuariosFiltrados.map((u) => (
                        <tr key={u.id_general || u.id_usuario}>
                          <td>
                            <strong>{u.numero_documento}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {u.nombre_documento || 'Doc'}
                            </div>
                          </td>
                          <td>
                            <strong>
                              {u.nombres} {u.apellidos}
                            </strong>
                          </td>
                          <td>
                            <span className="badgeTipoUsuario">
                              {u.nombre_tipo || 'General'}
                            </span>
                          </td>
                          <td>
                            {u.nombre_carrera ? (
                              <>
                                <div>{u.nombre_carrera}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Semestre {u.nombre_semestre || 'N/A'}
                                </div>
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>{u.correo_institucional || '—'}</td>
                          <td>
                            {u.fecha_sys ? new Date(u.fecha_sys).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="sinResultadosTabla">
                          No se encontraron usuarios que coincidan con los filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 2: SESIONES USUARIOS
              ============================================================== */}
          {tabActiva === 'sesiones' && (
            <>
              {/* Gráficas Estadísticas de Sesiones */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <Clock size={17} color="#38bdf8" />
                      Dispositivos y Plataformas
                    </h4>
                    <span>PC vs Móvil</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataSesionesDispositivos} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#818cf8" />
                      Frecuencia de Accesos Recientes
                    </h4>
                    <span>Inicios de sesión por fecha</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataSesionesFechas} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  <input
                    type="text"
                    className="inputSearchAdmin"
                    placeholder="🔍 Buscar por usuario, IP o dispositivo..."
                    value={busquedaSesion}
                    onChange={(e) => setBusquedaSesion(e.target.value)}
                  />
                </div>
                <div className="AdminFiltrosRight">
                  <span className="badgeTabCount">
                    Total Inicios: {sesionesFiltradas.length}
                  </span>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>IP de Acceso</th>
                      <th>Dispositivo / Navegador</th>
                      <th>Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sesionesFiltradas.length > 0 ? (
                      sesionesFiltradas.map((s) => (
                        <tr key={s.id_sesion}>
                          <td>#{s.id_sesion}</td>
                          <td>
                            <strong>
                              {s.nombres} {s.apellidos}
                            </strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ID: {s.id_usuario}
                            </div>
                          </td>
                          <td>
                            <code>{s.ip_acceso || '127.0.0.1'}</code>
                          </td>
                          <td>{s.dispositivo || 'Navegador Web'}</td>
                          <td>{s.fecha_ingreso}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="sinResultadosTabla">
                          No hay registros de sesión disponibles.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 3: LUGARES RECORRIDOS (GRÁFICAS Y TOP)
              ============================================================== */}
          {tabActiva === 'recorridos' && (
            <>
              {/* Banner Destacado del Bloque Más Buscado */}
              {data.metricas.bloque_top && (
                <div className="bannerBloqueMasBuscado">
                  <div className="infoBannerBloque">
                    <div className="iconoBloqueBanner">
                      <Building2 size={28} />
                    </div>
                    <div className="textosBannerBloque">
                      <h3>Bloque Más Buscado del Campus: {data.metricas.bloque_top.bloque}</h3>
                      <p>
                        Concentra la mayor cantidad de recorridos y consultas en el campus 3D
                      </p>
                    </div>
                  </div>
                  <div className="estadisticaBloqueValor">
                    {data.metricas.bloque_top.porcentaje}%
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ({data.metricas.bloque_top.cantidad} visitas)
                    </div>
                  </div>
                </div>
              )}

              {/* Grid de Gráficas Estadísticas */}
              <div className="gridGraficasAdmin">
                {/* Gráfica 1: Los 5 Lugares Más Buscados */}
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <MapPin size={17} color="#38bdf8" />
                      Los 5 Lugares Más Buscados
                    </h4>
                    <span>Ranking Top 5</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar
                      data={chartDataTop5Lugares}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false }
                        },
                        scales: {
                          y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.06)' } },
                          x: { grid: { display: false } }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Gráfica 2: Distribución de Búsquedas por Bloques */}
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <Building2 size={17} color="#818cf8" />
                      Búsquedas por Bloques
                    </h4>
                    <span>Distribución general</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut
                      data={chartDataBloques}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Tabla de Historial de Búsquedas Recientes */}
              <div className="AdminFiltrosBar" style={{ marginTop: '10px' }}>
                <div className="AdminFiltrosLeft">
                  <input
                    type="text"
                    className="inputSearchAdmin"
                    placeholder="🔍 Filtrar recorridos por lugar o usuario..."
                    value={busquedaRecorrido}
                    onChange={(e) => setBusquedaRecorrido(e.target.value)}
                  />
                </div>
                <div className="AdminFiltrosRight">
                  <span className="badgeTabCount">
                    Total Recorridos: {recorridosFiltrados.length}
                  </span>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>Lugar / Espacio Recorrido</th>
                      <th>Origen Búsqueda</th>
                      <th>Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recorridosFiltrados.length > 0 ? (
                      recorridosFiltrados.map((r) => (
                        <tr key={r.id_recorrido}>
                          <td>#{r.id_recorrido}</td>
                          <td>
                            <strong>
                              {r.nombres} {r.apellidos}
                            </strong>
                          </td>
                          <td>
                            <strong style={{ color: '#38bdf8' }}>{r.lugar_mesh}</strong>
                          </td>
                          <td>
                            <span className="badgeTipoUsuario">
                              {r.origen_busqueda || 'buscador'}
                            </span>
                          </td>
                          <td>{r.fecha_busqueda}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="sinResultadosTabla">
                          No hay registros de recorridos disponibles.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 4: REPORTES DE MAPA
              ============================================================== */}
          {tabActiva === 'reportes' && (
            <>
              {/* Gráficas Estadísticas de Reportes */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <AlertTriangle size={17} color="#f59e0b" />
                      Balance de Estados
                    </h4>
                    <span>Resueltos, Revisión y Pendientes</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataReportesEstados} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#ef4444" />
                      Incidencias por Tipo de Error
                    </h4>
                    <span>Frecuencia por categoría</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataReportesTipos} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  <select
                    className="selectFiltroAdmin"
                    value={filtroEstadoReporte}
                    onChange={(e) => setFiltroEstadoReporte(e.target.value)}
                  >
                    <option value="TODOS">Todos los Estados</option>
                    <option value="pendiente">Pendientes</option>
                    <option value="en_revision">En Revisión</option>
                    <option value="resuelto">Resueltos</option>
                  </select>
                </div>
                <div className="AdminFiltrosRight">
                  <span className="badgeTabCount">
                    Reportes: {reportesFiltrados.length}
                  </span>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>Tipo de Error</th>
                      <th>Lugar Afectado</th>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportesFiltrados.length > 0 ? (
                      reportesFiltrados.map((rep) => (
                        <tr key={rep.id_reporte}>
                          <td>#{rep.id_reporte}</td>
                          <td>
                            <strong>
                              {rep.nombres} {rep.apellidos}
                            </strong>
                          </td>
                          <td>
                            <span style={{ color: '#f87171', fontWeight: 600 }}>
                              {rep.tipo_error}
                            </span>
                          </td>
                          <td>{rep.lugar_afectado || 'Campus General'}</td>
                          <td style={{ maxWidth: '300px' }}>{rep.descripcion}</td>
                          <td>
                            <span className={`badgeEstadoReporte ${rep.estado}`}>
                              {rep.estado}
                            </span>
                          </td>
                          <td>{rep.fecha_reporte}</td>
                          <td>
                            <button
                              type="button"
                              className="btnAdminNav"
                              style={{ padding: '6px 12px', fontSize: '11px' }}
                              onClick={() => {
                                setModalEstadoReporte(rep);
                                setNuevoEstadoReporte(rep.estado);
                                setNotaAdminReporte('');
                              }}
                            >
                              Cambiar Estado
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="sinResultadosTabla">
                          No hay reportes de incidencias del mapa registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 5: ADMINISTRADORES
              ============================================================== */}
          {tabActiva === 'admins' && (
            <>
              {/* Gráficas Estadísticas de Administradores */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <Shield size={17} color="#8b5cf6" />
                      Privilegios y Roles
                    </h4>
                    <span>Superadmin vs Administrador</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataAdminsRoles} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#10b981" />
                      Estado Operativo de Cuentas
                    </h4>
                    <span>Activas vs Inactivas</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataAdminsEstado} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Cuentas con privilegios de gestión y configuración
                  </span>
                </div>
                <div className="AdminFiltrosRight">
                  <button
                    type="button"
                    className="btnNuevoElementoAdmin"
                    onClick={() => setModalNuevoAdmin(true)}
                  >
                    <Plus size={16} />
                    <span>Nuevo Administrador</span>
                  </button>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario / Correo</th>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Último Acceso</th>
                      <th>Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admins.map((adm) => (
                      <tr key={adm.id_admin}>
                        <td>#{adm.id_admin}</td>
                        <td>
                          <strong>{adm.username}</strong>
                        </td>
                        <td>{adm.nombre}</td>
                        <td>
                          <span className="badgeTipoUsuario">{adm.rol}</span>
                        </td>
                        <td>
                          {adm.activo ? (
                            <span className="badgeSesionActiva">Activo</span>
                          ) : (
                            <span className="badgeSesionCerrada">Inactivo</span>
                          )}
                        </td>
                        <td>{adm.ultimo_acceso || 'Nunca'}</td>
                        <td>{adm.created_at ? new Date(adm.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 6: AUDITORÍA Y CAMBIOS
              ============================================================== */}
          {tabActiva === 'auditorias' && (
            <>
              {/* Gráficas Estadísticas de Auditoría */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <FileText size={17} color="#38bdf8" />
                      Acciones por Módulo del Sistema
                    </h4>
                    <span>Reportes, Seguridad, Usuarios, etc.</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataAuditoriasModulos} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#818cf8" />
                      Operaciones y Tipos de Acción
                    </h4>
                    <span>Frecuencia de eventos auditados</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataAuditoriasTipos} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  <input
                    type="text"
                    className="inputSearchAdmin"
                    placeholder="🔍 Buscar por acción o administrador..."
                    value={busquedaAuditoria}
                    onChange={(e) => setBusquedaAuditoria(e.target.value)}
                  />
                  <select
                    className="selectFiltroAdmin"
                    value={filtroModuloAuditoria}
                    onChange={(e) => setFiltroModuloAuditoria(e.target.value)}
                  >
                    <option value="TODOS">Todos los Módulos</option>
                    <option value="Seguridad">Seguridad</option>
                    <option value="Reportes del Mapa">Reportes del Mapa</option>
                    <option value="Gestión Administradores">Gestión Administradores</option>
                    <option value="Notificaciones">Notificaciones</option>
                    <option value="Encuestas">Encuestas</option>
                  </select>
                </div>
                <div className="AdminFiltrosRight">
                  <span className="badgeTabCount">
                    Acciones: {auditoriasFiltradas.length}
                  </span>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Administrador</th>
                      <th>Acción</th>
                      <th>Módulo</th>
                      <th>Descripción Detallada</th>
                      <th>IP Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoriasFiltradas.length > 0 ? (
                      auditoriasFiltradas.map((aud) => (
                        <tr key={aud.id_auditoria}>
                          <td>{aud.fecha_accion}</td>
                          <td>
                            <strong>{aud.admin_username}</strong>
                          </td>
                          <td>
                            <code style={{ color: '#38bdf8' }}>{aud.tipo_accion}</code>
                          </td>
                          <td>
                            <span className="badgeTipoUsuario">{aud.modulo}</span>
                          </td>
                          <td>{aud.descripcion}</td>
                          <td>
                            <small>{aud.ip_origen}</small>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="sinResultadosTabla">
                          No hay registros de auditoría que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 7: SESIONES ADMIN
              ============================================================== */}
          {tabActiva === 'admin_sesiones' && (
            <>
              {/* Gráficas Estadísticas de Sesiones Admin */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <KeyRound size={17} color="#10b981" />
                      Estado de Sesiones Administrativas
                    </h4>
                    <span>Activas vs Cerradas</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataAdminSesionesEstado} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#818cf8" />
                      Accesos por Administrador
                    </h4>
                    <span>Conexiones por cuenta</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataAdminSesionesUser} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Administrador</th>
                      <th>IP Acceso</th>
                      <th>Dispositivo</th>
                      <th>Fecha Inicio</th>
                      <th>Fecha Cierre</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.admin_sesiones.map((s) => (
                      <tr key={s.id_sesion}>
                        <td>#{s.id_sesion}</td>
                        <td>
                          <strong>{s.username}</strong>
                        </td>
                        <td>
                          <code>{s.ip_acceso || '127.0.0.1'}</code>
                        </td>
                        <td>{s.dispositivo || 'Navegador Web'}</td>
                        <td>{s.fecha_inicio}</td>
                        <td>{s.fecha_cierre || '—'}</td>
                        <td>
                          {s.estado === 'activa' ? (
                            <span className="badgeSesionActiva">Activa</span>
                          ) : (
                            <span className="badgeSesionCerrada">Cerrada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 8: NOTIFICACIONES
              ============================================================== */}
          {tabActiva === 'notificaciones' && (
            <>
              {/* Gráficas Estadísticas de Notificaciones */}
              <div className="gridGraficasAdmin" style={{ marginBottom: '18px' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <Bell size={17} color="#38bdf8" />
                      Comunicados por Categoría
                    </h4>
                    <span>Avisos, Mantenimiento y Alertas</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Doughnut data={chartDataNotificacionesTipos} options={chartDoughnutOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#10b981" />
                      Estado Operativo de Comunicados
                    </h4>
                    <span>Visibles en el mapa vs Ocultas</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataNotificacionesEstado} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Mensajes y avisos emergentes transmitidos a los usuarios del campus 3D
                  </span>
                </div>
                <div className="AdminFiltrosRight">
                  <button
                    type="button"
                    className="btnNuevoElementoAdmin"
                    onClick={() => setModalNuevaNoti(true)}
                  >
                    <Plus size={16} />
                    <span>Nueva Notificación</span>
                  </button>
                </div>
              </div>

              <div className="tablaAdminWrapper">
                <table className="tablaAdmin">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Título</th>
                      <th>Mensaje</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.notificaciones.length > 0 ? (
                      data.notificaciones.map((noti) => (
                        <tr key={noti.id_notificacion}>
                          <td>#{noti.id_notificacion}</td>
                          <td>
                            <strong>{noti.titulo}</strong>
                          </td>
                          <td style={{ maxWidth: '350px' }}>{noti.mensaje}</td>
                          <td>
                            <span className="badgeTipoUsuario">{noti.tipo}</span>
                          </td>
                          <td>
                            {noti.activo ? (
                              <span className="badgeSesionActiva">Visible</span>
                            ) : (
                              <span className="badgeSesionCerrada">Oculta</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="btnAdminNav"
                                style={{ padding: '6px 12px', fontSize: '11px' }}
                                onClick={() => handleToggleNotificacion(noti.id_notificacion)}
                              >
                                {noti.activo ? 'Desactivar' : 'Activar'}
                              </button>
                              <button
                                type="button"
                                className="btnAdminNav"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#f87171',
                                  borderColor: 'rgba(239, 68, 68, 0.3)'
                                }}
                                onClick={() => handleEliminarNotificacion(noti.id_notificacion)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="sinResultadosTabla">
                          No hay notificaciones emitidas actualmente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==============================================================
              CONTENIDO DE LA PESTAÑA 9: ENCUESTAS (RESULTADOS Y ESTRELLAS)
              ============================================================== */}
          {tabActiva === 'encuestas' && (
            <>
              <div className="AdminFiltrosBar">
                <div className="AdminFiltrosLeft">
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Evaluación y retroalimentación de experiencia de estudiantes y visitantes
                  </span>
                </div>
                <div className="AdminFiltrosRight">
                  <button
                    type="button"
                    className="btnNuevoElementoAdmin"
                    onClick={() => setModalNuevaEncuesta(true)}
                  >
                    <Plus size={16} />
                    <span>Nueva Encuesta</span>
                  </button>
                </div>
              </div>

              {/* Resumen de Calificación por Estrellas */}
              <div className="gridEncuestasResumen">
                {/* Puntuación General */}
                <div className="cardScoreGeneral">
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    CALIFICACIÓN GENERAL
                  </span>
                  <div className="puntuacionNumeroGrande">
                    {data.encuestas_stats.promedio_general || 0}
                  </div>
                  <div className="estrellasRenderGrandes">
                    {renderEstrellas(data.encuestas_stats.promedio_general)}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Basado en {data.encuestas_stats.total_respuestas} respuestas
                  </span>
                </div>

                {/* Desglose de Estrellas (1 a 5) */}
                <div className="desgloseEstrellasCard">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = data.encuestas_stats.estrellas?.[stars] || 0;
                    const total = data.encuestas_stats.total_respuestas || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={stars} className="filaBarraEstrella">
                        <span className="labelEstrella">{stars} ★</span>
                        <div className="trackBarraEstrella">
                          <div className="fillBarraEstrella" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="conteoEstrellas">{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Promedios Específicos */}
                <div className="cardScoreGeneral" style={{ gap: '14px', alignItems: 'stretch' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    MÉTRICAS DE DETALLE
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Facilidad de Uso:</span>
                    <strong style={{ color: '#38bdf8', fontSize: '16px' }}>
                      {data.encuestas_stats.promedio_facilidad || 0} / 5
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Calidad Mapa 3D:</span>
                    <strong style={{ color: '#34d399', fontSize: '16px' }}>
                      {data.encuestas_stats.promedio_mapa_3d || 0} / 5
                    </strong>
                  </div>
                </div>
              </div>

              {/* Gráficas Estadísticas de Encuestas */}
              <div className="gridGraficasAdmin" style={{ margin: '18px 0' }}>
                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <Star size={17} color="#f59e0b" />
                      Distribución de Votos por Estrellas
                    </h4>
                    <span>Frecuencia de 1 a 5 ★</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataEncuestasEstrellas} options={chartBarOptions} />
                  </div>
                </div>

                <div className="cardGraficaAdmin">
                  <div className="cardGraficaHeader">
                    <h4>
                      <BarChart3 size={17} color="#2563eb" />
                      Comparativa de Promedios de Calidad
                    </h4>
                    <span>Puntuación sobre 5.0 ★</span>
                  </div>
                  <div className="canvasContainerGrafica">
                    <Bar data={chartDataEncuestasDimensiones} options={chartBarOptions} />
                  </div>
                </div>
              </div>

              {/* Feed de Comentarios y Preguntas Abiertas */}
              <h4 style={{ margin: '20px 0 10px 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                💬 Opiniones y Sugerencias Abiertas de los Usuarios
              </h4>

              <div className="listaComentariosFeed">
                {data.encuestas_stats.comentarios && data.encuestas_stats.comentarios.length > 0 ? (
                  data.encuestas_stats.comentarios.map((c) => (
                    <div key={c.id_respuesta} className="itemComentarioCard">
                      <div className="headerItemComentario">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="nombreUsuarioComentario">
                            {c.nombres ? `${c.nombres} ${c.apellidos}` : 'Usuario Anónimo'}
                          </span>
                          <span>{renderEstrellas(c.calificacion_general)}</span>
                        </div>
                        <span className="fechaComentario">{c.created_at}</span>
                      </div>
                      <p className="textoComentario">"{c.comentarios}"</p>
                      <div className="tagsDetallePuntuacion">
                        <span className="tagPuntaje">Facilidad: {c.facilidad_uso}/5</span>
                        <span className="tagPuntaje">Mapa 3D: {c.calidad_mapa_3d}/5</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sinResultadosTabla">
                    No se han registrado comentarios abiertos de encuestas todavía.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ==============================================================
          MODALES DE ADMINISTRACIÓN
          ============================================================== */}

      {/* Modal 1: Nuevo Administrador */}
      {modalNuevoAdmin && (
        <div className="modalAdminOverlay">
          <div className="modalAdminCard">
            <div className="modalAdminHeader">
              <h3>
                <Shield size={18} color="#38bdf8" />
                Registrar Nuevo Administrador
              </h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalNuevoAdmin(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCrearAdmin}>
              <div className="modalAdminBody">
                <div className="grupoCampoAdmin">
                  <label>Nombre de Usuario / Correo:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. coordinador@unimap"
                    value={formAdmin.username}
                    onChange={(e) => setFormAdmin({ ...formAdmin, username: e.target.value })}
                  />
                </div>
                <div className="grupoCampoAdmin">
                  <label>Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Ing. Carlos Mendoza"
                    value={formAdmin.nombre}
                    onChange={(e) => setFormAdmin({ ...formAdmin, nombre: e.target.value })}
                  />
                </div>
                <div className="grupoCampoAdmin">
                  <label>Contraseña de Acceso:</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={formAdmin.password}
                    onChange={(e) => setFormAdmin({ ...formAdmin, password: e.target.value })}
                  />
                </div>
                <div className="grupoCampoAdmin">
                  <label>Rol:</label>
                  <select
                    value={formAdmin.rol}
                    onChange={(e) => setFormAdmin({ ...formAdmin, rol: e.target.value })}
                  >
                    <option value="administrador">Administrador</option>
                    <option value="superadmin">Super Administrador</option>
                  </select>
                </div>
              </div>
              <div className="modalAdminFooter">
                <button
                  type="button"
                  className="btnModalCancelar"
                  onClick={() => setModalNuevoAdmin(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btnModalConfirmar"
                  disabled={guardandoAdmin}
                >
                  {guardandoAdmin ? 'Guardando...' : 'Crear Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Nueva Notificación */}
      {modalNuevaNoti && (
        <div className="modalAdminOverlay">
          <div className="modalAdminCard">
            <div className="modalAdminHeader">
              <h3>
                <Bell size={18} color="#38bdf8" />
                Publicar Notificación para Usuarios
              </h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalNuevaNoti(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCrearNotificacion}>
              <div className="modalAdminBody">
                <div className="grupoCampoAdmin">
                  <label>Título del Comunicado:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Mantenimiento en el Auditorio Principal"
                    value={formNoti.titulo}
                    onChange={(e) => setFormNoti({ ...formNoti, titulo: e.target.value })}
                  />
                </div>
                <div className="grupoCampoAdmin">
                  <label>Tipo de Notificación:</label>
                  <select
                    value={formNoti.tipo}
                    onChange={(e) => setFormNoti({ ...formNoti, tipo: e.target.value })}
                  >
                    <option value="aviso">Aviso General</option>
                    <option value="mantenimiento">Mantenimiento de Zona</option>
                    <option value="novedad">Novedad del Campus</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div className="grupoCampoAdmin">
                  <label>Mensaje Detallado:</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Escriba aquí el mensaje visible para los estudiantes y visitantes..."
                    value={formNoti.mensaje}
                    onChange={(e) => setFormNoti({ ...formNoti, mensaje: e.target.value })}
                  />
                </div>
              </div>
              <div className="modalAdminFooter">
                <button
                  type="button"
                  className="btnModalCancelar"
                  onClick={() => setModalNuevaNoti(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btnModalConfirmar"
                  disabled={guardandoNoti}
                >
                  {guardandoNoti ? 'Publicando...' : 'Publicar Notificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Nueva Encuesta */}
      {modalNuevaEncuesta && (
        <div className="modalAdminOverlay">
          <div className="modalAdminCard">
            <div className="modalAdminHeader">
              <h3>
                <Star size={18} color="#fbbf24" />
                Crear Encuesta de Satisfacción
              </h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalNuevaEncuesta(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCrearEncuesta}>
              <div className="modalAdminBody">
                <div className="grupoCampoAdmin">
                  <label>Título de la Encuesta:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Encuesta de Experiencia Campus 3D - 2026"
                    value={formEncuesta.titulo}
                    onChange={(e) => setFormEncuesta({ ...formEncuesta, titulo: e.target.value })}
                  />
                </div>
                <div className="grupoCampoAdmin">
                  <label>Descripción / Instrucciones:</label>
                  <textarea
                    rows={3}
                    placeholder="Describe el propósito de la encuesta para el usuario..."
                    value={formEncuesta.descripcion}
                    onChange={(e) => setFormEncuesta({ ...formEncuesta, descripcion: e.target.value })}
                  />
                </div>
              </div>
              <div className="modalAdminFooter">
                <button
                  type="button"
                  className="btnModalCancelar"
                  onClick={() => setModalNuevaEncuesta(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btnModalConfirmar"
                  disabled={guardandoEncuesta}
                >
                  {guardandoEncuesta ? 'Guardando...' : 'Crear Encuesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Cambiar Estado de Reporte de Mapa */}
      {modalEstadoReporte && (
        <div className="modalAdminOverlay">
          <div className="modalAdminCard">
            <div className="modalAdminHeader">
              <h3>
                <AlertTriangle size={18} color="#f87171" />
                Actualizar Estado de Incidencia #{modalEstadoReporte.id_reporte}
              </h3>
              <button
                type="button"
                className="btnCerrarModalAdmin"
                onClick={() => setModalEstadoReporte(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modalAdminBody">
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                <strong>Lugar:</strong> {modalEstadoReporte.lugar_afectado || 'Campus General'}
                <br />
                <strong>Problema:</strong> {modalEstadoReporte.descripcion}
              </p>

              <div className="grupoCampoAdmin">
                <label>Nuevo Estado:</label>
                <select
                  value={nuevoEstadoReporte}
                  onChange={(e) => setNuevoEstadoReporte(e.target.value)}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_revision">En Revisión</option>
                  <option value="resuelto">Resuelto</option>
                </select>
              </div>

              <div className="grupoCampoAdmin">
                <label>Nota del Administrador (opcional):</label>
                <input
                  type="text"
                  placeholder="ej. Coordenadas de nodo corregidas en el modelo"
                  value={notaAdminReporte}
                  onChange={(e) => setNotaAdminReporte(e.target.value)}
                />
              </div>
            </div>
            <div className="modalAdminFooter">
              <button
                type="button"
                className="btnModalCancelar"
                onClick={() => setModalEstadoReporte(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btnModalConfirmar"
                onClick={handleGuardarEstadoReporte}
                disabled={guardandoReporte}
              >
                {guardandoReporte ? 'Guardando...' : 'Actualizar Estado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
