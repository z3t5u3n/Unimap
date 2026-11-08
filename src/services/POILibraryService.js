import * as THREE from 'three';
import { EDIFICIOS_PRINCIPALES, LUGARES_RECORRIBLES } from '../data/catalogoCampus';

/**
 * POIPlace: Representa un Punto de Interés / Empty de destino en el mapa.
 * Adaptación fiel de POIPlace.cs de Unity.
 */
export class POIPlace {
  constructor(name, worldPosition = null, targetObject = null) {
    this.rawName = name || '';
    this.displayName = POIPlace.cleanEmptyPrefix(this.rawName);
    this.targetObject = targetObject;
    this.customOffset = new THREE.Vector3(0, 0, 0);
    this.nearestNodeId = -1;

    // Detectar edificio y categoría según nombre y jerarquía
    this.building = POIPlace.detectBuilding(this.rawName, targetObject);
    this.category = POIPlace.categorizeName(this.displayName);

    // Posición mundial (x, y, z)
    if (worldPosition) {
      this.x = worldPosition.x;
      this.y = worldPosition.y;
      this.z = worldPosition.z;
    } else {
      this.x = 0;
      this.y = 1.2;
      this.z = 0;
    }
  }

  /**
   * Elimina el prefijo 'Empty_', 'Empty-', 'Empty ' o 'View_' para dejar el nombre limpio del lugar.
   * Idéntico a POIPlace.CleanEmptyPrefix() en Unity.
   */
  static cleanEmptyPrefix(name) {
    if (!name || typeof name !== 'string') return '';
    let cleaned = name.trim();

    const prefixes = [
      'Empty_',
      'Empty-',
      'Empty ',
      'Empty',
      'View_',
      'View-',
      'View ',
      'View'
    ];

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
        break;
      }
    }

    return cleaned;
  }

  /**
   * Normaliza una cadena de texto eliminando tildes, diacríticos y puntuación para búsqueda tolerante.
   */
  static normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[-_.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detecta automáticamente el edificio principal al que pertenece un lugar
   * analizando el nombre del Empty y la jerarquía de padres en el modelo 3D.
   * Idéntico a POIPlace.DetectBuilding() en Unity.
   */
  static detectBuilding(name, targetObject = null) {
    // 1. Revisar padres en la jerarquía hacia arriba hasta el modelo raíz
    let curr = targetObject ? targetObject.parent : null;
    while (curr && curr.name && !curr.name.toLowerCase().includes('unimap')) {
      const match = POIPlace.matchBuildingKeywords(curr.name);
      if (match) return match;
      curr = curr.parent;
    }

    // 2. Revisar el propio nombre del Empty
    const directMatch = POIPlace.matchBuildingKeywords(name);
    if (directMatch) return directMatch;

    return 'General';
  }

  static matchBuildingKeywords(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    if (
      lower.includes('bloque-e') ||
      lower.includes('bloque e') ||
      lower.includes('-e ') ||
      lower.includes('-e.') ||
      lower.endsWith('-e') ||
      lower.includes('salon-e') ||
      lower.includes('salón-e')
    ) {
      return 'Bloque-E';
    }

    if (
      lower.includes('bloque-d') ||
      lower.includes('bloque d') ||
      lower.includes('-d ') ||
      lower.includes('-d.') ||
      lower.endsWith('-d') ||
      lower.includes('salon-d') ||
      lower.includes('salón-d')
    ) {
      return 'Bloque-D';
    }

    if (lower.includes('cafeteria') || lower.includes('cafetería')) {
      return 'Cafeteria Nueva';
    }

    if (lower.includes('coliseo')) {
      return 'Coliseo';
    }

    if (lower.includes('gym') || lower.includes('gimnasio')) {
      return 'GYM';
    }

    if (
      lower.includes('bloque-a') ||
      lower.includes('bloque a') ||
      lower.includes('-a ') ||
      lower.includes('-a.') ||
      lower.endsWith('-a') ||
      lower.includes('salon-a') ||
      lower.includes('salón-a') ||
      lower.includes('capilla')
    ) {
      return 'Bloque-A';
    }

    if (
      lower.includes('bloque-b') ||
      lower.includes('bloque b') ||
      lower.includes('-b ') ||
      lower.includes('-b.') ||
      lower.endsWith('-b') ||
      lower.includes('salon-b') ||
      lower.includes('salón-b')
    ) {
      return 'Bloque-B';
    }

    if (
      lower.includes('bloque-c') ||
      lower.includes('bloque c') ||
      lower.includes('-c ') ||
      lower.includes('-c.') ||
      lower.endsWith('-c') ||
      lower.includes('salon-c') ||
      lower.includes('salón-c') ||
      lower.includes('biblioteca')
    ) {
      return 'Bloque-C';
    }

    return null;
  }

  /**
   * Categoriza un lugar según su nombre.
   * Idéntico a POIPlace.CategorizeName() en Unity.
   */
  static categorizeName(name) {
    if (!name || typeof name !== 'string') return 'General';
    const lower = name.toLowerCase();

    if (lower.includes('capilla')) return 'Espacios Comunes';
    if (lower.includes('salon') || lower.includes('aula') || lower.includes('salón')) return 'Aulas';
    if (lower.includes('baño') || lower.includes('bano') || lower.includes('sanitario')) return 'Servicios Sanitarios';
    if (lower.includes('cafeteria') || lower.includes('cafetería')) return 'Cafetería';
    if (lower.includes('biblioteca')) return 'Biblioteca';
    if (
      lower.includes('administrativo') ||
      lower.includes('rector') ||
      lower.includes('registro') ||
      lower.includes('decanatura') ||
      lower.includes('bienestar')
    ) {
      return 'Administración';
    }
    if (lower.includes('porteria') || lower.includes('portería') || lower.includes('acceso')) return 'Accesos';
    if (lower.includes('auditorio')) return 'Auditorios';
    if (lower.includes('laboratorio') || lower.includes('lab')) return 'Laboratorios';
    if (lower.includes('enfermeria') || lower.includes('enfermería')) return 'Salud';
    if (lower.includes('cancha') || lower.includes('deporte') || lower.includes('gym')) return 'Deportes';

    return 'General';
  }

  /**
   * Comprueba si este POI coincide con una búsqueda exacta, limpia o parcial tolerante.
   * Idéntico a POIPlace.Matches() en Unity.
   */
  matches(query) {
    if (!query || typeof query !== 'string') return false;
    const q = query.trim().toLowerCase();

    // 1. Coincidencia exacta insensible a mayúsculas
    if (this.displayName.toLowerCase() === q || this.rawName.toLowerCase() === q) return true;

    // 2. Coincidencia limpia sin prefijo Empty_
    const cleanQ = POIPlace.cleanEmptyPrefix(query).toLowerCase();
    if (this.displayName.toLowerCase() === cleanQ || POIPlace.cleanEmptyPrefix(this.rawName).toLowerCase() === cleanQ) {
      return true;
    }

    // 3. Normalización sin tildes ni puntuación
    const normQ = POIPlace.normalizeText(cleanQ);
    const normDisplay = POIPlace.normalizeText(this.displayName);
    const normRaw = POIPlace.normalizeText(this.rawName);

    if (normDisplay.includes(normQ) || normQ.includes(normDisplay)) return true;
    if (normRaw.includes(normQ) || normQ.includes(normRaw)) return true;

    return false;
  }
}

