import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas base del Campus ITFIP en El Espinal, Tolima
const CAMPUS_ORIGEN_ITFIP = {
  lat: 4.15638,
  lng: -74.89748,
};

// Puntos de inicio configurables en la maqueta 3D del campus
const PUNTOS_CAMPUS = [
  { id: "porteria", nombre: "🚪 Portería Principal", x: -99.6, z: 363.6, lat: 4.15638, lng: -74.89748 },
  { id: "bloqueD", nombre: "🏢 Bloque D (Canchas)", x: -146.5, z: 372.3, lat: 4.15645, lng: -74.89720 },
  { id: "bloqueE", nombre: "🏫 Bloque E", x: -160.0, z: 420.0, lat: 4.15680, lng: -74.89700 },
  { id: "coliseo", nombre: "⚽ Coliseo y Canchas", x: -200.0, z: 340.0, lat: 4.15610, lng: -74.89760 },
  { id: "plazoleta", nombre: "🏛️ Plazoleta Central", x: -120.0, z: 380.0, lat: 4.15655, lng: -74.89730 },
];

const RADIO_TIERRA_METROS = 6371000;

// Ruta de simulación calibrada dentro del perímetro del Campus ITFIP
const RUTA_SIMULADA_ITFIP = [
  { lugar: "Entrada Principal ITFIP", lat: 4.15638, lng: -74.89748, heading: 45 },
  { lugar: "Plazoleta Central", lat: 4.15655, lng: -74.89730, heading: 60 },
  { lugar: "Paso Frente a Bloque A-B-C", lat: 4.15672, lng: -74.89712, heading: 85 },
  { lugar: "Entrada Bloque D", lat: 4.15690, lng: -74.89695, heading: 90 },
  { lugar: "Pasillo hacia Bloque E", lat: 4.15705, lng: -74.89675, heading: 75 },
  { lugar: "Cafetería Universitaria", lat: 4.15665, lng: -74.89660, heading: 180 },
  { lugar: "Coliseo y Canchas", lat: 4.15625, lng: -74.89680, heading: 250 },
  { lugar: "Gimnasio Universitario (GYM)", lat: 4.15610, lng: -74.89715, heading: 290 },
];

