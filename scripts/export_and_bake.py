import bpy
import json
import os
import sys
import time
import math
from mathutils.bvhtree import BVHTree
from mathutils import Vector

t0 = time.time()
print("======================================================================")
print("  PROCESAMIENTO MAESTRO UNIMAP: EXPORTACIÓN, HORNEADO Y PRE-CÁLCULO   ")
print("======================================================================")

# 1. Asegurar visibilidad total de todas las colecciones y objetos para exportación completa
print(">> [1/4] Habilitando visibilidad de todos los objetos y colecciones...")

def enable_all_collections(collection):
    collection.hide_viewport = False
    collection.hide_render = False
    for child in collection.children:
        enable_all_collections(child)

enable_all_collections(bpy.context.scene.collection)

for layer in bpy.context.scene.view_layers:
    for layer_coll in layer.layer_collection.children:
        layer_coll.exclude = False
        layer_coll.hide_viewport = False

for obj in bpy.data.objects:
    obj.hide_viewport = False
    obj.hide_render = False
    try:
        obj.hide_set(False)
    except:
        pass

total_objs = len(bpy.data.objects)
print(f"Total objetos activos: {total_objs}")

# 2. Exportar GLTF temporal completo
tmp_dir = "/tmp/unimap_export"
os.makedirs(tmp_dir, exist_ok=True)
tmp_gltf = os.path.join(tmp_dir, "Unimap.gltf")
print(f">> [2/4] Exportando escena completa a {tmp_gltf}...")

t_exp = time.time()
bpy.ops.export_scene.gltf(
    filepath=tmp_gltf,
    export_format='GLTF_SEPARATE',
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_extras=True
)
print(f"Exportación GLTF finalizada en {time.time() - t_exp:.2f}s")

# 3. Hornear Grafo de Navegación de 3.030 POIs con colisión BVH contra 150 muros Mesh_ (sin No_)
print(">> [3/4] Horneando grafo de navegación con BVH de muros Mesh_...")
pois = [obj for obj in bpy.data.objects if obj.name.startswith("POIs")]
def sort_key(obj):
    if obj.name == "POIs":
        return 0
    try:
        return int(obj.name.split(".")[1])
    except:
        return 99999

pois.sort(key=sort_key)
poi_count = len(pois)
print(f"Total POIs detectados: {poi_count}")

# Mallas estructurales que bloquean conexiones (inician con Mesh_ y no No_)
mesh_walls = [obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name.startswith("Mesh_") and not obj.name.startswith("No_")]
print(f"Mallas de muros Mesh_ detectadas: {len(mesh_walls)}")

all_verts = []
all_polys = []
vert_offset = 0
for b_obj in mesh_walls:
    mw = b_obj.matrix_world
    m = b_obj.data
    for v in m.vertices:
        all_verts.append(mw @ v.co)
    for p in m.polygons:
        all_polys.append([idx + vert_offset for idx in p.vertices])
    vert_offset += len(m.vertices)

bvh = BVHTree.FromPolygons(all_verts, all_polys)
print(f"BVH de muros construido: {len(all_verts)} vértices, {len(all_polys)} polígonos.")

