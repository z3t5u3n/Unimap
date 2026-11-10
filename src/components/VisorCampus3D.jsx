import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  Compass,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Eye,
  Pause,
  Play,
  Square,
  Network,
  Footprints,
  CheckCircle2,
  FastForward,
  Zap,
  Sparkles,
  Navigation,
  SlidersHorizontal
} from 'lucide-react';
import PanelConfiguracionMapa, {
  AJUSTES_PREDETERMINADOS,
  PRESETS_CONFIG
} from './PanelConfiguracionMapa';
import { poiGraphService } from '../services/POIGraphService';
import { poiLibraryService } from '../services/POILibraryService';
import { prepararCacheThreeJS } from '../services/cacheCampus3D';

// Coordenadas fijas de la Portería Principal (nodo POIs.4477 a la altura del centro de los POIs)
const POI_ENTRADA_COORDS = {
  x: 182.0139923095703,
  y: 1.1999976634979248, // Altura exacta del centro de los POIs (POIs.4477)
  z: 276.25738525390625,
  initialYaw: -142.1, // Ángulo en grados hacia el interior de la avenida del campus
  initialPitch: 1.5   // Inclinación visual natural
};

const SETTINGS_VERSION = 'unimap_v2_60fps';

const detectarDispositivoMovil = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const esMovilPorUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const esPantallaPequena = typeof window !== 'undefined' && window.innerWidth <= 768;
  const tieneTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  return esMovilPorUA || (esPantallaPequena && tieneTouch);
};

const obtenerAjustesIniciales = () => {
  try {
    const versionGuardada = localStorage.getItem('unimap_settings_version');
    if (versionGuardada !== SETTINGS_VERSION) {
      // Migración automática: asegura que arranca en Modo 60 FPS por defecto
      localStorage.setItem('unimap_settings_version', SETTINGS_VERSION);
      localStorage.setItem('unimap_graphics_settings', JSON.stringify(AJUSTES_PREDETERMINADOS));
      return { ...AJUSTES_PREDETERMINADOS };
    }
    const guardados = localStorage.getItem('unimap_graphics_settings');
    if (guardados) {
      return { ...AJUSTES_PREDETERMINADOS, ...JSON.parse(guardados) };
    }
  } catch (e) {
    console.warn('Error leyendo unimap_graphics_settings:', e);
  }
  return { ...AJUSTES_PREDETERMINADOS };
};

