import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Star, X, Check, Send, AlertCircle, Loader2, Sparkles, MessageSquare } from 'lucide-react';

export default function ModalEncuestaUsuario({
  usuario,
  isOpen,
  onCerrar
}) {
  const [cargando, setCargando] = useState(true);
  const [encuesta, setEncuesta] = useState(null);
  const [activa, setActiva] = useState(false);
  const [haRespondido, setHaRespondido] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');

  // Estados de las respuestas de la encuesta
  const [calificacionGeneral, setCalificacionGeneral] = useState(5);
  const [facilidadUso, setFacilidadUso] = useState(5);
  const [calidadMapa3d, setCalidadMapa3d] = useState(5);
  const [comentarios, setComentarios] = useState('');
  const [hoverGeneral, setHoverGeneral] = useState(0);
  const [hoverFacilidad, setHoverFacilidad] = useState(0);
  const [hoverCalidad, setHoverCalidad] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const consultarEncuestaActiva = async () => {
    if (!usuario?.id_usuario) return;
    setCargando(true);
    setErrorCarga('');
    setErrorEnvio('');
    setExito(false);

    try {
      const response = await axios.get(
        `${API_BASE_URL}/encuestas/activa?id_usuario=${usuario.id_usuario}`
      );
      setActiva(!!response.data?.activa);
      setEncuesta(response.data?.encuesta || null);
      setHaRespondido(!!response.data?.ha_respondido);
    } catch (err) {
      console.error('Error al consultar encuesta activa:', err);
      setErrorCarga('No se pudo verificar el estado de la encuesta.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      consultarEncuestaActiva();
    }
  }, [isOpen, usuario?.id_usuario]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorEnvio('');

    if (!encuesta?.id_encuesta) {
      setErrorEnvio('No se identificó la encuesta a responder.');
      return;
    }

    if (!usuario?.id_usuario) {
      setErrorEnvio('Debes tener una sesión activa para calificar.');
      return;
    }

    setEnviando(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/encuestas/responder`, {
        id_encuesta: encuesta.id_encuesta,
        id_usuario: usuario.id_usuario,
        calificacion_general: calificacionGeneral,
        facilidad_uso: facilidadUso,
        calidad_mapa_3d: calidadMapa3d,
        comentarios: comentarios.trim() || null
      });

      if (response.status === 200 || response.status === 201) {
        setExito(true);
        setHaRespondido(true);
        setTimeout(() => {
          onCerrar();
        }, 2200);
      }
    } catch (err) {
      console.error('Error al responder encuesta:', err);
      const msg =
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'No se pudo registrar tu respuesta. Por favor intenta nuevamente.';
      setErrorEnvio(msg);
    } finally {
      setEnviando(false);
    }
  };

  // Selector de estrellas interactivo
  const renderSelectorEstrellas = (valor, setValor, hoverVal, setHoverVal, etiqueta) => {
    return (
      <div className="filaSelectorEstrellas">
        <span className="etiquetaPreguntaEstrellas">{etiqueta}</span>
        <div className="estrellasInteractivas" onMouseLeave={() => setHoverVal(0)}>
          {[1, 2, 3, 4, 5].map((starIndex) => {
            const highlight = hoverVal ? starIndex <= hoverVal : starIndex <= valor;
            return (
              <button
                type="button"
                key={starIndex}
                className={`btnEstrellaVoto ${highlight ? 'activa' : ''}`}
                onClick={() => setValor(starIndex)}
                onMouseEnter={() => setHoverVal(starIndex)}
                aria-label={`${starIndex} estrellas`}
              >
                <Star
                  size={24}
                  fill={highlight ? '#f59e0b' : 'none'}
                  color={highlight ? '#f59e0b' : 'var(--text-muted)'}
                />
              </button>
            );
          })}
          <span className="puntajeTextoMini">
            {(hoverVal || valor)} / 5 ★
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="panelDatosOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="panelDatosCard modalUsuarioCard" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del Modal */}
        <div className="panelDatosHeader">
          <div className="avatarGroup">
            <div className="avatarCircle" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <Star size={24} />
            </div>
            <div>
              <h3>Encuesta de Satisfacción</h3>
              <span className="badgeRol" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                Tu opinión nos ayuda a mejorar
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btnClosePanel"
            onClick={onCerrar}
            title="Cerrar ventana"
            disabled={enviando}
          >
            <X size={18} />
          </button>
        </div>

        {cargando ? (
          <div className="cargandoNotificaciones">
            <Loader2 size={26} className="animate-spin" color="#f59e0b" />
            <p>Cargando encuesta de satisfacción...</p>
          </div>
        ) : errorCarga ? (
          <div className="modalAlertError" style={{ margin: '20px 0' }}>
            <AlertCircle size={16} />
            <span>{errorCarga}</span>
          </div>
        ) : exito ? (
          <div className="modalFeedbackExito">
            <div className="iconoCheckAnimado" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b', borderColor: '#f59e0b' }}>
              <Check size={32} />
            </div>
            <h4>¡Muchas gracias por tu valoración!</h4>
            <p>
              Tus respuestas y sugerencias han sido enviadas exitosamente al panel de administración para seguir perfeccionando UniMap.
            </p>
          </div>
        ) : haRespondido ? (
          <div className="modalFeedbackExito">
            <div className="iconoCheckAnimado" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', borderColor: '#22c55e' }}>
              <Sparkles size={32} />
            </div>
            <h4>¡Ya has completado esta encuesta!</h4>
            <p>
              Tu calificación previa ya está registrada en el sistema. Agradecemos mucho tu colaboración y apoyo.
            </p>
            <button
              type="button"
              className="btnModalSubmit"
              style={{ marginTop: '16px' }}
              onClick={onCerrar}
            >
              Cerrar
            </button>
          </div>
        ) : !activa || !encuesta ? (
          <div className="notificacionesVacias">
            <Star size={40} className="iconoNotifVacio" style={{ color: 'var(--text-muted)' }} />
            <h4>No hay encuestas activas</h4>
            <p>En este momento no hay formularios de valoración pendientes. ¡Gracias por usar UniMap!</p>
            <button
              type="button"
              className="btnModalSubmit"
              style={{ marginTop: '16px' }}
              onClick={onCerrar}
            >
              Volver al Mapa
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="formModalUsuario">
            <div className="encabezadoEncuestaInfo">
              <h4 className="tituloEncuestaActiva">{encuesta.titulo}</h4>
              {encuesta.descripcion && (
                <p className="descEncuestaActiva">{encuesta.descripcion}</p>
              )}
            </div>

            {errorEnvio && (
              <div className="modalAlertError">
                <AlertCircle size={15} />
                <span>{errorEnvio}</span>
              </div>
            )}

            <div className="grupoPreguntasEncuesta">
              {renderSelectorEstrellas(
                calificacionGeneral,
                setCalificacionGeneral,
                hoverGeneral,
                setHoverGeneral,
                '1. Calificación General de la Plataforma:'
              )}

              {renderSelectorEstrellas(
                facilidadUso,
                setFacilidadUso,
                hoverFacilidad,
                setHoverFacilidad,
                '2. Facilidad para Encontrar Lugares y Salones:'
              )}

              {renderSelectorEstrellas(
                calidadMapa3d,
                setCalidadMapa3d,
                hoverCalidad,
                setHoverCalidad,
                '3. Calidad Visual y Fluidez del Mapa 3D:'
              )}
            </div>

            <div className="campoModal" style={{ marginTop: '14px' }}>
              <label htmlFor="comentarios_encuesta">
                <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Comentarios o Sugerencias Adicionales: <span className="labelOpcional">(Opcional)</span>
              </label>
              <textarea
                id="comentarios_encuesta"
                rows={3}
                placeholder="¿Qué te gustaría ver en futuras actualizaciones de UniMap? (nuevos bloques, fotos de salones, rutas peatonales...)"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                disabled={enviando}
                maxLength={1000}
              />
            </div>

            <div className="accionesModalFooter">
              <button
                type="button"
                className="btnModalCancelar"
                onClick={onCerrar}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btnModalSubmit"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderColor: '#d97706' }}
                disabled={enviando}
              >
                {enviando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Enviar Calificación</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
