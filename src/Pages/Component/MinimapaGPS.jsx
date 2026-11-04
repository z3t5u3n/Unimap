import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas fijas de anclaje de UniEspinal (Entrada Principal ITFIP en El Espinal, Tolima)
const CAMPUS_ORIGEN = {
  lat: 4.156380,
  lng: -74.897480,
};

const RADIO_TIERRA_METROS = 6371000;
const RADIO_GEOFENCE_METROS = 800; // Radio del campus UniEspinal (~800m)

// Calcular distancia geográfica exacta en metros (Fórmula de Haversine)
const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// Ruta de simulación dentro de las instalaciones de UniEspinal (ITFIP)
const RUTA_SIMULADA = [
  { lugar: "Entrada Principal ITFIP", lat: 4.15638, lng: -74.89748, heading: 45 },
  { lugar: "Gimnasio Universitario (GYM)", lat: 4.15610, lng: -74.89715, heading: 90 },
  { lugar: "Coliseo y Canchas", lat: 4.15625, lng: -74.89680, heading: 120 },
  { lugar: "Paso Frente a Bloque A-B-C", lat: 4.15672, lng: -74.89712, heading: 60 },
  { lugar: "Entrada Bloque D", lat: 4.15690, lng: -74.89695, heading: 85 },
  { lugar: "Pasillo hacia Bloque E", lat: 4.15705, lng: -74.89675, heading: 75 },
  { lugar: "Cafetería Universitaria", lat: 4.15665, lng: -74.89660, heading: 180 },
  { lugar: "Plazoleta Central", lat: 4.15655, lng: -74.89730, heading: 240 },
];

