import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas base del Campus ITFIP en El Espinal, Tolima (Entrada Principal)
const CAMPUS_ORIGEN_ITFIP = {
  lat: 4.156380,
  lng: -74.897480,
};

// Puntos de inicio configurables en la maqueta 3D del campus con coordenadas reales de Unity
const PUNTOS_CAMPUS = [
  { id: "porteria", nombre: "🚪 Portería Principal (Entrada)", x: -102.3, z: 237.6, lat: 4.15638, lng: -74.89748 },
  { id: "bloqueA", nombre: "🏢 Bloque A-B-C", x: -44.6, z: 292.6, lat: 4.15672, lng: -74.89712 },
  { id: "bloqueD", nombre: "🏢 Bloque D", x: -125.0, z: 367.2, lat: 4.15690, lng: -74.89695 },
  { id: "bloqueE", nombre: "🏫 Bloque E", x: -124.0, z: 450.6, lat: 4.15705, lng: -74.89675 },
  { id: "coliseo", nombre: "🏟️ Coliseo y Canchas", x: -119.6, z: 270.9, lat: 4.15625, lng: -74.89680 },
  { id: "gym", nombre: "💪 Gimnasio (GYM)", x: -97.0, z: 252.2, lat: 4.15610, lng: -74.89715 },
  { id: "cafeteria", nombre: "☕ Cafetería Universitaria", x: -66.5, z: 296.9, lat: 4.15665, lng: -74.89660 },
  { id: "plazoleta", nombre: "🏛️ Plazoleta Central", x: -80.0, z: 270.0, lat: 4.15655, lng: -74.89730 },
];

const RADIO_TIERRA_METROS = 6371000;

// Ruta de simulación calibrada dentro del perímetro del Campus ITFIP
const RUTA_SIMULADA_ITFIP = [
  { lugar: "Entrada Principal ITFIP", lat: 4.15638, lng: -74.89748, heading: 45 },
  { lugar: "Gimnasio Universitario (GYM)", lat: 4.15610, lng: -74.89715, heading: 90 },
  { lugar: "Coliseo y Canchas", lat: 4.15625, lng: -74.89680, heading: 120 },
  { lugar: "Paso Frente a Bloque A-B-C", lat: 4.15672, lng: -74.89712, heading: 60 },
  { lugar: "Entrada Bloque D", lat: 4.15690, lng: -74.89695, heading: 85 },
  { lugar: "Pasillo hacia Bloque E", lat: 4.15705, lng: -74.89675, heading: 75 },
  { lugar: "Cafetería Universitaria", lat: 4.15665, lng: -74.89660, heading: 180 },
  { lugar: "Plazoleta Central", lat: 4.15655, lng: -74.89730, heading: 240 },
];