# Spatial Grid y raycasts para aristas del grafo
max_d = 4.0
cell_size = max_d
grid = {}
for i, p in enumerate(pois):
    loc = p.matrix_world.translation
    grid.setdefault((int(loc.x // cell_size), int(loc.y // cell_size)), []).append(i)

adj = {i: [] for i in range(poi_count)}
total_pairs_tested = 0
connections_blocked = 0

for (cx, cy), idxs in grid.items():
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            for i in idxs:
                p_i = pois[i].matrix_world.translation
                for j in grid.get((cx + dx, cy + dy), []):
                    if j <= i:
                        continue
                    p_j = pois[j].matrix_world.translation
                    diff = p_j - p_i
                    dist = diff.length
                    if abs(diff.z) > 1.8:
                        continue
                    if 0.05 < dist <= max_d:
                        total_pairs_tested += 1
                        dir_n = diff.normalized()
                        start = p_i + dir_n * 0.05 + Vector((0, 0, 0.3))
                        loc, norm, idx, d = bvh.ray_cast(start, dir_n, dist - 0.1)
                        if loc is None:
                            adj[i].append((j, dist))
                            adj[j].append((i, dist))
                        else:
                            connections_blocked += 1

total_edges = sum(len(v) for v in adj.values()) // 2
print(f"Grafo horneado: {total_edges} aristas válidas ({connections_blocked} bloqueadas por muros).")

# Alcance desde la Portería Principal (nodo 0)
visited = set([0])
queue = [0]
while queue:
    curr = queue.pop()
    for nxt, d in adj[curr]:
        if nxt not in visited:
            visited.add(nxt)
            queue.append(nxt)
print(f"Nodos alcanzables desde Portería: {len(visited)} de {poi_count} ({len(visited)/poi_count*100:.1f}%)")

# Generar datos del grafo
nodes_data = []
bifurcations_count = 0
poi_three_coords = []

for i, p in enumerate(pois):
    loc = p.matrix_world.translation
    three_x = round(loc.x, 3)
    three_y = round(loc.z, 3)
    three_z = round(-loc.y, 3)
    poi_three_coords.append((three_x, three_y, three_z))

    neighbors = []
    for neighbor_id, dist in sorted(adj[i], key=lambda x: x[0]):
        neighbors.append({
            "id": neighbor_id,
            "dist": round(dist, 3)
        })

    is_bifurcation = len(neighbors) > 2
    if is_bifurcation:
        bifurcations_count += 1

    nodes_data.append({
        "id": i,
        "name": p.name,
        "x": three_x,
        "y": three_y,
        "z": three_z,
        "neighbors": neighbors,
        "isBifurcation": is_bifurcation,
        "isReachable": (i in visited)
    })

graph_dict = {
    "version": "5.0-blender-3030-mesh-walls",
    "description": "Red de grafos de 3.030 POIs del Campus ITFIP pre-horneada con verificación BVH de muros Mesh_",
    "maxConnectionDistance": max_d,
    "totalNodes": poi_count,
    "totalEdges": total_edges,
    "bifurcationsCount": bifurcations_count,
    "nodes": nodes_data
}

out_graph_json = "/home/qtwtq/ProyectoWebGL/frontend/src/data/poiGraphData.json"
out_graph_js = "/home/qtwtq/ProyectoWebGL/frontend/src/data/poiGraphData.js"

with open(out_graph_json, "w", encoding="utf-8") as f:
    json.dump(graph_dict, f, indent=2)

with open(out_graph_js, "w", encoding="utf-8") as f:
    f.write("// Archivo pre-horneado automáticamente con la red de grafos de 3.030 POIs\n")
    f.write("// Conexiones verificadas contra muros Mesh_ para cero consumo en tiempo de ejecución\n")
    f.write("export const graphData = ")
    json.dump(graph_dict, f, indent=2)
    f.write(";\n\nexport default graphData;\n")

print(f"Grafo exportado a {out_graph_json} y {out_graph_js}")

# 4. Pre-calcular Catálogo de 125 Empties y vincular al nodo más cercano
print(">> [4/4] Pre-calculando catálogo completo de destinos (125 Empties)...")

def clean_empty_name(name):
    cleaned = name.strip()
    for p in ['Empty_', 'Empty-', 'Empty ', 'Empty', 'View_', 'View-', 'View ', 'View']:
        if cleaned.lower().startswith(p.lower()):
            cleaned = cleaned[len(p):].strip()
            break
    return cleaned

def detect_building_info(raw_name):
    lower = raw_name.lower()
    if 'bloque-e' in lower or 'bloque e' in lower or '-e ' in lower or '-e.' in lower or lower.endswith('-e') or 'salon-e' in lower:
        return 'Bloque-E', 'Bloque E'
    if 'bloque-d' in lower or 'bloque d' in lower or '-d ' in lower or '-d.' in lower or lower.endswith('-d') or 'salon-d' in lower:
        return 'Bloque-D', 'Bloque D'
    if 'cafeteria' in lower:
        return 'Cafeteria Nueva', 'Cafetería Nueva'
    if 'coliseo' in lower:
        return 'Coliseo', 'Coliseo ITFIP'
    if 'gym' in lower or 'gimnasio' in lower:
        return 'GYM', 'Gimnasio (GYM)'
    if 'bloque-a' in lower or 'bloque a' in lower or '-a ' in lower or '-a.' in lower or lower.endswith('-a') or 'salon-a' in lower or 'capilla' in lower:
        return 'Bloque-A', 'Bloque A'
    if 'bloque-b' in lower or 'bloque b' in lower or '-b ' in lower or '-b.' in lower or lower.endswith('-b') or 'salon-b' in lower:
        return 'Bloque-B', 'Bloque B'
    if 'bloque-c' in lower or 'bloque c' in lower or '-c ' in lower or '-c.' in lower or lower.endswith('-c') or 'salon-c' in lower or 'biblioteca' in lower or 'papiit' in lower:
        return 'Bloque-C', 'Bloque C'
    return 'General', 'General'

def detect_floor_info(raw_name):
    lower = raw_name.lower()
    if 'p3' in lower or 'piso 3' in lower:
        return 'Piso 3'
    if 'p2' in lower or 'piso 2' in lower:
        return 'Piso 2'
    return 'Piso 1'

def detect_category_info(raw_name):
    lower = raw_name.lower()
    if 'capilla' in lower: return 'Espacios Comunes'
    if 'salon' in lower or 'aula' in lower: return 'Aulas'
    if 'baño' in lower or 'bano' in lower or 'sanitario' in lower: return 'Servicios Sanitarios'
    if 'cafeteria' in lower: return 'Cafetería'
    if 'biblioteca' in lower: return 'Biblioteca'
    if any(k in lower for k in ['administrativo', 'rector', 'registro', 'decanatura', 'bienestar', 'tesoreria', 'directores', 'cordinacion', 'coordinacion', 'monitoreo', 'control', 'social']): return 'Administración'
    if any(k in lower for k in ['porteria', 'acceso', 'entrada']): return 'Accesos'
    if 'auditorio' in lower: return 'Auditorios'
    if 'laboratorio' in lower or 'lab' in lower or 'multimedia' in lower or 'computo' in lower or 'data center' in lower or 'fisica' in lower or 'arquictetura' in lower or 'arquiterua' in lower: return 'Laboratorios'
    if 'enfermeria' in lower: return 'Salud'
    if any(k in lower for k in ['cancha', 'deporte', 'gym', 'coliseo']): return 'Deportes'
    return 'General'

def find_nearest_poi_id(tx, ty, tz):
    best_id = -1
    best_dist = 999999.0
    for idx in visited: # Solo nodos alcanzables
        px, py, pz = poi_three_coords[idx]
        dx = px - tx
        dy = py - ty
        dz = pz - tz
        # Ponderar altura para no saltar entre pisos
        d = math.sqrt(dx*dx + dz*dz + (dy*dy * 4.0))
        if d < best_dist:
            best_dist = d
            best_id = idx
    return best_id

empties_objs = [o for o in bpy.data.objects if o.type == 'EMPTY' and ('empty' in o.name.lower() or 'view' in o.name.lower()) and not o.name.lower().startswith('pois')]
print(f"Total empties detectados: {len(empties_objs)}")

lugares_catalog = []
for e in sorted(empties_objs, key=lambda x: x.name):
    loc = e.matrix_world.translation
    tx = round(loc.x, 2)
    ty = round(loc.z, 2)
    tz = round(-loc.y, 2)

    raw_name = e.name
    clean_name = clean_empty_name(raw_name)
    bldg_code, bldg_name = detect_building_info(raw_name)
    floor = detect_floor_info(raw_name)
    category = detect_category_info(raw_name)
    nearest_node = find_nearest_poi_id(tx, ty, tz)

    # Slug ID
    slug_id = raw_name.lower().replace(' ', '_').replace('-', '_').replace('.', '_')
    while '__' in slug_id:
        slug_id = slug_id.replace('__', '_')

    lugares_catalog.append({
        "id": slug_id,
        "meshName": raw_name,
        "displayName": clean_name,
        "categoria": category,
        "bloque": bldg_name,
        "piso": floor,
        "x": tx,
        "y": ty,
        "z": tz,
        "nearestNodeId": nearest_node
    })

# Guardar catalogoCampus.json y catalogoCampus.js
out_catalog_json = "/home/qtwtq/ProyectoWebGL/frontend/src/data/catalogoCampus.json"
with open(out_catalog_json, "w", encoding="utf-8") as f:
    json.dump(lugares_catalog, f, indent=2)

print(f"Catálogo de {len(lugares_catalog)} lugares guardado en {out_catalog_json}")
print(f"=== SCRIPT BLENDER COMPLETADO EXITOSAMENTE EN {time.time() - t0:.2f}s ===")
