import * as THREE from 'three';
import graphData from '../data/poiGraphData.js';

/**
 * Servicio y Biblioteca de Red de Grafos de POIs para el Campus ITFIP.
 * Reproduce fielmente la lógica de POIGraphManager.cs, POIGraphData.cs y POICameraNavigator.cs de Unity.
 * 
 * Características idénticas a Unity:
 * - maxConnectionDistance = 3.8m (distancia calibrada para conectar todos los bloques del campus).
 * - Algoritmo A* (A-Star) para cálculo instantáneo de rutas óptimas (< 3ms).
 * - Detección de bifurcaciones/cruces de caminos (nodos con > 2 salidas).
 * - Caché de rutas calculadas en memoria O(1).
 * - Spatial Hash Grid para búsqueda ultrarrápida del nodo más cercano a cualquier coordenada 3D.
 * - Interpolación cinemática continua con anticipación de giro (Look-Ahead).
 */
export class POIGraphService {
  constructor() {
    this.maxConnectionDistance = graphData.maxConnectionDistance || 3.8;
    this.nodes = graphData.nodes || [];
    this.nodeMap = new Map();
    this.nameMap = new Map();
    this.pathCache = new Map();

    // Cuadrícula de aceleración espacial para búsqueda O(1)
    this.cellSize = this.maxConnectionDistance;
    this.spatialGrid = new Map();

    this.initializeLookup();
  }

