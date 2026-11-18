import os
import sys
import json
import urllib.parse
import re
from PIL import Image

print("======================================================================")
print("  OPTIMIZACIÓN DE ASSETS: WEBP, PARTICIONADO BINARIO Y CATÁLOGO       ")
print("======================================================================")

base_dir = "/home/qtwtq/ProyectoWebGL/frontend"
model_dir = os.path.join(base_dir, "public/Modelo3D")
tex_dir = os.path.join(model_dir, "UnimapTexture")
gltf_path = os.path.join(model_dir, "Unimap.gltf")
bin_path = os.path.join(model_dir, "Unimap.bin")

with open(gltf_path, "r", encoding="utf-8") as f:
    gltf = json.load(f)

# 1. Optimizar texturas a WebP
print(">> [1/5] Optimizando imágenes a WebP...")
images = gltf.get("images", [])
processed_webps = set()
files_to_remove = []

for img_entry in images:
    raw_uri = img_entry.get("uri", "")
    if not raw_uri:
        continue
    
    decoded_uri = urllib.parse.unquote(raw_uri)
    src_path = os.path.join(model_dir, decoded_uri)
    
    if not os.path.exists(src_path):
        print(f"  [AVISO] No se encontró {src_path}")
        continue
    
    base_name = os.path.splitext(os.path.basename(decoded_uri))[0]
    safe_name = base_name.replace(" ", "_").replace("%20", "_")
    webp_filename = safe_name + ".webp"
    dst_path = os.path.join(tex_dir, webp_filename)
    
    if not os.path.exists(dst_path) or dst_path == src_path or (os.path.exists(src_path) and os.path.getmtime(src_path) > os.path.getmtime(dst_path)):
        try:
            with Image.open(src_path) as im:
                w, h = im.size
                max_dim = 1024
                if w > max_dim or h > max_dim:
                    if w >= h:
                        new_w = max_dim
                        new_h = int(h * (max_dim / w))
                    else:
                        new_h = max_dim
                        new_w = int(w * (max_dim / h))
                    im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
                
                is_normal = "normal" in safe_name.lower() or "normalgl" in safe_name.lower()
                quality = 92 if is_normal else 82
                im.save(dst_path, "WEBP", quality=quality, method=6)
                orig_size = os.path.getsize(src_path)
                new_size = os.path.getsize(dst_path)
                print(f"  ✓ {webp_filename} ({orig_size // 1024} KB -> {new_size // 1024} KB)")
        except Exception as e:
            print(f"  [ERROR] {src_path}: {e}")
    
    processed_webps.add(webp_filename)
    if src_path != dst_path and not src_path.endswith(".webp"):
        files_to_remove.append(src_path)
    
    img_entry["mimeType"] = "image/webp"
    img_entry["uri"] = f"UnimapTexture/{webp_filename}"

# Eliminar imágenes raw png/jpg no necesarias
for p in set(files_to_remove):
    if os.path.exists(p):
        os.remove(p)
        print(f"  ✓ Eliminado archivo original no comprimido: {os.path.basename(p)}")

# 2. Particionar binario
print(">> [2/5] Particionando binario Unimap.bin en 2 partes (<18MB)...")
if os.path.exists(bin_path):
    with open(bin_path, "rb") as f:
        bin_bytes = f.read()
    
    total_bytes = len(bin_bytes)
    print(f"  Tamaño binario original: {total_bytes / (1024*1024):.2f} MB")
    
    bvs = gltf.get("bufferViews", [])
    half = total_bytes // 2
    split_idx = -1
    for i, bv in enumerate(bvs):
        off = bv.get("byteOffset", 0)
        if off >= half:
            split_idx = i
            break
    
    if split_idx == -1:
        split_idx = len(bvs) // 2
    
    split_offset = bvs[split_idx].get("byteOffset", 0)
    print(f"  Punto de corte: bufferView #{split_idx} en byte {split_offset}")
    
    part1_bytes = bin_bytes[:split_offset]
    part2_bytes = bin_bytes[split_offset:]
    len1 = len(part1_bytes)
    len2 = len(part2_bytes)
    
    part1_path = os.path.join(model_dir, "Unimap_part1.bin")
    part2_path = os.path.join(model_dir, "Unimap_part2.bin")
    
    with open(part1_path, "wb") as f:
        f.write(part1_bytes)
    with open(part2_path, "wb") as f:
        f.write(part2_bytes)
    
    print(f"  ✓ {part1_path}: {len1 / (1024*1024):.2f} MB")
    print(f"  ✓ {part2_path}: {len2 / (1024*1024):.2f} MB")
    
    for i in range(split_idx, len(bvs)):
        bv = bvs[i]
        bv["buffer"] = 1
        bv["byteOffset"] = bv.get("byteOffset", 0) - split_offset
    
    gltf["buffers"] = [
        {"byteLength": len1, "uri": "Unimap_part1.bin"},
        {"byteLength": len2, "uri": "Unimap_part2.bin"}
    ]
    
    os.remove(bin_path)
    print("  ✓ Eliminado binario único > 25MB Unimap.bin")
