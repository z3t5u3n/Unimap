import React, { useState, useMemo, useEffect } from "react";
import Header from "./Component/Header";
import Mapa from "./Component/Mapa";
import DatosUsuarios from "./Component/DatosUsuarios";
import ModalReporteBug from "./Component/ModalReporteBug";
import ModalNotificaciones from "./Component/ModalNotificaciones";
import MinimapaGPSTest from "./Component/MinimapaGPSTest";
import PanelRutasGPS from "./Component/PanelRutasGPS";
import "../CSS/interfaz.css";
import "../CSS/global.css";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

// Lugares autorizados para pruebas
const LUGARES_TRAMITES_VISITA = [
  { name: "Decanatura", categoria: "trámite", icono: "🏛️" },
  { name: "Auditorio-D", categoria: "visita", icono: "🎭" },
  { name: "Cafeteria Nueva", categoria: "visita", icono: "☕" },
  { name: "Coliseo", categoria: "visita", icono: "🏟️" },
  { name: "GYM", categoria: "visita", icono: "💪" },
  { name: "Bloque-E", categoria: "visita", icono: "🏢" },
  { name: "Bloque-D", categoria: "visita", icono: "🏢" },
  { name: "Bloque-A", categoria: "visita", icono: "🏢" },
  { name: "Bloque-B", categoria: "visita", icono: "🏢" },
  { name: "Bloque-C", categoria: "visita", icono: "🏢" },
  { name: "Admisiones y Registro", categoria: "trámite", icono: "📋" },
  { name: "Biblioteca Central", categoria: "trámite", icono: "📚" },
];