function MinimapaGPSTest({ visible, onClose, unityController }) {
  // Modos de operación para pruebas:
  // 'fijo_uniespinal' | 'gps_libre' | 'simulador'
  const [modoTester, setModoTester] = useState("gps_libre");

  // Punto de inicio seleccionado en el campus 3D (por defecto Portería Principal)
  const [puntoInicio, setPuntoInicio] = useState(PUNTOS_CAMPUS[0]);

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
  const [umbralRuidoMetros, setUmbralRuidoMetros] = useState(3.2); // 3.2m: Zona muerta antiruido satelital para L1 (Huawei Y9 Prime)
  const [factorZancada, setFactorZancada] = useState(1.25); // 1.25x: Calibración peatonal para que 5 pasos reales = 4 a 5 en 3D
  const [enMovimiento, setEnMovimiento] = useState(false);

  const anclaGPSRef = useRef(null);
  const filtroAntiRuidoRef = useRef(true);
  filtroAntiRuidoRef.current = filtroAntiRuido;
  const umbralRuidoRef = useRef(3.2);
  umbralRuidoRef.current = umbralRuidoMetros;
  const factorZancadaRef = useRef(1.25);
  factorZancadaRef.current = factorZancada;

  const ultimoHeadingRef = useRef(0);
  const ultimaPosDespachadaRef = useRef(null);
  const haIniciadoMovimientoRef = useRef(false);

  // Podómetro por Acelerómetro (Detección inercial de pasos físicos)
  const [contadorPasos, setContadorPasos] = useState(0);
  const [caminandoPorInercia, setCaminandoPorInercia] = useState(false);

  const contadorPasosRef = useRef(0);
  const caminandoPorInerciaRef = useRef(false);
  const acelerometroDisponibleRef = useRef(false);
  const ultimoPasoTimeRef = useRef(0);
  const ultimaAceleracionRef = useRef(0);
  const timerInactividadPasoRef = useRef(null);

  const [indiceSimulacion, setIndiceSimulacion] = useState(0);
  const [estadoConexion, setEstadoConexion] = useState("GPS Libre Activo");
  const [minimizado, setMinimizado] = useState(false);
  const [brujulaHeading, setBrujulaHeading] = useState(0);

  const simulacionRef = useRef(null);

  // Convertir coordenadas geográficas de UniEspinal a cartesianas calibradas en Unity (X, Z)
  const calcularCoordenadasUnity = useCallback((lat, lng) => {
    const dLat = (lat - CAMPUS_ORIGEN_ITFIP.lat) * (Math.PI / 180);
    const dLng = (lng - CAMPUS_ORIGEN_ITFIP.lng) * (Math.PI / 180);

    const east = dLng * RADIO_TIERRA_METROS * Math.cos(CAMPUS_ORIGEN_ITFIP.lat * (Math.PI / 180));
    const north = dLat * RADIO_TIERRA_METROS;

    // Transformación afín calibrada con los edificios 3D reales de UniEspinal (ITFIP)
    const x = -0.217679 * east - 0.145650 * north - 100.09;
    const z = 0.897218 * east + 1.530297 * north + 243.98;

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
        setEstadoConexion("Sincronizado con WebGL (3D)");
      } else {
        setEstadoConexion("GPS Activo (Esperando WebGL)");
      }
    },
    [calcularCoordenadasUnity, unityController]
  );

  // 1. Giro en tiempo real: sensor de brújula (solo actualiza el rumbo para minimapa 2D, NO mueve la cámara 3D)
  useEffect(() => {
    const handleOrientation = (e) => {
      const heading = e.webkitCompassHeading !== undefined
        ? e.webkitCompassHeading
        : (e.alpha !== null ? (360 - e.alpha) % 360 : null);

      if (heading !== null && heading !== undefined) {
        const h = Math.round(heading);

        // Diferencia angular circular teniendo en cuenta el salto de 0° / 360°
        const diffHeading = Math.abs((h - (ultimoHeadingRef.current || 0) + 540) % 360 - 180);
        if (diffHeading >= 3.0) {
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

  // 1.1 Podómetro Inercial: Escuchar acelerómetro para detección de pasos físicos reales (DeviceMotionEvent)
  useEffect(() => {
    const handleMotion = (e) => {
      const acc = e.acceleration || e.accelerationIncludingGravity;
      if (!acc) return;

      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);

      const dynamicAcc = (e.acceleration && e.acceleration.x !== null)
        ? mag
        : Math.abs(mag - 9.81);

      acelerometroDisponibleRef.current = true;

      const now = Date.now();
      const deltaT = now - ultimoPasoTimeRef.current;

      // Umbral dinámico de zancada peatonal humana (1.30 m/s²)
      if (dynamicAcc >= 1.30 && ultimaAceleracionRef.current < 1.30) {
        if (deltaT >= 300 && deltaT <= 1500) {
          contadorPasosRef.current += 1;
          setContadorPasos(contadorPasosRef.current);
          ultimoPasoTimeRef.current = now;

          caminandoPorInerciaRef.current = true;
          setCaminandoPorInercia(true);

          if (timerInactividadPasoRef.current) clearTimeout(timerInactividadPasoRef.current);
          timerInactividadPasoRef.current = setTimeout(() => {
            caminandoPorInerciaRef.current = false;
            setCaminandoPorInercia(false);
          }, 1500);
        } else if (deltaT > 1500) {
          ultimoPasoTimeRef.current = now;
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

  // 2. Control del Modo 1: Fijo en UniEspinal
  useEffect(() => {
    if (modoTester !== "fijo_uniespinal" || !visible) return;

    setCoords({
      lat: puntoInicio.lat,
      lng: puntoInicio.lng,
      accuracy: 1,
      speed: 0,
      heading: ultimoHeadingRef.current || 0,
    });
    setEstadoConexion(`📍 Fijo en ${puntoInicio.nombre}`);
    despacharAUnity(puntoInicio.lat, puntoInicio.lng, ultimoHeadingRef.current || 0, 0, 1, puntoInicio.x, puntoInicio.z);
  }, [modoTester, puntoInicio, visible, despacharAUnity]);

  // 3. Control de Rastrear GPS Real: GPS Libre (Móvil = 0,0) o GPS UniEspinal (Pivote 4.156310, -74.897399)
  useEffect(() => {
    if ((modoTester !== "gps_libre" && modoTester !== "gps_uniespinal") || !visible) return;

    if (!("geolocation" in navigator)) {
      setEstadoConexion("⚠️ Geolocalización no disponible");
      return;
    }

    setEstadoConexion(
      modoTester === "gps_libre"
        ? "📡 GPS Libre: Rastreando desplazamiento desde tu posición..."
        : "📍 GPS UniEspinal: Sincronizando con maqueta 3D real del Campus..."
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;
        const nuevoHeading = heading !== null && heading !== undefined ? Math.round(heading) : (ultimoHeadingRef.current || 0);

        // Descartar lecturas de precisión excesivamente baja (> 28m)
        if (accuracy > 28) {
          setEstadoConexion(`⚠️ Señal satelital débil (±${Math.round(accuracy)}m)`);
          return;
        }

        setCoordsDispositivo({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy || 0),
          speed: speed ? Math.round(speed * 3.6) : 0,
          heading: nuevoHeading,
        });

        let xCalculado, zCalculado, latVirtual, lngVirtual, dx, dz, distTotal;

        if (modoTester === "gps_libre") {
          // Si no hay ancla previa, fijar la posición actual física del celular como punto cero del tester
          let anclaActual = anclaGPSRef.current;
          if (!anclaActual) {
            anclaActual = { lat: latitude, lng: longitude };
            anclaGPSRef.current = anclaActual;
            ultimaPosDespachadaRef.current = { x: puntoInicio.x, z: puntoInicio.z };
          }

          // Desplazamiento relativo en metros respecto al ancla del celular
          const dLat = (latitude - anclaActual.lat) * (Math.PI / 180);
          const dLng = (longitude - anclaActual.lng) * (Math.PI / 180);
          const factorAvance = factorZancadaRef.current || 1.25;
          const eastMetros = dLng * RADIO_TIERRA_METROS * Math.cos(anclaActual.lat * (Math.PI / 180));
          const northMetros = dLat * RADIO_TIERRA_METROS;

          // Mapeo afín al espacio 3D de Unity para que la marcha real coincida con la orientación del campus
          const dXUnity = (-0.217679 * eastMetros - 0.145650 * northMetros) * factorAvance;
          const dZUnity = (0.897218 * eastMetros + 1.530297 * northMetros) * factorAvance;
          distTotal = Math.sqrt(eastMetros * eastMetros + northMetros * northMetros);

          xCalculado = Number((puntoInicio.x + dXUnity).toFixed(2));
          zCalculado = Number((puntoInicio.z + dZUnity).toFixed(2));
          dx = Number(dXUnity.toFixed(1));
          dz = Number(dZUnity.toFixed(1));

          // Coordenada geográfica virtual sobre UniEspinal para Google Maps
          latVirtual = puntoInicio.lat + (northMetros / RADIO_TIERRA_METROS) * (180 / Math.PI);
          lngVirtual = puntoInicio.lng + (eastMetros / (RADIO_TIERRA_METROS * Math.cos(puntoInicio.lat * (Math.PI / 180)))) * (180 / Math.PI);
        } else {
          // MODO GPS UNIESPINAL: Transformación afín exacta entre GPS WGS84 y Unity 3D
          const coordsU = calcularCoordenadasUnity(latitude, longitude);
          xCalculado = coordsU.x;
          zCalculado = coordsU.z;

          dx = Number((xCalculado - PUNTOS_CAMPUS[0].x).toFixed(1));
          dz = Number((zCalculado - PUNTOS_CAMPUS[0].z).toFixed(1));
          distTotal = Number(Math.sqrt(dx * dx + dz * dz).toFixed(1));

          latVirtual = latitude;
          lngVirtual = longitude;
        }

        // FUSIÓN SENSORIAL INERCIAL (ACELERÓMETRO + GPS):
        // Si hay acelerómetro disponible (celular), solo permitimos mover la cámara
        // si el podómetro confirma zancadas físicas (caminandoPorInerciaRef.current).
        const velMs = speed ? Math.max(0, speed) : 0;
        let debeMover = false;

        const marchaConfirmada = acelerometroDisponibleRef.current
          ? caminandoPorInerciaRef.current
          : (velMs >= 0.45 && distTotal >= 3.0);

        if (filtroAntiRuidoRef.current && !marchaConfirmada && velMs < 0.75) {
          // Reposo absoluto por acelerómetro inercial: bloqueo total de cámara 3D
          debeMover = false;
          setEnMovimiento(false);
          setEstadoConexion(
            acelerometroDisponibleRef.current
              ? `🟡 En reposo (${contadorPasosRef.current} pasos - Cámara fija)`
              : "🟡 Celular en reposo (Cámara fija)"
          );
        } else {
          debeMover = true;
          setEnMovimiento(true);
          haIniciadoMovimientoRef.current = true;
          setEstadoConexion(
            modoTester === "gps_libre"
              ? `🟢 Caminando en GPS Libre (👟 ${contadorPasosRef.current} pasos)`
              : `🟢 Caminando en Campus (👟 ${contadorPasosRef.current} pasos)`
          );

          if (ultimaPosDespachadaRef.current) {
            xCalculado = Number((ultimaPosDespachadaRef.current.x * 0.35 + xCalculado * 0.65).toFixed(2));
            zCalculado = Number((ultimaPosDespachadaRef.current.z * 0.35 + zCalculado * 0.65).toFixed(2));
          }
        }

        if (debeMover) {
          ultimaPosDespachadaRef.current = { x: xCalculado, z: zCalculado };

          setDeltaMetros({
            dx: Number(dx.toFixed(1)),
            dz: Number(dz.toFixed(1)),
            total: Number(distTotal.toFixed(1)),
          });

          setCoords({
            lat: latVirtual,
            lng: lngVirtual,
            accuracy: Math.round(accuracy || 0),
            speed: velMs > 0 ? Math.round(velMs * 3.6) : 0,
            heading: nuevoHeading,
          });

          // Despachar a Unity
          despacharAUnity(latVirtual, lngVirtual, nuevoHeading, velMs, accuracy, xCalculado, zCalculado);

          // Emitir evento global para el Grabador y Comparador de Rutas
          if (typeof window.dispatchEvent === "function") {
            window.dispatchEvent(
              new CustomEvent("UniMapGPSUpdate", {
                detail: {
                  x: Number(xCalculado.toFixed(2)),
                  z: Number(zCalculado.toFixed(2)),
                  lat: latVirtual,
                  lng: lngVirtual,
                  heading: nuevoHeading,
                  speed: velMs > 0 ? Math.round(velMs * 3.6) : 0,
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
        maximumAge: 0,
        timeout: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [modoTester, visible, puntoInicio, despacharAUnity, calcularCoordenadasUnity]);

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
    haIniciadoMovimientoRef.current = false;
    contadorPasosRef.current = 0;
    setContadorPasos(0);
    caminandoPorInerciaRef.current = false;
    setCaminandoPorInercia(false);
    if (coordsDispositivo) {
      if (modoTester === "gps_libre") {
        const nuevaAncla = { lat: coordsDispositivo.lat, lng: coordsDispositivo.lng };
        anclaGPSRef.current = nuevaAncla;
        ultimaPosDespachadaRef.current = { x: puntoInicio.x, z: puntoInicio.z };
        setDeltaMetros({ dx: 0, dz: 0, total: 0 });
        setEstadoConexion("📍 Ancla fijada. Da pasos para comenzar...");
      } else if (modoTester === "gps_uniespinal") {
        const c = calcularCoordenadasUnity(coordsDispositivo.lat, coordsDispositivo.lng);
        anclaGPSRef.current = { lat: coordsDispositivo.lat, lng: coordsDispositivo.lng };
        ultimaPosDespachadaRef.current = { x: c.x, z: c.z };
        setEstadoConexion("📍 Ancla fijada en Campus. Da pasos para comenzar...");
      }
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
    : modoTester === "fijo_uniespinal"
    ? { x: puntoInicio.x, z: puntoInicio.z }
    : (ultimaPosDespachadaRef.current || calcularCoordenadasUnity(coords.lat, coords.lng));

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
                haIniciadoMovimientoRef.current = false;
                if (coordsDispositivo) {
                  anclaGPSRef.current = { lat: coordsDispositivo.lat, lng: coordsDispositivo.lng };
                }
                if (unityController && typeof unityController.setModoGPS === "function") {
                  unityController.setModoGPS(true);
                }
              }}
              title="El 0,0 es tu celular. Camina en cualquier lugar del mundo y muévete por el campus 3D"
            >
              🌍 GPS Libre (Móvil 0,0)
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "gps_uniespinal" ? "activo" : ""}`}
              onClick={() => {
                setModoTester("gps_uniespinal");
                haIniciadoMovimientoRef.current = false;
                if (unityController && typeof unityController.setModoGPS === "function") {
                  unityController.setModoGPS(true);
                }
              }}
              title="El 0,0 es estrictamente el pivote del campus (4.156310, -74.897399). Si estás en la Biblioteca o cualquier edificio de UniEspinal, la cámara te sitúa allí."
            >
              📍 GPS UniEspinal (Campus)
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "fijo_uniespinal" ? "activo" : ""}`}
              onClick={() => setModoTester("fijo_uniespinal")}
              title="Fija la cámara en un edificio seleccionado con giro por brújula"
            >
              📌 Punto Fijo
            </button>
            <button
              type="button"
              className={`btnTabTester ${modoTester === "simulador" ? "activo" : ""}`}
              onClick={() => setModoTester("simulador")}
              title="Simula un recorrido automático a pie por el campus"
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
                haIniciadoMovimientoRef.current = false;
                ultimaPosDespachadaRef.current = null;
                setDeltaMetros({ dx: 0, dz: 0, total: 0 });

                if (modoTester === "fijo_uniespinal") {
                  if (unityController && typeof unityController.setModoGPS === "function") {
                    unityController.setModoGPS(true);
                  }
                  despacharAUnity(punto.lat, punto.lng, brujulaHeading, 0, 1, punto.x, punto.z);
                }
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
                  <strong>🚶 GPS Libre (Móvil = 0,0):</strong>
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
                  Origen (0, 0) fijado en tu celular. Al caminar y girar en tu entorno, la cámara se mueve a escala 1:1 en el campus 3D a 1m de altura.
                  {deltaMetros.total > 0 && ` Recorrido: ${deltaMetros.total}m.`}
                </p>
              </div>

              {/* Control del Estabilizador Anti-Ruido y Factor de Zancada */}
              <div className="filaFiltroAntiRuido" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0", fontSize: "11px", color: "#94a3b8" }}>
                <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={filtroAntiRuido}
                    onChange={(e) => setFiltroAntiRuido(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>🛡️ Filtro Reposo</span>
                </label>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <select
                    value={umbralRuidoMetros}
                    onChange={(e) => setUmbralRuidoMetros(Number(e.target.value))}
                    style={{
                      background: "#0f172a",
                      color: "#38bdf8",
                      border: "1px solid #334155",
                      borderRadius: "4px",
                      padding: "2px 4px",
                      fontSize: "10.5px",
                    }}
                    title="Umbral de reposo: menor valor = detecta pasos al instante"
                  >
                    <option value={0.5}>0.5m (Ultra Rápido)</option>
                    <option value={0.8}>0.8m (Recomendado)</option>
                    <option value={1.2}>1.2m (Equilibrado)</option>
                    <option value={1.8}>1.8m (Filtro Alto)</option>
                  </select>
                  <select
                    value={factorZancada}
                    onChange={(e) => setFactorZancada(Number(e.target.value))}
                    style={{
                      background: "#0f172a",
                      color: "#10b981",
                      border: "1px solid #334155",
                      borderRadius: "4px",
                      padding: "2px 4px",
                      fontSize: "10.5px",
                    }}
                    title="Multiplicador de zancada: 5 pasos reales = 4-5 en maqueta 3D"
                  >
                    <option value={1.0}>1.0x (Estricto)</option>
                    <option value={1.25}>1.25x (Rápido 5:4)</option>
                    <option value={1.4}>1.4x (Zancada ágil)</option>
                  </select>
                </div>
              </div>

              <div className="accionesGpsLibre">
                <button
                  type="button"
                  className="btnRecalibrarTester"
                  onClick={recalibrarPosicionActual}
                  title="Fija tu posición actual como el centro (0, 0) de partida"
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

          {/* Banner y Acciones del modo GPS UniEspinal Real */}
          {modoTester === "gps_uniespinal" && (
            <div className="bannerGpsLibreInfo" style={{ background: "linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(15, 23, 42, 0.95))", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              <div className="infoGpsLibreTexto">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong style={{ color: "#34d399" }}>📍 GPS UniEspinal (Campus ITFIP Real):</strong>
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
                  Campus ITFIP (4.15638, -74.89748). Calibrado matemáticamente con los edificios reales: Bloque D, Bloque E, Coliseo, Portería.
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
                    color: "#34d399",
                    border: "1px solid #065f46",
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
                  style={{ background: "rgba(16, 185, 129, 0.2)", borderColor: "#10b981", color: "#34d399" }}
                  onClick={recalibrarPosicionActual}
                  title="Sincronizar cámara con la posición satelital actual"
                >
                  🎯 Sincronizar GPS
                </button>
                <button
                  type="button"
                  className="btnToggleVistaMapa"
                  onClick={() => setMostrarMapa2D((prev) => !prev)}
                  title="Muestra u oculta el mapa 2D"
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
                <span>Avance desde Celular (0, 0):</span>
                <span>ΔX: {deltaMetros.dx}m | ΔZ: {deltaMetros.dz}m (Total: {deltaMetros.total}m)</span>
              </div>
            )}
            {modoTester === "gps_uniespinal" && (
              <div className="filaTelemetria" style={{ fontSize: "11px", color: "#34d399" }}>
                <span>Distancia desde Entrada Principal:</span>
                <span>ΔX: {deltaMetros.dx}m | ΔZ: {deltaMetros.dz}m (Total: {deltaMetros.total}m)</span>
              </div>
            )}

            <div className="gridTelemetriaDatos">
              <div className="itemMiniDato">
                <small>Rumbo Brújula</small>
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
        </div>
      )}
    </div>
  );
}

export default MinimapaGPSTest;
