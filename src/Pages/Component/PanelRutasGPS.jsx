import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas de los Edificios Principales y Zonas del Campus ITFIP en Unity (X, Z)
const EDIFICIOS_CAMPUS = [
  { id: "porteria", nombre: "Portería Principal", x: -99.6, z: 363.6, ancho: 18, alto: 12, color: "#38bdf8", tipo: "rect" },
  { id: "bloque_abc", nombre: "Bloque A-B-C", x: -110.0, z: 360.0, ancho: 32, alto: 22, color: "#818cf8", tipo: "rect" },
  { id: "plazoleta", nombre: "Plazoleta Central", x: -120.0, z: 380.0, radio: 14, color: "#fbbf24", tipo: "circ" },
  { id: "bloque_d", nombre: "Bloque D (Salones)", x: -146.5, z: 372.3, ancho: 30, alto: 24, color: "#34d399", tipo: "rect" },
  { id: "cafeteria", nombre: "Cafetería Nueva", x: -121.1, z: 328.9, ancho: 22, alto: 18, color: "#f472b6", tipo: "rect" },
  { id: "bloque_e", nombre: "Bloque E (Ingeniería)", x: -140.0, z: 430.0, ancho: 36, alto: 26, color: "#a78bfa", tipo: "rect" },
  { id: "coliseo", nombre: "Coliseo ITFIP", x: -195.0, z: 335.0, ancho: 34, alto: 30, color: "#fb923c", tipo: "rect" },
  { id: "gym", nombre: "Gimnasio", x: -210.0, z: 320.0, ancho: 20, alto: 18, color: "#f87171", tipo: "rect" },
  { id: "canchas", nombre: "Canchas Deportivas", x: -185.0, z: 295.0, ancho: 38, alto: 26, color: "#4ade80", tipo: "rect" },
];

// Límites de la superficie / mesh del campus en Unity
const CAMPUS_BOUNDS = {
  minX: -240,
  maxX: -60,
  minZ: 270,
  maxZ: 460,
};

