import React, { useRef } from 'react';
import { EDIFICIOS_PRINCIPALES } from '../data/catalogoCampus';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MenuEdificiosInferior({
  edificios = EDIFICIOS_PRINCIPALES,
  edificioActivoId,
  onSeleccionarEdificio
}) {
  const scrollContainerRef = useRef(null);

  const scroll = (offset) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="barraEdificiosInferior">
      {/* Botón flecha izquierda para desplazamiento horizontal */}
      <button
        type="button"
        className="btnScrollFlecha btnScrollIzq"
        onClick={() => scroll(-220)}
        title="Desplazar a la izquierda"
        aria-label="Desplazar a la izquierda"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Contenedor horizontal con scroll táctil y ocultamiento de barra */}
      <div className="scrollHorizontalEdificios" ref={scrollContainerRef}>
        {edificios.map((edificio) => {
          const esActivo = edificioActivoId === edificio.id;
          return (
            <button
              key={edificio.id}
              type="button"
              className={`btnEdificioHorizontal ${esActivo ? 'activo' : ''}`}
              onClick={() => onSeleccionarEdificio && onSeleccionarEdificio(edificio)}
              title={`${edificio.nombre}: ${edificio.descripcion}`}
            >
              <span className="iconoEdificio">{edificio.icono}</span>
              <span className="nombreEdificio">{edificio.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* Botón flecha derecha para desplazamiento horizontal */}
      <button
        type="button"
        className="btnScrollFlecha btnScrollDer"
        onClick={() => scroll(220)}
        title="Desplazar a la derecha"
        aria-label="Desplazar a la derecha"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
