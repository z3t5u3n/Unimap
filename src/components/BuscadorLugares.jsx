import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  MapPin,
  Building2,
  GraduationCap,
  Coffee,
  Dumbbell,
  BookOpen,
  Church,
  Activity,
  Layers
} from 'lucide-react';
import { buscarLugaresRecorribles, LUGARES_RECORRIBLES } from '../data/catalogoCampus';
import { poiLibraryService } from '../services/POILibraryService';

// Función para obtener icono representativo según la categoría
function getIconoPorCategoria(categoria) {
  switch (categoria) {
    case 'Salón de Clase':
      return <GraduationCap size={16} color="#38bdf8" />;
    case 'Biblioteca':
      return <BookOpen size={16} color="#fbbf24" />;
    case 'Capilla':
      return <Church size={16} color="#a78bfa" />;
    case 'Salud':
      return <Activity size={16} color="#f87171" />;
    case 'Cafetería':
      return <Coffee size={16} color="#f472b6" />;
    case 'Deportes':
      return <Dumbbell size={16} color="#34d399" />;
    case 'Laboratorio':
      return <Layers size={16} color="#818cf8" />;
    default:
      return <Building2 size={16} color="#94a3b8" />;
  }
}

export default function BuscadorLugares({ onSeleccionarLugar, lugarActivo, onLimpiar }) {
  const [termino, setTermino] = useState('');
  const [desplegado, setDesplegado] = useState(false);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(-1);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Escuchar cuando el modelo 3D termine de escanear y catalogar los Empties
  useEffect(() => {
    const handleCatalogo = () => setCatalogVersion((v) => v + 1);
    window.addEventListener('UniMapCatalogo', handleCatalogo);
    return () => window.removeEventListener('UniMapCatalogo', handleCatalogo);
  }, []);

  // Lugares filtrados según la búsqueda (combina catálogo base y POIs escaneados de la escena 3D)
  const resultados = useMemo(() => {
    if (!termino.trim()) {
      // Sugerencias populares cuando el buscador está vacío
      return LUGARES_RECORRIBLES.filter((l) =>
        [
          'Biblioteca Central ITFIP',
          'Auditorio Principal (Bloque E)',
          'Cafetería Nueva (Plazoleta)',
          'Coliseo Cubierto ITFIP',
          'Gimnasio Universitario (GYM)',
          'Capilla Institucional',
          'Enfermería Universitaria',
          'Laboratorio de Cómputo C1'
        ].includes(l.displayName)
      );
    }

    const baseResults = buscarLugaresRecorribles(termino);
    const poiResults = poiLibraryService.search(termino);

    const vistos = new Set(baseResults.map((r) => r.displayName.toLowerCase()));
    const combinados = [...baseResults];

    for (const p of poiResults) {
      if (!vistos.has(p.displayName.toLowerCase())) {
        vistos.add(p.displayName.toLowerCase());
        combinados.push({
          id: p.rawName || p.displayName,
          meshName: p.rawName,
          displayName: p.displayName,
          categoria: p.category || 'General',
          bloque: p.building || 'Campus',
          piso: '',
          x: p.x,
          y: p.y,
          z: p.z,
          dist: 0
        });
      }
    }

    return combinados;
  }, [termino, catalogVersion]);

  // Cerrar lista al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setDesplegado(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejo de teclado (flechas, Enter, Escape)
  const handleKeyDown = (e) => {
    // Evitar que Three.js o listeners globales capturen teclas mientras se escribe
    e.stopPropagation();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceSeleccionado((prev) => (prev < resultados.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceSeleccionado((prev) => (prev > 0 ? prev - 1 : resultados.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (indiceSeleccionado >= 0 && resultados[indiceSeleccionado]) {
        seleccionarItem(resultados[indiceSeleccionado]);
      } else if (resultados.length > 0) {
        seleccionarItem(resultados[0]);
      }
    } else if (e.key === 'Escape') {
      setDesplegado(false);
      inputRef.current?.blur();
    }
  };

  const seleccionarItem = (lugar) => {
    setTermino(lugar.displayName);
    setDesplegado(false);
    setIndiceSeleccionado(-1);
    if (onSeleccionarLugar) {
      onSeleccionarLugar(lugar);
    }
  };

  const handleLimpiar = () => {
    setTermino('');
    setDesplegado(false);
    setIndiceSeleccionado(-1);
    if (onLimpiar) {
      onLimpiar();
    }
  };

  return (
    <div className="buscadorMapaCentrado" ref={wrapperRef}>
      <div className="inputSearchWrapper">
        <Search className="searchIconInside" size={18} />
        <input
          ref={inputRef}
          type="text"
          className="inputSearchMapa"
          placeholder="🔍 Buscar salón, laboratorio, cafetería, biblioteca..."
          value={termino}
          onChange={(e) => {
            setTermino(e.target.value);
            setDesplegado(true);
            setIndiceSeleccionado(-1);
          }}
          onFocus={() => setDesplegado(true)}
          onKeyDown={handleKeyDown}
        />
        {termino && (
          <button
            type="button"
            className="btnClearSearch"
            onClick={handleLimpiar}
            title="Borrar búsqueda"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {desplegado && (
        <ul className="listaResultadosFlotante">
          <li className="headerResultados">
            <span>
              {termino.trim()
                ? `Resultados encontrados (${resultados.length})`
                : 'Lugares recomendados para recorrer'}
            </span>
          </li>

          {resultados.length > 0 ? (
            resultados.slice(0, 15).map((lugar, index) => (
              <li
                key={lugar.id || index}
                className={`itemResultadoFlotante ${
                  index === indiceSeleccionado ? 'seleccionado' : ''
                }`}
                onClick={() => seleccionarItem(lugar)}
                onMouseEnter={() => setIndiceSeleccionado(index)}
              >
                <div className="itemIconContainer">
                  {getIconoPorCategoria(lugar.categoria)}
                </div>
                <div className="itemInfoText">
                  <div className="itemTitulo">{lugar.displayName}</div>
                  <div className="itemSubtitulo">
                    {lugar.bloque} {lugar.piso ? `• ${lugar.piso}` : ''} •{' '}
                    <span className="distanciaPill">{lugar.dist}m</span>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="sinResultadosFlotante">
              <MapPin size={18} color="#94a3b8" />
              <span>No se encontraron lugares con "{termino}"</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
