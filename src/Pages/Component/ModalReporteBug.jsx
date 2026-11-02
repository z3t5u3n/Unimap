import React, { useState } from "react";
import { API_BASE_URL } from "../../config";
import "../../CSS/interfaz.css";

const CATEGORIAS_BUGS = [
  { id: "texturas", label: "Error de texturas / fallas visuales", valor: "Error de texturas / vista" },
  { id: "carga", label: "Error de carga del mapa 3D", valor: "Error de carga del mapa" },
  { id: "lag", label: "Mapa lagueado / bajo rendimiento", valor: "Mapa lagueado o lento" },
  { id: "recorrido", label: "Recorrido con cortes o saltos", valor: "Recorrido con cortes o saltos" },
  { id: "ubicacion", label: "Lugar mal ubicado en el mapa", valor: "Lugar mal ubicado" },
  { id: "nombre", label: "Nombre incorrecto o erróneo", valor: "Nombre de lugar incorrecto" },
  { id: "otro", label: "Otro problema", valor: "Otro problema" },
];

function ModalReporteBug({ visible, onClose, usuario, lugaresDisponibles = [] }) {
  const [tipoError, setTipoError] = useState(CATEGORIAS_BUGS[0].valor);
  const [lugarAfectado, setLugarAfectado] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!descripcion.trim()) {
      setErrorMsg("Por favor ingresa una breve descripción del problema encontrado.");
      return;
    }

    if (!usuario || !usuario.id_usuario) {
      setErrorMsg("No se detectó una sesión activa de usuario.");
      return;
    }

    setEnviando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reporte-mapa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id_usuario: usuario.id_usuario,
          tipo_error: tipoError,
          lugar_afectado: lugarAfectado.trim() || null,
          descripcion: descripcion.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMensajeExito("¡Reporte enviado exitosamente! Gracias por ayudarnos a mejorar UniMap.");
        setTimeout(() => {
          setMensajeExito("");
          setDescripcion("");
          setLugarAfectado("");
          setTipoError(CATEGORIAS_BUGS[0].valor);
          onClose();
        }, 1800);
      } else {
        setErrorMsg(data.message || data.mensaje || "Error al enviar el reporte.");
      }
    } catch (err) {
      console.error("Error al enviar reporte:", err);
      setErrorMsg("Error de conexión al enviar el reporte.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="overlayModalReporte" onClick={onClose}>
      <div className="cardModalReporte" onClick={(e) => e.stopPropagation()}>
        <div className="modalReporteHeader">
          <div className="modalReporteTitulo">
            <div>
              <h3>Reportar Error o Incidencia del Mapa</h3>
              <p>Ayúdanos a solucionar fallas visuales, de rendimiento o navegación</p>
            </div>
          </div>
          <button
            type="button"
            className="btnCerrarModal"
            onClick={onClose}
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {mensajeExito ? (
          <div className="mensajeExitoReporte">
            <h4>{mensajeExito}</h4>
            <p>El equipo técnico revisará la incidencia en el panel administrativo.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="formReporteBug">
            {errorMsg && <div className="alertaErrorReporte">{errorMsg}</div>}

            {/* Categoría del Error */}
            <div className="grupoInputReporte">
              <label>Tipo de problema encontrado *</label>
              <select
                value={tipoError}
                onChange={(e) => setTipoError(e.target.value)}
                className="selectReporte"
              >
                {CATEGORIAS_BUGS.map((cat) => (
                  <option key={cat.id} value={cat.valor}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Lugar Afectado */}
            <div className="grupoInputReporte">
              <label>Lugar, edificio o zona afectada (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: Bloque-E piso 2, Laboratorio-E1, Cafetería..."
                value={lugarAfectado}
                onChange={(e) => setLugarAfectado(e.target.value)}
                className="inputReporte"
                list="sugerenciasLugares"
              />
              {lugaresDisponibles && lugaresDisponibles.length > 0 && (
                <datalist id="sugerenciasLugares">
                  {lugaresDisponibles.slice(0, 30).map((l, idx) => {
                    const nombre = typeof l === "string" ? l : l.name || l.displayName;
                    return <option key={idx} value={nombre} />;
                  })}
                </datalist>
              )}
            </div>

            {/* Descripción */}
            <div className="grupoInputReporte">
              <label>Descripción detallada del error *</label>
              <textarea
                rows="4"
                placeholder="Describe qué ocurrió: texturas oscuras, tirones de FPS, saltos en la cámara, nombre mal escrito, etc."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="textareaReporte"
                required
              />
            </div>

            <div className="infoUsuarioReporte">
              <span>Reportando como: <b>{usuario?.nombres || "Usuario"}</b> ({usuario?.id_usuario})</span>
            </div>

            {/* Botones de acción */}
            <div className="accionesModalReporte">
              <button
                type="button"
                className="btnCancelarReporte"
                onClick={onClose}
                disabled={enviando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btnEnviarReporte"
                disabled={enviando}
              >
                {enviando ? "Enviando..." : "🚀 Enviar Reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ModalReporteBug;