/**
 * POILibraryService: Catálogo y Gestor de Lugares / Empties de destino.
 * Adaptación fiel de POILibrary.cs de Unity.
 */
export class POILibraryService {
  constructor() {
    this.mainBuildings = [
      'Bloque-A',
      'Bloque-B',
      'Bloque-C',
      'Bloque-D',
      'Bloque-E',
      'Cafeteria Nueva',
      'Coliseo',
      'GYM'
    ];

    this.places = [];
    this.sceneModel = null;
    this.graphService = null;

    // Inicializar con el catálogo base de campus precalibrado
    this.initializeFromStaticCatalog();
  }

  /**
   * Inicializa la biblioteca con el catálogo precargado para disponibilidad instantánea en UI
   */
  initializeFromStaticCatalog() {
    const list = [];
    for (const item of LUGARES_RECORRIBLES) {
      const place = new POIPlace(item.meshName || item.displayName, {
        x: item.x,
        y: item.y !== undefined ? item.y : 1.2,
        z: item.z
      });
      place.displayName = item.displayName || place.displayName;
      if (item.categoria) place.category = item.categoria;
      if (item.bloque) place.building = item.bloque;
      list.push(place);
    }
    this.places = list;
  }

  /**
   * Escanea recursivamente el modelo 3D (Unimap.gltf) en busca de todos los Empties (sin mallas)
   * que comiencen por 'Empty' o 'View' (excluyendo 'POIs*') y actualiza la biblioteca.
   * Idéntico a POILibrary.ScanAndRegisterPlaces() en Unity.
   */
  scanAndRegisterPlaces(sceneModel, graphService = null) {
    if (!sceneModel) return;

    this.sceneModel = sceneModel;
    if (graphService) this.graphService = graphService;

    const scannedPlaces = [];
    const wp = new THREE.Vector3();

    sceneModel.traverse((child) => {
      const name = child.name || '';

      // Ignorar nodos de la red de caminos POIs.*
      if (name.toLowerCase().startsWith('pois')) {
        return;
      }

      // Comprobar que sea un objeto EMPTY (no malla 3D de renderizado)
      const hasMesh = child.isMesh || child.isSkinnedMesh;
      if (!hasMesh) {
        // Detectar si inicia con Empty o View
        const isTargetEmpty =
          name.toLowerCase().startsWith('empty') ||
          name.toLowerCase().startsWith('view');

        if (isTargetEmpty) {
          child.getWorldPosition(wp);
          const place = new POIPlace(name, wp, child);

          // Si detecta un edificio válido, asegurar que esté registrado
          if (place.building && place.building !== 'General' && !this.mainBuildings.includes(place.building)) {
            this.mainBuildings.push(place.building);
          }

          scannedPlaces.push(place);
        }
      }
    });

    if (scannedPlaces.length > 0) {
      // Ordenar alfabéticamente por nombre legible limpio (displayName) como en Unity
      scannedPlaces.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' })
      );

      this.places = scannedPlaces;
    }

