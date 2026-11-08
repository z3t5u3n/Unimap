import React, { useState, useEffect } from 'react';
import {
  X,
  Snowflake,
  Sparkles,
  TreePine,
  Check,
  Power,
  Flame,
  CloudSnow,
  Sliders
} from 'lucide-react';

export default function ModalConfiguracionTemporada({ isOpen, onCerrar, onCambioTemporada }) {
  const [temporadaActiva, setTemporadaActiva] = useState(() => {
    const guardado = localStorage.getItem('unimap_temporada_activa');
    return guardado === null ? true : guardado === 'true';
  });

  const [intensidadNieve, setIntensidadNieve] = useState(() => {
    return localStorage.getItem('unimap_temporada_intensidad') || 'moderada';
  });

  const [lucesNavidenas, setLucesNavidenas] = useState(() => {
    const guardado = localStorage.getItem('unimap_temporada_luces');
    return guardado === null ? true : guardado === 'true';
  });

  // Sincronizar cambios en localStorage y emitir evento global
  const aplicarCambios = (nuevaActiva, nuevaIntensidad, nuevasLuces) => {
    localStorage.setItem('unimap_temporada_activa', String(nuevaActiva));
    localStorage.setItem('unimap_temporada_intensidad', nuevaIntensidad);
    localStorage.setItem('unimap_temporada_luces', String(nuevasLuces));

    window.dispatchEvent(
      new CustomEvent('unimap_temporada_changed', {
        detail: {
          activa: nuevaActiva,
          intensidad: nuevaIntensidad,
          luces: nuevasLuces
        }
      })
    );

    if (onCambioTemporada) {
      onCambioTemporada({
        activa: nuevaActiva,
        intensidad: nuevaIntensidad,
        luces: nuevasLuces
      });
    }
  };

  const handleToggleTemporada = () => {
    const nuevaActiva = !temporadaActiva;
    setTemporadaActiva(nuevaActiva);
    aplicarCambios(nuevaActiva, intensidadNieve, lucesNavidenas);
  };

  const handleCambiarIntensidad = (nivel) => {
    setIntensidadNieve(nivel);
    aplicarCambios(temporadaActiva, nivel, lucesNavidenas);
  };

  const handleToggleLuces = () => {
    const nuevasLuces = !lucesNavidenas;
    setLucesNavidenas(nuevasLuces);
    aplicarCambios(temporadaActiva, intensidadNieve, nuevasLuces);
  };

  // Escuchar tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCerrar]);

  if (!isOpen) return null;

  return (
    <div className="modalTemporadaOverlay" onClick={onCerrar}>
      <div
        className="modalTemporadaCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloModalTemporada"
      >
        {/* Cabecera del modal */}
        <div className="modalTemporadaHeader">
          <div className="modalTemporadaTituloGrupo">
            <div className="iconoTemporadaContenedor">
              <Snowflake size={22} className="iconoNieveRotando" />
            </div>
            <div>
              <h3 id="tituloModalTemporada" className="modalTemporadaTitulo">
                Configuración de Temporada
              </h3>
              <p className="modalTemporadaSubtitulo">
                Edición Navideña & Efectos Ambientales de Invierno
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btnCerrarModalTemporada"
            onClick={onCerrar}
            aria-label="Cerrar configuración de temporada"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div className="modalTemporadaBody">
          {/* Tarjeta de Estado Principal */}
          <div className={`tarjetaEstadoTemporada ${temporadaActiva ? 'estadoActivo' : 'estadoInactivo'}`}>
            <div className="infoEstadoTemporada">
              <span className="badgeEstadoTemporada">
                {temporadaActiva ? '❄️ Visualización de Temporada Activa' : '○ Visualización de Temporada Desactivada'}
              </span>
              <p className="descripcionEstadoTemporada">
                {temporadaActiva
                  ? 'El campus 3D tiene nieve artificial activa y la interfaz muestra toques navideños festivos.'
                  : 'Los efectos climáticos y adornos estacionales están pausados. El campus se muestra en modo estándar.'}
              </p>
            </div>

            {/* BOTÓN SOLICITADO: ACTIVAR O DESACTIVAR LA VISUALIZACIÓN DE TEMPORADA */}
            <button
              type="button"
              className={`btnAccionTemporadaPrincipal ${temporadaActiva ? 'btnDesactivar' : 'btnActivar'}`}
              onClick={handleToggleTemporada}
            >
              <Power size={17} />
              <span>
                {temporadaActiva
                  ? 'Desactivar visualización de temporada'
                  : 'Activar visualización de temporada'}
              </span>
            </button>
          </div>

          {/* Opciones secundarias cuando la temporada está activa */}
          {temporadaActiva && (
            <div className="seccionOpcionesTemporada">
              {/* 1. Selector de Intensidad de Nieve 3D */}
              <div className="grupoOpcionTemporada">
                <div className="etiquetaOpcionTemporada">
                  <CloudSnow size={17} color="#38bdf8" />
                  <div>
                    <span className="tituloOpcionTemporada">Intensidad de Nieve en el Mapa 3D</span>
                    <span className="subtituloOpcionTemporada">
                      Cantidad y densidad de copos cayendo sobre el campus universitario
                    </span>
                  </div>
                </div>

                <div className="selectorIntensidadGrid">
                  <button
                    type="button"
                    className={`btnNivelIntensidad ${intensidadNieve === 'suave' ? 'activo' : ''}`}
                    onClick={() => handleCambiarIntensidad('suave')}
                  >
                    <span className="emojiIntensidad">❄️</span>
                    <span className="textoNivel">Suave</span>
                    <span className="detalleNivel">1,500 copos</span>
                  </button>

                  <button
                    type="button"
                    className={`btnNivelIntensidad ${intensidadNieve === 'moderada' ? 'activo' : ''}`}
                    onClick={() => handleCambiarIntensidad('moderada')}
                  >
                    <span className="emojiIntensidad">🌨️</span>
                    <span className="textoNivel">Moderada</span>
                    <span className="detalleNivel">3,500 copos</span>
                  </button>

                  <button
                    type="button"
                    className={`btnNivelIntensidad ${intensidadNieve === 'ventisca' ? 'activo' : ''}`}
                    onClick={() => handleCambiarIntensidad('ventisca')}
                  >
                    <span className="emojiIntensidad">⛄</span>
                    <span className="textoNivel">Ventisca</span>
                    <span className="detalleNivel">6,000 copos</span>
                  </button>
                </div>
              </div>

              {/* 2. Decoración Navideña en la Interfaz */}
              <div className="grupoOpcionTemporada">
                <div className="etiquetaOpcionTemporada">
                  <Sparkles size={17} color="#fbbf24" />
                  <div>
                    <span className="tituloOpcionTemporada">Luces y Adornos Navideños en la Interfaz</span>
                    <span className="subtituloOpcionTemporada">
                      Guirnalda de luces festivas titilantes y distintivo navideño en el encabezado
                    </span>
                  </div>
                </div>

                <div className="switchContenedorTemporada">
                  <button
                    type="button"
                    className={`switchToggleNavidad ${lucesNavidenas ? 'switchOn' : ''}`}
                    onClick={handleToggleLuces}
                    role="switch"
                    aria-checked={lucesNavidenas}
                  >
                    <span className="switchPill" />
                  </button>
                  <span className="switchTextoLabel">
                    {lucesNavidenas ? 'Luces y Adornos Visibles' : 'Luces Ocultas'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="modalTemporadaFooter">
          <span className="notaPieTemporada">
            ✨ Los efectos no alteran los modelos 3D y se guardan automáticamente en tu navegador.
          </span>
          <button type="button" className="btnCerrarTemporadaListo" onClick={onCerrar}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
