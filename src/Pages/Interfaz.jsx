import React, { useState, useMemo, useEffect, useCallback } from "react";
import Header from "./Component/Header";
import Mapa from "./Component/Mapa";
import DatosUsuarios from "./Component/DatosUsuarios";
import ModalReporteBug from "./Component/ModalReporteBug";
import ModalNotificaciones from "./Component/ModalNotificaciones";
import MinimapaGPS from "./Component/MinimapaGPS";
import "../CSS/interfaz.css";
import "../CSS/global.css";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

// Detección del tipo de conexión (WiFi vs Datos Móviles)
const detectarTipoConexion = () => {
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      const type = conn.type;
      const effectiveType = conn.effectiveType;
      if (type === "cellular") {
        return `Datos Móviles (${(effectiveType || "4G").toUpperCase()})`;
      } else if (type === "wifi") {
        return "WiFi";
      } else if (type === "ethernet") {
        return "Red Cableada / Ethernet";
      } else if (effectiveType) {
        return effectiveType === "4g" || effectiveType === "3g" || effectiveType === "2g"
          ? `Datos Móviles (${effectiveType.toUpperCase()})`
          : "WiFi";
      }
    }
  } catch (e) {}
  return /Mobi|Android/i.test(navigator.userAgent) ? "Datos Móviles (SIM)" : "WiFi";
};

// Detección precisa de marca y modelo del celular o dispositivo
const detectarModeloDispositivo = () => {
  const ua = navigator.userAgent || "";
  const samsungMatch = ua.match(/SM-([A-Za-z0-9]+)/i);
  if (samsungMatch) {
    const code = samsungMatch[1];
    if (code.startsWith("A55")) return `Samsung Galaxy A55 5G (SM-${code})`;
    if (code.startsWith("A54")) return `Samsung Galaxy A54 5G (SM-${code})`;
    if (code.startsWith("A34")) return `Samsung Galaxy A34 (SM-${code})`;
    if (code.startsWith("A14")) return `Samsung Galaxy A14 (SM-${code})`;
    if (code.startsWith("A15")) return `Samsung Galaxy A15 (SM-${code})`;
    if (code.startsWith("S23")) return `Samsung Galaxy S23 (SM-${code})`;
    if (code.startsWith("S24")) return `Samsung Galaxy S24 (SM-${code})`;
    return `Samsung Galaxy SM-${code}`;
  }

  const xiaomiMatch = ua.match(/(Redmi[^;)]+|POCO[^;)]+|Xiaomi[^;)]+)/i);
  if (xiaomiMatch) return xiaomiMatch[0].trim();

  const motoMatch = ua.match(/(moto [^;)]+|motorola [^;)]+)/i);
  if (motoMatch) return motoMatch[0].trim();

  if (/iPhone/i.test(ua)) return "Apple iPhone (iOS)";
  if (/iPad/i.test(ua)) return "Apple iPad (iPadOS)";

  const huaweiMatch = ua.match(/(Huawei[^;)]+|Honor[^;)]+)/i);
  if (huaweiMatch) return huaweiMatch[0].trim();

  const genericAndroid = ua.match(/Android[^;]+;\s*([^;)]+)\s*Build/i);
  if (genericAndroid && genericAndroid[1]) {
    return genericAndroid[1].trim();
  }

  if (/Windows/i.test(ua)) return "PC / Windows";
  if (/Macintosh/i.test(ua)) return "Mac / macOS";
  if (/Linux/i.test(ua)) return "Linux / PC";

  return /Mobi|Android/i.test(ua) ? "Dispositivo Móvil Android" : "Navegador Web / PC";
};

// Lugares autorizados de trámites y visita (para usuarios generales y acceso rápido)
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

