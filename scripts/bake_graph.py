import bpy
import json
import time
import heapq
from mathutils.bvhtree import BVHTree
from mathutils import Vector

t_start = time.time()
print("=== HORNEADO DE GRAFOS DE POIS CON VERIFICACIÓN DE MALLAS MESH_ (CAMPUS ITFIP) ===")

# 1. Extraer y ordenar todos los POIs (empties que inician con POIs)
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
poi_indices = {p.name: i for i, p in enumerate(pois)}

# 2. Todas las mallas que inician con Mesh_ (los muros que no se pueden traspasar) y no No_ (elementos nulos/decoración)
mesh_objs = [obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name.startswith("Mesh_") and not obj.name.startswith("No_")]
print(f"Mallas de muros Mesh_ detectadas: {len(mesh_objs)}")

all_verts = []
all_polys = []
vert_offset = 0
for b_obj in mesh_objs:
    mw = b_obj.matrix_world
    m = b_obj.data
    for v in m.vertices:
        all_verts.append(mw @ v.co)
    for p in m.polygons:
        all_polys.append([idx + vert_offset for idx in p.vertices])
    vert_offset += len(m.vertices)

bvh = BVHTree.FromPolygons(all_verts, all_polys)
print(f"BVH construido con {len(all_verts)} vértices y {len(all_polys)} polígonos.")

# 3. Spatial Grid y cálculo de aristas con colisión contra muros Mesh_
max_d = 4.0
grid = {}
cell_size = max_d
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
print(f"Conexiones: {total_edges} aristas válidas ({connections_blocked} bloqueadas por muros Mesh_).")

# 4. Verificar alcance desde Portería Principal (nodo 0)
visited = set([0])
queue = [0]
while queue:
    curr = queue.pop()
    for nxt, d in adj[curr]:
        if nxt not in visited:
            visited.add(nxt)
            queue.append(nxt)
print(f"Nodos alcanzables desde Portería: {len(visited)} de {poi_count} ({len(visited)/poi_count*100:.1f}%)")

# 5. Exportar JSON y JS
nodes_data = []
bifurcations_count = 0

for i, p in enumerate(pois):
    loc = p.matrix_world.translation
    three_x = round(loc.x, 3)
    three_y = round(loc.z, 3)
    three_z = round(-loc.y, 3)

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
    "version": "4.0-blender-3025-mesh-walls",
    "description": "Red de grafos de 3.025 POIs del Campus ITFIP horneada con todas las 144 mallas de muros Mesh_ (max_d = 4.0m)",
    "maxConnectionDistance": max_d,
    "totalNodes": poi_count,
    "totalEdges": total_edges,
    "bifurcationsCount": bifurcations_count,
    "nodes": nodes_data
}

out_json = "/home/qtwtq/ProyectoWebGL/frontend/src/data/poiGraphData.json"
out_js = "/home/qtwtq/ProyectoWebGL/frontend/src/data/poiGraphData.js"

with open(out_json, "w", encoding="utf-8") as f:
    json.dump(graph_dict, f, indent=2)
print(f"Guardado JSON: {out_json}")

with open(out_js, "w", encoding="utf-8") as f:
    f.write("// Archivo generado automáticamente con la red de grafos de 3.025 POIs\n")
    f.write("// Conexiones <= 4.0m con verificación de todas las 144 mallas Mesh_ (muros y obstáculos)\n")
    f.write("export const graphData = ")
    json.dump(graph_dict, f, indent=2)
    f.write(";\n\nexport default graphData;\n")
print(f"Guardado JS: {out_js}")
print(f"=== HORNEADO FINALIZADO EXITOSAMENTE EN {time.time() - t_start:.2f}s ===")
