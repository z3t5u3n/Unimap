import React, { useState, useEffect, useRef, useCallback } from "react";
import "../../CSS/interfaz.css";

// Coordenadas de los Edificios Principales y Zonas del Campus ITFIP en Unity (X, Z) Calibradas
const EDIFICIOS_CAMPUS = [
  { id: "porteria", nombre: "Portería Principal", x: -102.3, z: 237.6, ancho: 16, alto: 10, color: "#38bdf8", tipo: "rect" },
  { id: "bloque_abc", nombre: "Bloque A-B-C", x: -44.6, z: 292.6, ancho: 32, alto: 22, color: "#818cf8", tipo: "rect" },
  { id: "plazoleta", nombre: "Plazoleta Central", x: -80.0, z: 270.0, radio: 14, color: "#fbbf24", tipo: "circ" },
  { id: "bloque_d", nombre: "Bloque D (Salones)", x: -125.0, z: 367.2, ancho: 28, alto: 24, color: "#34d399", tipo: "rect" },
  { id: "cafeteria", nombre: "Cafetería Universitaria", x: -66.5, z: 296.9, ancho: 20, alto: 16, color: "#f472b6", tipo: "rect" },
  { id: "bloque_e", nombre: "Bloque E (Ingeniería)", x: -124.0, z: 450.6, ancho: 32, alto: 26, color: "#a78bfa", tipo: "rect" },
  { id: "coliseo", nombre: "Coliseo ITFIP", x: -119.6, z: 270.9, ancho: 30, alto: 28, color: "#fb923c", tipo: "rect" },
  { id: "gym", nombre: "Gimnasio (GYM)", x: -97.0, z: 252.2, ancho: 18, alto: 16, color: "#f87171", tipo: "rect" },
  { id: "canchas", nombre: "Canchas Deportivas", x: -120.0, z: 285.0, ancho: 32, alto: 24, color: "#4ade80", tipo: "rect" },
];

// Edificios y Puntos de Referencia para el modelo con Pivote Oficial Centrado en (0, 0)
const EDIFICIOS_PIVOTE_CENTRAL = [
  { id: "porteria", nombre: "Portería Principal", x: -102.3, z: 237.6, ancho: 16, alto: 10, color: "#38bdf8", tipo: "rect" },
  { id: "bloque_d", nombre: "Bloque D", x: -125.0, z: 367.2, ancho: 28, alto: 24, color: "#34d399", tipo: "rect" },
  { id: "bloque_e", nombre: "Bloque E", x: -124.0, z: 450.6, ancho: 32, alto: 26, color: "#a78bfa", tipo: "rect" },
  { id: "coliseo", nombre: "Coliseo ITFIP", x: -119.6, z: 270.9, ancho: 30, alto: 28, color: "#fb923c", tipo: "rect" },
];

