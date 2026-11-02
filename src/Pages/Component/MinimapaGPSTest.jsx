import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas reales de anclaje del Campus ITFIP en El Espinal, Tolima
const CAMPUS_ORIGEN_ITFIP = {
  lat: 4.15638,
  lng: -74.89748,
};

// Offset calibrado de la maqueta 3D en Unity WebGL
const OFFSET_UNITY = {
  x: -146.5,
  z: 372.3,
};

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
  const [modoTester, setModoTester] = useState("fijo_uniespinal");

  // Opción para alternar visualización en Google Maps ('uniespinal' o 'dispositivo_real')
  const [vistaMapa, setVistaMapa] = useState("uniespinal");

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

  // Punto de anclaje relativo cuando se usa GPS Libre
  const [anclaGPS, setAnclaGPS] = useState(null);
  const [deltaMetros, setDeltaMetros] = useState({ dx: 0, dz: 0, total: 0 });

  const [indiceSimulacion, setIndiceSimulacion] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState("Punto fijo en UniEspinal");
  const [minimizado, setMinimizado] = useState(false);
  const [brujulaHeading, setBrujulaHeading] = useState(0);

  const simulacionRef = useRef(null);

  // Convertir coordenadas geográficas de UniEspinal a cartesianas Unity (X, Z)
  const calcularCoordenadasUnity = useCallback((lat, lng) => {
    const dLat = (lat - CAMPUS_ORIGEN_ITFIP.lat) * (Math.PI / 180);
    const dLng = (lng - CAMPUS_ORIGEN_ITFIP.lng) * (Math.PI / 180);

    const x = dLng * RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN_ITFIP.lat * (Math.PI / 180)) + OFFSET_UNITY.x;
    const z = dLat * RADIO_TIERRA_METROS + OFFSET_UNITY.z;

    return {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    };
  }, []);

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

  // 1. Escuchar sensor de brújula o giroscopio del móvil
  useEffect(() => {
    const handleOrientation = (e) => {
      const heading = e.webkitCompassHeading !== undefined
        ? e.webkitCompassHeading
        : (e.alpha !== null ? (360 - e.alpha) % 360 : null);

      if (heading !== null && heading !== undefined) {
        setBrujulaHeading(Math.round(heading));
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  // 2. Control del Modo 1: Fijo en UniEspinal
  useEffect(() => {
    if (modoTester !== "fijo_uniespinal" || !visible) return;

    setCoords({
      lat: CAMPUS_ORIGEN_ITFIP.lat,
      lng: CAMPUS_ORIGEN_ITFIP.lng,
      accuracy: 1,
      speed: 0,
      heading: 0,
    });
    setEstadoConexion("📍 Marcador fijado en UniEspinal");
    despacharAUnity(CAMPUS_ORIGEN_ITFIP.lat, CAMPUS_ORIGEN_ITFIP.lng, 0, 0, 1, OFFSET_UNITY.x, OFFSET_UNITY.z);
  }, [modoTester, visible, despacharAUnity]);

  // 3. Control del Modo 2: GPS Libre (Posición Actual del Dispositivo para probar en cualquier lugar)
  useEffect(() => {
    if (modoTester !== "gps_libre" || !visible) return;

    if (!("geolocation" in navigator)) {
      setEstadoConexion("⚠️ Geolocalización no disponible en este navegador");
      return;
    }

    setEstadoConexion("📡 Rastreando posición actual del tester...");

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

        // Si no hay punto de anclaje inicial, tomar la primera posición como origen del tester
        let anclaActual = anclaGPS;
        if (!anclaActual) {
          anclaActual = { lat: latitude, lng: longitude };
          setAnclaGPS(anclaActual);
        }

        // Calcular desplazamiento relativo en metros (delta Este/Oeste y Norte/Sur)
        const dLat = (latitude - anclaActual.lat) * (Math.PI / 180);
        const dLng = (longitude - anclaActual.lng) * (Math.PI / 180);
        const dx = dLng * RADIO_TIERRA_METROS * Math.cos(anclaActual.lat * (Math.PI / 180));
        const dz = dLat * RADIO_TIERRA_METROS;
        const distTotal = Math.sqrt(dx * dx + dz * dz);

        setDeltaMetros({
          dx: Number(dx.toFixed(1)),
          dz: Number(dz.toFixed(1)),
          total: Number(distTotal.toFixed(1)),
        });

        // Aplicar el desplazamiento relativo a la maqueta 3D en Unity WebGL
        const xFinalUnity = OFFSET_UNITY.x + dx;
        const zFinalUnity = OFFSET_UNITY.z + dz;

        // Calcular coordenada geográfica virtual sobre UniEspinal para Google Maps
        const latVirtual = CAMPUS_ORIGEN_ITFIP.lat + (dz / RADIO_TIERRA_METROS) * (180 / Math.PI);
        const lngVirtual = CAMPUS_ORIGEN_ITFIP.lng + (dx / (RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN_ITFIP.lat * (Math.PI / 180)))) * (180 / Math.PI);

        setCoords({
          lat: latVirtual,
          lng: lngVirtual,
          accuracy: Math.round(accuracy || 0),
          speed: speed ? Math.round(speed * 3.6) : 0,
          heading: Math.round(nuevoHeading || 0),
        });

        // Despachar a Unity las coordenadas relativas calculadas
        despacharAUnity(latVirtual, lngVirtual, nuevoHeading, speed, accuracy, xFinalUnity, zFinalUnity);
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
  }, [modoTester, visible, anclaGPS, despacharAUnity, brujulaHeading]);

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

  // Función para re-anclar la posición actual del dispositivo como centro del campus
  const recalibrarPosicionActual = () => {
    if (coordsDispositivo) {
      setAnclaGPS({ lat: coordsDispositivo.lat, lng: coordsDispositivo.lng });
      setDeltaMetros({ dx: 0, dz: 0, total: 0 });
      despacharAUnity(CAMPUS_ORIGEN_ITFIP.lat, CAMPUS_ORIGEN_ITFIP.lng, brujulaHeading, 0, 1, OFFSET_UNITY.x, OFFSET_UNITY.z);
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
    ? { x: Number((OFFSET_UNITY.x + deltaMetros.dx).toFixed(2)), z: Number((OFFSET_UNITY.z + deltaMetros.dz).toFixed(2)) }
    : calcularCoordenadasUnity(coords.lat, coords.lng);

  // Determinar qué coordenadas mostrar en el iframe de Google Maps
  const mapaLat = modoTester === "gps_libre" && vistaMapa === "dispositivo_real" && coordsDispositivo
    ? coordsDispositivo.lat
    : coords.lat;

  const mapaLng = modoTester === "gps_libre" && vistaMapa === "dispositivo_real" && coordsDispositivo
    ? coordsDispositivo.lng
    : coords.lng;

  return (
    <div className={`widgetMinimapaGPS ${minimizado ? "minimizado" : ""}`} style={{ border: "2px solid #06b6d4" }}>
      {/* Header del Minimapa Tester */}
      <div className="headerMinimapaGPS" style={{ background: "linear-gradient(135deg, #0f172a, #164e63)" }}>
        <div className="tituloHeaderMinimapa">
          <span className="iconoHeaderGPS">🧪</span>
          <div>
            <h4 style={{ color: "#38bdf8" }}>GPS Tester Multientorno</h4>
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
            title={minimizado ? "Expandir mapa GPS" : "Minimizar"}
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
              className={`btnTabTester ${modoTester === "fijo_uniespinal" ? "activo" : ""}`}
              onClick={() => setModoTester("fijo_uniespinal")}
              title="Fija el GPS en el punto exacto de UniEspinal"
            >
              📍 Fijo UniEspinal
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "gps_libre" ? "activo" : ""}`}
              onClick={() => {
                setModoTester("gps_libre");
                if (coordsDispositivo) {
                  setAnclaGPS({ lat: coordsDispositivo.lat, lng: coordsDispositivo.lng });
                }
              }}
              title="Toma tu ubicación real en cualquier lugar y proyecta tu movimiento al campus 3D"
            >
              🌍 GPS Libre (Tu Ubicación)
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "simulador" ? "activo" : ""}`}
              onClick={() => setModoTester("simulador")}
              title="Simula una caminata automática por las instalaciones"
            >
              🚶 Simulador
            </button>
          </div>

          {/* Banner explicativo del modo GPS Libre */}
          {modoTester === "gps_libre" && (
            <div className="bannerGpsLibreInfo">
              <div className="infoGpsLibreTexto">
                <strong>🌍 Modo Pruebas en Cualquier Lugar:</strong>
                <p>
                  Tu movimiento real en la calle o casa moverá el punto en el campus 3D.
                  {deltaMetros.total > 0 && ` Has caminado ${deltaMetros.total}m.`}
                </p>
              </div>
              <div className="accionesGpsLibre">
                <button
                  type="button"
                  className="btnRecalibrarTester"
                  onClick={recalibrarPosicionActual}
                  title="Establece tu posición actual como el punto cero de partida"
                >
                  🎯 Re-anclar Origen
                </button>
                <button
                  type="button"
                  className="btnToggleVistaMapa"
                  onClick={() => setVistaMapa((prev) => (prev === "uniespinal" ? "dispositivo_real" : "uniespinal"))}
                  title="Cambia el mapa entre UniEspinal y tu ubicación real"
                >
                  🗺️ {vistaMapa === "uniespinal" ? "Ver Mi Calle Real" : "Ver UniEspinal"}
                </button>
              </div>
            </div>
          )}

          {/* Contenedor del Mapa de Google Embebido */}
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

          {/* Telemetría y Coordenadas para Testers */}
          <div className="telemetriaGPS">
            <div className="filaTelemetria">
              <span className="etiquetaTelemetria">
                {modoTester === "gps_libre" && vistaMapa === "dispositivo_real"
                  ? "Ubicación Real del Tester:"
                  : "Coordenadas Campus UniEspinal:"}
              </span>
              <span className="valorTelemetria">
                {modoTester === "gps_libre" && vistaMapa === "dispositivo_real" && coordsDispositivo
                  ? `${coordsDispositivo.lat.toFixed(5)}, ${coordsDispositivo.lng.toFixed(5)}`
                  : `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
              </span>
            </div>

            <div className="filaTelemetria">
              <span className="etiquetaTelemetria">Posición 3D Unity (X, Z):</span>
              <span className="valorTelemetria resaltaVerde">
                X: {unityCoord.x}m | Z: {unityCoord.z}m
              </span>
            </div>

            {modoTester === "gps_libre" && (
              <div className="filaTelemetria" style={{ fontSize: "11px", color: "#38bdf8" }}>
                <span>Desplazamiento Relativo:</span>
                <span>ΔX: {deltaMetros.dx}m | ΔZ: {deltaMetros.dz}m (Total: {deltaMetros.total}m)</span>
              </div>
            )}

            <div className="gridTelemetriaDatos">
              <div className="itemMiniDato">
                <small>Rumbo</small>
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