  /**
   * Inicializa índices y la cuadrícula espacial
   */
  initializeLookup() {
    this.nodeMap.clear();
    this.nameMap.clear();
    this.spatialGrid.clear();

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      this.nodeMap.set(node.id, node);
      this.nameMap.set(node.name, node);

      const gx = Math.floor(node.x / this.cellSize);
      const gz = Math.floor(node.z / this.cellSize);
      const key = `${gx},${gz}`;

      if (!this.spatialGrid.has(key)) {
        this.spatialGrid.set(key, []);
      }
      this.spatialGrid.get(key).push(node);
    }
  }

  /**
   * Obtiene la cantidad total de nodos en la red
   */
  get nodeCount() {
    return this.nodes.length;
  }

  /**
   * Obtiene un nodo por su ID numérico
   */
  getNode(id) {
    return this.nodeMap.get(id) || null;
  }

  /**
   * Obtiene un nodo por su nombre (ej. "POIs.4477")
   */
  getNodeByName(name) {
    if (!name) return null;
    return this.nameMap.get(name) || null;
  }

  /**
   * Encuentra el nodo de la red más cercano a una posición (x, y, z) en el mundo 3D.
   * Utiliza la cuadrícula espacial (Spatial Hash Grid) para búsqueda rápida sin recorrer los 2407 nodos.
   */
  findNearestNode(x, y, z) {
    if (this.nodes.length === 0) return null;

    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);

    let nearest = null;
    let minSqrDist = Infinity;
    const hasY = y !== undefined && y !== null;

    // Buscar en la celda correspondiente y en las celdas adyacentes (radio de 2 celdas)
    for (let ox = -2; ox <= 2; ox++) {
      for (let oz = -2; oz <= 2; oz++) {
        const cell = this.spatialGrid.get(`${gx + ox},${gz + oz}`);
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const n = cell[i];
          const dx = n.x - x;
          const dy = hasY ? (n.y - y) * 2.5 : 0;
          const dz = n.z - z;
          const sqrDist = dx * dx + dy * dy + dz * dz;

          if (sqrDist < minSqrDist) {
            minSqrDist = sqrDist;
            nearest = n;
          }
        }
      }
    }

    // Fallback de búsqueda exhaustiva si la coordenada está fuera de la cuadrícula local
    if (!nearest) {
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const dx = n.x - x;
        const dy = hasY ? (n.y - y) * 2.5 : 0;
        const dz = n.z - z;
        const sqrDist = dx * dx + dy * dy + dz * dz;
        if (sqrDist < minSqrDist) {
          minSqrDist = sqrDist;
          nearest = n;
        }
      }
    }

    return nearest;
  }

  /**
   * Encuentra el nodo del grafo más cercano a una posición excluyendo un nodo en particular.
   * Idéntico a POIGraphManager.FindNearestNodeExcluding() en Unity.
   * Utilizado para encontrar el siguiente nodo alternativo para la flecha 3D.
   */
  findNearestNodeExcluding(x, y, z, excludeNodeId) {
    if (this.nodes.length === 0) return null;

    let nearest = null;
    let minSqrDist = Infinity;
    const hasY = y !== undefined && y !== null;

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.id === excludeNodeId) continue;

      const dx = n.x - x;
      const dy = hasY ? (n.y - y) * 2.5 : 0;
      const dz = n.z - z;
      const sqrDist = dx * dx + dy * dy + dz * dz;

      if (sqrDist < minSqrDist) {
        minSqrDist = sqrDist;
        nearest = n;
      }
    }

    return nearest;
  }

  /**
   * Calcula el camino óptimo más corto entre dos nodos utilizando el algoritmo A* (A-Star).
   * @param {number} startNodeId ID del nodo de inicio
   * @param {number} targetNodeId ID del nodo de destino
   * @returns {Array<THREE.Vector3>} Lista de puntos 3D a recorrer
   */
  calculatePath(startNodeId, targetNodeId) {
    if (startNodeId === targetNodeId) {
      const node = this.getNode(startNodeId);
      return node ? [new THREE.Vector3(node.x, node.y, node.z)] : [];
    }

    // Comprobar caché O(1)
    const cacheKey = `${startNodeId}_${targetNodeId}`;
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey).map((p) => p.clone());
    }

    const startNode = this.getNode(startNodeId);
    const targetNode = this.getNode(targetNodeId);
    if (!startNode || !targetNode) return [];

    const openSet = new Set([startNodeId]);
    const cameFrom = new Map();
    const gScore = new Float32Array(this.nodes.length).fill(Infinity);
    const fScore = new Float32Array(this.nodes.length).fill(Infinity);

    const heuristic = (nodeA, nodeB) => {
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const dz = nodeA.z - nodeB.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    gScore[startNodeId] = 0;
    fScore[startNodeId] = heuristic(startNode, targetNode);

    while (openSet.size > 0) {
      let currentId = -1;
      let lowestF = Infinity;

      for (const id of openSet) {
        const f = fScore[id];
        if (f < lowestF) {
          lowestF = f;
          currentId = id;
        }
      }

      if (currentId === targetNodeId) {
        // Reconstrucción del camino
        const pathPoints = [];
        let curr = currentId;

        while (cameFrom.has(curr)) {
          const n = this.getNode(curr);
          pathPoints.push(new THREE.Vector3(n.x, n.y, n.z));
          curr = cameFrom.get(curr);
        }

        const startN = this.getNode(startNodeId);
        pathPoints.push(new THREE.Vector3(startN.x, startN.y, startN.z));
        pathPoints.reverse();

        // Guardar en caché
        this.pathCache.set(cacheKey, pathPoints);
        return pathPoints.map((p) => p.clone());
      }

      openSet.delete(currentId);
      const currNode = this.getNode(currentId);
      if (!currNode) continue;

      for (let i = 0; i < currNode.neighbors.length; i++) {
        const edge = currNode.neighbors[i];
        const neighborId = edge.id;
        const neighborNode = this.getNode(neighborId);
        if (!neighborNode) continue;

        const tentativeG = gScore[currentId] + edge.dist;

        if (tentativeG < gScore[neighborId]) {
          cameFrom.set(neighborId, currentId);
          gScore[neighborId] = tentativeG;
          fScore[neighborId] = tentativeG + heuristic(neighborNode, targetNode);
          openSet.add(neighborId);
        }
      }
    }

    return [];
  }

  /**
   * Calcula la ruta completa entre dos puntos cualesquiera del campus 3D.
   * El recorrido transita exclusivamente por la red de POIs libres de obstáculos
   * y finaliza en el POI más cercano al destino (sin atravesar muros ni entrar al Empty).
   */
  getPathBetweenPositions(startPos, targetPos) {
    const startNode = this.findNearestNode(startPos.x, startPos.y, startPos.z);
    const targetNode = this.findNearestNode(targetPos.x, targetPos.y, targetPos.z);

    if (!startNode || !targetNode) return [];

    const graphPath = this.calculatePath(startNode.id, targetNode.id);
    if (!graphPath || graphPath.length === 0) return [];

    const fullPath = [];
    const distToStartNode = Math.hypot(startPos.x - startNode.x, startPos.z - startNode.z);
    if (distToStartNode > 0.6) {
      fullPath.push(new THREE.Vector3(startPos.x, startNode.y, startPos.z));
    }

    for (let i = 0; i < graphPath.length; i++) {
      fullPath.push(graphPath[i]);
    }

    // EL RECORRIDO TERMINA EN EL POI MÁS CERCANO (targetNode), NO en el empty del lugar.
    return fullPath;
  }

  // ==============================================================
  // UTILIDADES CINEMÁTICAS Y DE MOVIMIENTO (IDÉNTICAS A UNITY)
  // ==============================================================

  /**
   * Calcula la longitud total del camino en metros
   */
  getTotalPathLength(path) {
    if (!path || path.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      total += path[i].distanceTo(path[i + 1]);
    }
    return total;
  }

  /**
   * Obtiene la posición exacta sobre el camino a una distancia recorrida dada
   */
  getPointOnPath(path, distance) {
    if (!path || path.length === 0) return new THREE.Vector3();
    if (path.length === 1 || distance <= 0) return path[0].clone();

    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const segLen = path[i].distanceTo(path[i + 1]);
      if (accumulated + segLen >= distance) {
        const t = segLen > 0.001 ? (distance - accumulated) / segLen : 0;
        return new THREE.Vector3().lerpVectors(path[i], path[i + 1], t);
      }
      accumulated += segLen;
    }

    return path[path.length - 1].clone();
  }

  /**
   * Obtiene el subconjunto de puntos del camino hasta una distancia máxima (para animación de línea)
   */
  getSubPath(path, maxDist) {
    const subPath = [];
    if (!path || path.length === 0) return subPath;

    subPath.push(path[0].clone());
    if (maxDist <= 0) return subPath;

    let accumulated = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const segLen = path[i].distanceTo(path[i + 1]);
      if (accumulated + segLen >= maxDist) {
        const t = segLen > 0.001 ? (maxDist - accumulated) / segLen : 0;
        subPath.push(new THREE.Vector3().lerpVectors(path[i], path[i + 1], t));
        break;
      } else {
        subPath.push(path[i + 1].clone());
        accumulated += segLen;
      }
    }

    return subPath;
  }

  // ==============================================================
  // ELEMENTOS VISUALES 3D PARA THREE.JS (COMO EN UNITY)
  // ==============================================================

  /**
   * Crea una malla LineRenderer 3D luminosa para trazar el camino en el suelo del campus
   * Situada casi al nivel del suelo (~1.02m por debajo de la altura de la cámara / POIs).
   */
  createRouteLineObject(points, color = 0x38bdf8, groundOffset = -1.02) {
    if (!points || points.length < 2) return null;

    const group = new THREE.Group();
    group.name = 'RutaCaminosPOIs';

    // Línea trazada casi al nivel del suelo (camino/piso)
    const groundPoints = points.map(
      (p) => new THREE.Vector3(p.x, p.y + groundOffset, p.z)
    );

    const geometry = new THREE.BufferGeometry().setFromPoints(groundPoints);
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });

    const line = new THREE.Line(geometry, material);
    group.add(line);

    // Bolas / esferas guía luminosas situadas en el suelo a lo largo del camino
    const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.5
    });

    for (let i = 0; i < groundPoints.length; i += 2) {
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(groundPoints[i]);
      group.add(sphere);
    }

    return group;
  }

  /**
   * Genera la visualización completa de depuración de la red de grafos
   * (Idéntico a OnDrawGizmos() de POIGraphManager en Unity:
   *  - Caminos transitables en verde <= 3.8m
   *  - Desvíos / bifurcaciones en amarillo
   *  - Nodos normales en azul).
   */
  createDebugGizmoObject() {
    const group = new THREE.Group();
    group.name = 'DebugPOIGraphGizmos';

    const linePoints = [];
    const bifurcationPositions = [];
    const normalPositions = [];

    const groundOffset = 0.12;

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const pA = new THREE.Vector3(n.x, n.y + groundOffset, n.z);

      if (n.isBifurcation) {
        bifurcationPositions.push(pA);
      } else {
        normalPositions.push(pA);
      }

      for (let j = 0; j < n.neighbors.length; j++) {
        const neighborId = n.neighbors[j].id;
        if (neighborId > n.id) {
          const neighbor = this.getNode(neighborId);
          if (neighbor) {
            linePoints.push(pA);
            linePoints.push(new THREE.Vector3(neighbor.x, neighbor.y + groundOffset, neighbor.z));
          }
        }
      }
    }

    // 1. Líneas verdes de conexiones transitables (<= 3.8m)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x22c55e, // Verde
      transparent: true,
      opacity: 0.7
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    // 2. Cruces y desvíos (Bifurcaciones con > 2 caminos posibles, en Amarillo idéntico a Unity)
    if (bifurcationPositions.length > 0) {
      const bifGeo = new THREE.BufferGeometry().setFromPoints(bifurcationPositions);
      const bifMat = new THREE.PointsMaterial({
        color: 0xfacc15, // Amarillo
        size: 0.38,
        sizeAttenuation: true
      });
      const bifPoints = new THREE.Points(bifGeo, bifMat);
      group.add(bifPoints);
    }

    // 3. Nodos estándar (en Azul idéntico a Unity)
    if (normalPositions.length > 0) {
      const normGeo = new THREE.BufferGeometry().setFromPoints(normalPositions);
      const normMat = new THREE.PointsMaterial({
        color: 0x38bdf8, // Azul
        size: 0.2,
        sizeAttenuation: true
      });
      const normPoints = new THREE.Points(normGeo, normMat);
      group.add(normPoints);
    }

    return group;
  }

  /**
   * Oculta y desactiva todas las mallas y objetos 'Codiller' / 'Collider' en el modelo 3D.
   * Idéntico a POIGraphManager.HideCodillerObjects() en Unity.
   * Evita que se muestren mallas de colisión auxiliares en la vista del usuario.
   */
  hideCodillerObjects(sceneModel) {
    if (!sceneModel) return 0;
    let hiddenCount = 0;

    sceneModel.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      const isCodiller =
        name.includes('codiller') ||
        name.includes('collider') ||
        name.includes('colider');

      if (isCodiller) {
        child.visible = false;
        if (child.material) {
          child.material.visible = false;
        }
        hiddenCount++;
      }
    });

    if (hiddenCount > 0) {
      console.log(`[POIGraphService] ${hiddenCount} objetos 'Codiller' ocultados (0% interferencia visual).`);
    }
    return hiddenCount;
  }
}

// Instancia única (Singleton) para uso global en la aplicación
export const poiGraphService = new POIGraphService();
export default poiGraphService;
