import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas base de anclaje del Campus (Punto origen 0,0 en Unity)
const CAMPUS_ORIGEN = {
  lat: 4.0743,
  lng: -73.5828,
};
const RADIO_TIERRA_METROS = 6371000;

// Ruta de simulación para pruebas en PC sin salir a caminar
const RUTA_SIMULADA = [
  { lugar: "Entrada Principal", lat: 4.0743, lng: -73.5828, heading: 40 },
  { lugar: "Plazoleta Central", lat: 4.07455, lng: -73.58255, heading: 65 },
  { lugar: "Camino a Bloque A", lat: 4.07475, lng: -73.58235, heading: 85 },
  { lugar: "Frente a Bloque A", lat: 4.07485, lng: -73.5821, heading: 90 },
  { lugar: "Paso Bloque D", lat: 4.07498, lng: -73.5818, heading: 110 },
  { lugar: "Llegada a Bloque E", lat: 4.07515, lng: -73.5815, heading: 75 },
  { lugar: "Cafetería Universitaria", lat: 4.07465, lng: -73.5813, heading: 195 },
  { lugar: "Zona Deportiva / Coliseo", lat: 4.07425, lng: -73.5817, heading: 260 },
];

function MinimapaGPS({ visible, onClose, unityController }) {
  // Estados de localización
  const [coords, setCoords] = useState({
    lat: CAMPUS_ORIGEN.lat,
    lng: CAMPUS_ORIGEN.lng,
    accuracy: 5,
    speed: 0,
    heading: 0,
  });

  const [modoSimulador, setModoSimulador] = useState(false);
  const [indiceSimulacion, setIndiceSimulacion] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState("Iniciando GPS...");
  const [minimizado, setMinimizado] = useState(false);
  const [brujulaHeading, setBrujulaHeading] = useState(0);

  // Ref para controlar el intervalo de simulación
  const simulacionRef = useRef(null);

  // Convertir coordenadas geográficas WGS84 a coordenadas cartesianas (X, Z) en Unity
  const calcularCoordenadasUnity = useCallback((lat, lng) => {
    const dLat = (lat - CAMPUS_ORIGEN.lat) * (Math.PI / 180);
    const dLng = (lng - CAMPUS_ORIGEN.lng) * (Math.PI / 180);

    // X = Este/Oeste, Z = Norte/Sur en Unity
    const x = dLng * RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN.lat * (Math.PI / 180));
    const z = dLat * RADIO_TIERRA_METROS;

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
    },
    [calcularCoordenadasUnity, unityController, brujulaHeading]
  );

  // 1. Escuchar sensor de brújula o giroscopio del dispositivo (móvil)
  useEffect(() => {
    const handleOrientation = (e) => {
      // webkitCompassHeading para iOS, alpha invertido para Android
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

  // 2. Rastrear GPS Real con Geolocation API cuando el simulador esté apagado
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
        const nuevoHeading = heading !== null && heading !== undefined ? heading : brujulaHeading;

        setCoords({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy || 0),
          speed: speed ? Math.round(speed * 3.6) : 0, // Convertir m/s a km/h
          heading: Math.round(nuevoHeading || 0),
        });

        despacharAUnity(latitude, longitude, nuevoHeading, speed, accuracy);
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
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [modoSimulador, visible, despacharAUnity, brujulaHeading]);

  // 3. Modo Simulador de Caminata por el Campus (útil en PC)
  useEffect(() => {
    if (!modoSimulador || !visible) {
      if (simulacionRef.current) clearInterval(simulacionRef.current);
      return;
    }

    setEstadoConexion("🚶 Simulador de movimiento activo");

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
  }, [modoSimulador, visible, despacharAUnity]);

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
            <h4>GPS Google Maps</h4>
            <span className="estadoSubtitulo">
              {modoSimulador && RUTA_SIMULADA[indiceSimulacion]
                ? RUTA_SIMULADA[indiceSimulacion].lugar
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