else:
    print("  [AVISO] Unimap.bin no encontrado, comprobando partes existentes...")
    len1 = os.path.getsize(os.path.join(model_dir, "Unimap_part1.bin"))
    len2 = os.path.getsize(os.path.join(model_dir, "Unimap_part2.bin"))

with open(gltf_path, "w", encoding="utf-8") as f:
    json.dump(gltf, f, indent=2)
print(f"  ✓ {gltf_path} actualizado.")

# 3. Filtrar catálogo para las 123 ubicaciones verificadas
print(">> [3/5] Actualizando catálogo con 123 destinos verificados...")
cat_json_path = os.path.join(base_dir, "src/data/catalogoCampus.json")
with open(cat_json_path, "r", encoding="utf-8") as f:
    lugares = json.load(f)

# Excluir los empties eliminados por el usuario
lugares_filtrados = [
    l for l in lugares 
    if l["meshName"] not in ("Empty--C_P3-C p3", "Empty--C_P3.-C p3")
]
print(f"  Total lugares válidos: {len(lugares_filtrados)} (de {len(lugares)} previos)")

with open(cat_json_path, "w", encoding="utf-8") as f:
    json.dump(lugares_filtrados, f, indent=2)

# Actualizar catalogoCampus.js
cat_js_path = os.path.join(base_dir, "src/data/catalogoCampus.js")
edificios_principales = [
    {
        "id": "bloque_abc",
        "nombre": "Bloque A - B - C",
        "icono": "🏢",
        "meshName": "Empty-Bloque-A-B-C",
        "x": -58.16,
        "y": 1.2,
        "z": -9.88,
        "yaw": 157.8,
        "pitch": -0.3,
        "fov": 52,
        "descripcion": "Capilla, Biblioteca, Sala Directores, Administración y Salones A, B, C"
    },
    {
        "id": "bloque_d",
        "nombre": "Bloque D",
        "icono": "🏢",
        "meshName": "Empty-Bloque-D",
        "x": -50.86,
        "y": 1.2,
        "z": -44.28,
        "yaw": -141.9,
        "pitch": -0.3,
        "fov": 52,
        "descripcion": "Salones D101 a D111 y D201 a D206"
    },
    {
        "id": "bloque_e",
        "nombre": "Bloque E",
        "icono": "🏢",
        "meshName": "Empty-Bloque-E",
        "x": -19.83,
        "y": 0.7,
        "z": 34.75,
        "yaw": 141.4,
        "pitch": -0.4,
        "fov": 50,
        "descripcion": "Auditorio, Decanatura y Salones E1 a E8"
    },
    {
        "id": "biblioteca",
        "nombre": "Biblioteca Central",
        "icono": "📚",
        "meshName": "Empty-Biblioteca-C p1",
        "x": -124.31,
        "y": 2.5,
        "z": -151.19,
        "yaw": -100.9,
        "pitch": -0.6,
        "fov": 48,
        "descripcion": "Biblioteca General - Bloque C Piso 1"
    },
    {
        "id": "coliseo",
        "nombre": "Coliseo ITFIP",
        "icono": "🏟️",
        "meshName": "Empty-Coliseo",
        "x": -37.40,
        "y": 1.2,
        "z": -133.64,
        "yaw": 164.4,
        "pitch": -0.2,
        "fov": 48,
        "descripcion": "Coliseo Cubierto y Escenarios Deportivos"
    },
    {
        "id": "gym",
        "nombre": "Gimnasio (GYM)",
        "icono": "🏋️",
        "meshName": "Empty-GYM",
        "x": -53.50,
        "y": 1.2,
        "z": -151.05,
        "yaw": 154.4,
        "pitch": -0.2,
        "fov": 48,
        "descripcion": "Gimnasio Universitario ITFIP"
    },
    {
        "id": "canchas",
        "nombre": "Canchas Deportivas",
        "icono": "⚽",
        "meshName": "Mesh_Canchas-1",
        "x": -17.87,
        "y": 1.43,
        "z": -103.07,
        "yaw": 52.2,
        "pitch": -0.4,
        "fov": 50,
        "descripcion": "Canchas Múltiples de Fútbol y Baloncesto"
    },
    {
        "id": "cafeteria_nueva",
        "nombre": "Cafetería Nueva",
        "icono": "☕",
        "meshName": "Empty-Cafeteria Nueva",
        "x": -109.11,
        "y": 1.5,
        "z": -134.78,
        "yaw": 12.0,
        "pitch": -0.2,
        "fov": 48,
        "descripcion": "Cafetería y Zona de Alimentación"
    }
]

