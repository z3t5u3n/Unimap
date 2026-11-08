import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { AlertTriangle, X, Check, Send, MapPin, Loader2 } from 'lucide-react';

const TIPOS_ERROR = [
  'Punto mal ubicado / POI erróneo',
  'Camino o ruta bloqueada',
  'Nombre de lugar incorrecto',
  'Error visual o gráfico 3D',
  'Lentitud o congelamiento',
  'Otro problema'
];

export default function ModalReportarError({
  usuario,
  lugarSugerido,
  isOpen,
  onCerrar
}) {
  const [tipoError, setTipoError] = useState(TIPOS_ERROR[0]);
  const [lugarAfectado, setLugarAfectado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');

  // Actualizar lugar afectado cuando cambia el lugar sugerido o se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (lugarSugerido) {
        setLugarAfectado(lugarSugerido.displayName || lugarSugerido.nombre || lugarSugerido.meshName || '');
      } else {
        setLugarAfectado('');
      }
      setDescripcion('');
      setError('');
      setExito(false);
    }
  }, [isOpen, lugarSugerido]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!descripcion.trim()) {
      setError('Por favor describe el problema para que el equipo pueda corregirlo.');
      return;
    }

    if (!usuario?.id_usuario) {
      setError('Debes tener una sesión activa para enviar un reporte.');
      return;
    }

    setEnviando(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/reporte-mapa`, {
        id_usuario: usuario.id_usuario,
        tipo_error: tipoError,
        lugar_afectado: lugarAfectado.trim() || null,
        descripcion: descripcion.trim()
      });

      if (response.status === 200 || response.status === 201) {
        setExito(true);
        setTimeout(() => {
          onCerrar();
        }, 1800);
      }
    } catch (err) {
      console.error('Error al enviar reporte:', err);
      const msg =
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'No se pudo registrar el reporte. Por favor intenta de nuevo.';
      setError(msg);
    } finally {
      setEnviando(false);
    }
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
            <div className="avatarCircle" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3>Reportar Error del Mapa</h3>
              <span className="badgeRol" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}>
                Incidencias y Bugs 3D
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

        {exito ? (
          <div className="modalFeedbackExito">
            <div className="iconoCheckAnimado">
              <Check size={32} />
            </div>
            <h4>¡Reporte Enviado con Éxito!</h4>
            <p>
              Gracias por ayudarnos a mejorar UniMap 3D. El equipo técnico revisará la incidencia y ajustará el mapa.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="formModalUsuario">
            {error && (
              <div className="modalAlertError">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="campoModal">
              <label htmlFor="tipo_error">Tipo de Error o Incidencia:</label>
              <select
                id="tipo_error"
                value={tipoError}
                onChange={(e) => setTipoError(e.target.value)}
                disabled={enviando}
              >
                {TIPOS_ERROR.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="campoModal">
              <label htmlFor="lugar_afectado">
                Lugar, Bloque o Punto Afectado: <span className="labelOpcional">(Opcional)</span>
              </label>
              <div className="inputConIcono">
                <MapPin size={16} className="iconoInput" />
                <input
                  id="lugar_afectado"
                  type="text"
                  placeholder="Ej: Bloque E - Piso 2, Cafetería Nueva, etc."
                  value={lugarAfectado}
                  onChange={(e) => setLugarAfectado(e.target.value)}
                  disabled={enviando}
                />
              </div>
            </div>

            <div className="campoModal">
              <label htmlFor="descripcion_error">
                Descripción Detallada del Problema: <span className="labelRequerido">*</span>
              </label>
              <textarea
                id="descripcion_error"
                rows={4}
                placeholder="Explica qué ocurre (ej: la flecha atraviesa una pared, el salón está en otro piso, la cámara se queda pegada...)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={enviando}
                required
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
                className="btnModalSubmit btnModalSubmitDanger"
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
                    <span>Enviar Reporte</span>
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