function Interfaz() {
  const navigate = useNavigate();

  // 1. Estados de Usuario y Menú
  const [usuario, setUsuario] = useState(null);
  const [mostrarDatos, setMostrarDatos] = useState(window.innerWidth > 768); // En PC abierto, en celular colapsado para ver el mapa 3D
  const [menuAbierto, setMenuAbierto] = useState(window.innerWidth > 768);
  const [mapaExpandido, setMapaExpandido] = useState(false); // Modo pantalla completa / expandido (oculta header y menú lateral)
  const [modalReporteAbierto, setModalReporteAbierto] = useState(false); // Modal para reportar bugs del mapa
  const [modalNotificacionesAbierto, setModalNotificacionesAbierto] = useState(false); // Modal avisos y encuestas
  const [totalNotificacionesActivas, setTotalNotificacionesActivas] = useState(0);
  const [mostrarGPS, setMostrarGPS] = useState(false); // Minimapa Google Maps GPS en tiempo real
  const [filtroTramites, setFiltroTramites] = useState(false); // Filtro activo para mostrar trámites y visita

  // Control de visibilidad de módulos administrado desde /Admin (Persistido en DB y local)
  const [configModulos, setConfigModulos] = useState(() => {
    try {
      const cfg = localStorage.getItem("unimap_config_modulos_usuario");
      return cfg
        ? JSON.parse(cfg)
        : { mostrarBotonMapa: true, mostrarBotonGPS: true, mostrarBotonRecorridos: true };
    } catch (e) {
      return { mostrarBotonMapa: true, mostrarBotonGPS: true, mostrarBotonRecorridos: true };
    }
  });

  // Consultar configuración global de módulos desde la base de datos
  useEffect(() => {
    const consultarConfigModulos = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/configuracion/modulos`);
        if (resp.ok) {
          const data = await resp.json();
          const cfg = data.configuracion || data;
          if (cfg && typeof cfg.mostrarBotonMapa !== "undefined") {
            const normalizada = {
              mostrarBotonMapa: cfg.mostrarBotonMapa !== false,
              mostrarBotonGPS: cfg.mostrarBotonGPS !== false,
              mostrarBotonRecorridos: cfg.mostrarBotonRecorridos !== false,
            };
            setConfigModulos(normalizada);
            localStorage.setItem("unimap_config_modulos_usuario", JSON.stringify(normalizada));
          }
        }
      } catch (err) {
        console.debug("Usando configuración local de módulos:", err);
      }
    };

    consultarConfigModulos();
    // Sondeo cada 8s para sincronizar en vivo con los celulares sin recargar
    const interval = setInterval(consultarConfigModulos, 8000);

    const handleFocus = () => consultarConfigModulos();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    const handleConfigActualizada = (e) => {
      if (e.detail) {
        setConfigModulos(e.detail);
      } else {
        try {
          const cfg = localStorage.getItem("unimap_config_modulos_usuario");
          if (cfg) setConfigModulos(JSON.parse(cfg));
        } catch (err) {}
      }
    };
    window.addEventListener("UniMapConfigUpdated", handleConfigActualizada);
    window.addEventListener("storage", handleConfigActualizada);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("UniMapConfigUpdated", handleConfigActualizada);
      window.removeEventListener("storage", handleConfigActualizada);
    };
  }, []);

  // Manejador del tiempo de carga de Unity WebGL (Telemetría y Rendimiento)
  const handleUnityLoaded = useCallback(async (tiempoSegundos) => {
    try {
      const sesion = localStorage.getItem("usuario");
      const userObj = sesion ? JSON.parse(sesion) : null;
      const tipoConexion = detectarTipoConexion();
      const modeloDispositivo = detectarModeloDispositivo();

      const payload = {
        tiempo_carga_segundos: tiempoSegundos,
        id_usuario: userObj?.id_usuario || null,
        nombre_usuario: userObj?.nombre_completo || userObj?.nombre || userObj?.username || "Usuario General",
        tipo_conexion: tipoConexion,
        operador: null, // El backend lo resuelve inteligentemente por IP
        modelo_dispositivo: modeloDispositivo,
      };

      await fetch(`${API_BASE_URL}/telemetria/carga-unity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("⚡ Telemetría de carga registrada exitosamente:", payload);
    } catch (err) {
      console.debug("Error enviando telemetría de carga de Unity:", err);
    }
  }, []);

  // 2. Estados de Unity
  const [edificios, setEdificios] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [unityController, setUnityController] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  // Extraer los datos del usuario logueado
  useEffect(() => {
    const sesion = localStorage.getItem("usuario");
    if (sesion) {
      setUsuario(JSON.parse(sesion));
    } else {
      navigate("/");
    }
  }, [navigate]);

  // Cerrar sesión
  const handleCerrarSesion = () => {
    localStorage.removeItem("usuario");
    navigate("/");
  };

  // Escuchar tecla Escape para restaurar la vista si está en modo expandido
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mapaExpandido) {
        setMapaExpandido(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mapaExpandido]);

  // Liberar teclado para que Unity no capture las teclas al escribir en el buscador
  useEffect(() => {
    const liberarTeclado = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("keydown", liberarTeclado, true);
    window.addEventListener("keyup", liberarTeclado, true);

    return () => {
      window.removeEventListener("keydown", liberarTeclado, true);
      window.removeEventListener("keyup", liberarTeclado, true);
    };
  }, []);

  // Sincronizar Modo GPS con Unity WebGL cuando el usuario abre o cierra el minimapa GPS
  useEffect(() => {
    if (unityController && typeof unityController.setModoGPS === "function") {
      unityController.setModoGPS(mostrarGPS);
    }
  }, [mostrarGPS, unityController]);

  // Consultar notificaciones activas para badge del botón de campana
  useEffect(() => {
    const consultarNotificaciones = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notificaciones/activas`);
        const d = await res.json();
        if (res.ok) {
          setTotalNotificacionesActivas(d.total || 0);
        }
      } catch (err) {
        // Silencio en caso de error temporal de red
      }
    };
    consultarNotificaciones();
    const timer = setInterval(consultarNotificaciones, 45000);
    return () => clearInterval(timer);
  }, []);

  // Detectar si el usuario actual es de tipo General (tipo_usuario = 1)
  const esUsuarioGeneral = !usuario?.tipo_usuario || usuario.tipo_usuario === 1;

  // Función para determinar si un lugar corresponde a un salón o aula de clase
  const esSalon = (nombre) => /(salon|salón|aula|laboratorio)/i.test(nombre);

  // Filtrar lugares para el buscador (RESTRICCIÓN: Salones prohibidos para usuarios generales)
  const lugaresFiltrados = useMemo(() => {
    // Si no hay búsqueda y no está activo el filtro de trámites, retorno vacío
    if (!busqueda.trim() && !filtroTramites) return [];

    // Catálogo unificado combinando los lugares de Unity con los puntos de trámites y visita
    const catalogoUnificado = [...lugares];
    LUGARES_TRAMITES_VISITA.forEach((tv) => {
      if (!catalogoUnificado.some((l) => (typeof l === "string" ? l : l.name) === tv.name)) {
        catalogoUnificado.push(tv);
      }
    });

    const q = busqueda.trim().toLowerCase();

    return catalogoUnificado.filter((lugar) => {
      const nombre =
        typeof lugar === "string" ? lugar : lugar.name || lugar.displayName;

      // REGLA FUNDAMENTAL: Para usuario general, ocultar salones de clase
      if (esUsuarioGeneral && esSalon(nombre)) {
        return false;
      }

      // Si se activó el botón de "Trámites" y el buscador está vacío, mostrar catálogo de trámites y visita
      if (filtroTramites && !q) {
        return true;
      }

      return nombre.toLowerCase().includes(q);
    });
  }, [busqueda, lugares, esUsuarioGeneral, filtroTramites]);

  // Registrar el lugar recorrido en la base de datos (tb_lugares_recorridos)
  const registrarRecorridoEnBackend = (nombreLugar, origen) => {
    if (!usuario || !usuario.id_usuario) return;
    fetch(`${API_BASE_URL}/recorrido`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id_usuario: usuario.id_usuario,
        lugar_mesh: nombreLugar,
        origen_busqueda: origen,
      }),
    }).catch((err) => console.error("Error al registrar recorrido:", err));
  };

  // Navegar a un edificio
  const handleSeleccionarEdificio = (nombreEdificio) => {
    console.log("Viajando al edificio:", nombreEdificio);
    registrarRecorridoEnBackend(nombreEdificio, "boton_edificio");
    if (unityController) {
      unityController.navegarA(nombreEdificio);
    }
  };

  // Navegar a un lugar seleccionado del buscador
  const handleSeleccionarLugar = (lugar) => {
    const nombreLugar =
      typeof lugar === "string" ? lugar : lugar.name || lugar.displayName;

    // Protección en el frontend para usuarios generales
    if (esUsuarioGeneral && esSalon(nombreLugar)) {
      alert(
        "Acceso Restringido: Los salones de clase están reservados para estudiantes y docentes.\nTienes disponible el recorrido de zonas de trámites y visita (Decanatura, Auditorio, Cafetería, Coliseo, Gimnasio, etc.)."
      );
      return;
    }

    console.log("Viajando al lugar:", nombreLugar);
    registrarRecorridoEnBackend(nombreLugar, "buscador");
    setBusqueda("");
    setFiltroTramites(false);
    if (unityController) {
      unityController.navegarA(nombreLugar);
    }
  };


  return (
    <div className={`Interfaz ${mapaExpandido ? "modoExpandido" : ""}`}>
      {/* Header Global */}
      <Header />

      <div className="ContenedorPrimary">
        {/* Menú Lateral */}
        <div className={`ContenedorMenu ${menuAbierto ? "" : "menuColapsado"}`}>
          {/* Botón para colapsar / expandir el menú */}
          <button
            type="button"
            className="btn_close"
            onClick={() => setMenuAbierto((prev) => !prev)}
            title={menuAbierto ? "Ocultar menú" : "Mostrar menú"}
          >
            {menuAbierto ? "❮" : "❯"}
          </button>

          <div className="Menu">
            <h2 className="tituloMenuMapa">Menú Mapa</h2>

            {/* BOTÓN MAPA 3D */}
            {configModulos.mostrarBotonMapa !== false && (
              <button
                type="button"
                className="btnMenuLateral"
                onClick={() => {
                  if (window.innerWidth <= 768) setMenuAbierto(false);
                }}
              >
                🗺️ <b>Mapa 3D</b>
              </button>
            )}

            {/* BOTÓN MAPA GPS */}
            {configModulos.mostrarBotonGPS !== false && (
              <button
                type="button"
                className={`btnMenuLateral ${mostrarGPS ? "activo" : ""}`}
                onClick={() => {
                  setMostrarGPS((prev) => !prev);
                  if (window.innerWidth <= 768) setMenuAbierto(false);
                }}
              >
                📍 <b>Mapa GPS</b>
              </button>
            )}

            {/* BOTÓN DATOS: Al hacer clic oculta o vuelve a mostrar los datos sobre el mapa */}
            <button
              type="button"
              className={`btnMenuLateral ${mostrarDatos ? "activo" : ""}`}
              onClick={() => {
                setMostrarDatos((prev) => !prev);
                if (window.innerWidth <= 768) setMenuAbierto(false);
              }}
            >
              👤 <b>Datos</b>
            </button>

            {/* BOTÓN TRÁMITES Y VISITA */}
            {configModulos.mostrarBotonRecorridos !== false && (
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
            )}


            <button
              type="button"
              className="btnMenuLateral btnCerrarSesion"
              onClick={handleCerrarSesion}
            >
              🚪 <b>Cerrar Sesión</b>
            </button>
          </div>
        </div>

        {/* Telón oscuro para móvil al desplegar el menú */}
        {menuAbierto && !mapaExpandido && (
          <div
            className="backdropMenuMobile"
            onClick={() => setMenuAbierto(false)}
            title="Cerrar menú"
          />
        )}

        {/* Contenedor del Mapa (Unity y componentes superpuestos en el mismo contenedor) */}
        <div className="unityContenedor">
          {/* GRUPO DE BOTONES FLOTANTES SUPERIOR DERECHO */}
          <div className="grupoBotonesFlotantesTopRight">
            {/* 1. BOTÓN EXPANDIR (SOLO ICONO) */}
            <button
              type="button"
              className={`btnFlotanteCircular btnExpandirMapa ${mapaExpandido ? "activo" : ""}`}
              onClick={() => setMapaExpandido((prev) => !prev)}
              title={
                mapaExpandido
                  ? "Restaurar vista normal (Esc)"
                  : "Expandir mapa a pantalla completa"
              }
              aria-label={mapaExpandido ? "Restaurar vista" : "Expandir mapa"}
            >
              {mapaExpandido ? "🗗" : "⛶"}
            </button>

            {/* 2. BOTÓN ACTIVAR/DESACTIVAR MINIMAPA GPS */}
            {configModulos.mostrarBotonGPS !== false && (
              <button
                type="button"
                className={`btnFlotanteCircular btnGpsFlotante ${mostrarGPS ? "activo" : ""}`}
                onClick={() => setMostrarGPS((prev) => !prev)}
                title={mostrarGPS ? "Ocultar minimapa GPS de Google" : "Abrir minimapa GPS de Google en vivo"}
                aria-label="Minimapa GPS"
              >
                📍
              </button>
            )}

            {/* 3. BOTÓN NOTIFICACIONES Y ENCUESTA */}
            <button
              type="button"
              className={`btnFlotanteCircular btnNotificacionesFlotante ${modalNotificacionesAbierto ? "activo" : ""}`}
              onClick={() => setModalNotificacionesAbierto(true)}
              title="Avisos del Sistema y Encuesta de Satisfacción"
              aria-label="Notificaciones y encuestas"
            >
              🔔
              {totalNotificacionesActivas > 0 && (
                <span className="badgeContadorCampana">{totalNotificacionesActivas}</span>
              )}
            </button>

            {/* 4. BOTÓN REPORTAR BUGS / PROBLEMAS */}
            <button
              type="button"
              className="btnFlotanteCircular btnReportarBug"
              onClick={() => setModalReporteAbierto(true)}
              title="Reportar problema o bug del mapa (texturas, carga, lag, recorridos, nombres)"
              aria-label="Reportar error del mapa"
            >
              🐛
            </button>
          </div>

          {/* 1. BUSCADOR SUPERIOR FLOTANTE */}
          <div className="buscadorMapaCentrado">
            <input
              type="text"
              placeholder={
                esUsuarioGeneral
                  ? "Buscar trámites o visita (Decanatura, Auditorio, Cafetería, Coliseo, GYM...)"
                  : "Buscar salón, laboratorio, cafetería..."
              }
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="inputSearchMapa"
            />

            {(busqueda.trim() || filtroTramites) && (
              <ul className="listaResultadosFlotante">
                {filtroTramites && !busqueda.trim() && (
                  <li className="cabeceraTramitesVisita">
                    <b>Áreas de Trámites y Visita Autorizadas</b>
                  </li>
                )}

                {esUsuarioGeneral && /salon|sal\xc3\xb3n|aula|lab/i.test(busqueda) && (
                  <li className="itemRestriccionSalon">
                    <span><b>Salones Restringidos</b>: Como usuario general solo puedes recorrer áreas de trámites y visita (Decanatura, Auditorio, Cafetería, Coliseo, Gimnasio, etc.).</span>
                  </li>
                )}

                {lugaresFiltrados.length > 0 ? (
                  lugaresFiltrados.map((item, index) => {
                    const nombre = typeof item === "string" ? item : item.name;
                    return (
                      <li
                        key={index}
                        onClick={() => handleSeleccionarLugar(item)}
                        className="itemResultadoFlotante"
                      >
                        {nombre}
                      </li>
                    );
                  })
                ) : (
                  <li className="sinResultadosFlotante">
                    No se encontraron lugares {esUsuarioGeneral ? "de trámites o visita " : ""}disponibles.
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* 2. DATOS DE USUARIO CENTRADOS SOBRE EL MAPA (FONDO TRANSPARENTE) */}
          <DatosUsuarios
            usuario={usuario}
            visible={mostrarDatos}
            onClose={() => setMostrarDatos(false)}
            onUsuarioActualizado={setUsuario}
          />

          {/* 3. CANVAS 3D DE UNITY */}
          <Mapa
            onCatalogoLoaded={({ edificios: eds, lugares: lugs }) => {
              setEdificios(eds);
              setLugares(lugs);
            }}
            onUnityReady={setUnityController}
            onUnityLoaded={handleUnityLoaded}
          />

          {/* 4. MENÚ INFERIOR DE EDIFICIOS PRINCIPALES */}
          <div className="barraEdificiosInferior">
            <div className="scrollHorizontalEdificios">
              {edificios.length > 0 ? (
                edificios.map((edificio, index) => {
                  const nombre =
                    typeof edificio === "string" ? edificio : edificio.name;
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
                  Esperando catálogo de Unity...
                </span>
              )}
            </div>
          </div>

          {/* 5. MINIMAPA GPS GOOGLE MAPS EN TIEMPO REAL (OPCIÓN A) */}
          <MinimapaGPS
            visible={mostrarGPS}
            onClose={() => setMostrarGPS(false)}
            unityController={unityController}
          />

        </div>
      </div>

      {/* Modal para reportar errores o bugs del mapa */}
      <ModalReporteBug
        visible={modalReporteAbierto}
        onClose={() => setModalReporteAbierto(false)}
        usuario={usuario}
        lugaresDisponibles={lugares}
      />

      {/* Modal de Comunicados, Avisos y Encuestas de Satisfacción */}
      <ModalNotificaciones
        visible={modalNotificacionesAbierto}
        onClose={() => setModalNotificacionesAbierto(false)}
        usuario={usuario}
        onNotificacionesActualizadas={setTotalNotificacionesActivas}
      />
    </div>
  );
}

export default Interfaz;