with open(cat_js_path, "w", encoding="utf-8") as f:
    f.write("// Catálogo Oficial de Edificios y Lugares Recorribles del Campus ITFIP\n")
    f.write(f"// Pre-calculado con los {len(lugares_filtrados)} Empties del modelo Unimap.blend para cero costo en runtime\n\n")
    f.write("export const EDIFICIOS_PRINCIPALES = ")
    json.dump(edificios_principales, f, indent=2)
    f.write(";\n\n")
    f.write("export const LUGARES_RECORRIBLES = ")
    json.dump(lugares_filtrados, f, indent=2)
    f.write(";\n\n")
    f.write("""export function buscarLugaresRecorribles(termino) {
  if (!termino || !termino.trim()) return [];
  const q = termino.trim().toLowerCase();
  return LUGARES_RECORRIBLES.filter((lugar) => {
    return (
      (lugar.displayName && lugar.displayName.toLowerCase().includes(q)) ||
      (lugar.categoria && lugar.categoria.toLowerCase().includes(q)) ||
      (lugar.bloque && lugar.bloque.toLowerCase().includes(q)) ||
      (lugar.piso && lugar.piso.toLowerCase().includes(q)) ||
      (lugar.meshName && lugar.meshName.toLowerCase().includes(q))
    );
  });
}

export default { EDIFICIOS_PRINCIPALES, LUGARES_RECORRIBLES, buscarLugaresRecorribles };
""")
print(f"  ✓ {cat_js_path} actualizado.")

# 4. Actualizar Cache API y Service Worker a v18
print(">> [4/5] Actualizando versión de caché a v18 en cacheCampus3D.js y sw.js...")
cache_js_path = os.path.join(base_dir, "src/services/cacheCampus3D.js")
with open(cache_js_path, "r", encoding="utf-8") as f:
    cache_code = f.read()

cache_code = re.sub(r"CACHE_NAME = 'unimap-3d-cache-v\d+'", "CACHE_NAME = 'unimap-3d-cache-v18'", cache_code)
cache_code = re.sub(r"const PESO_PART1_APROX = \d+;", f"const PESO_PART1_APROX = {len1};", cache_code)
cache_code = re.sub(r"const PESO_PART2_APROX = \d+;", f"const PESO_PART2_APROX = {len2};", cache_code)

with open(cache_js_path, "w", encoding="utf-8") as f:
    f.write(cache_code)

sw_path = os.path.join(base_dir, "public/sw.js")
with open(sw_path, "r", encoding="utf-8") as f:
    sw_code = f.read()

sw_code = re.sub(r"unimap-offline-v\d+", "unimap-offline-v18", sw_code)
sw_code = re.sub(r"CACHE_NAME = 'unimap-3d-cache-v\d+'", "CACHE_NAME = 'unimap-3d-cache-v18'", sw_code)

with open(sw_path, "w", encoding="utf-8") as f:
    f.write(sw_code)

print("  ✓ Caché actualizada a v18.")
print("======================================================================")
print("  PROCESAMIENTO COMPLETADO EXITOSAMENTE                               ")
print("======================================================================")
