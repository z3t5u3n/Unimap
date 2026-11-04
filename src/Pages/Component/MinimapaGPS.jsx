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
  const [modoLibreCasa, setModoLibreCasa] = useState(false);
  const [indiceSimulacion, setIndiceSimulacion] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState("Iniciando GPS...");
  const [minimizado, setMinimizado] = useState(false);
  const [brujulaHeading, setBrujulaHeading] = useState(0);

  // Podómetro por Acelerómetro (Detección inercial de pasos físicos)
  const [contadorPasos, setContadorPasos] = useState(0);
  const [caminandoPorInercia, setCaminandoPorInercia] = useState(false);

  // Estados de validación física en UniEspinal (Geofence)
  const [errorGeofence, setErrorGeofence] = useState(null);
  const [distanciaAlCampus, setDistanciaAlCampus] = useState(0);

  // Refs para filtros antiruido satelital adaptados a Kirin 710F (Huawei Y9 Prime)
  const simulacionRef = useRef(null);
  const anclaGPSRef = useRef(null);
  const ultimoPuntoEstableRef = useRef(null);
  const ultimoHeadingRef = useRef(0);
  const haIniciadoMovimientoRef = useRef(false);

  // Refs para Podómetro Inercial
  const contadorPasosRef = useRef(0);
  const caminandoPorInerciaRef = useRef(false);
  const acelerometroDisponibleRef = useRef(false);
  const ultimoPasoTimeRef = useRef(0);
  const ultimaAceleracionRef = useRef(0);
  const timerInactividadPasoRef = useRef(null);

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

      const rumboFinal = Number((heading ?? ultimoHeadingRef.current ?? 0).toFixed(1));

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
        setEstadoConexion("Sincronizado con WebGL");
      } else {
        setEstadoConexion("GPS Activo (Esperando Unity)");
      }

      // Emitir evento para el panel de rutas
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("UniMapGPSUpdate", {
            detail: {
              x: Number(x.toFixed(2)),
              z: Number(z.toFixed(2)),
              lat: Number(lat.toFixed(6)),
              lng: Number(lng.toFixed(6)),
              heading: rumboFinal,
              speed: Number((speed || 0).toFixed(2)),
              accuracy: Math.round(accuracy || 0),
              enMovimiento: (speed || 0) > 0.45,
              timestamp: Date.now(),
            },
          })
        );
      }
    },
    [calcularCoordenadasUnity, unityController]
  );

  // Recalibrar y fijar posición actual (ancla y podómetro)
  const recalibrarPosicionActual = useCallback(() => {
    anclaGPSRef.current = null;
    ultimoPuntoEstableRef.current = null;
    haIniciadoMovimientoRef.current = false;
    contadorPasosRef.current = 0;
    setContadorPasos(0);
    caminandoPorInerciaRef.current = false;
    setCaminandoPorInercia(false);
    setEstadoConexion("📍 Posición reiniciada. Da pasos para comenzar...");
  }, []);

  // 1. Escuchar sensor de brújula o giroscopio del dispositivo (móvil) con filtro de zona muerta
  useEffect(() => {
    const handleOrientation = (e) => {
      // webkitCompassHeading para iOS, alpha invertido para Android
      const heading = e.webkitCompassHeading !== undefined
        ? e.webkitCompassHeading
        : (e.alpha !== null ? (360 - e.alpha) % 360 : null);

      if (heading !== null && heading !== undefined) {
        const h = Math.round(heading);
        // Zona muerta antitemblores involuntarios de la mano (mínimo 4.0 grados de cambio)
        const diff = Math.abs((h - (ultimoHeadingRef.current || 0) + 540) % 360 - 180);
        if (diff >= 4.0) {
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

  // 2. Podómetro Inercial: Escuchar acelerómetro para detección de pasos físicos reales (DeviceMotionEvent)
  useEffect(() => {
    const handleMotion = (e) => {
      const acc = e.acceleration || e.accelerationIncludingGravity;
      if (!acc) return;

      const hasLinear = e.acceleration && e.acceleration.x !== null && e.acceleration.x !== undefined;
      let dynamicAcc = 0;

      if (hasLinear) {
        const ax = e.acceleration.x || 0;
        const ay = e.acceleration.y || 0;
        const az = e.acceleration.z || 0;
        dynamicAcc = Math.sqrt(ax * ax + ay * ay + az * az);
      } else if (e.accelerationIncludingGravity) {
        const ax = e.accelerationIncludingGravity.x || 0;
        const ay = e.accelerationIncludingGravity.y || 0;
        const az = e.accelerationIncludingGravity.z || 0;
        const mag = Math.sqrt(ax * ax + ay * ay + az * az);
        dynamicAcc = Math.abs(mag - 9.81);
      }

      acelerometroDisponibleRef.current = true;

      const now = Date.now();
      const deltaT = now - ultimoPasoTimeRef.current;

      // Umbral dinámico de zancada humana: 1.10 m/s² (sensible a marcha natural con el celular en mano)
      const UMBRAL_PASO = 1.10;
      if (dynamicAcc >= UMBRAL_PASO && ultimaAceleracionRef.current < UMBRAL_PASO) {
        // Mínimo 280ms entre zancadas para evitar falsos rebotes dentro del mismo impacto de pie
        if (deltaT >= 280) {
          contadorPasosRef.current += 1;
          setContadorPasos(contadorPasosRef.current);
          ultimoPasoTimeRef.current = now;

          caminandoPorInerciaRef.current = true;
          setCaminandoPorInercia(true);

          if (timerInactividadPasoRef.current) clearTimeout(timerInactividadPasoRef.current);
          timerInactividadPasoRef.current = setTimeout(() => {
            caminandoPorInerciaRef.current = false;
            setCaminandoPorInercia(false);
          }, 2200);
        }
      }

      ultimaAceleracionRef.current = dynamicAcc;
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", handleMotion, true);
    }

    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener("devicemotion", handleMotion, true);
      }
      if (timerInactividadPasoRef.current) clearTimeout(timerInactividadPasoRef.current);
    };
  }, []);

  // 2. Rastrear GPS Real con Geolocation API con filtro de marcha activa y zona muerta adaptada a Huawei Y9 Prime
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
        const nuevoHeading = heading !== null && heading !== undefined ? Math.round(heading) : (ultimoHeadingRef.current || 0);
        const distancia = calcularDistanciaMetros(latitude, longitude, CAMPUS_ORIGEN.lat, CAMPUS_ORIGEN.lng);
        setDistanciaAlCampus(distancia);

        // Descartar lecturas con señal excesivamente pobre (> 28 metros) típicas de interiores
        if (accuracy > 28) {
          setEstadoConexion(`⚠️ Señal satelital débil (±${Math.round(accuracy)}m)`);
          return;
        }

        const fueraDelCampus = distancia > RADIO_GEOFENCE_METROS;

        if (fueraDelCampus && !modoLibreCasa) {
          // El usuario NO está físicamente en UniEspinal y no ha activado el modo libre
          const km = (distancia / 1000).toFixed(1);
          setErrorGeofence(`Estás a ${km} km del campus. Puedes caminar en tu entorno activando el Modo Libre.`);
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
          return;
        }

        // Si está dentro del campus o activó modo libre en casa, limpiar alerta
        setErrorGeofence(null);

        let xCalculado, zCalculado, latVirtual, lngVirtual;

        if (modoLibreCasa) {
          // MODO LIBRE EN CASA: Mapear pasos reales del usuario en su casa al espacio 3D de UniEspinal desde la Portería
          if (!anclaGPSRef.current) {
            anclaGPSRef.current = { lat: latitude, lng: longitude };
            ultimoPuntoEstableRef.current = { x: -102.3, z: 237.6 };
          }

          const ancla = anclaGPSRef.current;
          const dLat = (latitude - ancla.lat) * (Math.PI / 180);
          const dLng = (longitude - ancla.lng) * (Math.PI / 180);
          const eastMetros = dLng * RADIO_TIERRA_METROS * Math.cos(ancla.lat * (Math.PI / 180));
          const northMetros = dLat * RADIO_TIERRA_METROS;

          // Mapeo afín al espacio 3D (Portería = x: -102.3, z: 237.6)
          const dXUnity = -0.217679 * eastMetros - 0.145650 * northMetros;
          const dZUnity = 0.897218 * eastMetros + 1.530297 * northMetros;

          xCalculado = Number((-102.3 + dXUnity).toFixed(2));
          zCalculado = Number((237.6 + dZUnity).toFixed(2));

          latVirtual = CAMPUS_ORIGEN.lat + (northMetros / RADIO_TIERRA_METROS) * (180 / Math.PI);
          lngVirtual = CAMPUS_ORIGEN.lng + (eastMetros / (RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN.lat * (Math.PI / 180)))) * (180 / Math.PI);
        } else {
          // MODO UNIESPINAL CAMPUS: Geometría afín directa
          if (!anclaGPSRef.current) {
            anclaGPSRef.current = { lat: latitude, lng: longitude };
          }

          const coordsU = calcularCoordenadasUnity(latitude, longitude);
          xCalculado = coordsU.x;
          zCalculado = coordsU.z;

          latVirtual = latitude;
          lngVirtual = longitude;
        }

        // 1. Fijación inicial de posición al enlazar satélites por primera vez
        if (!ultimoPuntoEstableRef.current) {
          ultimoPuntoEstableRef.current = { x: xCalculado, z: zCalculado, lat: latVirtual, lng: lngVirtual };
          despacharAUnity(latVirtual, lngVirtual, nuevoHeading, 0, accuracy, xCalculado, zCalculado);
          setCoords({
            lat: latVirtual,
            lng: lngVirtual,
            accuracy: Math.round(accuracy || 0),
            speed: 0,
            heading: nuevoHeading,
          });
          setEstadoConexion("📍 Posición inicial fijada. Da pasos para moverte...");
          return;
        }

        // 2. FUSIÓN SENSORIAL INERCIAL PURA (PODÓMETRO + GPS):
        // Sin filtros de distancia artificiales: el movimiento está gobernado puramente por los pasos físicos.
        const velMs = speed ? Math.max(0, speed) : 0;
        const estaCaminando = acelerometroDisponibleRef.current
          ? caminandoPorInerciaRef.current
          : (velMs >= 0.40);

        if (!estaCaminando) {
          // Reposo absoluto por podómetro: congelamiento total de la cámara 3D (cero derivas satelitales)
          setEstadoConexion(
            acelerometroDisponibleRef.current
              ? `🟡 En reposo (${contadorPasosRef.current} pasos - Cámara fija)`
              : "🟡 En reposo (Cámara fija)"
          );
          setCoords((prev) => ({
            ...prev,
            speed: 0,
            accuracy: Math.round(accuracy || 0),
            heading: nuevoHeading,
          }));
          return;
        }

        // 3. Pasos físicos confirmados: actualizar la cámara 3D fluidamente
        haIniciadoMovimientoRef.current = true;
        setEstadoConexion(
          modoLibreCasa
            ? `🟢 Caminando en Casa (👟 ${contadorPasosRef.current} pasos)`
            : `🟢 Caminando por el Campus (👟 ${contadorPasosRef.current} pasos)`
        );

        let xFinal = xCalculado;
        let zFinal = zCalculado;

        // Suavizado EMA ágil (20% previo / 80% nuevo) para respuesta instantánea a cada paso sin vibración
        if (ultimoPuntoEstableRef.current) {
          xFinal = Number((ultimoPuntoEstableRef.current.x * 0.20 + xCalculado * 0.80).toFixed(2));
          zFinal = Number((ultimoPuntoEstableRef.current.z * 0.20 + zCalculado * 0.80).toFixed(2));
        }

        ultimoPuntoEstableRef.current = { x: xFinal, z: zFinal, lat: latVirtual, lng: lngVirtual };

        setCoords({
          lat: latVirtual,
          lng: lngVirtual,
          accuracy: Math.round(accuracy || 0),
          speed: velMs > 0 ? Math.round(velMs * 3.6) : 0, // km/h
          heading: nuevoHeading,
        });

        despacharAUnity(latVirtual, lngVirtual, nuevoHeading, velMs, accuracy, xFinal, zFinal);
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
  }, [modoSimulador, modoLibreCasa, visible, despacharAUnity, calcularCoordenadasUnity, unityController]);

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
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btnActivarSimuladorAlerta"
                    onClick={() => {
                      setModoLibreCasa(true);
                      recalibrarPosicionActual();
                    }}
                    style={{
                      background: "#22c55e",
                      border: "none",
                      borderRadius: "6px",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    🌍 Caminar en mi entorno (GPS Libre)
                  </button>
                  <button
                    type="button"
                    className="btnActivarSimuladorAlerta"
                    onClick={() => setModoSimulador(true)}
                    style={{
                      background: "rgba(255, 255, 255, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.4)",
                      borderRadius: "6px",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    🚶 Recorrido Virtual
                  </button>
                </div>
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
                <small>Pasos (Inercia)</small>
                <b style={{ color: caminandoPorInercia ? "#22c55e" : "#60a5fa" }}>
                  👟 {contadorPasos}
                </b>
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

          {/* Controles de Modo: GPS Real vs Simulador vs GPS Libre */}
          <div className="controlesMinimapaFooter" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className={`btnModoRastreo ${!modoSimulador && !modoLibreCasa ? "activo" : ""}`}
              onClick={() => {
                setModoSimulador(false);
                setModoLibreCasa(false);
                recalibrarPosicionActual();
              }}
            >
              🏛️ Campus UniEspinal
            </button>
            <button
              type="button"
              className={`btnModoRastreo ${modoLibreCasa ? "activo" : ""}`}
              onClick={() => {
                setModoSimulador(false);
                setModoLibreCasa(true);
                recalibrarPosicionActual();
              }}
              title="Permite caminar en cualquier lugar (en casa o calle) mapeando tus pasos en 3D"
            >
              🌍 GPS Libre
            </button>
            <button
              type="button"
              className={`btnModoRastreo ${modoSimulador ? "activo" : ""}`}
              onClick={() => {
                setModoLibreCasa(false);
                setModoSimulador(true);
              }}
              title="Simula un recorrido a pie por el campus para probar en PC"
            >
              🚶 Simular
            </button>
            <button
              type="button"
              onClick={recalibrarPosicionActual}
              style={{
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.5)",
                color: "#60a5fa",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: "600",
                marginLeft: "auto",
              }}
              title="Recalibra el punto de inicio a donde estás parado ahora mismo"
            >
              🎯 Fijar Aquí
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MinimapaGPS;