function PanelRutasGPS({ visible, onClose, telemetriaCamara }) {
  const canvasRef = useRef(null);

  // Estados de grabación y rutas en vivo
  const [grabando, setGrabando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0);

  // Puntos recolectados en la sesión actual
  const [rutaGPS, setRutaGPS] = useState([]);
  const [rutaCamara, setRutaCamara] = useState([]);

  // Telemetría instantánea
  const [posGPSActual, setPosGPSActual] = useState(null);
  const [posCamActual, setPosCamActual] = useState(null);

  // Historial de rutas guardadas
  const [rutasGuardadas, setRutasGuardadas] = useState(() => {
    try {
      const data = localStorage.getItem("unimap_rutas_guardadas");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  });

  const [rutaSeleccionadaId, setRutaSeleccionadaId] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState("mapa"); // 'mapa' o 'historial'

  // Refs para capturar en listeners sin recrear funciones
  const grabandoRef = useRef(false);
  grabandoRef.current = grabando;
  const pausadoRef = useRef(false);
  pausadoRef.current = pausado;

  // 1. Escuchar actualizaciones de GPS desde MinimapaGPSTest
  useEffect(() => {
    const handleGPSUpdate = (e) => {
      const p = e.detail;
      if (!p) return;

      setPosGPSActual(p);

      if (grabandoRef.current && !pausadoRef.current) {
        setRutaGPS((prev) => [
          ...prev,
          {
            x: p.x,
            z: p.z,
            heading: p.heading || 0,
            speed: p.speed || 0,
            time: Date.now(),
          },
        ]);
      }
    };

    window.addEventListener("UniMapGPSUpdate", handleGPSUpdate);
    return () => window.removeEventListener("UniMapGPSUpdate", handleGPSUpdate);
  }, []);

  // 2. Escuchar telemetría de la cámara 3D desde Unity WebGL
  useEffect(() => {
    if (!telemetriaCamara) return;

    setPosCamActual(telemetriaCamara);

    if (grabandoRef.current && !pausadoRef.current) {
      setRutaCamara((prev) => [
        ...prev,
        {
          x: telemetriaCamara.x,
          z: telemetriaCamara.z,
          rot: telemetriaCamara.rot || 0,
          time: Date.now(),
        },
      ]);
    }
  }, [telemetriaCamara]);

  // 3. Temporizador de grabación
  useEffect(() => {
    let timer = null;
    if (grabando && !pausado) {
      timer = setInterval(() => {
        setTiempoTranscurrido((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [grabando, pausado]);

  // 4. Conversor de coordenadas Unity (X, Z) a píxeles del Canvas 2D
  const aPixeles = useCallback((x, z, width, height) => {
    const { minX, maxX, minZ, maxZ } = CAMPUS_BOUNDS;
    const padding = 25;
    const wEfectivo = width - padding * 2;
    const hEfectivo = height - padding * 2;

    const px = padding + ((x - minX) / (maxX - minX)) * wEfectivo;
    // En Unity Z apunta al Norte (+Z hacia arriba). En canvas Y crece hacia abajo.
    const py = padding + (1 - (z - minZ) / (maxZ - minZ)) * hEfectivo;

    return { px, py };
  }, []);

  // 5. Renderizado del Canvas 2D (Superficie del campus, edificios y rutas)
  const dibujarMapa = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // A. Fondo de la superficie del campus (suelo y gradiente)
    ctx.clearRect(0, 0, width, height);

    const gradFondo = ctx.createLinearGradient(0, 0, 0, height);
    gradFondo.addColorStop(0, "#0b1324");
    gradFondo.addColorStop(1, "#070c18");
    ctx.fillStyle = gradFondo;
    ctx.fillRect(0, 0, width, height);

    // B. Rejilla topográfica de calibración (cada 20 metros)
    ctx.strokeStyle = "rgba(56, 189, 248, 0.08)";
    ctx.lineWidth = 1;
    for (let x = CAMPUS_BOUNDS.minX; x <= CAMPUS_BOUNDS.maxX; x += 20) {
      const p1 = aPixeles(x, CAMPUS_BOUNDS.minZ, width, height);
      const p2 = aPixeles(x, CAMPUS_BOUNDS.maxZ, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
    for (let z = CAMPUS_BOUNDS.minZ; z <= CAMPUS_BOUNDS.maxZ; z += 20) {
      const p1 = aPixeles(CAMPUS_BOUNDS.minX, z, width, height);
      const p2 = aPixeles(CAMPUS_BOUNDS.maxX, z, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    // C. Dibujar siluetas de los Edificios Principales
    EDIFICIOS_CAMPUS.forEach((ed) => {
      const centro = aPixeles(ed.x, ed.z, width, height);

      if (ed.tipo === "circ") {
        ctx.beginPath();
        const rPix = (ed.radio / (CAMPUS_BOUNDS.maxX - CAMPUS_BOUNDS.minX)) * (width - 50);
        ctx.arc(centro.px, centro.py, rPix, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
        ctx.fill();
        ctx.strokeStyle = ed.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const wPix = (ed.ancho / (CAMPUS_BOUNDS.maxX - CAMPUS_BOUNDS.minX)) * (width - 50);
        const hPix = (ed.alto / (CAMPUS_BOUNDS.maxZ - CAMPUS_BOUNDS.minZ)) * (height - 50);

        ctx.fillStyle = `${ed.color}22`;
        ctx.fillRect(centro.px - wPix / 2, centro.py - hPix / 2, wPix, hPix);
        ctx.strokeStyle = ed.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(centro.px - wPix / 2, centro.py - hPix / 2, wPix, hPix);
      }

      // Etiqueta del edificio
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ed.nombre, centro.px, centro.py);
    });

    // D. Dibujar Ruta del GPS (Cian / Azul)
    if (rutaGPS.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 2]);

      rutaGPS.forEach((p, i) => {
        const pos = aPixeles(p.x, p.z, width, height);
        if (i === 0) ctx.moveTo(pos.px, pos.py);
        else ctx.lineTo(pos.px, pos.py);
      });
      ctx.stroke();
      ctx.setLineDash([]); // Restaurar línea sólida

      // Puntos de muestreo GPS
      rutaGPS.forEach((p) => {
        const pos = aPixeles(p.x, p.z, width, height);
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#06b6d4";
        ctx.fill();
      });
    }

    // E. Dibujar Ruta de la Cámara 3D (Naranja / Fucsia)
    if (rutaCamara.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 3;

      rutaCamara.forEach((p, i) => {
        const pos = aPixeles(p.x, p.z, width, height);
        if (i === 0) ctx.moveTo(pos.px, pos.py);
        else ctx.lineTo(pos.px, pos.py);
      });
      ctx.stroke();

      // Puntos de muestreo de Cámara
      rutaCamara.forEach((p) => {
        const pos = aPixeles(p.x, p.z, width, height);
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
      });
    }

    // F. Marcador actual de posición GPS (Círculo azul brillante)
    if (posGPSActual) {
      const pos = aPixeles(posGPSActual.x, posGPSActual.z, width, height);
      ctx.beginPath();
      ctx.arc(pos.px, pos.py, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#06b6d4";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flecha de orientación del GPS
      if (posGPSActual.heading !== undefined) {
        const rad = (posGPSActual.heading * Math.PI) / 180;
        const flechaX = pos.px + Math.sin(rad) * 14;
        const flechaY = pos.py - Math.cos(rad) * 14;
        ctx.beginPath();
        ctx.moveTo(pos.px, pos.py);
        ctx.lineTo(flechaX, flechaY);
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // G. Marcador actual de posición de la Cámara 3D (Triángulo naranja con cono de visión)
    if (posCamActual) {
      const pos = aPixeles(posCamActual.x, posCamActual.z, width, height);

      // Cono de visión 3D
      const rotRad = ((posCamActual.rot || 0) * Math.PI) / 180;
      const fovRad = (30 * Math.PI) / 180;
      const largoCono = 22;

      ctx.beginPath();
      ctx.moveTo(pos.px, pos.py);
      ctx.arc(pos.px, pos.py, largoCono, rotRad - Math.PI / 2 - fovRad, rotRad - Math.PI / 2 + fovRad);
      ctx.closePath();
      ctx.fillStyle = "rgba(249, 115, 22, 0.25)";
      ctx.fill();

      // Punto central de la cámara
      ctx.beginPath();
      ctx.arc(pos.px, pos.py, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ea580c";
      ctx.fill();
      ctx.strokeStyle = "#fed7aa";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [aPixeles, rutaGPS, rutaCamara, posGPSActual, posCamActual]);

  // Redibujar periódicamente mientras esté visible
  useEffect(() => {
    if (!visible) return;
    dibujarMapa();
  }, [visible, dibujarMapa]);

  // Cálculos de estadísticas (distancias y discrepancia)
  const calcularDistanciaTotal = (puntos) => {
    let d = 0;
    for (let i = 1; i < puntos.length; i++) {
      const dx = puntos[i].x - puntos[i - 1].x;
      const dz = puntos[i].z - puntos[i - 1].z;
      d += Math.sqrt(dx * dx + dz * dz);
    }
    return Number(d.toFixed(1));
  };

  const distGPS = calcularDistanciaTotal(rutaGPS);
  const distCam = calcularDistanciaTotal(rutaCamara);

  // Discrepancia actual entre GPS y Cámara
  const discrepanciaActual = (() => {
    if (!posGPSActual || !posCamActual) return 0;
    const dx = posGPSActual.x - posCamActual.x;
    const dz = posGPSActual.z - posCamActual.z;
    return Number(Math.sqrt(dx * dx + dz * dz).toFixed(1));
  })();

  // Iniciar nueva grabación
  const handleIniciarGrabacion = () => {
    setRutaGPS([]);
    setRutaCamara([]);
    setTiempoTranscurrido(0);
    setPausado(false);
    setGrabando(true);
  };

  // Pausar o reanudar
  const handleTogglePausa = () => {
    setPausado((prev) => !prev);
  };

  // Guardar la sesión actual en el historial
  const handleGuardarRuta = () => {
    if (rutaGPS.length === 0 && rutaCamara.length === 0) {
      alert("No hay datos grabados para guardar.");
      return;
    }

    const nombrePorDefecto = `Ruta_${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    const nombre = prompt("Nombre de la prueba:", nombrePorDefecto) || nombrePorDefecto;

    const nuevaRuta = {
      id: Date.now().toString(),
      nombre,
      fecha: new Date().toLocaleString("es-CO"),
      duracionSegundos: tiempoTranscurrido,
      distanciaGPS: distGPS,
      distanciaCamara: distCam,
      discrepanciaFinal: discrepanciaActual,
      puntosGPS: rutaGPS,
      puntosCamara: rutaCamara,
    };

    const actualizado = [nuevaRuta, ...rutasGuardadas];
    setRutasGuardadas(actualizado);
    try {
      localStorage.setItem("unimap_rutas_guardadas", JSON.stringify(actualizado));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage:", e);
    }

    setGrabando(false);
    setPausado(false);
    alert(`✅ Ruta "${nombre}" guardada con éxito en el historial.`);
  };

  // Cargar una ruta guardada en el mapa 2D
  const handleCargarRuta = (ruta) => {
    setRutaGPS(ruta.puntosGPS || []);
    setRutaCamara(ruta.puntosCamara || []);
    setRutaSeleccionadaId(ruta.id);
    setPestanaActiva("mapa");
  };

  // Exportar una ruta a JSON
  const handleExportarJSON = (ruta) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ruta, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${ruta.nombre.replace(/\s+/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Eliminar una ruta del historial
  const handleEliminarRuta = (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta ruta grabada?")) return;
    const filtradas = rutasGuardadas.filter((r) => r.id !== id);
    setRutasGuardadas(filtradas);
    try {
      localStorage.setItem("unimap_rutas_guardadas", JSON.stringify(filtradas));
    } catch (e) {}
  };

  // Limpiar trazado en pantalla
  const handleLimpiarTrazado = () => {
    setRutaGPS([]);
    setRutaCamara([]);
    setRutaSeleccionadaId(null);
  };

  const formatearTiempo = (seg) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!visible) return null;

  return (
    <div className="overlayModalRutas">
      <div className="cardModalRutas">
        {/* Cabecera del Panel */}
        <div className="headerModalRutas">
          <div className="tituloModalRutas">
            <span className="iconoRutas">🗺️</span>
            <div>
              <h3>Comparador y Grabador de Rutas GPS vs Cámara 3D</h3>
              <small>Entorno de Validación Técnica y Diagnóstico de Desplazamiento</small>
            </div>
          </div>
          <button type="button" className="btnCerrarRutas" onClick={onClose} title="Cerrar panel">
            ✖
          </button>
        </div>

        {/* Pestañas de Navegación: Mapa 2D vs Historial */}
        <div className="pestanasRutas">
          <button
            type="button"
            className={`btnPestanaRuta ${pestanaActiva === "mapa" ? "activa" : ""}`}
            onClick={() => setPestanaActiva("mapa")}
          >
            📍 Mapa 2D y Trazado en Vivo
          </button>
          <button
            type="button"
            className={`btnPestanaRuta ${pestanaActiva === "historial" ? "activa" : ""}`}
            onClick={() => setPestanaActiva("historial")}
          >
            📋 Historial de Rutas ({rutasGuardadas.length})
          </button>
        </div>

        {pestanaActiva === "mapa" ? (
          <div className="contenidoMapaRutas">
            {/* Controles de Grabación */}
            <div className="barraControlesGrabacion">
              {!grabando ? (
                <button type="button" className="btnIniciarGrabacion" onClick={handleIniciarGrabacion}>
                  🔴 Iniciar Grabación
                </button>
              ) : (
                <>
                  <button type="button" className="btnPausarGrabacion" onClick={handleTogglePausa}>
                    {pausado ? "▶️ Continuar" : "⏸️ Pausar"}
                  </button>
                  <button type="button" className="btnDetenerGrabacion" onClick={handleGuardarRuta}>
                    ⏹️ Guardar Ruta
                  </button>
                </>
              )}

              <button type="button" className="btnLimpiarTrazado" onClick={handleLimpiarTrazado}>
                🧹 Limpiar
              </button>

              <div className="indicadorTiempoGrabacion">
                ⏱️ Tiempo: <b>{formatearTiempo(tiempoTranscurrido)}</b>
                {grabando && (
                  <span className={`badgeGrabandoPill ${pausado ? "pausado" : "grabando"}`}>
                    {pausado ? "PAUSADO" : "GRABANDO"}
                  </span>
                )}
              </div>
            </div>

            {/* Canvas del Mapa de Superficie 2D del Campus */}
            <div className="contenedorCanvasMapa">
              <canvas
                ref={canvasRef}
                width={500}
                height={500}
                className="canvasSuperficieCampus"
              />

              {/* Leyenda flotante sobre el mapa */}
              <div className="leyendaMapaRutas">
                <div className="itemLeyenda">
                  <span className="dotLeyenda" style={{ background: "#06b6d4" }} />
                  <span>Ruta GPS (Dispositivo) [{rutaGPS.length} pts]</span>
                </div>
                <div className="itemLeyenda">
                  <span className="dotLeyenda" style={{ background: "#f97316" }} />
                  <span>Ruta Cámara 3D (WebGL) [{rutaCamara.length} pts]</span>
                </div>
              </div>
            </div>

            {/* Tarjetas de Telemetría Comparativa */}
            <div className="gridTelemetriaRutas">
              <div className="cardTelemetriaRuta">
                <small>🛰️ GPS Dispositivo</small>
                <b>X: {posGPSActual?.x ?? "--"}m | Z: {posGPSActual?.z ?? "--"}m</b>
                <span>Distancia: <b>{distGPS}m</b></span>
              </div>

              <div className="cardTelemetriaRuta">
                <small>🎥 Cámara 3D WebGL</small>
                <b>X: {posCamActual?.x ?? "--"}m | Z: {posCamActual?.z ?? "--"}m</b>
                <span>Distancia: <b>{distCam}m</b> (Alt: +1.0m)</span>
              </div>

              <div className="cardTelemetriaRuta">
                <small>⚖️ Discrepancia GPS vs Cámara</small>
                <b style={{ color: discrepanciaActual > 3 ? "#f87171" : "#34d399" }}>
                  {discrepanciaActual} metros
                </b>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {discrepanciaActual < 1.5 ? "✅ Alineación Óptima" : "⚠️ Desviación en curso"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="contenidoHistorialRutas">
            {rutasGuardadas.length === 0 ? (
              <div className="estadoVacioHistorial">
                <p>No tienes rutas grabadas aún.</p>
                <small>Ve a la pestaña "Mapa 2D", pulsa "🔴 Iniciar Grabación" y camina para registrar una prueba.</small>
              </div>
            ) : (
              <div className="listaRutasGuardadas">
                {rutasGuardadas.map((r) => (
                  <div key={r.id} className={`itemRutaGuardada ${rutaSeleccionadaId === r.id ? "seleccionada" : ""}`}>
                    <div className="infoRutaGuardada">
                      <h4>{r.nombre}</h4>
                      <p>📅 {r.fecha} • ⏱️ {formatearTiempo(r.duracionSegundos)}</p>
                      <div className="metricasRutaPill">
                        <span>🛰️ GPS: {r.distanciaGPS}m ({r.puntosGPS?.length || 0} pts)</span>
                        <span>🎥 Cámara: {r.distanciaCamara}m ({r.puntosCamara?.length || 0} pts)</span>
                      </div>
                    </div>
                    <div className="accionesRutaGuardada">
                      <button
                        type="button"
                        className="btnAccionRuta cargar"
                        onClick={() => handleCargarRuta(r)}
                        title="Ver en el mapa 2D"
                      >
                        👁️ Ver
                      </button>
                      <button
                        type="button"
                        className="btnAccionRuta exportar"
                        onClick={() => handleExportarJSON(r)}
                        title="Descargar archivo JSON"
                      >
                        💾 JSON
                      </button>
                      <button
                        type="button"
                        className="btnAccionRuta eliminar"
                        onClick={() => handleEliminarRuta(r.id)}
                        title="Eliminar de la lista"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelRutasGPS;