function MinimapaGPS({ visible, onClose, unityController }) {
  // Estados de localización: Punto inicial fijado en UniEspinal
  const [coords, setCoords] = useState({
    lat: CAMPUS_ORIGEN.lat,
    lng: CAMPUS_ORIGEN.lng,
    accuracy: 3,
    speed: 0,
    heading: 0,
  });

  const [modoSimulador, setModoSimulador] = useState(false);
  const [indiceSimulacion, setIndiceSimulacion] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState("Iniciando GPS UniEspinal...");
  const [minimizado, setMinimizado] = useState(false);
  const [brujulaHeading, setBrujulaHeading] = useState(0);

  // Estados de validación física en UniEspinal (Geofence)
  const [errorGeofence, setErrorGeofence] = useState(null);
  const [distanciaAlCampus, setDistanciaAlCampus] = useState(0);

  // Refs para filtros antiruido satelital y control de simulación
  const simulacionRef = useRef(null);
  const ultimoPuntoEstableRef = useRef(null);
  const ultimoHeadingRef = useRef(0);

  // Convertir coordenadas geográficas WGS84 a coordenadas cartesianas calibradas (X, Z) en Unity
  const calcularCoordenadasUnity = useCallback((lat, lng) => {
    const dLat = (lat - CAMPUS_ORIGEN.lat) * (Math.PI / 180);
    const dLng = (lng - CAMPUS_ORIGEN.lng) * (Math.PI / 180);

    const east = dLng * RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN.lat * (Math.PI / 180));
    const north = dLat * RADIO_TIERRA_METROS;

    // Transformación afín calibrada con los edificios 3D reales de UniEspinal (ITFIP)
    const x = -0.217679 * east - 0.145650 * north - 100.09;
    const z = 0.897218 * east + 1.530297 * north + 243.98;

    return {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    };
  }, []);

  // Enviar coordenadas y orientación a Unity WebGL
  const despacharAUnity = useCallback(
    (lat, lng, heading, speed, accuracy) => {
      const { x, z } = calcularCoordenadasUnity(lat, lng);
      const rumboFinal = Number((heading ?? brujulaHeading ?? 0).toFixed(1));

      const paqueteGPS = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        x: x,
        z: z,
        heading: rumboFinal,
        speed: Number((speed || 0).toFixed(2)),
        accuracy: Math.round(accuracy || 0),
        timestamp: Date.now(),
      };

      if (unityController && typeof unityController.actualizarGPS === "function") {
        unityController.actualizarGPS(paqueteGPS);
        setEstadoConexion("Sincronizado con WebGL");
      } else {
        setEstadoConexion("GPS Activo (Esperando Unity)");
      }

      // Emitir evento para el panel de rutas
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("UniMapGPSUpdate", {
            detail: {
              x: x,
              z: z,
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
              heading: rumboFinal,
              speed: Number((speed || 0).toFixed(2)),
              accuracy: Math.round(accuracy || 0),
              enMovimiento: (speed || 0) > 0.4,
              timestamp: Date.now(),
            },
          })
        );
      }
    },
    [calcularCoordenadasUnity, unityController, brujulaHeading]
  );

  // 1. Escuchar sensor de brújula o giroscopio del dispositivo (móvil) con filtro de zona muerta
  useEffect(() => {
    const handleOrientation = (e) => {
      // webkitCompassHeading para iOS, alpha invertido para Android
      const heading = e.webkitCompassHeading !== undefined
        ? e.webkitCompassHeading
        : (e.alpha !== null ? (360 - e.alpha) % 360 : null);

      if (heading !== null && heading !== undefined) {
        const h = Math.round(heading);
        // Zona muerta antitemblores involuntarios de la mano (mínimo 3.0 grados de cambio)
        const diff = Math.abs((h - (ultimoHeadingRef.current || 0) + 540) % 360 - 180);
        if (diff >= 3.0) {
          ultimoHeadingRef.current = h;
          setBrujulaHeading(h);
        }
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  // 2. Rastrear GPS Real con Geolocation API con filtro de zona muerta y EMA
  useEffect(() => {
    if (modoSimulador || !visible) return;

    if (!("geolocation" in navigator)) {
      setEstadoConexion("⚠️ Geolocalización no disponible en este navegador");
      return;
    }

    setEstadoConexion("Buscando satélites GPS...");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        const nuevoHeading = heading !== null && heading !== undefined ? Math.round(heading) : (ultimoHeadingRef.current || brujulaHeading || 0);
        const distancia = calcularDistanciaMetros(latitude, longitude, CAMPUS_ORIGEN.lat, CAMPUS_ORIGEN.lng);
        setDistanciaAlCampus(distancia);

        if (distancia > RADIO_GEOFENCE_METROS) {
          // El usuario NO está físicamente en UniEspinal (ej. en su casa)
          const km = (distancia / 1000).toFixed(1);
          setErrorGeofence(`Estás a ${km} km del campus. El seguimiento GPS en vivo se activará al llegar a la universidad.`);
          setEstadoConexion("⚠️ Fuera del campus UniEspinal");

          // Mantener mapa local centrado pero NO despachar a Unity para evitar secuestro de cámara y vibraciones en casa
          setCoords({
            lat: CAMPUS_ORIGEN.lat,
            lng: CAMPUS_ORIGEN.lng,
            accuracy: Math.round(accuracy || 0),
            speed: 0,
            heading: nuevoHeading,
          });

          // Desactivar el modo GPS en Unity para que el usuario pueda usar control manual libremente
          if (unityController && typeof unityController.setModoGPS === "function") {
            unityController.setModoGPS(false);
          }
        } else {
          // El usuario SÍ está físicamente dentro de UniEspinal
          setErrorGeofence(null);

          // 1. Descartar lecturas con precisión satelital deficiente (> 30 metros)
          if (accuracy > 30) {
            console.warn("[GPS] Descartada lectura con baja precisión satelital:", accuracy);
            setEstadoConexion(`⚠️ Señal débil (±${Math.round(accuracy)}m)`);
            return;
          }

          // 2. Filtro de zona muerta para usuario quieto:
          // Si el desplazamiento es menor a 2.5 metros y la velocidad es baja (< 0.6 m/s = ~2.1 km/h), el usuario está detenido
          const velMs = speed ? Math.max(0, speed) : 0;
          if (ultimoPuntoEstableRef.current) {
            const deltaM = calcularDistanciaMetros(latitude, longitude, ultimoPuntoEstableRef.current.lat, ultimoPuntoEstableRef.current.lng);
            if (deltaM < 2.5 && velMs < 0.6) {
              // Usuario detenido: mantener posición fija y no enviar ruido satelital a Unity
              setCoords((prev) => ({
                ...prev,
                speed: 0,
                accuracy: Math.round(accuracy || 0),
                heading: nuevoHeading,
              }));
              return;
            }
          }

          // 3. Filtro suavizador exponencial (EMA) para pasos y marcha fluida
          let latFiltrada = latitude;
          let lngFiltrada = longitude;
          if (ultimoPuntoEstableRef.current) {
            latFiltrada = ultimoPuntoEstableRef.current.lat * 0.35 + latitude * 0.65;
            lngFiltrada = ultimoPuntoEstableRef.current.lng * 0.35 + longitude * 0.65;
          }

          ultimoPuntoEstableRef.current = { lat: latFiltrada, lng: lngFiltrada };

          setCoords({
            lat: latFiltrada,
            lng: lngFiltrada,
            accuracy: Math.round(accuracy || 0),
            speed: velMs > 0 ? Math.round(velMs * 3.6) : 0, // Convertir m/s a km/h
            heading: nuevoHeading,
          });

          despacharAUnity(latFiltrada, lngFiltrada, nuevoHeading, velMs, accuracy);
        }
      },
      (err) => {
        console.warn("Aviso GPS:", err.message);
        if (window.isSecureContext === false) {
          setEstadoConexion("⚠️ Bloqueado por HTTP (Usa 'Simular' o activa HTTPS)");
        } else if (err.code === 1) {
          setEstadoConexion("⚠️ Permiso de ubicación denegado");
        } else if (err.code === 2) {
          setEstadoConexion("⚠️ Posición no disponible o sin señal");
        } else {
          setEstadoConexion("⚠️ Esperando señal de satélites...");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 6000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [modoSimulador, visible, despacharAUnity, brujulaHeading, unityController]);

  // 3. Modo Simulador de Caminata por el Campus (útil en PC o desde casa)
  useEffect(() => {
    if (!modoSimulador || !visible) {
      if (simulacionRef.current) clearInterval(simulacionRef.current);
      return;
    }

    // Al activar el simulador limpiamos la alerta de geofence porque la ruta es interna de UniEspinal
    setErrorGeofence(null);
    setEstadoConexion("🚶 Simulador de movimiento activo");

    if (unityController && typeof unityController.setModoGPS === "function") {
      unityController.setModoGPS(true);
    }

    simulacionRef.current = setInterval(() => {
      setIndiceSimulacion((prev) => {
        const siguiente = (prev + 1) % RUTA_SIMULADA.length;
        const punto = RUTA_SIMULADA[siguiente];

        setCoords({
          lat: punto.lat,
          lng: punto.lng,
          accuracy: 3,
          speed: 4, // 4 km/h caminando
          heading: punto.heading,
        });

        despacharAUnity(punto.lat, punto.lng, punto.heading, 1.1, 3);
        return siguiente;
      });
    }, 2000);

    return () => {
      if (simulacionRef.current) clearInterval(simulacionRef.current);
    };
  }, [modoSimulador, visible, despacharAUnity, unityController]);

  if (!visible) return null;

  // Calcular rumbo cardinal (N, NE, E, SE, S, SW, W, NW)
  const getPuntoCardinal = (deg) => {
    const sectores = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
    return sectores[index];
  };

  const unityCoord = calcularCoordenadasUnity(coords.lat, coords.lng);

  return (
    <div className={`widgetMinimapaGPS ${minimizado ? "minimizado" : ""}`}>
      {/* Barra de cabecera */}
      <div className="headerMinimapaGPS">
        <div className="tituloMinimapa">
          <div>
            <h4>GPS UniEspinal (ITFIP)</h4>
            <span className={`estadoSubtitulo ${errorGeofence ? "estadoError" : ""}`}>
              {errorGeofence
                ? "⚠️ Fuera de UniEspinal"
                : (modoSimulador && RUTA_SIMULADA[indiceSimulacion]
                    ? RUTA_SIMULADA[indiceSimulacion].lugar
                    : estadoConexion)}
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
          {/* Banner de alerta Geofence si el usuario no está en UniEspinal */}
          {errorGeofence && (
            <div className="alertaGeofenceGPS">
              <span className="iconoAlertaGPS">⚠️</span>
              <div className="textoAlertaGPS">
                <p className="mensajeErrorGeofence">{errorGeofence}</p>
                {distanciaAlCampus > 0 && (
                  <small className="distanciaDetalle">
                    (Estás a {distanciaAlCampus > 1000 ? `${(distanciaAlCampus / 1000).toFixed(1)} km` : `${distanciaAlCampus} m`} del campus UniEspinal)
                  </small>
                )}
                <button
                  type="button"
                  className="btnActivarSimuladorAlerta"
                  onClick={() => setModoSimulador(true)}
                  style={{
                    marginTop: "8px",
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    borderRadius: "6px",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "4px 8px",
                    cursor: "pointer",
                    display: "inline-block",
                  }}
                >
                  🚶 Probar Recorrido Virtual desde casa
                </button>
              </div>
            </div>
          )}

          {/* Contenedor del Mapa de Google Embebido */}
          <div className="frameMapaContainer">
            <iframe
              title="Google Maps GPS en Vivo"
              src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=17&output=embed`}
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
              <div className="circuloPulsoAzul" />
              <div className="puntoAzulCentro" />
            </div>

            {/* Rosa de los vientos / Brújula flotante */}
            <div
              className="brujulaFlotante"
              style={{ transform: `rotate(-${coords.heading || brujulaHeading || 0}deg)` }}
              title="Brújula Norte"
            >
              <span>N</span>
            </div>
          </div>

          {/* Telemetría y Coordenadas en tiempo real */}
          <div className="telemetriaGPS">
            <div className="filaTelemetria">
              <span className="etiquetaTelemetria">Lat / Lng:</span>
              <span className="valorTelemetria">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
            </div>

            <div className="filaTelemetria">
              <span className="etiquetaTelemetria">Posición 3D (X, Z):</span>
              <span className="valorTelemetria resaltaVerde">
                X: {unityCoord.x}m | Z: {unityCoord.z}m
              </span>
            </div>

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

          {/* Controles de Modo: GPS Real vs Simulador */}
          <div className="controlesMinimapaFooter">
            <button
              type="button"
              className={`btnModoRastreo ${!modoSimulador ? "activo" : ""}`}
              onClick={() => setModoSimulador(false)}
            >
              🛰️ GPS Real
            </button>
            <button
              type="button"
              className={`btnModoRastreo ${modoSimulador ? "activo" : ""}`}
              onClick={() => setModoSimulador(true)}
              title="Simula un recorrido a pie por el campus para probar en PC"
            >
              🚶 Simular Recorrido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MinimapaGPS;
