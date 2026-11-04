import React, { useEffect, useCallback, useRef, memo } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";
import "../../CSS/interfaz.css";
import { API_BASE_URL } from "../../config";

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

const Mapa = memo(function Mapa({
  isIcon,
  onCatalogoLoaded, // Recibe edificios y lugares juntos desde Unity
  onUnityReady,
  onCameraTelemetry, // Recibe la posición y rotación real de la cámara WebGL
  onUnityLoaded, // Notifica el tiempo exacto que tardó en cargar Unity WebGL
}) {
  const mountTimeRef = useRef(performance.now());
  const notifiedLoadRef = useRef(false);

  const {
    unityProvider,
    sendMessage,
    addEventListener,
    removeEventListener,
    isLoaded,
    loadingProgression,
    initialisationError,
  } = useUnityContext({
    loaderUrl: "/UniMapBuild/Build/UniMapBuild.loader.js",
    dataUrl: "/UniMapBuild/Build/UniMapBuild.data.unityweb",
    frameworkUrl: "/UniMapBuild/Build/UniMapBuild.framework.js.unityweb",
    codeUrl: "/UniMapBuild/Build/UniMapBuild.wasm.unityweb",
    companyName: "DefaultCompany",
    productName: "UniMapUniversal3D",
    productVersion: "0.2.0",
    webglContextAttributes: {
      preserveDrawingBuffer: false, // Optimización crítica de GPU: reduce consumo de VRAM y evita pérdida de contexto
      powerPreference: "default",
      antialias: false,
    },
    // Activa la caché persistente IndexedDB de Unity WebGL para arranques inmediatos en próximas visitas
    cacheControl: (url) => {
      if (url.match(/\.data/) || url.match(/\.wasm/)) {
        return "immutable";
      }
      return "must-revalidate";
    },
  });

  // Manejador del catálogo completo emitido por Unity
  const handleRecibirCatalogo = useCallback(
    (catalogoRaw) => {
      try {
        const data =
          typeof catalogoRaw === "string"
            ? JSON.parse(catalogoRaw)
            : catalogoRaw;
        console.log("Catálogo dinámico recibido desde Unity:", data);
        if (onCatalogoLoaded) {
          onCatalogoLoaded({
            edificios: data.edificiosPrincipales || [],
            lugares: data.lugares || [],
          });
        }
      } catch (err) {
        console.error("Error al procesar el catálogo de Unity:", err);
      }
    },
    [onCatalogoLoaded],
  );

  // Manejador de telemetría de cámara en tiempo real
  const handleTelemetriaCamara = useCallback(
    (telemetriaRaw) => {
      try {
        const data =
          typeof telemetriaRaw === "string"
            ? JSON.parse(telemetriaRaw)
            : telemetriaRaw;
        if (onCameraTelemetry) {
          onCameraTelemetry(data);
        }
      } catch (err) {
        // Ignorar silenciosamente
      }
    },
    [onCameraTelemetry]
  );

  useEffect(() => {
    // Escuchar catálogo y telemetría emitidos por Unity WebGL
    addEventListener("EnviarCatalogo", handleRecibirCatalogo);
    addEventListener("EnviarTelemetriaCamara", handleTelemetriaCamara);

    const handleCustomEvent = (e) => {
      handleTelemetriaCamara(e.detail);
    };
    window.addEventListener("UniMapTelemetriaCamara", handleCustomEvent);

    return () => {
      removeEventListener("EnviarCatalogo", handleRecibirCatalogo);
      removeEventListener("EnviarTelemetriaCamara", handleTelemetriaCamara);
      window.removeEventListener("UniMapTelemetriaCamara", handleCustomEvent);
    };
  }, [addEventListener, removeEventListener, handleRecibirCatalogo, handleTelemetriaCamara]);

  // Cuando Unity termina de cargar, compartimos las funciones de navegación 3D y GPS y registramos telemetría
  useEffect(() => {
    if (isLoaded) {
      if (!notifiedLoadRef.current) {
        notifiedLoadRef.current = true;
        const tiempoSegundos = Math.round(((performance.now() - mountTimeRef.current) / 1000) * 100) / 100;
        console.log(`⏱️ Unity WebGL cargado en: ${tiempoSegundos}s`);

        // Registrar telemetría de carga directamente al backend
        (async () => {
          try {
            let userObj = null;
            try {
              const u = localStorage.getItem("usuario");
              if (u) userObj = JSON.parse(u);
            } catch (e) {}

            let testerObj = null;
            try {
              const t = localStorage.getItem("tester_sesion");
              if (t) testerObj = JSON.parse(t);
            } catch (e) {}

            const nombre =
              userObj?.nombre_completo ||
              userObj?.nombre ||
              userObj?.username ||
              (testerObj ? `Tester (${testerObj.nombre || testerObj.username})` : "Usuario General");

            const idUsuario = userObj?.id_usuario
              ? String(userObj.id_usuario)
              : (testerObj?.id_tester ? `TEST-${testerObj.id_tester}` : null);

            const payload = {
              tiempo_carga_segundos: tiempoSegundos,
              id_usuario: idUsuario,
              nombre_usuario: nombre,
              tipo_conexion: detectarTipoConexion(),
              operador: null,
              modelo_dispositivo: detectarModeloDispositivo(),
            };

            await fetch(`${API_BASE_URL}/telemetria/carga-unity`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            console.log("⚡ Telemetría de carga registrada en backend:", payload);
          } catch (errTelemetria) {
            console.debug("Error al registrar telemetría de carga:", errTelemetria);
          }
        })();

        if (onUnityLoaded) {
          onUnityLoaded(tiempoSegundos);
        }
      }

      try {
        sendMessage("[Sistema_Guia_POIs]", "SolicitarCatalogo");
      } catch (err) {
        console.debug("Solicitando catálogo inicial:", err);
      }
    }

    if (isLoaded && onUnityReady) {
      onUnityReady({
        // Solicitar reenvío de catálogo si es necesario
        solicitarCatalogo: () => {
          try {
            sendMessage("[Sistema_Guia_POIs]", "SolicitarCatalogo");
          } catch (err) {
            console.error("Error al solicitar catálogo en Unity:", err);
          }
        },
        // Función directa para navegar usando el GameObject y Método REALES de Unity
        navegarA: (nombreDestino) => {
          try {
            sendMessage("[Sistema_Guia_POIs]", "IrALugar", nombreDestino);
          } catch (err) {
            console.error("Error al llamar IrALugar en Unity:", err);
          }
        },
        irALugar: (nombreDestino) => {
          try {
            sendMessage("[Sistema_Guia_POIs]", "IrALugar", nombreDestino);
          } catch (err) {
            console.error("Error al llamar IrALugar en Unity:", err);
          }
        },
        moverA: (nombreDestino) => {
          try {
            sendMessage("[Sistema_Guia_POIs]", "MoverA", nombreDestino);
          } catch (err) {
            console.error("Error al llamar MoverA en Unity:", err);
          }
        },
        // Función para enviar coordenadas y orientación GPS a Unity WebGL
        actualizarGPS: (datosGPS) => {
          try {
            const payload =
              typeof datosGPS === "string" ? datosGPS : JSON.stringify(datosGPS);
            console.log("📡 Enviando coordenadas GPS a WebGL [Sistema_Guia_POIs -> ActualizarGPS]:", payload);
            sendMessage("[Sistema_Guia_POIs]", "ActualizarGPS", payload);
          } catch (err) {
            console.debug("Unity WebGL pendiente de implementar método ActualizarGPS:", err);
          }
        },
        // Función para activar o desactivar el Modo GPS en Unity WebGL
        setModoGPS: (activo) => {
          try {
            const val = activo ? "1" : "0";
            console.log("📍 Sincronizando Modo GPS con WebGL [Sistema_Guia_POIs -> SetModoGPS]:", val);
            sendMessage("[Sistema_Guia_POIs]", "SetModoGPS", val);
          } catch (err) {
            console.debug("Unity WebGL pendiente de SetModoGPS:", err);
          }
        },
      });
    }
  }, [isLoaded, onUnityReady, sendMessage, onUnityLoaded]);

  const containerRef = useRef(null);

  // Porcentaje y mensajes de estado interactivos durante la descarga y arranque WebGL
  const porcentajeCarga = Math.round(loadingProgression * 100);
  const mensajeEstado = (() => {
    if (porcentajeCarga < 25) return "Descargando motor y escenas del campus...";
    if (porcentajeCarga < 60) return "Cargando modelos 3D y texturas arquitectónicas...";
    if (porcentajeCarga < 90) return "Compilando shaders y preparando WebGL...";
    return "Iniciando recorrido 3D UniMap...";
  })();

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
      onClick={() => {
        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas) canvas.focus();
      }}
    >
      {/* 1. Pantalla de carga interactiva mientras Unity se descarga y arranca */}
      {!isLoaded && !initialisationError && (
        <div className="overlayCargaWebGL">
          <div className="cardCargaWebGL">
            <div className="spinnerAnilloWebGL"></div>
            <h3 className="tituloCargaWebGL">Cargando Campus 3D ITFIP</h3>
            <p className="textoCargaWebGL">{mensajeEstado}</p>

            <div className="contenedorBarraProgresoWebGL">
              <div
                className="barraProgresoWebGL"
                style={{ width: `${Math.max(porcentajeCarga, 6)}%` }}
              ></div>
            </div>
            <span className="porcentajeTextoWebGL">{porcentajeCarga}%</span>

            <p className="notaCacheWebGL">
              Optimizando recursos en tu navegador para arranques inmediatos en próximas visitas.
            </p>
          </div>
        </div>
      )}

      {/* 2. Pantalla de error si el dispositivo o navegador no soporta el contexto WebGL */}
      {initialisationError && (
        <div className="overlayCargaWebGL">
          <div className="cardCargaWebGL">
            <h3 style={{ color: "#ef4444", marginBottom: "8px" }}>Error al iniciar WebGL</h3>
            <p className="textoCargaWebGL">
              {initialisationError.message || "Tu navegador o dispositivo no pudo inicializar el contexto gráfico 3D."}
            </p>
            <button
              type="button"
              className="btnReintentarWebGL"
              onClick={() => window.location.reload()}
            >
              Reintentar Carga
            </button>
          </div>
        </div>
      )}

      {/* 3. Canvas 3D de Unity */}
      <Unity
        unityProvider={unityProvider}
        tabIndex={1}
        style={{
          width: "100%",
          height: "100%",
          display: isLoaded ? "block" : "none",
          outline: "none",
          touchAction: "none",
        }}
      />
    </div>
  );
});

export default Mapa;
