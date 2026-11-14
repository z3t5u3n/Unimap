// Catálogo oficial de Puntos de Inicio de Recorrido del Campus ITFIP
// Permite al usuario posicionarse directamente en puntos clave del campus y comenzar desde allí su recorrido guiado.

export const PUNTOS_INICIO = [
  {
    id: 'porteria_principal',
    nombre: 'Portería Principal (Entrada General)',
    nombreCorto: 'Portería Principal',
    poiName: 'POIs',
    icono: '🏫',
    bloque: 'Entrada General',
    descripcion: 'Acceso peatonal principal sobre la vía nacional',
    x: 176.023,
    y: 1.15,
    z: 245.385,
    nodeId: 0,
    yaw: -142,
    pitch: 0
  },
  {
    id: 'bloque_e',
    nombre: 'Bloque E',
    nombreCorto: 'Bloque E',
    poiName: 'POIs.2197',
    icono: '🏢',
    bloque: 'Bloque E',
    descripcion: 'Edificio de aulas y auditorio Bloque E',
    x: -39.758,
    y: 2.75,
    z: 21.859,
    nodeId: 1994,
    yaw: -137,
    pitch: 0
  },
  {
    id: 'entrada_buses',
    nombre: 'Portería o Entrada de los Buses',
    nombreCorto: 'Entrada Buses',
    poiName: 'POIs.2075',
    icono: '🚌',
    bloque: 'Zona de Buses',
    descripcion: 'Acceso y parqueadero de transporte institucional',
    x: -103.545,
    y: 1.15,
    z: 129.443,
    nodeId: 1872,
    yaw: 160,
    pitch: 0
  },
  {
    id: 'bloque_d',
    nombre: 'Bloque D',
    nombreCorto: 'Bloque D',
    poiName: 'POIs.193',
    icono: '🏢',
    bloque: 'Bloque D',
    descripcion: 'Edificio de aulas generales D101-D206',
    x: -48.96,
    y: 1.106,
    z: -44.044,
    nodeId: 193,
    yaw: 90,
    pitch: 0
  },
  {
    id: 'bloque_viejo',
    nombre: 'Bloque Viejo',
    nombreCorto: 'Bloque Viejo',
    poiName: 'POIs.2139',
    icono: '🏛️',
    bloque: 'Bloque Histórico',
    descripcion: 'Instalaciones y aulas del Bloque Viejo',
    x: -66.906,
    y: 1.15,
    z: -31.905,
    nodeId: 1936,
    yaw: -90,
    pitch: 0
  },
  {
    id: 'biblioteca',
    nombre: 'Biblioteca',
    nombreCorto: 'Biblioteca',
    poiName: 'POIs.1444',
    icono: '📚',
    bloque: 'Bloque C',
    descripcion: 'Biblioteca General y salas de estudio y consulta',
    x: -120.87,
    y: 2.037,
    z: -148.497,
    nodeId: 1241,
    yaw: -135,
    pitch: 0
  },
  {
    id: 'cafeteria_vieja',
    nombre: 'Cafetería Vieja',
    nombreCorto: 'Cafetería Vieja',
    poiName: 'POIs.1304',
    icono: '☕',
    bloque: 'Zona Posterior',
    descripcion: 'Zona tradicional de cafetería y descanso',
    x: -144.762,
    y: 2.0,
    z: -144.404,
    nodeId: 1101,
    yaw: -180,
    pitch: 0
  },
  {
    id: 'cafeteria_nueva',
    nombre: 'Cafetería Nueva',
    nombreCorto: 'Cafetería Nueva',
    poiName: 'POIs.3113',
    icono: '☕',
    bloque: 'Plazoleta de Comidas',
    descripcion: 'Zona de alimentación y descanso estudiantil',
    x: -39.046,
    y: 2.5,
    z: -71.893,
    nodeId: 2910,
    yaw: 102,
    pitch: 0
  }
];

export function getPuntoInicioPorPOI(poiName) {
  if (!poiName) return PUNTOS_INICIO[0];
  return PUNTOS_INICIO.find(
    (p) => p.poiName.toLowerCase() === poiName.toLowerCase()
  ) || PUNTOS_INICIO[0];
}

export default PUNTOS_INICIO;