export default function VisorCampus3D({
  onCargaCompleta,
  destinoActivo,
  puntoInicio,
  onReorientar,
  temporadaActiva,
  accionesExtra
}) {
  const mountRef = useRef(null);
  const snowPointsRef = useRef(null);
  const [temporadaNavidena, setTemporadaNavidena] = useState(() => {
    const guardado = localStorage.getItem('unimap_temporada_activa');
    return guardado === null ? true : guardado === 'true';
  });
  const temporadaRef = useRef(temporadaNavidena);

  useEffect(() => {
    temporadaRef.current = temporadaNavidena;
  }, [temporadaNavidena]);

  useEffect(() => {
    if (typeof temporadaActiva === 'boolean') {
      setTemporadaNavidena(temporadaActiva);
      temporadaRef.current = temporadaActiva;
      if (snowPointsRef.current) {
        snowPointsRef.current.visible = temporadaActiva;
      }
    }
  }, [temporadaActiva]);
  const [progresoCarga, setProgresoCarga] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [subtituloCarga, setSubtituloCarga] = useState('Inicializando red de 2.407 POIs y grafos de caminos');

  // Estados de navegación cinemática y recorrido de grafos
  const [rutaCalculada, setRutaCalculada] = useState(null);
  const [navegando, setNavegando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [progresoRecorrido, setProgresoRecorrido] = useState(0);
  const [haLlegado, setHaLlegado] = useState(false);
  const [mostrarRedGrafos, setMostrarRedGrafos] = useState(false);
  const [ajustesGraficos, setAjustesGraficos] = useState(obtenerAjustesIniciales);
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [calidadUltra, setCalidadUltra] = useState(() => {
    const init = obtenerAjustesIniciales();
    return init.modoUltra !== undefined ? init.modoUltra : false;
  }); // Modo Ultra Fotorrealista (Cycles / EEVEE Look)
  const [nodoActualCamara, setNodoActualCamara] = useState('POIs.4477'); // Nodo activo en marcha manual
  const [dandoPaso, setDandoPaso] = useState(false);

  const aplicarAjusteEnEscenaRef = useRef(null);
  const aplicarAjustesMasivosRef = useRef(null);

  // Referencias para invocar acciones desde la UI
  const recentrarRef = useRef(null);
  const zoomInRef = useRef(null);
  const zoomOutRef = useRef(null);
  const orientarDestinoRef = useRef(null);
  const pausarRecorridoRef = useRef(null);
  const detenerRecorridoRef = useRef(null);
  const saltarDestinoRef = useRef(null);
  const toggleRedGrafosRef = useRef(null);
  const toggleCalidadRef = useRef(null);
  const teletransportarPuntoInicioRef = useRef(null);

  // Referencias para callbacks, destino y punto de inicio sin reiniciar WebGL
  const onCargaCompletaRef = useRef(onCargaCompleta);
  const onReorientarRef = useRef(onReorientar);
  const destinoActivoRef = useRef(destinoActivo);
  const puntoInicioRef = useRef(puntoInicio);

  useEffect(() => {
    onCargaCompletaRef.current = onCargaCompleta;
  }, [onCargaCompleta]);

  useEffect(() => {
    onReorientarRef.current = onReorientar;
  }, [onReorientar]);

  useEffect(() => {
    destinoActivoRef.current = destinoActivo;
  }, [destinoActivo]);

  useEffect(() => {
    puntoInicioRef.current = puntoInicio;
    if (teletransportarPuntoInicioRef.current && !cargando && puntoInicio) {
      teletransportarPuntoInicioRef.current(puntoInicio);
    }
  }, [puntoInicio, cargando]);

  // Funciones de gestión de configuración gráfica
  const cambiarAjuste = (clave, valor) => {
    if (clave === 'modoUltra') {
      setCalidadUltra(valor);
    }
    if (clave === 'mostrarGizmosGrafos') {
      setMostrarRedGrafos(valor);
    }
    setAjustesGraficos((prev) => {
      const actualizados = { ...prev, [clave]: valor };
      try {
        localStorage.setItem('unimap_graphics_settings', JSON.stringify(actualizados));
      } catch (e) {}
      if (aplicarAjusteEnEscenaRef.current) {
        aplicarAjusteEnEscenaRef.current(clave, valor, actualizados);
      }
      return actualizados;
    });
  };

  const aplicarPreset = (preset) => {
    const nuevosAjustes = { ...ajustesGraficos, ...preset.ajustes };
    if (nuevosAjustes.modoUltra !== undefined) {
      setCalidadUltra(nuevosAjustes.modoUltra);
    }
    if (nuevosAjustes.mostrarGizmosGrafos !== undefined) {
      setMostrarRedGrafos(nuevosAjustes.mostrarGizmosGrafos);
    }
    setAjustesGraficos(nuevosAjustes);
    try {
      localStorage.setItem('unimap_graphics_settings', JSON.stringify(nuevosAjustes));
    } catch (e) {}
    if (aplicarAjustesMasivosRef.current) {
      aplicarAjustesMasivosRef.current(nuevosAjustes);
    }
  };

  const restablecerAjustes = () => {
    setCalidadUltra(AJUSTES_PREDETERMINADOS.modoUltra);
    setMostrarRedGrafos(AJUSTES_PREDETERMINADOS.mostrarGizmosGrafos);
    setAjustesGraficos(AJUSTES_PREDETERMINADOS);
    try {
      localStorage.removeItem('unimap_graphics_settings');
    } catch (e) {}
    if (aplicarAjustesMasivosRef.current) {
      aplicarAjustesMasivosRef.current(AJUSTES_PREDETERMINADOS);
    }
  };

  // Escuchar cambios en el destino activo e iniciar viaje cuando el modelo esté listo
  useEffect(() => {
    if (orientarDestinoRef.current && !cargando) {
      orientarDestinoRef.current(destinoActivo);
    }
  }, [destinoActivo, cargando]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = currentMount.clientWidth || window.innerWidth;
    const height = currentMount.clientHeight || window.innerHeight;

    const cfg = ajustesGraficos;
    const esMovil = detectarDispositivoMovil();

    // Distancia máxima de visión según el dispositivo:
    // En celular se limita a 260m (suficiente para ver bloques cercanos y senderos sin saturar la GPU).
    // En PC se amplía a 600m (descartando geometría innecesaria más allá de 600m en lugar de los antiguos 3500m).
    const distanciaVision = esMovil ? 260 : 600;
    const fogNear = esMovil ? 90 : 180;
    const fogFar = distanciaVision;

    // 1. ESCENA Y CONFIGURACIÓN ATMOSFÉRICA
    const scene = new THREE.Scene();
    const esClaroInicial = document.documentElement.getAttribute('data-theme') !== 'dark';
    const fogColorInicial = esClaroInicial ? '#dbeafe' : '#0b1329';

    // Niebla de Distancia Lineal: los objetos lejanos se desvanecen suavemente hacia el color del cielo
    // y la GPU los descarta automáticamente cuando superan la distancia de visión (Zero Overdraw).
    if (cfg.nieblaHabilitada !== false) {
      scene.fog = new THREE.Fog(fogColorInicial, fogNear, fogFar);
    } else {
      scene.fog = null;
    }
    scene.background = new THREE.Color(fogColorInicial);

    // 2. CÁMARA INICIAL (Punto de inicio seleccionado o Portería Principal)
    const puntoInicial = puntoInicioRef.current || POI_ENTRADA_COORDS;
    const camera = new THREE.PerspectiveCamera(cfg.fovBase || 60, width / height, 0.2, distanciaVision);
    camera.position.set(puntoInicial.x, puntoInicial.y, puntoInicial.z);

    // 3. RENDERIZADOR WebGL CON CONFIGURACIÓN FOTORREALISTA PBR (ACES FILMIC)
    const renderer = new THREE.WebGLRenderer({
      antialias: !esMovil,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    renderer.setSize(width, height);
    // En celulares limitamos pixelRatio a 1.0 para igualar el rendimiento fluido de Unity WebGL
    const maxDPR = esMovil ? Math.min(window.devicePixelRatio || 1, 1.0) : Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(maxDPR);
    renderer.shadowMap.enabled = cfg.sombrasHabilitadas !== false;
    renderer.shadowMap.type = (cfg.sombrasSuaves && !esMovil) ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Algoritmo ACES de Hollywood y Blender
    renderer.toneMappingExposure = cfg.exposicion || 1.05;
    currentMount.appendChild(renderer.domElement);

    // IBL: Entorno de reflexiones físicas PBR con PMREM (Image-Based Lighting)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    // Cielo Atmosférico Físico (Sky Shader con dispersión Rayleigh / Mie)
    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    let sunPos = new THREE.Vector3(160, 260, 120);
    if (cfg.horaDelDia === 'mediodia') sunPos.set(60, 340, 40);
    else if (cfg.horaDelDia === 'atardecer') sunPos.set(220, 50, -180);
    else if (cfg.horaDelDia === 'noche') sunPos.set(-80, -60, 100);
    const sunDirection = sunPos.clone().normalize();

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = cfg.turbidezCielo || 8;
    skyUniforms['rayleigh'].value = cfg.rayleighCielo || (esClaroInicial ? 1.2 : 3.5);
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;
    skyUniforms['sunPosition'].value.copy(sunDirection);

    // 4. GRUPOS PARA ELEMENTOS 3D
    let sceneModel = null;
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);

    const routeLineGroup = new THREE.Group();
    scene.add(routeLineGroup);

    const debugGizmosGroup = new THREE.Group();
    scene.add(debugGizmosGroup);

    // ------------------------------------------------------------------
    // SISTEMA DE NIEVE ARTIFICIAL 3D (TEMPORADA NAVIDEÑA & INVIERNO)
    // No requiere modificar el modelo 3D en Blender: se genera dinámicamente
    // ------------------------------------------------------------------
    const CANTIDAD_COPOS = esMovil ? 700 : 3500;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(CANTIDAD_COPOS * 3);
    const snowVel = new Float32Array(CANTIDAD_COPOS);
    const snowOffsets = new Float32Array(CANTIDAD_COPOS);

    const RANGO_NIEVE_X = 140;
    const RANGO_NIEVE_Y = 75;
    const RANGO_NIEVE_Z = 140;

    const pIniX = puntoInicial.x;
    const pIniY = puntoInicial.y;
    const pIniZ = puntoInicial.z;

    for (let i = 0; i < CANTIDAD_COPOS; i++) {
      snowPos[i * 3 + 0] = pIniX + (Math.random() - 0.5) * RANGO_NIEVE_X;
      snowPos[i * 3 + 1] = pIniY + Math.random() * RANGO_NIEVE_Y;
      snowPos[i * 3 + 2] = pIniZ + (Math.random() - 0.5) * RANGO_NIEVE_Z;

      // Velocidad suave de caída (2.2 a 4.8 m/s)
      snowVel[i] = 2.2 + Math.random() * 2.6;
      snowOffsets[i] = Math.random() * Math.PI * 2;
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

    // Generar textura circular suave para los copos de nieve
    const crearTexturaCopo = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.35, 'rgba(240, 248, 255, 0.9)');
      grad.addColorStop(0.7, 'rgba(224, 242, 254, 0.35)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    };

    const snowTexture = crearTexturaCopo();
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.55,
      map: snowTexture,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const snowPoints = new THREE.Points(snowGeo, snowMat);
    snowPoints.visible = temporadaRef.current;
    scene.add(snowPoints);
    snowPointsRef.current = snowPoints;

    // ------------------------------------------------------------------
    // FLECHA 3D INTERACTIVA PARA NAVEGACIÓN MANUAL (IDÉNTICA A UNITY)
    // ------------------------------------------------------------------
    const arrowGroup = new THREE.Group();
    arrowGroup.name = 'FlechaNavegacionManual';
    scene.add(arrowGroup);

    // Malla estilizada procedural luminosa (activa inmediatamente)
    const arrowMeshGroup = new THREE.Group();

    // 1. Cabeza de la flecha (cono apuntando hacia adelante en +Z)
    const headGeo = new THREE.ConeGeometry(0.38, 0.72, 16);
    headGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0088cc,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8
    });
    const headMesh = new THREE.Mesh(headGeo, arrowMat);
    headMesh.position.z = 0.32;
    arrowMeshGroup.add(headMesh);

    // 2. Vástago / cuerpo de la flecha
    const shaftGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.55, 16);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMesh = new THREE.Mesh(shaftGeo, arrowMat);
    shaftMesh.position.z = -0.22;
    arrowMeshGroup.add(shaftMesh);

    // 3. Hitbox invisible de 1.4m para clics/toques cómodos en móvil y PC
    const hitBoxGeo = new THREE.SphereGeometry(1.4, 8, 8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    arrowMeshGroup.add(hitBox);

    arrowGroup.add(arrowMeshGroup);

    // Cargar la malla original Flecha.fbx de Unity si está disponible
    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      '/Modelo3D/Flecha.fbx',
      (fbx) => {
        fbx.traverse((child) => {
          if (child.isMesh) {
            child.material = arrowMat;
            child.castShadow = true;
          }
        });
        fbx.scale.set(0.0075, 0.0075, 0.0075);
        // Rotar 180° para que la punta apunte hacia adelante en dirección al próximo nodo (+Z) y no hacia la cámara
        fbx.rotation.y = Math.PI;
        arrowMeshGroup.remove(headMesh);
        arrowMeshGroup.remove(shaftMesh);
        arrowMeshGroup.add(fbx);
      },
      undefined,
      (err) => {
        console.warn('Aviso de carga Flecha.fbx, usando flecha procedural estilizada:', err);
      }
    );

    const pointerRaycaster = new THREE.Raycaster();
    let currentCameraNodeId = 1999;
    let currentArrowNodeId = 1998;
    let isStepping = false;
    let stepStartTime = 0;
    const stepDuration = 0.45; // Duración del paso en segundos (idéntico a POIManualArrowNavigator en Unity)
    const arrowYOffset = -0.55; // Ajuste de altura idéntico a Unity para situar la flecha en el suelo
    const stepStartPos = new THREE.Vector3();
    const stepTargetPos = new THREE.Vector3();
    let stepStartYaw = 0;
    let stepTargetYaw = 0;

    let lastReportedNodeName = '';
    const lastCamPosChecked = new THREE.Vector3(-9999, -9999, -9999);

    // Actualiza hacia qué POI vecino debe posicionarse la flecha según hacia dónde mira la cámara
    const actualizarSiguienteNodoFlecha = (immediate = false) => {
      if (isNavigating || isStepping) {
        arrowGroup.visible = false;
        return;
      }

      arrowGroup.visible = true;

      // Sincronizar el nodo más cercano a la cámara solo si la cámara se movió
      const camPos = camera.position;
      let currNode = null;
      if (lastCamPosChecked.distanceToSquared(camPos) > 0.04 || currentCameraNodeId === null) {
        currNode = poiGraphService.findNearestNode(camPos.x, camPos.y, camPos.z);
        lastCamPosChecked.copy(camPos);
      } else {
        currNode = poiGraphService.getNode(currentCameraNodeId);
      }
      if (!currNode) return;
      currentCameraNodeId = currNode.id;
      if (lastReportedNodeName !== currNode.name) {
        lastReportedNodeName = currNode.name;
        setNodoActualCamara(currNode.name);
      }

      // Vector de dirección horizontal hacia donde mira la cámara
      const rad = THREE.MathUtils.degToRad(currentYaw);
      const camFwd = new THREE.Vector3(Math.sin(rad), 0, Math.cos(rad)).normalize();

      let bestDot = -999;
      let bestNeighbor = null;
      let closestNeighbor = null;
      let minDistance = Infinity;

      if (currNode.neighbors && currNode.neighbors.length > 0) {
        for (let i = 0; i < currNode.neighbors.length; i++) {
          const edge = currNode.neighbors[i];
          const neighbor = poiGraphService.getNode(edge.id);
          if (!neighbor || neighbor.id === currNode.id) continue;

          const dx = neighbor.x - camPos.x;
          const dz = neighbor.z - camPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.15) continue;

          if (dist < minDistance) {
            minDistance = dist;
            closestNeighbor = neighbor;
          }

          const dot = (camFwd.x * (dx / dist)) + (camFwd.z * (dz / dist));
          if (dot > bestDot) {
            bestDot = dot;
            bestNeighbor = neighbor;
          }
        }
      }

      // Si hay un vecino adelante en la dirección de la cámara (dot > 0.05f), seleccionarlo (como en Unity)
      let chosen = (bestDot > 0.05 && bestNeighbor) ? bestNeighbor : closestNeighbor;

      // Fallback: Si el nodo no tiene vecinos hacia adelante, buscar el más cercano que no sea el actual
      if (!chosen) {
        chosen = poiGraphService.findNearestNodeExcluding(camPos.x, camPos.y, camPos.z, currentCameraNodeId);
      }

      if (!chosen) return;

      currentArrowNodeId = chosen.id;

      const targetPos = new THREE.Vector3(chosen.x, chosen.y + arrowYOffset, chosen.z);

      if (immediate || arrowGroup.position.distanceTo(targetPos) > 4.5) {
        arrowGroup.position.copy(targetPos);
      } else {
        arrowGroup.position.lerp(targetPos, 0.22);
      }

      const dirX = chosen.x - camPos.x;
      const dirZ = chosen.z - camPos.z;
      if (dirX * dirX + dirZ * dirZ > 0.01) {
        const targetRotY = Math.atan2(dirX, dirZ);
        if (immediate) {
          arrowGroup.rotation.y = targetRotY;
        } else {
          let diffRotY = (targetRotY - arrowGroup.rotation.y) % (Math.PI * 2);
          if (diffRotY > Math.PI) diffRotY -= Math.PI * 2;
          if (diffRotY < -Math.PI) diffRotY += Math.PI * 2;
          arrowGroup.rotation.y += diffRotY * 0.25;
        }
      }
    };

    // Da un paso manual fluido hacia el POI de la flecha
    const darPasoManual = (targetNodeId) => {
      if (isStepping || isNavigating) return;
      const targetNode = poiGraphService.getNode(targetNodeId);
      if (!targetNode) return;

      isStepping = true;
      setDandoPaso(true);
      stepStartTime = performance.now();
      stepStartPos.copy(camera.position);
      stepTargetPos.set(targetNode.x, targetNode.y, targetNode.z);

      const dirX = targetNode.x - camera.position.x;
      const dirZ = targetNode.z - camera.position.z;
      if (dirX * dirX + dirZ * dirZ > 0.01) {
        stepTargetYaw = Math.atan2(dirX, dirZ) * (180 / Math.PI);
      } else {
        stepTargetYaw = currentYaw;
      }
      stepStartYaw = currentYaw;
    };

    let pinMesh = null;
    let ringMesh = null;
    let basePosY = 0;

    // 5. VARIABLES DE NAVEGACIÓN CINEMÁTICA POR LA RED DE GRAFOS (IGUAL QUE EN UNITY)
    let activePath = [];
    let totalPathLength = 0;
    let currentDistance = 0;
    let isNavigating = false;
    let isPaused = false;
    let moveSpeed = cfg.velocidadRecorrido || 14.0; // Velocidad de avance fluido en metros/segundo (ajustable)
    const lookAheadDistance = 3.5; // Anticipación suave de curvas (igual a Unity)
    const clock = new THREE.Clock();

    // Actualiza o limpia el marcador visual 3D
    const crearOActualizarMarcador = (dest) => {
      while (markerGroup.children.length > 0) {
        markerGroup.remove(markerGroup.children[0]);
      }

      if (!dest || dest.x === undefined || dest.id === 'porteria') {
        pinMesh = null;
        ringMesh = null;
        return;
      }

      markerGroup.position.set(dest.x, (dest.y !== undefined ? dest.y : 1.2) - 1.02, dest.z);
      basePosY = 2.4;

      const pinGeo = new THREE.SphereGeometry(0.55, 24, 24);
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.8,
        roughness: 0.25,
        metalness: 0.5
      });
      pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.y = basePosY;
      markerGroup.add(pinMesh);

      const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.15;
      markerGroup.add(ringMesh);

      const lineGeo = new THREE.CylinderGeometry(0.05, 0.05, basePosY, 8);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.y = basePosY / 2;
      markerGroup.add(lineMesh);
    };

    // Actualiza la línea de ruta 3D en el suelo
    const actualizarLineaRuta3D = (path) => {
      while (routeLineGroup.children.length > 0) {
        routeLineGroup.remove(routeLineGroup.children[0]);
      }

      if (path && path.length >= 2) {
        const routeObj = poiGraphService.createRouteLineObject(path, 0x38bdf8, -1.02);
        if (routeObj) {
          routeLineGroup.add(routeObj);
        }
      }
    };

    // 6. ROTACIÓN PANORÁMICA 360° (Look-Around idéntico a POICameraOrbitController en Unity)
    let currentYaw = puntoInicial.yaw !== undefined ? puntoInicial.yaw : POI_ENTRADA_COORDS.initialYaw;
    let targetYaw = currentYaw;
    let currentPitch = puntoInicial.pitch !== undefined ? puntoInicial.pitch : POI_ENTRADA_COORDS.initialPitch;
    let targetPitch = currentPitch;
    let targetFOV = cfg.fovBase || 60;

    // Estado de llegada suave cinematográfica (1.0s con smoothstep como en Unity)
    let isArriving = false;
    let arrivalStartTime = 0;
    const arrivalDuration = 1.0;
    let arrivalStartYaw = 0;
    let arrivalStartPitch = 0;
    let arrivalTargetYaw = 0;
    let arrivalTargetPitch = 0;
    let lastTelemetryTime = 0;

    let isPointerDown = false;
    let previousPointerX = 0;
    let previousPointerY = 0;

    const dom = renderer.domElement;
    dom.style.cursor = 'grab';
    dom.style.touchAction = 'none';

    const actualizarOrientacionCamara = (delta) => {
      // Amortiguación inercial exponencial idéntica a POICameraOrbitController en Unity (smoothDamping = 12)
      const smoothDamping = 12.0;
      const dt = delta || 0.016;
      const t = 1.0 - Math.exp(-smoothDamping * dt);

      let diffYaw = (targetYaw - currentYaw) % 360;
      if (diffYaw > 180) diffYaw -= 360;
      if (diffYaw < -180) diffYaw += 360;
      currentYaw += diffYaw * t;

      const diffPitch = targetPitch - currentPitch;
      currentPitch += diffPitch * t;

      // Amortiguación suave del campo de visión (FOV zoom)
      camera.fov += (targetFOV - camera.fov) * t;
      camera.updateProjectionMatrix();

      const phi = THREE.MathUtils.degToRad(90 - currentPitch);
      const theta = THREE.MathUtils.degToRad(currentYaw);

      const lookDir = new THREE.Vector3(
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.cos(theta)
      );

      const lookTarget = new THREE.Vector3().copy(camera.position).add(lookDir);
      camera.lookAt(lookTarget);
    };

    // AL BUSCAR O PULSAR UN BOTÓN: Calula la ruta A* y mueve la cámara automáticamente
    orientarDestinoRef.current = (dest) => {
      // Detener cualquier navegación o llegada previa
      isNavigating = false;
      isArriving = false;
      isPaused = false;
      currentDistance = 0;
      setNavegando(false);
      setPausado(false);
      setProgresoRecorrido(0);
      setHaLlegado(false);

      if (dest) {
        // Resolver a través de POILibrary si es un string o no tiene coordenadas
        let targetPlace = dest;
        if (typeof dest === 'string') {
          targetPlace = poiLibraryService.findPOI(dest) || { nombre: dest };
        } else if (dest && dest.nombre && dest.x === undefined) {
          targetPlace = poiLibraryService.findPOI(dest.nombre) || dest;
        }

        // Posición de destino
        let targetPos =
          targetPlace.id === 'porteria'
            ? { x: POI_ENTRADA_COORDS.x, y: 1.2, z: POI_ENTRADA_COORDS.z }
            : targetPlace;

        // Si el objeto 3D o Empty existe en el modelo cargado, consultar su World Position real (estilo Unity)
        if (targetPlace.meshName && sceneModel) {
          const obj = sceneModel.getObjectByName(targetPlace.meshName);
          if (obj) {
            const worldPos = new THREE.Vector3();
            obj.getWorldPosition(worldPos);
            targetPos = {
              ...targetPlace,
              x: worldPos.x,
              y: worldPos.y,
              z: worldPos.z
            };
          }
        }

        const currentPos = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        };

        const nearestDestNode = poiGraphService.findNearestNode(targetPos.x, targetPos.y, targetPos.z);
        const distAlNearestNode = nearestDestNode
          ? Math.hypot(currentPos.x - nearestDestNode.x, currentPos.z - nearestDestNode.z)
          : Math.hypot(currentPos.x - targetPos.x, currentPos.z - targetPos.z);

        crearOActualizarMarcador(targetPos);

        // Si la cámara ya está prácticamente en el POI más cercano del destino (< 2.8m), orientar y listo
        if (distAlNearestNode < 2.8) {
          if (dest.yaw !== undefined) targetYaw = dest.yaw;
          targetPitch = dest.pitch || 0;
          targetFOV = dest.fov || 50;
          setHaLlegado(true);
          return;
        }

        // CALCULAR RUTA POR LA RED DE POIs CON A* (distancia de conexión <= 3.8m)
        const path = poiGraphService.getPathBetweenPositions(currentPos, targetPos);

        if (path && path.length >= 2) {
          activePath = path;
          totalPathLength = poiGraphService.getTotalPathLength(path);
          actualizarLineaRuta3D(path);

          setRutaCalculada({
            puntos: path,
            distanciaMetros: parseFloat(totalPathLength.toFixed(1)),
            nodoInicio: poiGraphService.findNearestNode(currentPos.x, currentPos.y, currentPos.z)?.name,
            nodoFin: poiGraphService.findNearestNode(targetPos.x, targetPos.y, targetPos.z)?.name
          });

          // INICIAR AUTOMÁTICAMENTE EL VIAJE DE LA CÁMARA (COMO EN UNITY)
          isNavigating = true;
          isArriving = false;
          isPaused = false;
          currentDistance = 0;
          arrowGroup.visible = false;
          setNavegando(true);
          setPausado(false);
          setHaLlegado(false);
          targetFOV = 55;
          clock.getDelta();

          // Emitir evento de navegación iniciada hacia la ventana
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('UniMapNavegacionIniciada', {
                detail: {
                  destination: targetPlace.displayName || targetPlace.nombre || targetPlace.rawName || 'Destino'
                }
              })
            );
          }
        } else {
          // Si no hay ruta continua, orientar directamente
          if (dest.yaw !== undefined) targetYaw = dest.yaw;
          targetPitch = dest.pitch || 0;
          actualizarLineaRuta3D(null);
          setRutaCalculada(null);
          actualizarSiguienteNodoFlecha(true);
        }
      } else {
        // Al limpiar el destino o detener recorrido, mantener la posición y orientación actual
        crearOActualizarMarcador(null);
        actualizarLineaRuta3D(null);
        activePath = [];
        totalPathLength = 0;
        setRutaCalculada(null);
        actualizarSiguienteNodoFlecha(true);
      }
    };

    // Pausar o reanudar el avance
    pausarRecorridoRef.current = () => {
      if (!isNavigating) return;
      isPaused = !isPaused;
      setPausado(isPaused);
      if (!isPaused) clock.getDelta();
    };

    // Saltar directamente al final del camino (Teletransporte instantáneo al destino)
    saltarDestinoRef.current = () => {
      if (!activePath || activePath.length < 2) return;
      isNavigating = false;
      isArriving = false;
      currentDistance = totalPathLength;

      const finalPos = activePath[activePath.length - 1];
      camera.position.set(finalPos.x, finalPos.y, finalPos.z);
      const nodeFinal = poiGraphService.findNearestNode(finalPos.x, finalPos.y, finalPos.z);
      if (nodeFinal) {
        currentCameraNodeId = nodeFinal.id;
        setNodoActualCamara(nodeFinal.name);
      }

      setNavegando(false);
      setPausado(false);
      setHaLlegado(true);
      setProgresoRecorrido(100);

      const dest = destinoActivoRef.current;
      if (dest) {
        let destPos = dest;
        if (dest.meshName && sceneModel) {
          const obj = sceneModel.getObjectByName(dest.meshName);
          if (obj) {
            const wp = new THREE.Vector3();
            obj.getWorldPosition(wp);
            destPos = { x: wp.x, y: wp.y, z: wp.z };
          }
        }
        if (dest.yaw !== undefined) {
          targetYaw = dest.yaw;
          targetPitch = dest.pitch || 0;
        } else if (destPos.x !== undefined && destPos.z !== undefined) {
          const dx = destPos.x - finalPos.x;
          const dz = destPos.z - finalPos.z;
          targetYaw = Math.atan2(dx, dz) * (180 / Math.PI);
          targetPitch = 0;
        }
      }
      actualizarSiguienteNodoFlecha(true);
    };

    // Teletransportar cámara al punto de inicio seleccionado y preparar navegación
    teletransportarPuntoInicioRef.current = (punto) => {
      if (!punto) return;
      isNavigating = false;
      isArriving = false;
      isPaused = false;
      isStepping = false;
      currentDistance = 0;
      activePath = [];
      totalPathLength = 0;
      setNavegando(false);
      setPausado(false);
      setProgresoRecorrido(0);
      setHaLlegado(false);
      setDandoPaso(false);

      camera.position.set(punto.x, punto.y, punto.z);
      currentYaw = targetYaw = punto.yaw !== undefined ? punto.yaw : currentYaw;
      currentPitch = targetPitch = punto.pitch !== undefined ? punto.pitch : 0;
      targetFOV = cfg.fovBase || 60;
      camera.fov = targetFOV;
      camera.updateProjectionMatrix();

      arrowGroup.visible = true;
      actualizarSiguienteNodoFlecha(true);

      // Si hay un destino activo seleccionado, recalcular y reiniciar el recorrido desde este nuevo punto de inicio
      if (destinoActivoRef.current && orientarDestinoRef.current) {
        orientarDestinoRef.current(destinoActivoRef.current);
      } else {
        crearOActualizarMarcador(null);
        actualizarLineaRuta3D(null);
        setRutaCalculada(null);
      }
    };

    // Detener recorrido: si está en pleno camino o con ruta activa, quedarse exactamente en el POI hacia el cual va
    detenerRecorridoRef.current = () => {
      // 1. Identificar el nodo POI exacto hacia el cual se dirige la cámara en el segmento actual
      let targetNode = null;

      if (activePath && activePath.length >= 2) {
        let accumulated = 0;
        for (let i = 0; i < activePath.length - 1; i++) {
          const segLen = activePath[i].distanceTo(activePath[i + 1]);
          if (accumulated + segLen >= currentDistance) {
            // El nodo en activePath hacia el cual va la cámara en este tramo
            targetNode = poiGraphService.findNearestNode(
              activePath[i + 1].x,
              activePath[i + 1].y,
              activePath[i + 1].z
            );
            break;
          }
          accumulated += segLen;
        }

        // Si ya recorrió toda la ruta o estaba en el último tramo
        if (!targetNode && activePath.length > 0) {
          const finalPoint = activePath[activePath.length - 1];
          targetNode = poiGraphService.findNearestNode(finalPoint.x, finalPoint.y, finalPoint.z);
        }
      }

      // Si no se encontró por activePath, asegurar el nodo más cercano a la posición actual de la cámara
      if (!targetNode) {
        targetNode = poiGraphService.findNearestNode(
          camera.position.x,
          camera.position.y,
          camera.position.z
        );
      }

      // 2. Detener estados cinemáticos de navegación
      isNavigating = false;
      isArriving = false;
      isPaused = false;
      isStepping = false;
      currentDistance = 0;
      activePath = [];
      totalPathLength = 0;
      setNavegando(false);
      setPausado(false);
      setProgresoRecorrido(0);
      setHaLlegado(false);
      setDandoPaso(false);
      setRutaCalculada(null);
      crearOActualizarMarcador(null);
      actualizarLineaRuta3D(null);

      // 3. Posicionar la cámara en el POI hacia el cual iba (NUNCA regresar a la entrada)
      if (targetNode) {
        camera.position.set(targetNode.x, targetNode.y, targetNode.z);
        currentCameraNodeId = targetNode.id;
        setNodoActualCamara(targetNode.name);
      }

      // Mantener la orientación de la cámara hacia adelante
      targetYaw = currentYaw;
      targetPitch = 0;
      targetFOV = cfg.fovBase || 60;
      camera.fov = targetFOV;
      camera.updateProjectionMatrix();

      // Habilitar la flecha 3D inmediatamente desde este nuevo POI para continuar exploración manual
      arrowGroup.visible = true;
      actualizarSiguienteNodoFlecha(true);

      // Limpiar destino activo en el estado superior para ocultar el HUD de ruta
      if (onReorientarRef.current) onReorientarRef.current();
    };

    // Alternar visualización de la red de grafos (Gizmos de depuración verdes y amarillos)
    toggleRedGrafosRef.current = (visible) => {
      while (debugGizmosGroup.children.length > 0) {
        debugGizmosGroup.remove(debugGizmosGroup.children[0]);
      }

      if (visible) {
        const gizmos = poiGraphService.createDebugGizmoObject();
        debugGizmosGroup.add(gizmos);
      }
    };

    // Eventos de arrastre para rotación manual 360°, zoom FOV y clics en flecha 3D (POICameraOrbitController)
    const activePointers = new Map();
    let lastPinchDistance = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let pointerDownTime = 0;

    const onPointerDown = (e) => {
      // En modo guiado automático por la red de POIs, la orientación la guía el camino
      if (isNavigating && !isPaused) return;

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {
        isPointerDown = true;
        previousPointerX = e.clientX;
        previousPointerY = e.clientY;
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
        pointerDownTime = performance.now();
        dom.style.cursor = 'grabbing';
      } else if (activePointers.size === 2) {
        // Inicializar distancia de pellizco (pinch-to-zoom en móvil)
        const pts = Array.from(activePointers.values());
        lastPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };

    const onPointerMove = (e) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (activePointers.size >= 2) {
        // Pellizco táctil de zoom en móvil (Pinch-to-zoom idéntico a Unity pinchZoomSpeed = 0.08)
        const pts = Array.from(activePointers.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinchDistance > 0) {
          const pinchDelta = (currentDist - lastPinchDistance) * 0.08;
          targetFOV = Math.max(35, Math.min(75, targetFOV - pinchDelta));
        }
        lastPinchDistance = currentDist;
      } else if (isPointerDown) {
        const deltaX = e.clientX - previousPointerX;
        const deltaY = e.clientY - previousPointerY;
        previousPointerX = e.clientX;
        previousPointerY = e.clientY;

        const velocidadRotacion = cfg.sensibilidadGiro || 0.22;
        targetYaw -= deltaX * velocidadRotacion;
        targetPitch += deltaY * velocidadRotacion;
        targetPitch = Math.max(-60, Math.min(60, targetPitch)); // Límites -60° a 60° (idéntico a Unity)
      } else {
        // Feedback visual hover sobre la flecha 3D (cursor y brillo reactivo)
        if (!isNavigating && !isStepping && arrowGroup.visible) {
          const rect = dom.getBoundingClientRect();
          const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          pointerRaycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
          const hits = pointerRaycaster.intersectObjects(arrowGroup.children, true);
          if (hits.length > 0) {
            dom.style.cursor = 'pointer';
            arrowMat.emissiveIntensity = 1.5;
          } else {
            dom.style.cursor = 'grab';
            arrowMat.emissiveIntensity = 0.9;
          }
        }
      }
    };

    const onPointerUp = (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        lastPinchDistance = 0;
      }

      const dragDist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      const pressDuration = performance.now() - pointerDownTime;
      isPointerDown = false;
      dom.style.cursor = 'grab';

      // Si fue un clic o toque limpio sin arrastre (como en Unity clickMaxDragDistance = 18px)
      if (dragDist < 18 && pressDuration < 600 && !isNavigating && !isStepping && arrowGroup.visible) {
        const rect = dom.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        pointerRaycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);
        const hits = pointerRaycaster.intersectObjects(arrowGroup.children, true);
        if (hits.length > 0) {
          darPasoManual(currentArrowNodeId);
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      // Zoom FOV suave con rueda (idéntico a POICameraOrbitController en Unity)
      const zoomFactor = (e.deltaY > 0 ? 1 : -1) * 3.5;
      targetFOV = Math.max(35, Math.min(75, targetFOV + zoomFactor));
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    recentrarRef.current = () => {
      const p = puntoInicioRef.current || POI_ENTRADA_COORDS;
      if (teletransportarPuntoInicioRef.current) {
        teletransportarPuntoInicioRef.current(p);
      }
    };

    zoomInRef.current = () => {
      targetFOV = Math.max(35, targetFOV - 5);
    };

    zoomOutRef.current = () => {
      targetFOV = Math.min(75, targetFOV + 5);
    };

    // 7. ILUMINACIÓN CINEMÁTICA DEL CAMPUS
    // Luz solar directa con sombras de alta definición y bias anti-acné
    const sunLight = new THREE.DirectionalLight(
      cfg.luzSolarColor || 0xfff6ea,
      cfg.luzSolarIntensidad ?? 2.2
    );
    sunLight.position.copy(sunPos);
    sunLight.castShadow = cfg.sombrasHabilitadas !== false;
    const shadowRes = esMovil ? Math.min(cfg.calidadSombras || 512, 512) : (cfg.calidadSombras || 1024);
    sunLight.shadow.mapSize.width = shadowRes;
    sunLight.shadow.mapSize.height = shadowRes;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = esMovil ? 350 : 1200;
    const d = esMovil ? 140 : 320;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // Luz hemisférica: cielo azul arriba, rebote de pasto/tierra abajo
    const hemiLight = new THREE.HemisphereLight(
      0xb1e1ff,
      0x3d4a3e,
      cfg.luzHemisfericaIntensidad ?? 0.75
    );
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);

    // Luz ambiental suave para levantar negros
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      cfg.luzAmbientalIntensidad ?? 0.35
    );
    scene.add(ambientLight);

    // Post-procesamiento cinematográfico (GTAO Ambient Occlusion + Bloom HDR + OutputPass)
    // Se inicializa bajo demanda para no consumir memoria GPU en modo 60 FPS
    let composer = null;
    let gtaoPass = null;
    let bloomPass = null;

    const inicializarComposer = () => {
      if (composer) return composer;
      try {
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Ambient Occlusion en tiempo real para sombras de contacto (como en Cycles)
        gtaoPass = new GTAOPass(scene, camera, width, height);
        gtaoPass.blendIntensity = cfg.gtaoIntensidad ?? 0.75;
        gtaoPass.enabled = cfg.gtaoHabilitado !== false;
        composer.addPass(gtaoPass);

        // Bloom HDR elegante para luces, reflejos y línea 3D
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          cfg.bloomIntensidad ?? 0.22,
          0.4,
          0.88
        );
        bloomPass.enabled = cfg.bloomHabilitado !== false;
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);
        return composer;
      } catch (e) {
        console.warn('Aviso de post-procesamiento:', e);
        composer = null;
        return null;
      }
    };

    if (cfg.modoUltra) {
      inicializarComposer();
    }

    let useUltraQuality = cfg.modoUltra ?? false;
    toggleCalidadRef.current = (activarUltra) => {
      useUltraQuality = activarUltra;
      if (activarUltra && !composer) {
        inicializarComposer();
      }
    };

    // Manejador reactivo para actualizar en caliente cualquier propiedad de la escena 3D
    const aplicarAjusteIndividual = (clave, valor, todos) => {
      switch (clave) {
        case 'luzSolarIntensidad':
          sunLight.intensity = valor;
          break;
        case 'luzSolarColor':
          sunLight.color.set(valor);
          break;
        case 'luzHemisfericaIntensidad':
          hemiLight.intensity = valor;
          break;
        case 'luzAmbientalIntensidad':
          ambientLight.intensity = valor;
          break;
        case 'exposicion':
          renderer.toneMappingExposure = valor;
          break;
        case 'horaDelDia':
          if (valor === 'mediodia') {
            sunLight.position.set(60, 340, 40);
          } else if (valor === 'atardecer') {
            sunLight.position.set(220, 50, -180);
          } else if (valor === 'noche') {
            sunLight.position.set(-80, -60, 100);
          } else {
            sunLight.position.set(160, 260, 120);
          }
          skyUniforms['sunPosition'].value.copy(sunLight.position).normalize();
          break;
        case 'sombrasHabilitadas':
          sunLight.castShadow = valor;
          renderer.shadowMap.enabled = valor;
          scene.traverse((c) => {
            if (c.isMesh) {
              c.castShadow = valor;
              c.receiveShadow = valor;
            }
          });
          break;
        case 'calidadSombras':
          sunLight.shadow.mapSize.set(valor, valor);
          if (sunLight.shadow.map) {
            sunLight.shadow.map.dispose();
            sunLight.shadow.map = null;
          }
          renderer.shadowMap.needsUpdate = true;
          break;
        case 'sombrasSuaves':
          renderer.shadowMap.type = valor ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
          renderer.shadowMap.needsUpdate = true;
          break;
        case 'turbidezCielo':
          skyUniforms['turbidity'].value = valor;
          break;
        case 'rayleighCielo':
          skyUniforms['rayleigh'].value = valor;
          break;
        case 'nieblaHabilitada':
          if (valor) {
            const esClaro = document.documentElement.getAttribute('data-theme') !== 'dark';
            const col = esClaro ? '#dbeafe' : '#0b1329';
            scene.fog = new THREE.Fog(col, fogNear, fogFar);
          } else {
            scene.fog = null;
          }
          break;
        case 'densidadNiebla':
          if (scene.fog && scene.fog.isFog) {
            scene.fog.near = Math.max(40, fogNear * (1 - (valor - 0.001) * 300));
            scene.fog.far = Math.max(100, fogFar * (1 - (valor - 0.001) * 200));
          }
          break;
        case 'modoUltra':
          useUltraQuality = valor;
          setCalidadUltra(valor);
          if (valor && !composer) {
            inicializarComposer();
          }
          break;
        case 'gtaoHabilitado':
          if (gtaoPass) gtaoPass.enabled = valor;
          break;
        case 'gtaoIntensidad':
          if (gtaoPass) gtaoPass.blendIntensity = valor;
          break;
        case 'bloomHabilitado':
          if (bloomPass) bloomPass.enabled = valor;
          break;
        case 'bloomIntensidad':
          if (bloomPass) bloomPass.strength = valor;
          break;
        case 'velocidadRecorrido':
          moveSpeed = valor;
          break;
        case 'sensibilidadGiro':
          velocidadRotacion = valor;
          break;
        case 'fovBase':
          camera.fov = valor;
          camera.updateProjectionMatrix();
          break;
        case 'mostrarFlecha3D':
          arrowGroup.visible = valor;
          break;
        case 'mostrarGizmosGrafos':
          setMostrarRedGrafos(valor);
          if (toggleRedGrafosRef.current) toggleRedGrafosRef.current(valor);
          break;
        default:
          break;
      }
    };

    aplicarAjusteEnEscenaRef.current = aplicarAjusteIndividual;
    aplicarAjustesMasivosRef.current = (todos) => {
      Object.keys(todos).forEach((k) => aplicarAjusteIndividual(k, todos[k], todos));
    };

    // 8. TEMA CLARO / OSCURO
    const handleThemeChange = (e) => {
      const tema = e.detail?.tema;
      const claro = tema === 'light';
      const col = claro ? '#dbeafe' : '#0b1329';
      if (scene.fog) {
        scene.fog.color.set(col);
      }
      scene.background.set(col);
      if (sky) {
        skyUniforms['rayleigh'].value = claro ? 1.2 : 3.5;
        skyUniforms['turbidity'].value = claro ? 8 : 12;
      }
      sunLight.intensity = claro ? 2.2 : 0.8;
      hemiLight.intensity = claro ? 0.75 : 0.35;
      ambientLight.intensity = claro ? 0.35 : 0.15;
    };
    window.addEventListener('unimap_theme_changed', handleThemeChange);

    // 9. CARGA DEL MODELO 3D (ACELERADA CON CACHE API)
    const loader = new GLTFLoader();

    const ejecutarCargaGLTF = () => {
      loader.load(
        '/Modelo3D/Unimap.gltf',
        (gltf) => {
          const model = gltf.scene;

          model.traverse((child) => {
            if (child.isMesh) {
              child.frustumCulled = true;
              child.castShadow = !esMovil;
              child.receiveShadow = true;

              if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat) => {
                  const matName = (mat.name || '').toLowerCase();
                  // Corrección de materiales de palmeras y rocas si vienen en blanco del glTF
                  if (matName.includes('trunk.001')) {
                    if (mat.color && mat.color.r > 0.85 && mat.color.g > 0.85 && mat.color.b > 0.85) {
                      mat.color.setRGB(0.35, 0.20, 0.10);
                      mat.roughness = 0.7;
                    }
                  } else if (matName.includes('green_2.001')) {
                    if (mat.color && mat.color.r > 0.85 && mat.color.g > 0.85 && mat.color.b > 0.85) {
                      mat.color.setRGB(0.12, 0.42, 0.08);
                      mat.roughness = 0.6;
                    }
                  } else if (matName.includes('green.001')) {
                    if (mat.color && mat.color.r > 0.85 && mat.color.g > 0.85 && mat.color.b > 0.85) {
                      mat.color.setRGB(0.08, 0.32, 0.05);
                      mat.roughness = 0.6;
                    }
                  } else if (matName === 'trunk') {
                    if (mat.color && mat.color.r > 0.85 && mat.color.g > 0.85 && mat.color.b > 0.85) {
                      mat.color.setRGB(0.35, 0.35, 0.37);
                      mat.roughness = 0.8;
                    }
                  } else if (matName === 'white' || matName === 'whitere') {
                    // Calibración de color para aceras, bordillos, rampas y muros para evitar quemado en blanco absoluto
                    if (mat.color && mat.color.r > 0.70 && mat.color.g > 0.70 && mat.color.b > 0.70) {
                      mat.color.setRGB(0.55, 0.55, 0.53);
                      mat.roughness = 0.85;
                      mat.metalness = 0.0;
                    }
                  }

                  mat.envMapIntensity = 1.0;
                  if (mat.map) {
                    mat.map.anisotropy = esMovil ? 2 : Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
                  }
                });
              }
            }
          });

          scene.add(model);
          sceneModel = model;

          // Ocultar mallas Codiller auxiliares (idéntico a POIGraphManager.HideCodillerObjects en Unity)
          poiGraphService.hideCodillerObjects(model);

          // Escanear y registrar todos los Empties de destino (idéntico a POILibrary.ScanAndRegisterPlaces en Unity)
          poiLibraryService.scanAndRegisterPlaces(model, poiGraphService);

          let emptyPOI = null;
          model.traverse((child) => {
            if (
              child.name === 'POIs.4477' ||
              child.name === 'POIs4477' ||
              child.userData?.name === 'POIs.4477'
            ) {
              emptyPOI = child;
            }
          });

          const puntoAct = puntoInicioRef.current;
          if (puntoAct) {
            camera.position.set(puntoAct.x, puntoAct.y, puntoAct.z);
            currentYaw = targetYaw = puntoAct.yaw !== undefined ? puntoAct.yaw : POI_ENTRADA_COORDS.initialYaw;
            currentPitch = targetPitch = puntoAct.pitch !== undefined ? puntoAct.pitch : POI_ENTRADA_COORDS.initialPitch;
          } else if (emptyPOI) {
            const poiPos = new THREE.Vector3();
            emptyPOI.getWorldPosition(poiPos);
            camera.position.set(poiPos.x, poiPos.y, poiPos.z);
          } else {
            camera.position.set(POI_ENTRADA_COORDS.x, POI_ENTRADA_COORDS.y, POI_ENTRADA_COORDS.z);
          }

          actualizarSiguienteNodoFlecha(true);
          setCargando(false);
          if (onCargaCompletaRef.current) onCargaCompletaRef.current(model);
        },
        (xhr) => {
          if (xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            setProgresoCarga(pct);
          }
        },
        (err) => {
          console.error('Error al cargar Unimap.gltf:', err);
          setErrorCarga('No se pudo cargar el modelo 3D del campus.');
          setCargando(false);
        }
      );
    };

    // Iniciar carga con aceleración de Cache API
    prepararCacheThreeJS((pct, mensaje) => {
      setProgresoCarga(pct);
      if (mensaje) setSubtituloCarga(mensaje);
    })
      .then((resultado) => {
        if (resultado && resultado.desdeCache) {
          setDesdeCache(true);
          setSubtituloCarga('⚡ Recuperando modelo 3D desde memoria local...');
        }
        ejecutarCargaGLTF();
      })
      .catch((err) => {
        console.warn('Aviso caché 3D, continuando con carga directa:', err);
        ejecutarCargaGLTF();
      });

    // 10. BUCLE DE ANIMACIÓN Y NAVEGACIÓN CINEMÁTICA
    let animationFrameId;
    let lastReportedPct = -1;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);

      // A. Paso manual hacia el POI de la flecha 3D (Interpolación SmoothStep idéntica a Unity)
      if (isStepping) {
        const elapsed = (performance.now() - stepStartTime) / 1000;
        const t = Math.min(1.0, elapsed / stepDuration);
        const smoothT = t * t * (3 - 2 * t); // SmoothStep

        camera.position.lerpVectors(stepStartPos, stepTargetPos, smoothT);

        let diffYaw = (stepTargetYaw - stepStartYaw) % 360;
        if (diffYaw > 180) diffYaw -= 360;
        if (diffYaw < -180) diffYaw += 360;
        targetYaw = stepStartYaw + diffYaw * smoothT;

        if (t >= 1.0) {
          camera.position.copy(stepTargetPos);
          currentYaw = stepTargetYaw;
          targetYaw = stepTargetYaw;
          isStepping = false;
          setDandoPaso(false);
          currentCameraNodeId = currentArrowNodeId;
          const reached = poiGraphService.getNode(currentArrowNodeId);
          if (reached) {
            setNodoActualCamara(reached.name);
          }
          actualizarSiguienteNodoFlecha(true);
        }
      } else if (!isNavigating) {
        // En reposo manual: mantener la flecha alineada según hacia dónde mira la cámara
        actualizarSiguienteNodoFlecha(false);
      }

      // Animación flotante bobbing de la flecha 3D
      if (arrowGroup.visible) {
        const timeBob = Date.now() * 0.0035;
        arrowMeshGroup.position.y = Math.sin(timeBob) * 0.04;
      }

      // Actualización continua de nieve artificial 3D (cuando la temporada está activa)
      if (snowPoints && snowPoints.visible) {
        const positions = snowGeo.attributes.position.array;
        const timeSnow = performance.now() * 0.0015;
        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;

        for (let i = 0; i < CANTIDAD_COPOS; i++) {
          const idx = i * 3;
          // Caída vertical
          positions[idx + 1] -= snowVel[i] * delta;

          // Suave brisa lateral sinusoidal
          positions[idx + 0] += Math.sin(timeSnow + snowOffsets[i]) * 0.035;
          positions[idx + 2] += Math.cos(timeSnow + snowOffsets[i] * 0.8) * 0.025;

          // Si el copo cae por debajo de la altura de la cámara, reubicarlo arriba
          if (positions[idx + 1] < camY - 20) {
            positions[idx + 1] = camY + 45 + Math.random() * 15;
            positions[idx + 0] = camX + (Math.random() - 0.5) * RANGO_NIEVE_X;
            positions[idx + 2] = camZ + (Math.random() - 0.5) * RANGO_NIEVE_Z;
          }

          // Mantener la nube de nieve centrada en el desplazamiento del usuario
          if (Math.abs(positions[idx + 0] - camX) > RANGO_NIEVE_X * 0.55) {
            positions[idx + 0] = camX + (Math.random() - 0.5) * RANGO_NIEVE_X;
          }
          if (Math.abs(positions[idx + 2] - camZ) > RANGO_NIEVE_Z * 0.55) {
            positions[idx + 2] = camZ + (Math.random() - 0.5) * RANGO_NIEVE_Z;
          }
        }
        snowGeo.attributes.position.needsUpdate = true;
      }

      // B. Recorrido guiado automático por la red de POIs (al buscar o seleccionar un lugar)
      if (isNavigating && !isPaused && activePath.length >= 2) {
        currentDistance += moveSpeed * delta;
        const clampedDist = Math.min(currentDistance, totalPathLength);

        // Posición actual sobre el camino (a la altura exacta del centro de los POIs)
        const currentPos = poiGraphService.getPointOnPath(activePath, clampedDist);
        camera.position.set(currentPos.x, currentPos.y, currentPos.z);

        // Punto de anticipación (Look-Ahead) para girar suavemente en las curvas del camino
        const lookAheadDist = Math.min(clampedDist + lookAheadDistance, totalPathLength);
        const lookTarget = poiGraphService.getPointOnPath(activePath, lookAheadDist);

        const forwardDir = new THREE.Vector3().subVectors(lookTarget, currentPos);
        forwardDir.y = 0; // Horizonte nivelado sin cabeceos verticales

        if (forwardDir.lengthSq() > 0.001) {
          targetYaw = Math.atan2(forwardDir.x, forwardDir.z) * (180 / Math.PI);
          targetPitch = 0;
        }

        const pct = Math.min(100, Math.round((clampedDist / totalPathLength) * 100));
        if (pct !== lastReportedPct) {
          lastReportedPct = pct;
          setProgresoRecorrido(pct);
        }

        // Comprobar llegada al destino
        if (currentDistance >= totalPathLength) {
          isNavigating = false;
          setNavegando(false);
          setProgresoRecorrido(100);

          // La cámara permanece en el POI más cercano sobre el camino exterior
          const finalPos = activePath[activePath.length - 1];
          camera.position.set(finalPos.x, finalPos.y, finalPos.z);

          // Secuencia de llegada idéntica a Unity ArrivalSequence():
          // Rotación suave con Mathf.SmoothStep durante 1.0s para encarar el Empty / Lugar
          let destYaw = currentYaw;
          let destPitch = 0;
          const dest = destinoActivoRef.current;
          if (dest) {
            let destPos = dest;
            if (dest.meshName && sceneModel) {
              const obj = sceneModel.getObjectByName(dest.meshName);
              if (obj) {
                const wp = new THREE.Vector3();
                obj.getWorldPosition(wp);
                destPos = { x: wp.x, y: wp.y, z: wp.z };
              }
            }
            if (dest.yaw !== undefined) {
              destYaw = dest.yaw;
              destPitch = dest.pitch || 0;
            } else if (destPos.x !== undefined && destPos.z !== undefined) {
              const dx = destPos.x - finalPos.x;
              const dz = destPos.z - finalPos.z;
              destYaw = Math.atan2(dx, dz) * (180 / Math.PI);
              destPitch = 0;
            }
          }

          isArriving = true;
          arrivalStartTime = performance.now();
          arrivalStartYaw = currentYaw;
          arrivalStartPitch = currentPitch;
          arrivalTargetYaw = destYaw;
          arrivalTargetPitch = destPitch;
        }
      }

      // C. Secuencia de llegada cinematográfica (idéntica a ArrivalSequence en Unity con Mathf.SmoothStep)
      if (isArriving) {
        const elapsed = (performance.now() - arrivalStartTime) / 1000.0;
        const tClamped = Math.min(1.0, Math.max(0.0, elapsed / arrivalDuration));
        const smoothT = tClamped * tClamped * (3.0 - 2.0 * tClamped);

        let dYaw = (arrivalTargetYaw - arrivalStartYaw) % 360;
        if (dYaw > 180) dYaw -= 360;
        if (dYaw < -180) dYaw += 360;

        currentYaw = arrivalStartYaw + dYaw * smoothT;
        targetYaw = currentYaw;

        currentPitch = arrivalStartPitch + (arrivalTargetPitch - arrivalStartPitch) * smoothT;
        targetPitch = currentPitch;

        if (tClamped >= 1.0) {
          isArriving = false;
          setHaLlegado(true);
          arrowGroup.visible = true;
          actualizarSiguienteNodoFlecha(true);

          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('UniMapLlegada', {
                detail: {
                  destination: destinoActivoRef.current?.displayName || destinoActivoRef.current?.nombre || 'Destino'
                }
              })
            );
          }
        }
      }

      actualizarOrientacionCamara(delta);

      // D. Emisión continua de telemetría de la cámara cada 100ms (idéntico a UniMapTelemetriaCamara en Unity)
      const nowMs = performance.now();
      if (nowMs - lastTelemetryTime >= 100) {
        lastTelemetryTime = nowMs;
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          const modo = isNavigating ? 'Navigating' : (isArriving ? 'Arriving' : 'Manual');
          const telemData = {
            x: parseFloat(camera.position.x.toFixed(2)),
            y: parseFloat(camera.position.y.toFixed(2)),
            z: parseFloat(camera.position.z.toFixed(2)),
            rot: parseFloat(currentYaw.toFixed(1)),
            pitch: parseFloat(currentPitch.toFixed(1)),
            fov: parseFloat(camera.fov.toFixed(1)),
            modo
          };
          window.dispatchEvent(new CustomEvent('UniMapTelemetriaCamara', { detail: telemData }));
          if (typeof window.dispatchReactUnityEvent === 'function') {
            window.dispatchReactUnityEvent('EnviarTelemetriaCamara', JSON.stringify(telemData));
          }
        }
      }

      // Animación del Pin 3D
      if (pinMesh && ringMesh) {
        const time = Date.now() * 0.003;
        pinMesh.position.y = basePosY + Math.sin(time) * 0.35;
        const scaleRing = 1 + Math.sin(time * 1.5) * 0.2;
        ringMesh.scale.set(scaleRing, scaleRing, 1);
      }

      if (useUltraQuality && composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };
    animate();

    const handleResize = () => {
      if (!currentMount) return;
      const newW = currentMount.clientWidth;
      const newH = currentMount.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
      const curMaxDPR = esMovil ? Math.min(window.devicePixelRatio || 1, 1.0) : Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(curMaxDPR);
      if (composer) {
        composer.setSize(newW, newH);
      }
    };
    window.addEventListener('resize', handleResize);

    // Handlers para eventos del puente global estilo Unity WebGL
    const handleUniMapMoverA = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const coords = typeof detail === 'string' ? JSON.parse(detail) : detail;
      if (coords && coords.x !== undefined && coords.z !== undefined) {
        if (orientarDestinoRef.current) orientarDestinoRef.current(coords);
      }
    };

    const handleUniMapIrALugar = (e) => {
      const detail = e.detail;
      if (!detail) return;
      const lugar = typeof detail === 'string' ? detail : (detail.nombre || detail.lugar || detail.id);
      if (lugar && orientarDestinoRef.current) {
        orientarDestinoRef.current(lugar);
      }
    };

    const handleUniMapSolicitarCatalogo = () => {
      const cat = poiLibraryService.getCatalogJSON();
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('UniMapCatalogo', { detail: cat }));
        if (typeof window.dispatchReactUnityEvent === 'function') {
          window.dispatchReactUnityEvent('EnviarCatalogo', cat);
        }
      }
    };

    const handleTemporadaChanged = (e) => {
      const detail = e.detail;
      if (detail && typeof detail.activa === 'boolean') {
        temporadaRef.current = detail.activa;
        setTemporadaNavidena(detail.activa);
        if (snowPoints) {
          snowPoints.visible = detail.activa;
        }
      }
    };

    window.addEventListener('UniMapMoverA', handleUniMapMoverA);
    window.addEventListener('UniMapIrALugar', handleUniMapIrALugar);
    window.addEventListener('UniMapSolicitarCatalogo', handleUniMapSolicitarCatalogo);
    window.addEventListener('unimap_temporada_changed', handleTemporadaChanged);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('unimap_theme_changed', handleThemeChange);
      window.removeEventListener('UniMapMoverA', handleUniMapMoverA);
      window.removeEventListener('UniMapIrALugar', handleUniMapIrALugar);
      window.removeEventListener('UniMapSolicitarCatalogo', handleUniMapSolicitarCatalogo);
      window.removeEventListener('unimap_temporada_changed', handleTemporadaChanged);
      cancelAnimationFrame(animationFrameId);
      aplicarAjusteEnEscenaRef.current = null;
      aplicarAjustesMasivosRef.current = null;
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      if (composer) composer.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      snowTexture.dispose();
    };
  }, []);

  // Manejar el toggle de la red de grafos
  const handleToggleRedGrafos = () => {
    const nuevoEstado = !mostrarRedGrafos;
    setMostrarRedGrafos(nuevoEstado);
    cambiarAjuste('mostrarGizmosGrafos', nuevoEstado);
  };

  // Manejar el toggle de calidad gráfica (Ultra Fotorrealista / Rendimiento)
  const handleToggleCalidad = () => {
    const nuevo = !calidadUltra;
    cambiarAjuste('modoUltra', nuevo);
  };

  return (
    <div className="visorCampusWrapper" ref={mountRef}>
      {/* Indicador de estado y orientación 360° */}
      <div className="badgePanoramico">
        <Eye size={15} color="#38bdf8" />
        <span>
          {navegando
            ? `Recorriendo (${progresoRecorrido}%)`
            : dandoPaso
            ? `Avanzando hacia ${nodoActualCamara}...`
            : haLlegado
            ? '¡Llegaste a tu destino! (Clic en flecha para seguir)'
            : `Paso a Paso • ${nodoActualCamara || 'POIs.4477'} • Clic en flecha para avanzar`}
        </span>
      </div>

      {/* Barra vertical de herramientas y controles al lado */}
      <div className="botonesControl3D">
        {accionesExtra}
        {accionesExtra && <div className="separadorControles3D" />}
        <button
          type="button"
          className={`btn3DControl ${mostrarConfiguracion ? 'activoConfig' : ''}`}
          onClick={() => setMostrarConfiguracion((prev) => !prev)}
          title="Configuración Visual y Gráfica del Campus 3D (Iluminación, Sombras, Atmósfera, Rendimiento)"
        >
          <SlidersHorizontal size={17} />
        </button>
        <button
          type="button"
          className={`btn3DControl ${calidadUltra ? 'activoGizmo' : ''}`}
          onClick={handleToggleCalidad}
          title={
            calidadUltra
              ? 'Modo Gráfico: Ultra Fotorrealista (Cycles / Ambient Occlusion / Bloom activo)'
              : 'Modo Gráfico: Rendimiento (EEVEE PBR rápido)'
          }
        >
          <Sparkles size={17} />
        </button>
        <button
          type="button"
          className="btn3DControl"
          onClick={() => recentrarRef.current && recentrarRef.current()}
          title="Reorientar / Volver a la entrada"
        >
          <RotateCcw size={17} />
        </button>
      </div>

      {/* PANEL DE CONTROL DE RECORRIDO (Aparece automáticamente al buscar o presionar un botón) */}
      {rutaCalculada && (
        <div className="panelRecorridoCamara">
          <div className="infoRutaHeader">
            <Footprints size={18} color="#38bdf8" />
            <div className="textosRuta">
              <span className="distanciaRuta">
                {navegando
                  ? `Viajando hacia ${destinoActivo?.displayName || destinoActivo?.nombre}...`
                  : haLlegado
                  ? `Destino alcanzado: ${destinoActivo?.displayName || destinoActivo?.nombre}`
                  : `Ruta de ${rutaCalculada.distanciaMetros}m (${rutaCalculada.puntos.length} POIs)`}
              </span>
              <span className="detallesRuta">
                {navegando
                  ? `${progresoRecorrido}% completado (${rutaCalculada.distanciaMetros}m totales)`
                  : 'Red de caminos calibrada a 3.8m'}
              </span>
            </div>
          </div>

          <div className="accionesRecorrido">
            {navegando && (
              <>
                <button
                  type="button"
                  className="btnAccionRuta btnPausarRuta"
                  onClick={() => pausarRecorridoRef.current && pausarRecorridoRef.current()}
                  title={pausado ? 'Reanudar avance' : 'Pausar avance'}
                >
                  {pausado ? <Play size={15} /> : <Pause size={15} />}
                  <span>{pausado ? 'Reanudar' : 'Pausar'}</span>
                </button>
                <button
                  type="button"
                  className="btnAccionRuta btnSaltarRuta"
                  onClick={() => saltarDestinoRef.current && saltarDestinoRef.current()}
                  title="Saltar directamente al destino"
                >
                  <Zap size={15} />
                  <span>Llegar Ya</span>
                </button>
                <button
                  type="button"
                  className="btnAccionRuta btnDetenerRuta"
                  onClick={() => detenerRecorridoRef.current && detenerRecorridoRef.current()}
                  title="Detener recorrido y quedarse en el POI actual"
                >
                  <Square size={14} />
                  <span>Detener</span>
                </button>
              </>
            )}

            {haLlegado && (
              <div className="avisoLlegada">
                <CheckCircle2 size={16} color="#22c55e" />
                <span>¡Has llegado! Usa el ratón o pantalla para mirar en 360°</span>
              </div>
            )}
          </div>

          {/* Barra de progreso animada del recorrido */}
          {(navegando || haLlegado) && (
            <div className="barraProgresoTrack">
              <div
                className="barraProgresoFill"
                style={{ width: `${progresoRecorrido}%` }}
              />
            </div>
          )}
        </div>
      )}

      {cargando && (
        <div className="loadingOverlay3D">
          <div className="loadingSpinnerBox">
            <Loader2 className="animate-spin" size={36} color={desdeCache ? '#10b981' : '#38bdf8'} />
            <div className="loadingTextGroup">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {desdeCache && <Zap size={18} color="#10b981" />}
                {desdeCache ? 'Campus 3D (Caché Local)' : 'Cargando Campus 3D...'}
              </h3>
              <p>{subtituloCarga}</p>
              {progresoCarga > 0 && <span className="pctLoading">{progresoCarga}%</span>}
            </div>
          </div>
        </div>
      )}

      {errorCarga && (
        <div className="errorOverlay3D">
          <Compass size={32} color="#ef4444" />
          <p>{errorCarga}</p>
        </div>
      )}

      {/* Modal / Panel Flotante de Configuración Gráfica y Visual del Campus 3D */}
      {mostrarConfiguracion && (
        <PanelConfiguracionMapa
          ajustes={ajustesGraficos}
          onCambiarAjuste={cambiarAjuste}
          onAplicarPreset={aplicarPreset}
          onRestablecer={restablecerAjustes}
          onCerrar={() => setMostrarConfiguracion(false)}
        />
      )}
    </div>
  );
}