// Límites de la superficie / mesh del campus en Unity Calibrados
const CAMPUS_BOUNDS = {
  minX: -160,
  maxX: -20,
  minZ: 210,
  maxZ: 470,
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
  const [modoEncuadre, setModoEncuadre] = useState("auto"); // 'auto' (zoom centrado en la ruta) o 'campus' (vista completa)

  // Refs para capturar en listeners sin recrear funciones
  const grabandoRef = useRef(false);
  grabandoRef.current = grabando;
  const pausadoRef = useRef(false);
  pausadoRef.current = pausado;
  const boundsRef = useRef(CAMPUS_BOUNDS);

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
    const { minX, maxX, minZ, maxZ } = boundsRef.current || CAMPUS_BOUNDS;
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

    // Detectar si las coordenadas activas están cerca de (0,0) (GPS Libre o Pivote Central Oficial)
    const puntos = [...rutaGPS, ...rutaCamara];
    if (posGPSActual) puntos.push(posGPSActual);
    if (posCamActual) puntos.push(posCamActual);
    const usaPivoteCero = puntos.length > 0 && puntos.some((p) => Math.abs(p.x) < 80 && Math.abs(p.z) < 80);

    let bounds;
    // Si modoEncuadre es "auto" y tenemos puntos registrados, auto-ajustar zoom centrado en la ruta
    if (modoEncuadre === "auto" && puntos.length >= 2) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      puntos.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      });

      const spanX = Math.max(maxX - minX, 15);
      const spanZ = Math.max(maxZ - minZ, 15);
      const margen = Math.max(12, Math.max(spanX, spanZ) * 0.25);
      const centroX = (minX + maxX) / 2;
      const centroZ = (minZ + maxZ) / 2;
      const mitadDim = Math.max(spanX, spanZ) / 2 + margen;

      bounds = {
        minX: Math.round(centroX - mitadDim),
        maxX: Math.round(centroX + mitadDim),
        minZ: Math.round(centroZ - mitadDim),
        maxZ: Math.round(centroZ + mitadDim),
        esPivoteCero: usaPivoteCero,
        paso: Math.max(5, Math.round((mitadDim * 2) / 6)),
        edificios: usaPivoteCero ? EDIFICIOS_PIVOTE_CENTRAL : EDIFICIOS_CAMPUS,
      };
    } else {
      bounds = usaPivoteCero
        ? { minX: -100, maxX: 100, minZ: -100, maxZ: 100, esPivoteCero: true, paso: 20, edificios: EDIFICIOS_PIVOTE_CENTRAL }
        : { minX: -240, maxX: -60, minZ: 270, maxZ: 460, esPivoteCero: false, paso: 20, edificios: EDIFICIOS_CAMPUS };
    }

    boundsRef.current = bounds;

    // Soporte Hi-DPI para nitidez máxima en pantallas retina y móviles
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = 500;
    const displayHeight = 500;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = displayWidth;
    const height = displayHeight;

    // A. Fondo de la superficie del campus (suelo y gradiente)
    ctx.clearRect(0, 0, width, height);

    const gradFondo = ctx.createLinearGradient(0, 0, 0, height);
    gradFondo.addColorStop(0, "#0b1324");
    gradFondo.addColorStop(1, "#070c18");
    ctx.fillStyle = gradFondo;
    ctx.fillRect(0, 0, width, height);

    // B. Rejilla topográfica de calibración con escala métrica
    ctx.strokeStyle = "rgba(56, 189, 248, 0.09)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "8px monospace";
    ctx.textAlign = "left";

    for (let x = bounds.minX; x <= bounds.maxX; x += bounds.paso) {
      const p1 = aPixeles(x, bounds.minZ, width, height);
      const p2 = aPixeles(x, bounds.maxZ, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
      ctx.fillText(`${x}m`, p2.px + 2, height - 6);
    }
    for (let z = bounds.minZ; z <= bounds.maxZ; z += bounds.paso) {
      const p1 = aPixeles(bounds.minX, z, width, height);
      const p2 = aPixeles(bounds.maxX, z, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
      ctx.fillText(`${z}m`, 4, p1.py - 2);
    }

    // Si es pivote cero, dibujar ejes cartesianos X y Z que cruzan por (0, 0)
    if (bounds.esPivoteCero) {
      ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
      ctx.lineWidth = 1.5;
      const ejeZ1 = aPixeles(0, bounds.minZ, width, height);
      const ejeZ2 = aPixeles(0, bounds.maxZ, width, height);
      ctx.beginPath();
      ctx.moveTo(ejeZ1.px, ejeZ1.py);
      ctx.lineTo(ejeZ2.px, ejeZ2.py);
      ctx.stroke();

      const ejeX1 = aPixeles(bounds.minX, 0, width, height);
      const ejeX2 = aPixeles(bounds.maxX, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(ejeX1.px, ejeX1.py);
      ctx.lineTo(ejeX2.px, ejeX2.py);
      ctx.stroke();
    }

    // C. Dibujar siluetas de los Edificios Principales
    bounds.edificios.forEach((ed) => {
      // Omitir edificios que caigan completamente fuera de la vista
      if (ed.x < bounds.minX - 40 || ed.x > bounds.maxX + 40 || ed.z < bounds.minZ - 40 || ed.z > bounds.maxZ + 40) {
        return;
      }

      const centro = aPixeles(ed.x, ed.z, width, height);
      const escalaH = (width - 50) / (bounds.maxX - bounds.minX);
      const escalaV = (height - 50) / (bounds.maxZ - bounds.minZ);

      if (ed.tipo === "circ") {
        ctx.beginPath();
        const rPix = Math.max(6, ed.radio * escalaH);
        ctx.arc(centro.px, centro.py, rPix, 0, Math.PI * 2);
        ctx.fillStyle = `${ed.color}25`;
        ctx.fill();
        ctx.strokeStyle = ed.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const wPix = Math.max(12, ed.ancho * escalaH);
        const hPix = Math.max(10, ed.alto * escalaV);

        ctx.fillStyle = `${ed.color}22`;
        ctx.fillRect(centro.px - wPix / 2, centro.py - hPix / 2, wPix, hPix);
        ctx.strokeStyle = ed.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(centro.px - wPix / 2, centro.py - hPix / 2, wPix, hPix);
      }

      // Etiqueta del edificio
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ed.nombre, centro.px, centro.py);
    });

    // D. Dibujar Ruta del GPS (Cian brillante, Hi-DPI, suavizado)
    if (rutaGPS.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0, 229, 255, 0.4)";
      ctx.shadowBlur = 6;
      ctx.setLineDash([6, 3]);

      rutaGPS.forEach((p, i) => {
        const pos = aPixeles(p.x, p.z, width, height);
        if (i === 0) ctx.moveTo(pos.px, pos.py);
        else ctx.lineTo(pos.px, pos.py);
      });
      ctx.stroke();
      ctx.restore();

      // Puntos de muestreo GPS
      rutaGPS.forEach((p) => {
        const pos = aPixeles(p.x, p.z, width, height);
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#00e5ff";
        ctx.fill();
      });

      // Marcador de INICIO de la ruta (Primer punto)
      const pInicio = aPixeles(rutaGPS[0].x, rutaGPS[0].z, width, height);
      ctx.beginPath();
      ctx.arc(pInicio.px, pInicio.py, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🟢 INICIO", pInicio.px, pInicio.py - 10);

      // Marcador de FIN de la ruta (Último punto si no está grabando)
      if (!grabandoRef.current && rutaGPS.length > 1) {
        const pFin = aPixeles(rutaGPS[rutaGPS.length - 1].x, rutaGPS[rutaGPS.length - 1].z, width, height);
        ctx.beginPath();
        ctx.arc(pFin.px, pFin.py, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🏁 FIN", pFin.px, pFin.py - 10);
      }
    }

    // E. Dibujar Ruta de la Cámara 3D (Naranja brillante, Hi-DPI, suavizado)
    if (rutaCamara.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "#ff9100";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(255, 145, 0, 0.4)";
      ctx.shadowBlur = 6;

      rutaCamara.forEach((p, i) => {
        const pos = aPixeles(p.x, p.z, width, height);
        if (i === 0) ctx.moveTo(pos.px, pos.py);
        else ctx.lineTo(pos.px, pos.py);
      });
      ctx.stroke();
      ctx.restore();

      // Puntos de muestreo de Cámara
      rutaCamara.forEach((p) => {
        const pos = aPixeles(p.x, p.z, width, height);
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ff9100";
        ctx.fill();
      });
    }

    // F. Marcador actual de posición GPS (Círculo azul brillante con flecha)
    if (posGPSActual) {
      const pos = aPixeles(posGPSActual.x, posGPSActual.z, width, height);
      ctx.beginPath();
      ctx.arc(pos.px, pos.py, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#00e5ff";
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
        ctx.strokeStyle = "#00e5ff";
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

    ctx.restore();
  }, [aPixeles, rutaGPS, rutaCamara, posGPSActual, posCamActual, modoEncuadre]);

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

  // Enviar ruta directamente al Administrador
  const handleEnviarAlAdmin = (ruta) => {
    try {
      const guardadasAdmin = JSON.parse(localStorage.getItem("unimap_rutas_compartidas_admin") || "[]");
      const existeIdx = guardadasAdmin.findIndex((r) => r.id === ruta.id);
      let usuarioActual = {};
      try {
        usuarioActual = JSON.parse(localStorage.getItem("usuario") || "{}");
      } catch (e) {}

      const rutaParaAdmin = {
        ...ruta,
        enviadoAlAdminEn: new Date().toLocaleString("es-CO"),
        testerNombre: usuarioActual.nombre || usuarioActual.username || "Tester Móvil",
        dispositivo: navigator.userAgent.includes("Mobile") ? "Dispositivo Móvil (Smartphone)" : "Navegador de Escritorio (PC)",
      };

      if (existeIdx >= 0) {
        guardadasAdmin[existeIdx] = rutaParaAdmin;
      } else {
        guardadasAdmin.unshift(rutaParaAdmin);
      }

      localStorage.setItem("unimap_rutas_compartidas_admin", JSON.stringify(guardadasAdmin));
      window.dispatchEvent(new CustomEvent("UniMapRutaCompartidaAdmin", { detail: rutaParaAdmin }));
      alert(`📤 ¡Ruta "${ruta.nombre}" enviada con éxito al panel del Administrador!`);
    } catch (err) {
      console.error("Error al enviar al admin:", err);
      alert("No se pudo enviar la ruta al admin.");
    }
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

              {/* Botón de auto-zoom y encuadre nítido */}
              <button
                type="button"
                className={`btnAutoEncuadre ${modoEncuadre === "auto" ? "activo" : ""}`}
                onClick={() => setModoEncuadre((prev) => (prev === "auto" ? "campus" : "auto"))}
                title={modoEncuadre === "auto" ? "Ver mapa completo del campus" : "Enfocar y centrar en la ruta grabada"}
              >
                {modoEncuadre === "auto" ? "🔍 Zoom Ruta" : "🏛️ Ver Campus"}
              </button>

              {/* Botón para enviar la ruta actual al Administrador */}
              {rutaGPS.length > 0 && (
                <button
                  type="button"
                  className="btnEnviarAdminRuta"
                  onClick={() =>
                    handleEnviarAlAdmin({
                      id: rutaSeleccionadaId || Date.now().toString(),
                      nombre: `Ruta_Test_${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`,
                      fecha: new Date().toLocaleString("es-CO"),
                      duracionSegundos: tiempoTranscurrido,
                      distanciaGPS: distGPS,
                      distanciaCamara: distCam,
                      discrepanciaFinal: discrepanciaActual,
                      puntosGPS: rutaGPS,
                      puntosCamara: rutaCamara,
                    })
                  }
                  title="Enviar la gráfica y datos de esta ruta al Administrador"
                >
                  📤 Enviar al Admin
                </button>
              )}

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
                        className="btnAccionRuta enviarAdmin"
                        onClick={() => handleEnviarAlAdmin(r)}
                        title="Enviar esta ruta al Administrador"
                        style={{ background: "rgba(16, 185, 129, 0.2)", color: "#34d399", border: "1px solid #10b981" }}
                      >
                        📤 Admin
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
