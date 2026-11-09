import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import VisorCampus3D from '../components/VisorCampus3D';
import PanelDatos from '../components/PanelDatos';
import BuscadorLugares from '../components/BuscadorLugares';
import SelectorPuntoInicio from '../components/SelectorPuntoInicio';
import MenuEdificiosInferior from '../components/MenuEdificiosInferior';
import ModalReportarError from '../components/ModalReportarError';
import ModalNotificacionesUsuario from '../components/ModalNotificacionesUsuario';
import ModalEncuestaUsuario from '../components/ModalEncuestaUsuario';
import ModalConfiguracionTemporada from '../components/ModalConfiguracionTemporada';
import { PUNTOS_INICIO } from '../data/puntosInicioCampus';
import { Map, User, LogOut, ChevronLeft, ChevronRight, MapPin, X, Bell, AlertTriangle, Star, Snowflake } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Interfaz() {
  const navigate = useNavigate();

  // Estados principales de usuario y navegación
  const [usuario, setUsuario] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('mapa'); // 'mapa' o 'datos'
  // Menú lateral: cerrado por defecto para que el mapa tome 100% de ancho
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Estados para los modales de usuario y configuración
  const [modalReporteAbierto, setModalReporteAbierto] = useState(false);
  const [modalNotificacionesAbierto, setModalNotificacionesAbierto] = useState(false);
  const [modalEncuestaAbierto, setModalEncuestaAbierto] = useState(false);
  const [modalTemporadaAbierto, setModalTemporadaAbierto] = useState(false);
  const [totalNotificaciones, setTotalNotificaciones] = useState(0);

  // Estado de temporada navideña
  const [temporadaActiva, setTemporadaActiva] = useState(() => {
    const guardado = localStorage.getItem('unimap_temporada_activa');
    return guardado === null ? true : guardado === 'true';
  });

  // Sincronizar eventos globales de temporada
  useEffect(() => {
    const handleAbrirModal = () => setModalTemporadaAbierto(true);
    const handleTemporadaChanged = (e) => {
      if (e.detail && typeof e.detail.activa === 'boolean') {
        setTemporadaActiva(e.detail.activa);
      }
    };

    window.addEventListener('unimap_abrir_modal_temporada', handleAbrirModal);
    window.addEventListener('unimap_temporada_changed', handleTemporadaChanged);
    return () => {
      window.removeEventListener('unimap_abrir_modal_temporada', handleAbrirModal);
      window.removeEventListener('unimap_temporada_changed', handleTemporadaChanged);
    };
  }, []);

  // Al seleccionar una opción del menú:
  // - "Mapa": oculta el menú y el mapa toma el 100% de ancho con todos sus controles sobre el mapa
  // - "Datos": oculta el menú, difumina el mapa y muestra los datos centrados por encima
  const handleSeleccionarVista = (vista) => {
    setVistaActiva(vista);
    setMenuAbierto(false);
  };

  // Destino seleccionado para orientar la cámara y mostrar información
  const [destinoActivo, setDestinoActivo] = useState(null);
  const [edificioActivoId, setEdificioActivoId] = useState(null);

  // Punto de inicio de recorrido activo (teletransporta la cámara y sirve de origen)
  const [puntoInicioActivo, setPuntoInicioActivo] = useState(PUNTOS_INICIO[0]);

  // Verificar sesión al montar y consultar notificaciones activas
  useEffect(() => {
    const sesionUsuario = localStorage.getItem('usuario');
    const sesionAdmin = localStorage.getItem('admin_session');

    if (sesionUsuario) {
      setUsuario(JSON.parse(sesionUsuario));
    } else if (sesionAdmin) {
      setUsuario(JSON.parse(sesionAdmin));
    } else {
      navigate('/login');
    }

    // Consultar conteo de notificaciones activas
    fetch(`${API_BASE_URL}/notificaciones/activas`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.total === 'number') {
          setTotalNotificaciones(data.total);
        }
      })
      .catch((err) => console.log('Aviso notificaciones:', err.message));
  }, [navigate]);

  // Cerrar sesión
  const handleCerrarSesion = () => {
    localStorage.removeItem('usuario');
    localStorage.removeItem('admin_session');
    navigate('/login');
  };

  // Registrar recorrido en backend de Laravel (tb_lugares_recorridos)
  const registrarRecorridoEnBackend = useCallback(
    (nombreLugar, origen = 'buscador') => {
      if (!usuario || !usuario.id_usuario) return;
      fetch(`${API_BASE_URL}/recorrido`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          id_usuario: usuario.id_usuario,
          lugar_mesh: nombreLugar,
          origen_busqueda: origen
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.mensaje) {
            console.log('Registro de recorrido:', data.mensaje);
          }
        })
        .catch((err) => console.warn('Aviso de recorrido backend:', err));
    },
    [usuario]
  );

  // Al seleccionar un lugar desde el buscador (salones, laboratorios, biblioteca, etc.)
  const handleSeleccionarLugar = (lugar) => {
    setDestinoActivo(lugar);
    setEdificioActivoId(null);
    registrarRecorridoEnBackend(lugar.displayName || lugar.meshName, 'buscador');
  };

  // Al seleccionar un edificio desde el menú horizontal inferior
  const handleSeleccionarEdificio = (edificio) => {
    setDestinoActivo(edificio);
    setEdificioActivoId(edificio.id);
    registrarRecorridoEnBackend(edificio.nombre || edificio.meshName, 'boton_edificio');
  };

  // Limpiar destino y volver a la vista general de la entrada
  const handleLimpiarDestino = () => {
    setDestinoActivo(null);
    setEdificioActivoId(null);
  };

  return (
    <div className="Interfaz">
      <Header />

      <div className="ContenedorPrimary">
        {/* Menú Lateral: ÚNICAMENTE DOS BOTONES (MAPA Y DATOS) */}
        <aside className={`ContenedorMenu ${menuAbierto ? '' : 'menuColapsado'}`}>
          <button
            type="button"
            className="btn_close"
            onClick={() => setMenuAbierto((prev) => !prev)}
            title={menuAbierto ? 'Ocultar menú' : 'Mostrar menú'}
            aria-label={menuAbierto ? 'Ocultar menú' : 'Mostrar menú'}
          >
            {menuAbierto ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className="Menu">
            <h2 className="tituloMenuMapa">Menú</h2>

            {/* 1. BOTÓN MAPA */}
            <button
              type="button"
              className={`btnMenuLateral ${vistaActiva === 'mapa' ? 'activo' : ''}`}
              onClick={() => handleSeleccionarVista('mapa')}
            >
              <Map size={18} />
              <b>Mapa</b>
            </button>

            {/* 2. BOTÓN DATOS */}
            <button
              type="button"
              className={`btnMenuLateral ${vistaActiva === 'datos' ? 'activo' : ''}`}
              onClick={() => handleSeleccionarVista('datos')}
            >
              <User size={18} />
              <b>Datos</b>
            </button>

            {/* Cerrar Sesión al final */}
            <button
              type="button"
              className="btnMenuLateral btnCerrarSesion"
              onClick={handleCerrarSesion}
            >
              <LogOut size={17} />
              <b>Cerrar Sesión</b>
            </button>
          </div>
        </aside>

        {/* Área del Visor 3D y Contenido */}
        <main className="unityContenedor">
          {/* El Visor 3D siempre está montado de fondo para rendimiento fluido */}
          <VisorCampus3D
            destinoActivo={destinoActivo}
            puntoInicio={puntoInicioActivo}
            onReorientar={handleLimpiarDestino}
            temporadaActiva={temporadaActiva}
            accionesExtra={
              <>
                {/* Botón de Configuración de Temporada Navideña */}
                <button
                  type="button"
                  className={`btn3DControl btnTemporadaTop ${temporadaActiva ? 'temporadaActiva' : ''}`}
                  onClick={() => setModalTemporadaAbierto(true)}
                  title="Configuración de Temporada"
                  aria-label="Configuración de Temporada"
                >
                  <Snowflake size={17} className={temporadaActiva ? 'iconoNieveGirando' : ''} />
                  {temporadaActiva && <span className="puntoNavidadActivo" />}
                </button>

                <button
                  type="button"
                  className="btn3DControl btnNotifTop"
                  onClick={() => setModalNotificacionesAbierto(true)}
                  title="Avisos y Comunicados Oficiales"
                  aria-label="Avisos y Notificaciones"
                >
                  <Bell size={17} />
                  {totalNotificaciones > 0 && (
                    <span className="badgeContadorNotif">{totalNotificaciones}</span>
                  )}
                </button>

                <button
                  type="button"
                  className="btn3DControl btnReporteTop"
                  onClick={() => setModalReporteAbierto(true)}
                  title="Reportar Bug o Error del Mapa"
                  aria-label="Reportar Error"
                >
                  <AlertTriangle size={17} />
                </button>

                <button
                  type="button"
                  className="btn3DControl btnEncuestaTop"
                  onClick={() => setModalEncuestaAbierto(true)}
                  title="Encuesta de Satisfacción"
                  aria-label="Encuesta de Satisfacción"
                >
                  <Star size={17} />
                </button>
              </>
            }
          />

          {/* BARRA SUPERIOR DE NAVEGACIÓN: SELECTOR DE INICIO Y BUSCADOR */}
          <div className="barraNavegacionSuperiorMapa">
            <SelectorPuntoInicio
              puntoInicioActivo={puntoInicioActivo}
              onSeleccionarPuntoInicio={(punto) => setPuntoInicioActivo(punto)}
            />
            <BuscadorLugares
              onSeleccionarLugar={handleSeleccionarLugar}
              lugarActivo={destinoActivo}
              onLimpiar={handleLimpiarDestino}
            />
          </div>

          {/* 2. BADGE INFORMATIVO DE DESTINO ACTIVO */}
          {destinoActivo && (
            <div className="badgeDestinoFlotante">
              <div className="infoDestinoContenido">
                <MapPin size={17} color="#38bdf8" />
                <div className="textosDestino">
                  <span className="tituloDestino">
                    {destinoActivo.displayName || destinoActivo.nombre}
                  </span>
                  <span className="subtituloDestino">
                    {destinoActivo.bloque || destinoActivo.descripcion}
                    {destinoActivo.dist ? ` • ${destinoActivo.dist}m de distancia` : ''}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btnCerrarDestino"
                onClick={handleLimpiarDestino}
                title="Volver a la entrada general"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* 3. MENÚ HORIZONTAL INFERIOR DE MESHES / EDIFICIOS PRINCIPALES */}
          <MenuEdificiosInferior
            edificioActivoId={edificioActivoId}
            onSeleccionarEdificio={handleSeleccionarEdificio}
          />

          {/* 4. PANEL DE DATOS (Superpuesto cuando vistaActiva es 'datos') */}
          {vistaActiva === 'datos' && usuario && (
            <PanelDatos
              usuario={usuario}
              onCerrar={() => setVistaActiva('mapa')}
              onUsuarioActualizado={(u) => setUsuario(u)}
            />
          )}

          {/* 5. MODALES INTERACTIVOS DE USUARIO (REPORTE DE BUGS, NOTIFICACIONES, ENCUESTA) */}
          <ModalReportarError
            usuario={usuario}
            lugarSugerido={destinoActivo}
            isOpen={modalReporteAbierto}
            onCerrar={() => setModalReporteAbierto(false)}
          />

          <ModalNotificacionesUsuario
            isOpen={modalNotificacionesAbierto}
            onCerrar={() => setModalNotificacionesAbierto(false)}
            onActualizarTotal={(t) => setTotalNotificaciones(t)}
          />

          <ModalEncuestaUsuario
            usuario={usuario}
            isOpen={modalEncuestaAbierto}
            onCerrar={() => setModalEncuestaAbierto(false)}
          />

          {/* 6. MODAL DE CONFIGURACIÓN DE TEMPORADA (NAVIDAD / INVIERNO) */}
          <ModalConfiguracionTemporada
            isOpen={modalTemporadaAbierto}
            onCerrar={() => setModalTemporadaAbierto(false)}
            onCambioTemporada={(detalle) => setTemporadaActiva(detalle.activa)}
          />
        </main>
      </div>
    </div>
  );
}