function MinimapaGPSTest({ visible, onClose, unityController }) {
  // Modos de operación para pruebas:
  // 'fijo_uniespinal' | 'gps_libre' | 'simulador'
  const [modoTester, setModoTester] = useState("gps_libre");

  // Punto de inicio seleccionado en el campus 3D
  const [puntoInicio, setPuntoInicio] = useState(PUNTOS_CAMPUS[0]); // Por defecto: Portería Principal

  // Control para mostrar u ocultar el iframe 2D (por defecto minimizado en móvil para ver el 3D)
  const [mostrarMapa2D, setMostrarMapa2D] = useState(window.innerWidth > 768);

  // Coordenadas reflejadas en la maqueta 3D
  const [coords, setCoords] = useState({
    lat: CAMPUS_ORIGEN_ITFIP.lat,
    lng: CAMPUS_ORIGEN_ITFIP.lng,
    accuracy: 3,
    speed: 0,
    heading: 0,
  });

  // Coordenadas reales del dispositivo del tester
  const [coordsDispositivo, setCoordsDispositivo] = useState(null);

  // Desplazamiento relativo respecto al ancla
  const [deltaMetros, setDeltaMetros] = useState({ dx: 0, dz: 0, total: 0 });

  // Estabilizador anti-ruido satelital y de brújula (evita que la cámara se mueva sola con celular quieto)
  const [filtroAntiRuido, setFiltroAntiRuido] = useState(true);
  const [umbralRuidoMetros, setUmbralRuidoMetros] = useState(1.8);
  const [enMovimiento, setEnMovimiento] = useState(false);

  const anclaGPSRef = useRef(null);
  const filtroAntiRuidoRef = useRef(true);
  filtroAntiRuidoRef.current = filtroAntiRuido;
  const umbralRuidoRef = useRef(1.8);
  umbralRuidoRef.current = umbralRuidoMetros;

  const ultimoHeadingRef = useRef(0);
  const ultimaPosDespachadaRef = useRef({ x: puntoInicio.x, z: puntoInicio.z });

  const [indiceSimulacion, setIndiceSimulacion] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState("GPS Libre Activo");
  const [minimizado, setMinimizado] = useState(false);
  const [brujulaHeading, setBrujulaHeading] = useState(0);

  const simulacionRef = useRef(null);

  // Convertir coordenadas geográficas de UniEspinal a cartesianas Unity (X, Z)
  const calcularCoordenadasUnity = useCallback((lat, lng) => {
    const dLat = (lat - CAMPUS_ORIGEN_ITFIP.lat) * (Math.PI / 180);
    const dLng = (lng - CAMPUS_ORIGEN_ITFIP.lng) * (Math.PI / 180);

    const x = dLng * RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN_ITFIP.lat * (Math.PI / 180)) + puntoInicio.x;
    const z = dLat * RADIO_TIERRA_METROS + puntoInicio.z;

    return {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    };
  }, [puntoInicio]);

  // Enviar paquete GPS a Unity WebGL
  const despacharAUnity = useCallback(
    (lat, lng, heading, speed, accuracy, xOverride, zOverride) => {
      let x, z;
      if (xOverride !== undefined && zOverride !== undefined) {
        x = xOverride;
        z = zOverride;
      } else {
        const c = calcularCoordenadasUnity(lat, lng);
        x = c.x;
        z = c.z;
      }

      const rumboFinal = Number((heading ?? brujulaHeading ?? 0).toFixed(1));

      const paqueteGPS = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
        heading: rumboFinal,
        speed: Number((speed || 0).toFixed(2)),
        accuracy: Math.round(accuracy || 0),
        timestamp: Date.now(),
      };

      if (unityController && typeof unityController.actualizarGPS === "function") {
        unityController.actualizarGPS(paqueteGPS);
        setEstadoConexion("Sincronizado con WebGL (3D)");
      } else {
        setEstadoConexion("GPS Activo (Esperando WebGL)");
      }
    },
    [calcularCoordenadasUnity, unityController, brujulaHeading]
  );

  // 1. Giro en tiempo real: sensor de brújula o giroscopio del móvil
  useEffect(() => {
    let ultimoEnvio = 0;
    const handleOrientation = (e) => {
      const heading = e.webkitCompassHeading !== undefined
        ? e.webkitCompassHeading
        : (e.alpha !== null ? (360 - e.alpha) % 360 : null);

      if (heading !== null && heading !== undefined) {
        const h = Math.round(heading);
        setBrujulaHeading(h);

        const ahora = Date.now();
        // Si el filtro anti-ruido está activo, descartar oscilaciones espurias menores a 2.5 grados
        const diffHeading = Math.abs(h - ultimoHeadingRef.current);
        const cambioSignificativo = !filtroAntiRuidoRef.current || diffHeading >= 2.5;

        if (visible && cambioSignificativo && ahora - ultimoEnvio > 45) {
          ultimoEnvio = ahora;
          ultimoHeadingRef.current = h;
          if (modoTester === "gps_libre") {
            const posActual = ultimaPosDespachadaRef.current || { x: puntoInicio.x, z: puntoInicio.z };
            despacharAUnity(coords.lat, coords.lng, h, coords.speed, coords.accuracy, posActual.x, posActual.z);
          } else if (modoTester === "fijo_uniespinal") {
            despacharAUnity(puntoInicio.lat, puntoInicio.lng, h, 0, 1, puntoInicio.x, puntoInicio.z);
          }
        }
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [visible, modoTester, coords, puntoInicio, despacharAUnity]);

  // 2. Control del Modo 1: Fijo en UniEspinal
  useEffect(() => {
    if (modoTester !== "fijo_uniespinal" || !visible) return;

    setCoords({
      lat: puntoInicio.lat,
      lng: puntoInicio.lng,
      accuracy: 1,
      speed: 0,
      heading: brujulaHeading,
    });
    setEstadoConexion(`📍 Fijo en ${puntoInicio.nombre}`);
    despacharAUnity(puntoInicio.lat, puntoInicio.lng, brujulaHeading, 0, 1, puntoInicio.x, puntoInicio.z);
  }, [modoTester, puntoInicio, visible, brujulaHeading, despacharAUnity]);

  // 3. Control del Modo 2: GPS Libre (Posición Actual del Dispositivo para probar en cualquier lugar)
  useEffect(() => {
    if (modoTester !== "gps_libre" || !visible) return;

    if (!("geolocation" in navigator)) {
      setEstadoConexion("⚠️ Geolocalización no disponible");
      return;
    }

    setEstadoConexion("📡 Rastreando posición y giroscopio...");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        const nuevoHeading = heading !== null && heading !== undefined ? heading : brujulaHeading;

        setCoordsDispositivo({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy || 0),
          speed: speed ? Math.round(speed * 3.6) : 0,
          heading: Math.round(nuevoHeading || 0),
        });

        // Si no hay ancla previa, fijar la posición actual como punto cero del tester
        let anclaActual = anclaGPSRef.current;
        if (!anclaActual) {
          anclaActual = { lat: latitude, lng: longitude };
          anclaGPSRef.current = anclaActual;
          ultimaPosDespachadaRef.current = { x: puntoInicio.x, z: puntoInicio.z };
        }

        // Calcular desplazamiento relativo en metros (delta Este/Oeste y Norte/Sur)
        const dLat = (latitude - anclaActual.lat) * (Math.PI / 180);
        const dLng = (longitude - anclaActual.lng) * (Math.PI / 180);
        const dx = dLng * RADIO_TIERRA_METROS * Math.cos(anclaActual.lat * (Math.PI / 180));
        const dz = dLat * RADIO_TIERRA_METROS;
        const distTotal = Math.sqrt(dx * dx + dz * dz);

        const xCalculado = puntoInicio.x + dx;
        const zCalculado = puntoInicio.z + dz;

        // FILTRO ANTI-RUIDO SATELITAL (ZONA MUERTA DE REPOSO):
        let debeMover = true;
        if (filtroAntiRuidoRef.current && ultimaPosDespachadaRef.current) {
          const dXUltimo = xCalculado - ultimaPosDespachadaRef.current.x;
          const dZUltimo = zCalculado - ultimaPosDespachadaRef.current.z;
          const saltoMetros = Math.sqrt(dXUltimo * dXUltimo + dZUltimo * dZUltimo);

          // Si el salto es menor al umbral configurado (1.8m) y la velocidad del dispositivo es baja (< 0.4 m/s), es ruido GPS en reposo
          if (saltoMetros < umbralRuidoRef.current && (speed === null || speed < 0.4)) {
            debeMover = false;
            setEnMovimiento(false);
          } else {
            setEnMovimiento(true);
          }
        } else {
          setEnMovimiento(true);
        }

        if (debeMover) {
          ultimaPosDespachadaRef.current = { x: xCalculado, z: zCalculado };

          setDeltaMetros({
            dx: Number(dx.toFixed(1)),
            dz: Number(dz.toFixed(1)),
            total: Number(distTotal.toFixed(1)),
          });

          // Coordenada geográfica virtual sobre UniEspinal para Google Maps
          const latVirtual = puntoInicio.lat + (dz / RADIO_TIERRA_METROS) * (180 / Math.PI);
          const lngVirtual = puntoInicio.lng + (dx / (RADIO_TIERRA_METROS * Math.cos(puntoInicio.lat * (Math.PI / 180)))) * (180 / Math.PI);

          setCoords({
            lat: latVirtual,
            lng: lngVirtual,
            accuracy: Math.round(accuracy || 0),
            speed: speed ? Math.round(speed * 3.6) : 0,
            heading: Math.round(nuevoHeading || 0),
          });

          // Despachar a Unity: la cámara se posiciona exactamente a 1m sobre el punto
          despacharAUnity(latVirtual, lngVirtual, nuevoHeading, speed, accuracy, xCalculado, zCalculado);

          // Emitir evento global para el Grabador y Comparador de Rutas
          if (typeof window.dispatchEvent === "function") {
            window.dispatchEvent(
              new CustomEvent("UniMapGPSUpdate", {
                detail: {
                  x: Number(xCalculado.toFixed(2)),
                  z: Number(zCalculado.toFixed(2)),
                  lat: latVirtual,
                  lng: lngVirtual,
                  heading: Math.round(nuevoHeading || 0),
                  speed: speed ? Math.round(speed * 3.6) : 0,
                  accuracy: Math.round(accuracy || 0),
                  enMovimiento: true,
                  timestamp: Date.now(),
                },
              })
            );
          }
        }
      },
      (err) => {
        console.warn("Aviso GPS Tester:", err.message);
        if (window.isSecureContext === false) {
          setEstadoConexion("⚠️ GPS bloqueado por HTTP (Usa HTTPS)");
        } else if (err.code === 1) {
          setEstadoConexion("⚠️ Permiso de ubicación denegado");
        } else {
          setEstadoConexion("⚠️ Esperando satélites GPS...");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 500,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [modoTester, visible, puntoInicio, despacharAUnity, brujulaHeading]);

  // 4. Control del Modo 3: Simulador de Caminata dentro del ITFIP
  useEffect(() => {
    if (modoTester !== "simulador" || !visible) {
      if (simulacionRef.current) clearInterval(simulacionRef.current);
      return;
    }

    setEstadoConexion("🚶 Simulador de ruta ITFIP activo");

    simulacionRef.current = setInterval(() => {
      setIndiceSimulacion((prev) => {
        const siguiente = (prev + 1) % RUTA_SIMULADA_ITFIP.length;
        const punto = RUTA_SIMULADA_ITFIP[siguiente];

        setCoords({
          lat: punto.lat,
          lng: punto.lng,
          accuracy: 2,
          speed: 4,
          heading: punto.heading,
        });

        despacharAUnity(punto.lat, punto.lng, punto.heading, 1.1, 2);
        return siguiente;
      });
    }, 2000);

    return () => {
      if (simulacionRef.current) clearInterval(simulacionRef.current);
    };
  }, [modoTester, visible, despacharAUnity]);

  // Re-calibrar: fijar la posición actual como origen en el campus
  const recalibrarPosicionActual = () => {
    if (coordsDispositivo) {
      const nuevaAncla = { lat: coordsDispositivo.lat, lng: coordsDispositivo.lng };
      anclaGPSRef.current = nuevaAncla;
      ultimaPosDespachadaRef.current = { x: puntoInicio.x, z: puntoInicio.z };
      setDeltaMetros({ dx: 0, dz: 0, total: 0 });
      despacharAUnity(puntoInicio.lat, puntoInicio.lng, brujulaHeading, 0, 1, puntoInicio.x, puntoInicio.z);
    }
  };

  if (!visible) return null;

  const getPuntoCardinal = (deg) => {
    const sectores = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
    return sectores[index];
  };

  // Coordenadas calculadas para Unity
  const unityCoord = modoTester === "gps_libre"
    ? { x: Number((puntoInicio.x + deltaMetros.dx).toFixed(2)), z: Number((puntoInicio.z + deltaMetros.dz).toFixed(2)) }
    : calcularCoordenadasUnity(coords.lat, coords.lng);

  // Coordenadas para Google Maps
  const mapaLat = coords.lat;
  const mapaLng = coords.lng;

  return (
    <div className={`widgetMinimapaGPS ${minimizado ? "minimizado" : ""}`} style={{ border: "2px solid #06b6d4" }}>
      {/* Header del Minimapa Tester */}
      <div className="headerMinimapaGPS" style={{ background: "linear-gradient(135deg, #0f172a, #164e63)" }}>
        <div className="tituloHeaderMinimapa">
          <span className="iconoHeaderGPS">🧪</span>
          <div>
            <h4 style={{ color: "#38bdf8" }}>GPS Tester (Cámara a 1m)</h4>
            <span className="estadoSubtitulo">
              {modoTester === "simulador" && RUTA_SIMULADA_ITFIP[indiceSimulacion]
                ? RUTA_SIMULADA_ITFIP[indiceSimulacion].lugar
                : estadoConexion}
            </span>
          </div>
        </div>

        <div className="accionesHeaderMinimapa">
          <button
            type="button"
            className="btnMinimizarMinimapa"
            onClick={() => setMinimizado((prev) => !prev)}
            title={minimizado ? "Expandir panel GPS" : "Minimizar panel GPS"}
          >
            {minimizado ? "🔼" : "🔽"}
          </button>
          <button
            type="button"
            className="btnCerrarMinimapa"
            onClick={onClose}
            title="Cerrar mapa GPS"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimizado && (
        <div className="cuerpoMinimapaGPS">
          {/* Selector de Modos de Prueba */}
          <div className="selectorModosTester">
            <button
              type="button"
              className={`btnTabTester ${modoTester === "gps_libre" ? "activo" : ""}`}
              onClick={() => {
                setModoTester("gps_libre");
                if (coordsDispositivo) {
                  anclaGPSRef.current = { lat: coordsDispositivo.lat, lng: coordsDispositivo.lng };
                }
              }}
              title="Caminar y girar en cualquier lugar mueve la cámara a 1m en el campus 3D"
            >
              🌍 GPS Libre (Tu Ubicación)
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "fijo_uniespinal" ? "activo" : ""}`}
              onClick={() => setModoTester("fijo_uniespinal")}
              title="Fija la cámara en un punto exacto del campus"
            >
              📍 Punto Fijo
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "simulador" ? "activo" : ""}`}
              onClick={() => setModoTester("simulador")}
              title="Simula un recorrido automático a pie"
            >
              🚶 Simulador
            </button>
          </div>

          {/* Selector de Punto de Partida en el Campus (Portería, Bloque D, Bloque E, Coliseo, etc.) */}
          <div className="selectorPuntoInicioTester">
            <label className="etiquetaSelectPunto">📍 Punto de inicio en el Campus 3D:</label>
            <select
              className="selectCampusUbicacion"
              value={puntoInicio.id}
              onChange={(e) => {
                const punto = PUNTOS_CAMPUS.find((p) => p.id === e.target.value) || PUNTOS_CAMPUS[0];
                setPuntoInicio(punto);
                anclaGPSRef.current = null;
                setDeltaMetros({ dx: 0, dz: 0, total: 0 });
                despacharAUnity(punto.lat, punto.lng, brujulaHeading, 0, 1, punto.x, punto.z);
              }}
            >
              {PUNTOS_CAMPUS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (X: {p.x}, Z: {p.z})
                </option>
              ))}
            </select>
          </div>

          {/* Banner y Acciones del modo GPS Libre */}
          {modoTester === "gps_libre" && (
            <div className="bannerGpsLibreInfo">
              <div className="infoGpsLibreTexto">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong>🚶 Movimiento Peatonal:</strong>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: enMovimiento ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: enMovimiento ? "#34d399" : "#fbbf24",
                      border: `1px solid ${enMovimiento ? "#10b981" : "#f59e0b"}`,
                      fontWeight: 600,
                    }}
                  >
                    {enMovimiento ? "🟢 Caminando" : "🟡 Celular Quieto (En reposo)"}
                  </span>
                </div>
                <p>
                  Gira o camina con tu teléfono. La cámara se ubica a 1m de altura y gira hacia tu rumbo.
                  {deltaMetros.total > 0 && ` Recorrido: ${deltaMetros.total}m.`}
                </p>
              </div>

              {/* Control del Estabilizador Anti-Ruido */}
              <div className="filaFiltroAntiRuido" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0", fontSize: "11px", color: "#94a3b8" }}>
                <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={filtroAntiRuido}
                    onChange={(e) => setFiltroAntiRuido(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>🛡️ Filtro Anti-Ruido GPS</span>
                </label>
                <select
                  value={umbralRuidoMetros}
                  onChange={(e) => setUmbralRuidoMetros(Number(e.target.value))}
                  style={{
                    background: "#0f172a",
                    color: "#38bdf8",
                    border: "1px solid #334155",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "10.5px",
                  }}
                  title="Sensibilidad del filtro de reposo"
                >
                  <option value={1.0}>1.0m (Sensible)</option>
                  <option value={1.8}>1.8m (Estándar)</option>
                  <option value={2.5}>2.5m (Filtro Alto)</option>
                  <option value={4.0}>4.0m (Máx Estabilidad)</option>
                </select>
              </div>

              <div className="accionesGpsLibre">
                <button
                  type="button"
                  className="btnRecalibrarTester"
                  onClick={recalibrarPosicionActual}
                  title="Fija tu posición actual como el centro de partida"
                >
                  🎯 Re-anclar Origen
                </button>
                <button
                  type="button"
                  className="btnToggleVistaMapa"
                  onClick={() => setMostrarMapa2D((prev) => !prev)}
                  title="Muestra u oculta el mapa 2D para dejar visible el campus 3D en el móvil"
                >
                  {mostrarMapa2D ? "🔼 Ocultar Mapa 2D" : "🗺️ Ver Mapa 2D"}
                </button>
              </div>
            </div>
          )}

          {/* Contenedor del Mapa 2D de Google (Opcional en móvil para dar 100% visibilidad al 3D) */}
          {mostrarMapa2D && (
            <div className="frameMapaContainer">
              <iframe
                title="Google Maps GPS Tester"
                src={`https://maps.google.com/maps?q=${mapaLat},${mapaLng}&z=17&output=embed`}
                className="iframeGoogleMaps"
                loading="lazy"
              />

              {/* Marcador Radar GPS sobre el mapa */}
              <div className="radarPuntoUsuario">
                <div
                  className="conoOrientacionHeading"
                  style={{ transform: `rotate(${coords.heading || brujulaHeading || 0}deg)` }}
                  title={`Rumbo: ${coords.heading || brujulaHeading || 0}°`}
                >
                  ▲
                </div>
                <div className="circuloPulsoAzul" style={{ borderColor: "#06b6d4" }} />
                <div className="puntoAzulCentro" style={{ background: "#06b6d4" }} />
              </div>

              {/* Brújula flotante */}
              <div
                className="brujulaFlotante"
                style={{ transform: `rotate(-${coords.heading || brujulaHeading || 0}deg)` }}
                title="Brújula Norte"
              >
                <span>N</span>
              </div>
            </div>
          )}

          {/* Telemetría y Coordenadas para Testers */}
          <div className="telemetriaGPS">
            <div className="filaTelemetria">
              <span className="etiquetaTelemetria">Posición 3D (X, Z):</span>
              <span className="valorTelemetria resaltaVerde">
                X: {unityCoord.x}m | Z: {unityCoord.z}m (Cámara: +1.0m)
              </span>
            </div>

            {modoTester === "gps_libre" && (
              <div className="filaTelemetria" style={{ fontSize: "11px", color: "#38bdf8" }}>
                <span>Avance Físico:</span>
                <span>ΔX: {deltaMetros.dx}m | ΔZ: {deltaMetros.dz}m (Total: {deltaMetros.total}m)</span>
              </div>
            )}

            <div className="gridTelemetriaDatos">
              <div className="itemMiniDato">
                <small>Rumbo Brújula</small>
                <b>{coords.heading || brujulaHeading}° ({getPuntoCardinal(coords.heading || brujulaHeading)})</b>
              </div>
              <div className="itemMiniDato">
                <small>Velocidad</small>
                <b>{coords.speed} km/h</b>
              </div>
              <div className="itemMiniDato">
                <small>Precisión</small>
                <b>±{coords.accuracy}m</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MinimapaGPSTest;