function InterfazPruebas() {
  const navigate = useNavigate();

  // 1. Estado de Sesión del Tester
  const [testerSesion] = useState(() => {
    try {
      const guardado = localStorage.getItem("unimap_tester_session");
      return guardado ? JSON.parse(guardado) : null;
    } catch (e) {
      return null;
    }
  });

  // Si no hay sesión de tester ni de admin, permitir acceso con advertencia o redirigir
  const [usuario] = useState(() => ({
    nombres: testerSesion ? testerSesion.nombre : "Tester UniMap",
    apellidos: "(Modo Pruebas)",
    numero_documento: "TESTER-DEV",
    nombre_tipo: "Tester Oficial",
    correo_institucional: testerSesion ? testerSesion.username : "tester@unimap.edu.co",
  }));

  // 2. Estados de la interfaz
  const [menuAbierto, setMenuAbierto] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTramites, setFiltroTramites] = useState(false);
  const [edificios, setEdificios] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const [mostrarGPS, setMostrarGPS] = useState(false); // Inicia cerrado para ver el mapa 3D limpio y se activa al pulsar el botón 📍
  const [mapaExpandido, setMapaExpandido] = useState(false);
  const [mostrarPanelRutas, setMostrarPanelRutas] = useState(false);
  const [telemetriaCamara, setTelemetriaCamara] = useState(null);

  // Estados de modales
  const [modalReporteAbierto, setModalReporteAbierto] = useState(false);
  const [modalNotificacionesAbierto, setModalNotificacionesAbierto] = useState(false);
  const [totalNotificacionesActivas, setTotalNotificacionesActivas] = useState(0);

  // Controlador de comandos WebGL
  const [unityController, setUnityController] = useState(null);

  // Sincronizar Modo GPS con WebGL cuando cambie mostrarGPS
  useEffect(() => {
    if (unityController && typeof unityController.setModoGPS === "function") {
      unityController.setModoGPS(mostrarGPS);
    }
  }, [mostrarGPS, unityController]);

  // Consultar notificaciones del sistema
  useEffect(() => {
    const consultarNotificaciones = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/notificaciones/activas`);
        if (resp.ok) {
          const notis = await resp.json();
          setTotalNotificacionesActivas(Array.isArray(notis) ? notis.length : 0);
        }
      } catch (e) {
        console.debug("Consultando avisos en entorno tester:", e);
      }
    };
    consultarNotificaciones();
  }, []);

  const handleCerrarSesionTester = () => {
    localStorage.removeItem("unimap_tester_session");
    navigate("/");
  };

  // Filtrado de lugares
  const lugaresFiltrados = useMemo(() => {
    let base = lugares;
    if (filtroTramites) {
      base = LUGARES_TRAMITES_VISITA;
    }
    if (!busqueda.trim()) return base.slice(0, 15);
    return base.filter((lugar) => {
      const nombre = typeof lugar === "string" ? lugar : lugar.name || "";
      return nombre.toLowerCase().includes(busqueda.toLowerCase());
    });
  }, [busqueda, lugares, filtroTramites]);

  const handleSeleccionarDestino = (nombreLugar) => {
    setBusqueda("");
    setFiltroTramites(false);
    if (unityController) {
      unityController.navegarA(nombreLugar);
    }
  };

  const handleSeleccionarEdificio = (nombreEdificio) => {
    setBusqueda("");
    setFiltroTramites(false);
    if (unityController) {
      unityController.navegarA(nombreEdificio);
    }
  };

  return (
    <div className={`Interfaz ${mapaExpandido ? "modoExpandido" : ""}`}>
      {/* 1. BANNER FLOTANTE DE ENTORNO DE PRUEBAS RESPONSIVE */}
      <div className="bannerTesterHeader">
        <div className="bloqueIzquierdoTester">
          <span className="badgeTesterPill">🧪 MODO TESTER</span>
          <span className="textoLargoTester">UniMap 3D ITFIP — Entorno de Validación Técnica y GPS</span>
        </div>

        <div className="bloqueDerechoTester">
          <span className="usuarioTesterLabel">
            👤 <b>{testerSesion ? testerSesion.username : "tester@Unimap"}</b>
          </span>
          <button
            type="button"
            className="btnAbrirRutasTester"
            onClick={() => setMostrarPanelRutas(true)}
            title="Comparador y Grabador de Rutas GPS vs Cámara 3D"
          >
            🗺️ Rutas GPS vs 3D
          </button>
          <button
            type="button"
            className="btnSalirTester"
            onClick={handleCerrarSesionTester}
          >
            Salir
          </button>
        </div>
      </div>

      <Header />

      <div className="ContenedorPrimary">
        {/* Menú Lateral */}
        <div className={`ContenedorMenu ${menuAbierto ? "" : "menuColapsado"}`}>
          <button
            type="button"
            className="btn_close"
            onClick={() => setMenuAbierto((prev) => !prev)}
            title={menuAbierto ? "Ocultar menú" : "Mostrar menú"}
          >
            {menuAbierto ? "❮" : "❯"}
          </button>

          <div className="Menu">
            <h2 className="tituloMenuMapa" style={{ color: "#38bdf8" }}>
              Panel Tester 3D
            </h2>

            <button
              type="button"
              className="btnMenuLateral"
              onClick={() => {
                if (window.innerWidth <= 768) setMenuAbierto(false);
              }}
            >
              🗺️ <b>Mapa 3D</b>
            </button>

            {/* BOTÓN MAPA GPS CALIBRADO */}
            <button
              type="button"
              className={`btnMenuLateral ${mostrarGPS ? "activo" : ""}`}
              onClick={() => {
                setMostrarGPS((prev) => !prev);
                if (window.innerWidth <= 768) setMenuAbierto(false);
              }}
              style={{ borderLeft: mostrarGPS ? "4px solid #06b6d4" : "none" }}
            >
              📍 <b>GPS Calibrado ITFIP</b>
            </button>

            {/* BOTÓN DATOS */}
            <button
              type="button"
              className={`btnMenuLateral ${mostrarDatos ? "activo" : ""}`}
              onClick={() => {
                setMostrarDatos((prev) => !prev);
                if (window.innerWidth <= 768) setMenuAbierto(false);
              }}
            >
              👤 <b>Datos Tester</b>
            </button>

            {/* BOTÓN TRÁMITES Y VISITA */}
            <button
              type="button"
              className={`btnMenuLateral ${filtroTramites ? "activo" : ""}`}
              onClick={() => {
                setFiltroTramites((prev) => !prev);
                if (window.innerWidth <= 768) setMenuAbierto(false);
              }}
            >
              📋 <b>Trámites y Visita</b>
            </button>

            <button
              type="button"
              className="btnMenuLateral btnCerrarSesion"
              onClick={handleCerrarSesionTester}
            >
              🚪 <b>Cerrar Sesión Tester</b>
            </button>
          </div>
        </div>

        {/* Telón oscuro para móvil */}
        {menuAbierto && !mapaExpandido && (
          <div
            className="backdropMenuMobile"
            onClick={() => setMenuAbierto(false)}
            title="Cerrar menú"
          />
        )}

        {/* Contenedor del Mapa 3D */}
        <div className="ContenedorMapa">
          {/* BOTONES FLOTANTES DE ACCIÓN RÁPIDA */}
          <div className="accionesFlotantesDerecha">
            {/* 1. BOTÓN PANTALLA COMPLETA */}
            <button
              type="button"
              className="btnFlotanteCircular btnExpandirMapa"
              onClick={() => setMapaExpandido((prev) => !prev)}
              title={mapaExpandido ? "Salir de pantalla completa" : "Pantalla completa"}
              aria-label="Pantalla completa"
            >
              {mapaExpandido ? "🗗" : "⛶"}
            </button>

            {/* 2. BOTÓN ACTIVAR/DESACTIVAR GPS CALIBRADO */}
            <button
              type="button"
              className={`btnFlotanteCircular btnGpsFlotante ${mostrarGPS ? "activo" : ""}`}
              onClick={() => setMostrarGPS((prev) => !prev)}
              title={mostrarGPS ? "Ocultar minimapa GPS Calibrado" : "Abrir minimapa GPS Calibrado ITFIP"}
              aria-label="Minimapa GPS Calibrado"
              style={{ background: mostrarGPS ? "#0891b2" : undefined }}
            >
              📍
            </button>

            {/* 3. BOTÓN COMPARADOR Y GRABADOR DE RUTAS GPS VS 3D */}
            <button
              type="button"
              className={`btnFlotanteCircular btnRutasFlotante ${mostrarPanelRutas ? "activo" : ""}`}
              onClick={() => setMostrarPanelRutas((prev) => !prev)}
              title={mostrarPanelRutas ? "Ocultar panel de rutas" : "Abrir Comparador y Grabador de Rutas GPS vs Cámara 3D"}
              aria-label="Comparador de Rutas"
              style={{ background: mostrarPanelRutas ? "#ea580c" : undefined }}
            >
              🗺️
            </button>

            {/* 4. BOTÓN NOTIFICACIONES */}
            <button
              type="button"
              className={`btnFlotanteCircular btnNotificacionesFlotante ${modalNotificacionesAbierto ? "activo" : ""}`}
              onClick={() => setModalNotificacionesAbierto(true)}
              title="Avisos del Sistema"
              aria-label="Notificaciones"
            >
              🔔
              {totalNotificacionesActivas > 0 && (
                <span className="badgeContadorCampana">{totalNotificacionesActivas}</span>
              )}
            </button>

            {/* 5. BOTÓN REPORTAR BUGS / PROBLEMAS CON TAG [TESTER] */}
            <button
              type="button"
              className="btnFlotanteCircular btnReportarBug"
              onClick={() => setModalReporteAbierto(true)}
              title="Reportar problema técnico encontrado en pruebas (Tag: [TESTER])"
              aria-label="Reportar error del mapa"
            >
              🐛
            </button>
          </div>

          {/* BUSCADOR SUPERIOR FLOTANTE */}
          <div className="buscadorMapaCentrado">
            <input
              type="text"
              placeholder="Buscar salón, laboratorio, cafetería (Modo Tester)..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="inputSearchMapa"
              style={{ borderColor: "#0891b2" }}
            />

            {(busqueda.trim() || filtroTramites) && (
              <ul className="listaResultadosFlotante">
                {lugaresFiltrados.length > 0 ? (
                  lugaresFiltrados.map((item, index) => {
                    const nombre = typeof item === "string" ? item : item.name;
                    return (
                      <li
                        key={index}
                        onClick={() => handleSeleccionarDestino(nombre)}
                        className="itemResultadoBusqueda"
                      >
                        📍 <span>{nombre}</span>
                      </li>
                    );
                  })
                ) : (
                  <li className="itemSinResultados">No se encontraron lugares</li>
                )}
              </ul>
            )}
          </div>

          {/* MODAL DE REPORTAR BUG CON IDENTIFICADOR DE TESTER */}
          <ModalReporteBug
            abierto={modalReporteAbierto}
            onCerrar={() => setModalReporteAbierto(false)}
            idUsuario={testerSesion ? `TESTER-${testerSesion.username}` : "TESTER-DEV"}
            nombreUsuario={testerSesion ? `[TESTER] ${testerSesion.nombre}` : "[TESTER] Verificador"}
          />

          {/* MODAL DE NOTIFICACIONES */}
          <ModalNotificaciones
            abierto={modalNotificacionesAbierto}
            onCerrar={() => setModalNotificacionesAbierto(false)}
            idUsuario={testerSesion ? `TESTER-${testerSesion.username}` : "TESTER-DEV"}
          />

          {/* TARJETA FLOTANTE DE DATOS */}
          <DatosUsuarios
            visible={mostrarDatos}
            usuario={usuario}
            onClose={() => setMostrarDatos(false)}
          />

          {/* CANVAS 3D DE UNITY */}
          <Mapa
            onCatalogoLoaded={({ edificios: eds, lugares: lugs }) => {
              setEdificios(eds);
              setLugares(lugs);
            }}
            onUnityReady={setUnityController}
            onCameraTelemetry={setTelemetriaCamara}
          />

          {/* BARRA INFERIOR DE EDIFICIOS */}
          <div className="barraEdificiosInferior">
            <div className="scrollHorizontalEdificios">
              {edificios.length > 0 ? (
                edificios.map((edificio, index) => {
                  const nombre = typeof edificio === "string" ? edificio : edificio.name;
                  return (
                    <button
                      key={index}
                      type="button"
                      className="btnEdificioHorizontal"
                      onClick={() => handleSeleccionarEdificio(nombre)}
                    >
                      🏢 {nombre}
                    </button>
                  );
                })
              ) : (
                <span style={{ color: "#e2e8f0", fontSize: "13px", padding: "6px 14px", background: "rgba(0,0,0,0.5)", borderRadius: "20px" }}>
                  Iniciando catálogo 3D de Unity...
                </span>
              )}
            </div>
          </div>

          {/* MINIMAPA GPS CALIBRADO PARA TESTERS */}
          <MinimapaGPSTest
            visible={mostrarGPS}
            onClose={() => setMostrarGPS(false)}
            unityController={unityController}
          />

          {/* PANEL COMPARADOR Y GRABADOR DE RUTAS GPS VS CÁMARA 3D */}
          <PanelRutasGPS
            visible={mostrarPanelRutas}
            onClose={() => setMostrarPanelRutas(false)}
            telemetriaCamara={telemetriaCamara}
          />
        </div>
      </div>
    </div>
  );
}

export default InterfazPruebas;