    if (this.graphService) {
      this.linkPlacesToGraphNodes(this.graphService);
    }

    // Emitir evento UniMapCatalogo en window (idéntico a ReactBridge.jslib en Unity)
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const jsonStr = this.getCatalogJSON();
        window.dispatchEvent(new CustomEvent('UniMapCatalogo', { detail: jsonStr }));
      } catch (e) {
        console.warn('Aviso emitiendo UniMapCatalogo:', e);
      }
    }

    console.log(
      `%c[POILibrary] Escaneo completado: ${this.places.length} lugares catalogados con nombres limpios en ${this.mainBuildings.length} edificios principales.`,
      'color: #4CAF50; font-weight: bold;'
    );
  }

  /**
   * Asocia cada lugar con el nodo del grafo más cercano.
   * Idéntico a POILibrary.LinkPlacesToGraphNodes() en Unity.
   */
  linkPlacesToGraphNodes(graphService) {
    if (!graphService || graphService.nodeCount === 0) return;

    for (let i = 0; i < this.places.length; i++) {
      const p = this.places[i];
      const nearest = graphService.findNearestNode(p.x, p.y, p.z);
      if (nearest) {
        p.nearestNodeId = nearest.id;
      }
    }
  }

  /**
   * Busca un POI por coincidencia exacta, limpia o parcial.
   * Si no está en la biblioteca pre-escaneada, busca dinámicamente en la escena activa.
   * Idéntico a POILibrary.FindPOI() en Unity.
   */
  findPOI(query) {
    if (!query || typeof query !== 'string') return null;
    const trimmed = query.trim();

    // 1. Búsqueda exacta por displayName o rawName
    for (let i = 0; i < this.places.length; i++) {
      const p = this.places[i];
      if (
        p.displayName.toLowerCase() === trimmed.toLowerCase() ||
        p.rawName.toLowerCase() === trimmed.toLowerCase()
      ) {
        return p;
      }
    }

    // 2. Búsqueda por coincidencia parcial / flexible (ignora mayúsculas, prefijos, tildes)
    for (let i = 0; i < this.places.length; i++) {
      if (this.places[i].matches(trimmed)) {
        return this.places[i];
      }
    }

    // 3. Fallback dinámico: buscar directamente en el modelo 3D activo
    if (this.sceneModel) {
      let directFound = null;
      const wp = new THREE.Vector3();

      this.sceneModel.traverse((child) => {
        if (directFound) return;
        const name = child.name || '';
        const cleanName = POIPlace.cleanEmptyPrefix(name);

        if (
          name.toLowerCase() === trimmed.toLowerCase() ||
          cleanName.toLowerCase() === trimmed.toLowerCase() ||
          name.toLowerCase().includes(trimmed.toLowerCase())
        ) {
          if (!child.isMesh) {
            directFound = child;
          }
        }
      });

      if (directFound) {
        directFound.getWorldPosition(wp);
        const dynamicPlace = new POIPlace(directFound.name, wp, directFound);
        if (this.graphService) {
          const nearest = this.graphService.findNearestNode(wp.x, wp.y, wp.z);
          if (nearest) dynamicPlace.nearestNodeId = nearest.id;
        }
        this.places.push(dynamicPlace);
        return dynamicPlace;
      }
    }

    return null;
  }

  /**
   * Devuelve la lista de edificios principales
   */
  getMainBuildingsArray() {
    return [...this.mainBuildings];
  }

  /**
   * Devuelve un array con los nombres legibles limpios de todos los lugares registrados
   */
  getPlaceDisplayNames() {
    return this.places.map((p) => p.displayName);
  }

  /**
   * Devuelve los lugares que pertenecen a un edificio principal en específico
   */
  getPlacesForBuilding(buildingName) {
    if (!buildingName) return [];
    return this.places
      .filter((p) => p.building.toLowerCase() === buildingName.toLowerCase())
      .map((p) => p.displayName);
  }

  /**
   * Busca lugares en la biblioteca que coincidan con la consulta (búsqueda tolerante).
   * Idéntico a la búsqueda de POILibrary en Unity.
   */
  search(query) {
    if (!query || typeof query !== 'string') return [];
    const trimmed = query.trim();
    if (!trimmed) return [];

    const results = [];
    for (let i = 0; i < this.places.length; i++) {
      const p = this.places[i];
      if (p.matches(trimmed)) {
        results.push(p);
      }
    }
    return results;
  }

  /**
   * Devuelve el JSON estructurado con los dos arrays idéntico al emitido en Unity:
   * {
   *   "edificiosPrincipales": ["Bloque-A", "Bloque-B", ...],
   *   "lugares": [
   *     { "name": "Salon-E8 p3", "building": "Bloque-E", "category": "Aulas", "rawName": "..." }
   *   ]
   * }
   */
  getCatalogJSON() {
    return JSON.stringify({
      edificiosPrincipales: this.mainBuildings,
      lugares: this.places.map((p) => ({
        name: p.displayName,
        building: p.building,
        category: p.category,
        rawName: p.rawName,
        x: p.x,
        y: p.y,
        z: p.z,
        nearestNodeId: p.nearestNodeId
      }))
    });
  }
}

// Instancia única (Singleton) para toda la aplicación
export const poiLibraryService = new POILibraryService();
export default poiLibraryService;
