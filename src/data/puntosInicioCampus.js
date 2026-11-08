// Catálogo oficial de Puntos de Inicio de Recorrido del Campus ITFIP
// Permite al usuario posicionarse directamente en puntos clave del campus (Bloque E, Buses, Bloque D, etc.)
// y comenzar desde allí su recorrido guiado o exploración manual con la flecha 3D.

export const PUNTOS_INICIO = [
  {
    id: 'entrada_principal',
    nombre: 'Portería Principal (Entrada General)',
    nombreCorto: 'Portería Principal',
    poiName: 'POIs.4477',
    icono: '🏫',
    bloque: 'Entrada General',
    descripcion: 'Acceso peatonal principal sobre la vía nacional',
    x: 182.014,
    y: 1.2,
    z: 276.257,
    nodeId: 1999,
    yaw: -142,
    pitch: 0
  },
  {
    id: 'entrada_buses',
    nombre: 'Entrada de los Buses',
    nombreCorto: 'Entrada de Buses',
    poiName: 'POIs.4443',
    icono: '🚌',
    bloque: 'Zona de Buses',
    descripcion: 'Acceso y parqueadero de transporte institucional',
    x: -93.648,
    y: 1.2,
    z: 163.553,
    nodeId: 1965,
    yaw: 161.3,
    pitch: 0
  },
  {
    id: 'bloque_e_1',
    nombre: 'Bloque-E 1 (Acceso Norte)',
    nombreCorto: 'Bloque-E 1',
    poiName: 'POIs.3770',
    icono: '🏢',
    bloque: 'Bloque E',
    descripcion: 'Acceso norte al edificio de aulas Bloque E',
    x: -35.153,
    y: 2.636,
    z: 51.506,
    nodeId: 1292,
    yaw: -9.2,
    pitch: 0
  },
  {
    id: 'bloque_e_2',
    nombre: 'Bloque-E 2 (Acceso Central / Auditorio)',
    nombreCorto: 'Bloque-E 2',
    poiName: 'POIs.4015',
    icono: '🏢',
    bloque: 'Bloque E',
    descripcion: 'Plazoleta central y entrada al Auditorio Principal',
    x: -19.787,
    y: 2.7,
    z: 69.659,
    nodeId: 1537,
    yaw: -136.2,
    pitch: 0
  },
  {
    id: 'bloque_e_3',
    nombre: 'Bloque-E 3 (Acceso Sur / Aulas)',
    nombreCorto: 'Bloque-E 3',
    poiName: 'POIs.4337',
    icono: '🏢',
    bloque: 'Bloque E',
    descripcion: 'Acceso sur hacia laboratorios y salones E',
    x: -33.521,
    y: 2.508,
    z: 82.203,
    nodeId: 1859,
    yaw: -145.6,
    pitch: 0
  },
  {
    id: 'bloque_d',
    nombre: 'Bloque-D (Aulas D101-D206)',
    nombreCorto: 'Bloque-D',
    poiName: 'POIs.892',
    icono: '🏢',
    bloque: 'Bloque D',
    descripcion: 'Edificio de dos plantas de aulas generales',
    x: -38.957,
    y: 1.2,
    z: -12.443,
    nodeId: 892,
    yaw: 90,
    pitch: 0
  },
  {
    id: 'cafeteria_nueva',
    nombre: 'Cafetería Nueva (Plazoleta)',
    nombreCorto: 'Cafetería Nueva',
    poiName: 'POIs.871',
    icono: '☕',
    bloque: 'Plazoleta de Comidas',
    descripcion: 'Zona de alimentación y descanso estudiantil',
    x: -34.089,
    y: 2.5,
    z: -39.265,
    nodeId: 871,
    yaw: 102.4,
    pitch: 0
  },
  {
    id: 'coliseo',
    nombre: 'Coliseo Cubierto ITFIP',
    nombreCorto: 'Coliseo',
    poiName: 'POIs.4697',
    icono: '🏟️',
    bloque: 'Área Deportiva',
    descripcion: 'Canchas múltiples cubiertas y eventos deportivos',
    x: -16.273,
    y: 1.2,
    z: -114.946,
    nodeId: 2219,
    yaw: 180,
    pitch: 0
  },
  {
    id: 'gym',
    nombre: 'Gimnasio Universitario (GYM)',
    nombreCorto: 'GYM',
    poiName: 'POIs.4765',
    icono: '🏋️',
    bloque: 'Área Deportiva',
    descripcion: 'Centro de acondicionamiento físico institucional',
    x: -49.537,
    y: 1.2,
    z: -120.113,
    nodeId: 2287,
    yaw: -99.9,
    pitch: 0
  },
  {
    id: 'biblioteca',
    nombre: 'Biblioteca Central ITFIP',
    nombreCorto: 'Biblioteca',
    poiName: 'POIs.413',
    icono: '📚',
    bloque: 'Bloque C',
    descripcion: 'Biblioteca General y salas de estudio y consulta',
    x: -109.935,
    y: 2.0,
    z: -116.273,
    nodeId: 413,
    yaw: -135,
    pitch: 0
  },
  {
    id: 'cafeteria_vieja',
    nombre: 'Cafetería Vieja',
    nombreCorto: 'Cafetería Vieja',
    poiName: 'POIs.360',
    icono: '☕',
    bloque: 'Bloque C Posterior',
    descripcion: 'Zona de kioscos y cafetería tradicional',
    x: -134.277,
    y: 2.0,
    z: -113.186,
    nodeId: 360,
    yaw: -180,
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
