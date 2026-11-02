import React, { useEffect, useCallback, useRef, memo } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";
import "../../CSS/interfaz.css";

const Mapa = memo(function Mapa({
  isIcon,
  onCatalogoLoaded, // Recibe edificios y lugares juntos desde Unity
  onUnityReady,
}) {
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
    productVersion: "0.1.0",
    webglContextAttributes: {
      preserveDrawingBuffer: false, // Optimización crítica de GPU: reduce consumo de VRAM y evita pérdida de contexto
      powerPreference: "default",
      antialias: false,
    },
    // Activa la caché persistente IndexedDB de Unity WebGL para arranques inmediatos en próximas visitas
    cacheControl: (url) => "must-revalidate",
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

  useEffect(() => {
    // Escuchar el catálogo que emite Unity al iniciar
    addEventListener("EnviarCatalogo", handleRecibirCatalogo);

    return () => {
      removeEventListener("EnviarCatalogo", handleRecibirCatalogo);
    };
  }, [addEventListener, removeEventListener, handleRecibirCatalogo]);

  // Cuando Unity termina de cargar, compartimos las funciones de navegación 3D y GPS
  useEffect(() => {
    if (isLoaded) {
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
  }, [isLoaded, onUnityReady, sendMessage]);

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
