import React, { useState, useEffect, useRef } from 'react';
import { Compass, ChevronDown, Check, MapPin, Sparkles } from 'lucide-react';
import { PUNTOS_INICIO } from '../data/puntosInicioCampus';

export default function SelectorPuntoInicio({
  puntoInicioActivo = PUNTOS_INICIO[0],
  onSeleccionarPuntoInicio
}) {
  const [desplegado, setDesplegado] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar lista al hacer clic fuera del menú
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDesplegado(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSeleccionar = (punto) => {
    setDesplegado(false);
    if (onSeleccionarPuntoInicio) {
      onSeleccionarPuntoInicio(punto);
    }
  };

  return (
    <div className="selectorPuntoInicioWrapper" ref={dropdownRef}>
      {/* Botón trigger principal que abre el menú */}
      <button
        type="button"
        className={`btnTriggerPuntoInicio ${desplegado ? 'activo' : ''}`}
        onClick={() => setDesplegado((prev) => !prev)}
        title="Seleccionar el punto de partida del recorrido o exploración manual"
        aria-haspopup="listbox"
        aria-expanded={desplegado}
      >
        <div className="iconoInicioWrapper">
          <Compass className="iconoBrujulaInicio" size={17} />
        </div>
        <div className="textosTriggerInicio">
          <span className="etiquetaInicioMini">Punto de inicio</span>
          <span className="nombrePuntoInicioActivo">
            {puntoInicioActivo?.nombreCorto || puntoInicioActivo?.nombre || 'Portería Principal'}
          </span>
        </div>
        <span className="badgePOIPillMini">{puntoInicioActivo?.poiName}</span>
        <ChevronDown
          size={16}
          className={`flechaDropdownInicio ${desplegado ? 'girada' : ''}`}
        />
      </button>

      {/* Menú desplegable flotante con los puntos clave */}
      {desplegado && (
        <div className="menuDesplegablePuntosInicio animateScaleUp">
          <div className="headerMenuInicio">
            <div className="tituloHeaderInicio">
              <MapPin size={16} color="#38bdf8" />
              <span>Punto de inicio de recorrido</span>
            </div>
            <span className="subtituloHeaderInicio">
              Selecciona desde qué lugar del campus deseas partir
            </span>
          </div>

          <div className="listaPuntosInicioScroll">
            {PUNTOS_INICIO.map((punto) => {
              const esActivo = puntoInicioActivo?.id === punto.id;
              return (
                <button
                  key={punto.id}
                  type="button"
                  className={`itemPuntoInicio ${esActivo ? 'seleccionado' : ''}`}
                  onClick={() => handleSeleccionar(punto)}
                >
                  <span className="emojiIconoInicio">{punto.icono}</span>
                  <div className="infoItemInicio">
                    <div className="filaTituloItem">
                      <span className="tituloItemInicio">{punto.nombre}</span>
                      <span className="tagPOINodo">{punto.poiName}</span>
                    </div>
                    <span className="descripcionItemInicio">{punto.descripcion}</span>
                  </div>
                  {esActivo && (
                    <div className="checkActivoInicio">
                      <Check size={16} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
