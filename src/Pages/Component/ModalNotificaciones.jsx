import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../../config";
import "../../CSS/interfaz.css";

function ModalNotificaciones({ visible, onClose, usuario, onNotificacionesActualizadas }) {
  const [tab, setTab] = useState("notificaciones"); // "notificaciones" | "encuesta"
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargandoNotis, setCargandoNotis] = useState(false);

  // Estados de Encuesta
  const [encuesta, setEncuesta] = useState(null);
  const [haRespondido, setHaRespondido] = useState(false);
  const [cargandoEncuesta, setCargandoEncuesta] = useState(false);
  const [calificacionGeneral, setCalificacionGeneral] = useState(5);
  const [facilidadUso, setFacilidadUso] = useState(5);
  const [calidadMapa3D, setCalidadMapa3D] = useState(5);
  const [comentarios, setComentarios] = useState("");
  const [hoverEstrellas, setHoverEstrellas] = useState(0);
  const [enviandoEncuesta, setEnviandoEncuesta] = useState(false);
  const [mensajeExitoEncuesta, setMensajeExitoEncuesta] = useState("");
  const [errorEncuesta, setErrorEncuesta] = useState("");

  // Cargar notificaciones activas
  const cargarNotificaciones = useCallback(async () => {
    setCargandoNotis(true);
    try {
      const response = await fetch(`${API_BASE_URL}/notificaciones/activas`);
      const data = await response.json();
      if (response.ok) {
        setNotificaciones(data.notificaciones || []);
        if (typeof onNotificacionesActualizadas === "function") {
          onNotificacionesActualizadas(data.total || 0);
        }
      }
    } catch (err) {
      console.error("Error al obtener notificaciones:", err);
    } finally {
      setCargandoNotis(false);
    }
  }, [onNotificacionesActualizadas]);

  // Cargar encuesta activa y estado de respuesta del usuario
  const cargarEncuesta = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    setCargandoEncuesta(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/encuestas/activa?id_usuario=${encodeURIComponent(usuario.id_usuario)}`
      );
      const data = await response.json();
      if (response.ok && data.activa) {
        setEncuesta(data.encuesta);
        setHaRespondido(data.ha_respondido || false);
      } else {
        setEncuesta(null);
        setHaRespondido(false);
      }
    } catch (err) {
      console.error("Error al obtener encuesta activa:", err);
    } finally {
      setCargandoEncuesta(false);
    }
  }, [usuario?.id_usuario]);

  useEffect(() => {
    if (visible) {
      cargarNotificaciones();
      cargarEncuesta();
    }
  }, [visible, cargarNotificaciones, cargarEncuesta]);

  if (!visible) return null;

  // Enviar respuesta a la encuesta
  const handleSubmitEncuesta = async (e) => {
    e.preventDefault();
    setErrorEncuesta("");
    if (!encuesta) return;
    if (!usuario?.id_usuario) {
      setErrorEncuesta("Debes tener una sesión activa para enviar la encuesta.");
      return;
    }

    setEnviandoEncuesta(true);
    try {
      const response = await fetch(`${API_BASE_URL}/encuestas/responder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id_encuesta: encuesta.id_encuesta,
          id_usuario: usuario.id_usuario,
          calificacion_general: calificacionGeneral,
          facilidad_uso: facilidadUso,
          calidad_mapa_3d: calidadMapa3D,
          comentarios: comentarios.trim() || null,
        }),
      });

      const res = await response.json();
      if (response.ok) {
        setMensajeExitoEncuesta("¡Muchas gracias! Tu opinión ha sido registrada correctamente.");
        setHaRespondido(true);
      } else {
        setErrorEncuesta(res.mensaje || "Error al registrar la encuesta.");
      }
    } catch (err) {
      console.error("Error al responder encuesta:", err);
      setErrorEncuesta("Error de conexión al enviar la encuesta.");
    } finally {
      setEnviandoEncuesta(false);
    }
  };

  const getTipoNotiBadge = (tipo) => {
    switch (tipo) {
      case "mantenimiento":
        return { label: "Mantenimiento Programado", clase: "notiBadgeMantenimiento" };
      case "urgente":
        return { label: "Aviso Urgente", clase: "notiBadgeUrgente" };
      case "actualizacion":
        return { label: "Nueva Actualización", clase: "notiBadgeActualizacion" };
      default:
        return { label: "Comunicado General", clase: "notiBadgeAviso" };
    }
  };

  const textosEstrellas = {
    1: "1 estrella - Muy deficiente",
    2: "2 estrellas - Regular",
    3: "3 estrellas - Aceptable",
    4: "4 estrellas - Buena experiencia",
    5: "5 estrellas - ¡Excelente plataforma!",
  };

  return (
    <div className="overlayModalReporte" onClick={onClose}>
      <div className="cardModalReporte modalNotificacionesCard" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del Modal */}
        <div className="modalReporteHeader">
          <div className="modalReporteTitulo">
            <div>
              <h3>Centro de Notificaciones y Opinión</h3>
              <p>Avisos oficiales de mantenimiento y evaluación del campus 3D</p>
            </div>
          </div>
          <button
            type="button"
            className="btnCerrarModal"
            onClick={onClose}
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {/* Selector de Pestañas */}
        <div className="modalNotificacionesTabs">
          <button
            type="button"
            className={`btnTabNotiModal ${tab === "notificaciones" ? "activo" : ""}`}
            onClick={() => setTab("notificaciones")}
          >
            📢 Avisos Oficiales ({notificaciones.length})
          </button>
          <button
            type="button"
            className={`btnTabNotiModal ${tab === "encuesta" ? "activo" : ""}`}
            onClick={() => setTab("encuesta")}
          >
            ⭐ Encuesta de Satisfacción {haRespondido ? "(Completada)" : ""}
          </button>
        </div>

        {/* PESTAÑA 1: COMUNICADOS Y AVISOS */}
        {tab === "notificaciones" && (
          <div className="modalNotiContenido">
            {cargandoNotis ? (
              <div className="estadoCargandoModal">
                <p>Consultando comunicados del servidor...</p>
              </div>
            ) : notificaciones.length > 0 ? (
              <div className="listaNotificacionesUsuario">
                {notificaciones.map((n) => {
                  const badge = getTipoNotiBadge(n.tipo);
                  return (
                    <div key={n.id_notificacion} className="cardNotificacionItem">
                      <div className="cardNotiTopRow">
                        <span className={`badgeNotiTipo ${badge.clase}`}>{badge.label}</span>
                        <span className="fechaNotiItem">
                          {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <h4 className="tituloNotiItem">{n.titulo}</h4>
                      <p className="mensajeNotiItem">{n.mensaje}</p>
                      <div className="footerNotiItem">
                        <span>Emisor: Soporte Técnico UniMap ITFIP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="vacioModalNotificaciones">
                <h4>No hay comunicados activos</h4>
                <p>Todos los servicios del campus 3D están operando con total normalidad.</p>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: ENCUESTA DE SATISFACCIÓN */}
        {tab === "encuesta" && (
          <div className="modalNotiContenido">
            {cargandoEncuesta ? (
              <div className="estadoCargandoModal">
                <p>Cargando encuesta de satisfacción...</p>
              </div>
            ) : !encuesta ? (
              <div className="vacioModalNotificaciones">
                <h4>No hay encuestas disponibles en este momento</h4>
                <p>Agradecemos tu interés en compartir tus comentarios con la comunidad.</p>
              </div>
            ) : haRespondido || mensajeExitoEncuesta ? (
              <div className="encuestaCompletadaBox">
                <div className="iconoCompletado">✓</div>
                <h4>¡Encuesta completada!</h4>
                <p>
                  Ya has registrado tu opinión para <strong>"{encuesta.titulo}"</strong>. Tu
                  valoración es analizada por la administración para optimizar los recorridos
                  y el rendimiento del visor 3D.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitEncuesta} className="formularioEncuestaUsuario">
                <div className="encuestaIntroHeader">
                  <h4>{encuesta.titulo}</h4>
                  {encuesta.descripcion && <p>{encuesta.descripcion}</p>}
                </div>

                {errorEncuesta && (
                  <div className="errorReporteBox">
                    <p>{errorEncuesta}</p>
                  </div>
                )}

                {/* Pregunta 1: Calificación General con Estrellas */}
                <div className="campoEncuestaGroup">
                  <label className="labelEncuesta">
                    1. ¿Cómo calificarías tu experiencia general con UniMap 3D?
                  </label>
                  <div className="estrellasSelector">
                    {[1, 2, 3, 4, 5].map((estrella) => (
                      <button
                        key={estrella}
                        type="button"
                        className={`btnEstrella ${(hoverEstrellas || calificacionGeneral) >= estrella ? "estrellaActiva" : ""}`}
                        onMouseEnter={() => setHoverEstrellas(estrella)}
                        onMouseLeave={() => setHoverEstrellas(0)}
                        onClick={() => setCalificacionGeneral(estrella)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span className="textoAyudaEstrella">
                    {textosEstrellas[hoverEstrellas || calificacionGeneral]}
                  </span>
                </div>

                {/* Pregunta 2: Facilidad de Uso */}
                <div className="campoEncuestaGroup">
                  <label className="labelEncuesta">
                    2. Facilidad para encontrar edificios y orientarte en el campus:
                  </label>
                  <div className="selectorPuntuacionBotones">
                    {[1, 2, 3, 4, 5].map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        className={`btnPuntuacion ${facilidadUso === valor ? "activo" : ""}`}
                        onClick={() => setFacilidadUso(valor)}
                      >
                        {valor}
                      </button>
                    ))}
                  </div>
                  <div className="extremosPuntuacion">
                    <span>1 = Muy difícil</span>
                    <span>5 = Muy fácil e intuitivo</span>
                  </div>
                </div>

                {/* Pregunta 3: Calidad visual y rendimiento 3D */}
                <div className="campoEncuestaGroup">
                  <label className="labelEncuesta">
                    3. Calidad gráfica, texturas y fluidez del mapa 3D:
                  </label>
                  <div className="selectorPuntuacionBotones">
                    {[1, 2, 3, 4, 5].map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        className={`btnPuntuacion ${calidadMapa3D === valor ? "activo" : ""}`}
                        onClick={() => setCalidadMapa3D(valor)}
                      >
                        {valor}
                      </button>
                    ))}
                  </div>
                  <div className="extremosPuntuacion">
                    <span>1 = Con errores / lento</span>
                    <span>5 = Excelente fidelidad y rapidez</span>
                  </div>
                </div>

                {/* Pregunta 4: Comentarios abiertos */}
                <div className="campoEncuestaGroup">
                  <label className="labelEncuesta">
                    4. Sugerencias o comentarios de mejora (opcional):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Cuéntanos qué te gustaría ver en próximas versiones o si experimentaste alguna dificultad..."
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    className="textareaEncuesta"
                    maxLength={1000}
                  />
                </div>

                <div className="accionesEncuesta">
                  <button
                    type="submit"
                    className="btnEnviarEncuesta"
                    disabled={enviandoEncuesta}
                  >
                    {enviandoEncuesta ? "Enviando..." : "Enviar Encuesta"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ModalNotificaciones;
