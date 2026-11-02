import React, { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../../config";
import "../../CSS/interfaz.css";

function DatosUsuarios({ usuario, visible, onClose, onUsuarioActualizado }) {
  const [tabActiva, setTabActiva] = useState("datos"); // 'datos' | 'estadisticas'
  const [subTabStats, setSubTabStats] = useState("sesiones"); // 'sesiones' | 'recorridos'

  // Estados del Formulario de Edición
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Estados para Cambio de Rol a Estudiante
  const [correoInst, setCorreoInst] = useState("");
  const [carreras, setCarreras] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState("");
  const [semestreSeleccionado, setSemestreSeleccionado] = useState("");
  const [solicitandoRol, setSolicitandoRol] = useState(false);
  const [mensajeExitoRol, setMensajeExitoRol] = useState("");
  const [errorMsgRol, setErrorMsgRol] = useState("");

  // Estados de Estadísticas
  const [stats, setStats] = useState(null);
  const [cargandoStats, setCargandoStats] = useState(false);

  // Cargar catálogo de carreras y semestres desde la API
  useEffect(() => {
    const cargarDatosAcademicos = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/datos-academicos`);
        const data = await res.json();
        if (res.ok) {
          setCarreras(data.carreras || []);
          setSemestres(data.semestres || []);
        }
      } catch (err) {
        console.error("Error al cargar datos académicos:", err);
      }
    };
    cargarDatosAcademicos();
  }, []);

  // Refrescar el perfil completo del usuario para traer rol actualizado, carrera y semestre
  const refrescarPerfil = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/usuario/${usuario.id_usuario}/perfil`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.usuario) {
          const usuarioActualizado = { ...usuario, ...data.usuario };
          localStorage.setItem("usuario", JSON.stringify(usuarioActualizado));
          if (onUsuarioActualizado) {
            onUsuarioActualizado(usuarioActualizado);
          }
        }
      }
    } catch (err) {
      console.error("Error al refrescar perfil del usuario:", err);
    }
  }, [usuario, onUsuarioActualizado]);

  useEffect(() => {
    if (visible && usuario?.id_usuario) {
      refrescarPerfil();
    }
  }, [visible, usuario?.id_usuario, refrescarPerfil]);

  // Sincronizar datos iniciales del usuario
  useEffect(() => {
    if (usuario) {
      setNombres(usuario.nombres || "");
      setApellidos(usuario.apellidos || "");
    }
  }, [usuario]);

  // Cargar estadísticas personales del usuario
  const cargarEstadisticas = useCallback(async () => {
    if (!usuario?.id_usuario) return;
    setCargandoStats(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/usuario/${usuario.id_usuario}/estadisticas`
      );
      const data = await response.json();
      if (response.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error("Error al cargar estadísticas personales:", err);
    } finally {
      setCargandoStats(false);
    }
  }, [usuario?.id_usuario]);

  useEffect(() => {
    if (visible && tabActiva === "estadisticas") {
      cargarEstadisticas();
    }
  }, [visible, tabActiva, cargarEstadisticas]);

  // Calcular sugerencia de correo institucional según formato ITFIP / UNIESPINAL (ej: jhernandez71@itfip.edu.co)
  const correoSugerido = (() => {
    if (!usuario?.nombres || !usuario?.apellidos) return "jhernandez71@itfip.edu.co";
    const inicial = usuario.nombres.trim().charAt(0).toLowerCase();
    const primerApellido = usuario.apellidos.trim().split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const ultimosDos = usuario.numero_documento ? usuario.numero_documento.slice(-2) : "71";
    return `${inicial}${primerApellido}${ultimosDos}@itfip.edu.co`;
  })();

  // Manejar solicitud de cambio de rol a Estudiante
  const handleSolicitarCambioRol = async (e) => {
    e.preventDefault();
    setErrorMsgRol("");
    setMensajeExitoRol("");

    const correoLimpio = correoInst.trim().toLowerCase();

    if (!correoLimpio) {
      setErrorMsgRol("Por favor ingresa tu correo institucional.");
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@(itfip|uniespinal)\.edu\.co$/i.test(correoLimpio)) {
      setErrorMsgRol("El correo debe pertenecer al dominio institucional @itfip.edu.co o @uniespinal.edu.co");
      return;
    }

    if (!carreraSeleccionada) {
      setErrorMsgRol("Por favor selecciona tu carrera o programa académico.");
      return;
    }

    if (!semestreSeleccionado) {
      setErrorMsgRol("Por favor selecciona tu semestre actual.");
      return;
    }

    setSolicitandoRol(true);
    try {
      const response = await fetch(`${API_BASE_URL}/usuario/solicitar-cambio-rol`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id_usuario: usuario.id_usuario,
          correo_institucional: correoLimpio,
          id_carrera: parseInt(carreraSeleccionada, 10),
          id_semestre: parseInt(semestreSeleccionado, 10),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMensajeExitoRol(data.mensaje || "Se ha enviado un enlace de confirmación a tu correo institucional.");
      } else {
        setErrorMsgRol(data.mensaje || "Error al solicitar cambio de rol.");
      }
    } catch (err) {
      console.error("Error al solicitar cambio de rol:", err);
      setErrorMsgRol("Error de conexión al enviar la solicitud.");
    } finally {
      setSolicitandoRol(false);
    }
  };

  if (!visible) return null;

  // Manejar guardado de datos
  const handleGuardarDatos = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setMensajeExito("");

    if (!nombres.trim() || !apellidos.trim()) {
      setErrorMsg("Nombres y apellidos son campos obligatorios.");
      return;
    }

    setGuardando(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/usuario/${usuario.id_usuario}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            nombres: nombres.trim(),
            apellidos: apellidos.trim(),
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMensajeExito("¡Datos actualizados exitosamente!");
        // Actualizar en localStorage y notificar al componente padre
        const usuarioActualizado = { ...usuario, ...data.usuario };
        localStorage.setItem("usuario", JSON.stringify(usuarioActualizado));
        if (onUsuarioActualizado) {
          onUsuarioActualizado(usuarioActualizado);
        }
        setTimeout(() => setMensajeExito(""), 2500);
      } else {
        setErrorMsg(data.mensaje || "Error al actualizar los datos.");
      }
    } catch (err) {
      console.error("Error al guardar datos:", err);
      setErrorMsg("Error de conexión al guardar cambios.");
    } finally {
      setGuardando(false);
    }
  };

  const tipoTexto = () => {
    if (!usuario) return "General";
    if (usuario.tipo_usuario === 1) return "General (Trámites y Visita)";
    if (usuario.tipo_usuario === 2) return "Estudiante";
    if (usuario.tipo_usuario === 3) return "Docente";
    return "General";
  };

  const iniciales = usuario?.nombres
    ? usuario.nombres.charAt(0).toUpperCase()
    : "U";

  return (
    <div className="overlayDatosUsuario" onClick={onClose}>
      <div className="cardDatosFlotante modalPerfilEstadisticas" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del Perfil */}
        <div className="cardDatosHeader">
          <div className="avatarUsuario">
            <span>{iniciales}</span>
          </div>
          <div className="titulosUsuario">
            <h3>{usuario ? `${usuario.nombres} ${usuario.apellidos}` : "Mi Cuenta"}</h3>
            <span className="badgeEstado">● Sesión Activa</span>
          </div>
          <button
            type="button"
            className="btnCerrarDatos"
            onClick={onClose}
            title="Ocultar datos"
          >
            ✕
          </button>
        </div>

        {/* Pestañas de navegación interna */}
        <div className="tabsPerfilUsuario">
          <button
            type="button"
            className={`btnTabPerfil ${tabActiva === "datos" ? "activo" : ""}`}
            onClick={() => setTabActiva("datos")}
          >
            ✏️ Mis Datos
          </button>
          <button
            type="button"
            className={`btnTabPerfil ${tabActiva === "estadisticas" ? "activo" : ""}`}
            onClick={() => setTabActiva("estadisticas")}
          >
            📊 Mis Estadísticas
          </button>
          <button
            type="button"
            className={`btnTabPerfil ${tabActiva === "rol" ? "activo" : ""}`}
            onClick={() => setTabActiva("rol")}
          >
            🎓 Cambiar Rol
          </button>
        </div>

        {/* CONTENIDO PESTAÑA 1: FORMULARIO DE DATOS */}
        {tabActiva === "datos" && (
          <form onSubmit={handleGuardarDatos} className="formModificarPerfil">
            {mensajeExito && <div className="alertaExitoPerfil">{mensajeExito}</div>}
            {errorMsg && <div className="alertaErrorPerfil">{errorMsg}</div>}

            <div className="cardDatosBody">
              <div className="campoDato">
                <span className="labelDato">Nombres *</span>
                <input
                  type="text"
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  className="inputPerfil"
                  required
                />
              </div>

              <div className="campoDato">
                <span className="labelDato">Apellidos *</span>
                <input
                  type="text"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  className="inputPerfil"
                  required
                />
              </div>

              <div className="campoDato">
                <span className="labelDato">Número de Documento</span>
                <input
                  type="text"
                  value={usuario?.numero_documento || ""}
                  disabled
                  className="inputPerfil inputDeshabilitado"
                  title="El documento no se puede modificar directamente"
                />
              </div>

              <div className="campoDato">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="labelDato">Tipo de Usuario</span>
                  {usuario?.tipo_usuario !== 2 && (
                    <button
                      type="button"
                      className="btnLinkCambiarRol"
                      onClick={() => setTabActiva("rol")}
                      title="Pasar a rol Estudiante con correo @itfip.edu.co"
                    >
                      🔄 Cambiar a Estudiante
                    </button>
                  )}
                </div>
                <p className="valorDato badgeRol">{tipoTexto()}</p>
              </div>

              {usuario?.correo_institucional && (
                <div className="campoDato campoFull">
                  <span className="labelDato">Correo Institucional Verificado</span>
                  <p className="valorDato" style={{ color: "#4ade80", fontWeight: "600", fontSize: "14px" }}>
                    {usuario.correo_institucional}
                  </p>
                </div>
              )}

              {((usuario?.tipo_usuario === 2) || usuario?.nombre_carrera) && (
                <>
                  <div className="campoDato">
                    <span className="labelDato">Carrera / Programa Académico</span>
                    <p className="valorDato" style={{ fontWeight: "600" }}>
                      {usuario.nombre_carrera || "Estudiante ITFIP"}
                    </p>
                  </div>

                  <div className="campoDato">
                    <span className="labelDato">Semestre Actual</span>
                    <p className="valorDato" style={{ fontWeight: "600" }}>
                      {usuario.nombre_semestre || "En curso"}
                    </p>
                  </div>

                  <div className="campoDato campoFull">
                    <span className="labelDato">Estado y Privilegios en Campus 3D</span>
                    <div className="alertaBeneficioActivo" style={{ margin: "4px 0", fontSize: "12px" }}>
                      Acceso total habilitado a todos los salones, aulas, laboratorios y bloques A, B, C, D y E.
                    </div>
                  </div>
                </>
              )}

              {usuario?.id_usuario && (
                <div className="campoDato campoFull">
                  <span className="labelDato">ID de Usuario (UniMap)</span>
                  <p className="valorDato" style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "14px", fontWeight: "700" }}>
                    {usuario.id_usuario}
                  </p>
                </div>
              )}

              {usuario?.fecha_sys && (
                <div className="campoDato campoFull">
                  <span className="labelDato">Fecha de Registro</span>
                  <p className="valorDato valorPequeno">{usuario.fecha_sys}</p>
                </div>
              )}
            </div>

            <div className="footerFormPerfil">
              <button
                type="submit"
                className="btnGuardarPerfil"
                disabled={guardando}
              >
                {guardando ? "Guardando cambios..." : "💾 Guardar Cambios"}
              </button>
            </div>
          </form>
        )}

        {/* CONTENIDO PESTAÑA 2: ESTADÍSTICAS E HISTORIAL */}
        {tabActiva === "estadisticas" && (
          <div className="seccionEstadisticasPersonales">
            {cargandoStats ? (
              <div className="cargandoStatsUsuario">
                <p>Cargando tus estadísticas personales...</p>
              </div>
            ) : stats ? (
              <>
                {/* Métricas destacadas */}
                <div className="gridMetricasPersonales">
                  <div className="cardMiniMetrica">
                    <div>
                      <small>Inicios de Sesión</small>
                      <h4>{stats.metricas.total_sesiones} veces</h4>
                    </div>
                  </div>

                  <div className="cardMiniMetrica">
                    <div>
                      <small>Lugares Recorridos</small>
                      <h4>{stats.metricas.total_recorridos} visitas</h4>
                    </div>
                  </div>

                  <div className="cardMiniMetrica full">
                    <div>
                      <small>Lugar más buscado</small>
                      <h4 style={{ color: "#38bdf8" }}>
                        {stats.metricas.lugar_mas_buscado}{" "}
                        {stats.metricas.veces_lugar_top > 0 && (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            ({stats.metricas.veces_lugar_top} veces)
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Sub-pestañas de historial */}
                <div className="subTabsHistorial">
                  <button
                    type="button"
                    className={`btnSubTab ${subTabStats === "sesiones" ? "activo" : ""}`}
                    onClick={() => setSubTabStats("sesiones")}
                  >
                    🔐 Historial de Sesiones ({stats.sesiones.length})
                  </button>
                  <button
                    type="button"
                    className={`btnSubTab ${subTabStats === "recorridos" ? "activo" : ""}`}
                    onClick={() => setSubTabStats("recorridos")}
                  >
                    📍 Lugares Recorridos ({stats.recorridos.length})
                  </button>
                </div>

                {/* Tabla de Sesiones */}
                {subTabStats === "sesiones" && (
                  <div className="tablaHistorialPersonalContainer">
                    <table className="tablaHistorialPersonal">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>IP</th>
                          <th>Dispositivo</th>
                          <th>Fecha y Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sesiones.length > 0 ? (
                          stats.sesiones.map((s, idx) => (
                            <tr key={s.id_sesion}>
                              <td>#{idx + 1}</td>
                              <td>{s.ip_acceso || "127.0.0.1"}</td>
                              <td className="columnaDispositivo" title={s.dispositivo}>
                                {s.dispositivo ? (s.dispositivo.length > 25 ? s.dispositivo.slice(0, 25) + "..." : s.dispositivo) : "Navegador Web"}
                              </td>
                              <td>{s.fecha_ingreso}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="sinDatosHistorial">
                              No hay registros de sesión adicionales.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tabla de Recorridos */}
                {subTabStats === "recorridos" && (
                  <div className="tablaHistorialPersonalContainer">
                    <table className="tablaHistorialPersonal">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Lugar (Mesh)</th>
                          <th>Origen</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recorridos.length > 0 ? (
                          stats.recorridos.map((r, idx) => (
                            <tr key={r.id_recorrido}>
                              <td>#{idx + 1}</td>
                              <td>
                                <span className="badgeLugarPersonal">🏢 {r.lugar_mesh}</span>
                              </td>
                              <td>
                                <span className="badgeOrigenPersonal">{r.origen_busqueda}</span>
                              </td>
                              <td>{r.fecha_busqueda}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="sinDatosHistorial">
                              Aún no has buscado lugares en el mapa.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="cargandoStatsUsuario">
                <p>No se pudieron obtener las estadísticas.</p>
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO PESTAÑA 3: CAMBIAR ROL O TIPO DE USUARIO */}
        {tabActiva === "rol" && (
          <div className="seccionCambioRol">
            {usuario?.tipo_usuario === 2 ? (
              <div className="cardRolEstudianteActivo">
                <h3>Estudiante ITFIP Activo</h3>
                <div className="detallesEstudianteCard">
                  <div className="filaDetalleEstudiante">
                    <span className="etiquetaDetalle">Programa / Carrera:</span>
                    <span className="valorDetalle">{usuario.nombre_carrera || "Estudiante ITFIP"}</span>
                  </div>
                  <div className="filaDetalleEstudiante">
                    <span className="etiquetaDetalle">Semestre:</span>
                    <span className="valorDetalle">{usuario.nombre_semestre || "En curso"}</span>
                  </div>
                  <div className="filaDetalleEstudiante">
                    <span className="etiquetaDetalle">Correo Institucional:</span>
                    <span className="valorDetalle correoResaltado">{usuario.correo_institucional || "Verificado"}</span>
                  </div>
                </div>
                <div className="alertaBeneficioActivo">
                  Cuentas con acceso total a todos los <strong>salones, aulas, laboratorios y bloques</strong> del campus universitario en el mapa 3D interactivo.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSolicitarCambioRol} className="formCambioRol">
                <div className="bannerExplicacionRol">
                  <h4>Actualizar Rol a Estudiante</h4>
                  <p>
                    Para recorrer y explorar todos los salones, aulas y laboratorios de los bloques del campus, debes vincular tu correo institucional de estudiante (<strong>@itfip.edu.co</strong>).
                  </p>
                </div>

                <div className="avisoTiempoLimite">
                  <div>
                    <strong>Tiempo límite de confirmación:</strong>
                    <p>Se enviará un enlace de verificación que será válido únicamente durante <b>5 minutos</b>.</p>
                  </div>
                </div>

                {mensajeExitoRol && (
                  <div className="alertaExitoPerfil">
                    {mensajeExitoRol}
                  </div>
                )}

                {errorMsgRol && (
                  <div className="alertaErrorPerfil">
                    {errorMsgRol}
                  </div>
                )}

                <div className="campoDato campoFull">
                  <span className="labelDato">Carrera / Programa Académico *</span>
                  <select
                    value={carreraSeleccionada}
                    onChange={(e) => setCarreraSeleccionada(e.target.value)}
                    className="inputPerfil"
                    required
                  >
                    <option value="">-- Selecciona tu carrera --</option>
                    {carreras.map((c) => (
                      <option key={c.id_carrera} value={c.id_carrera}>
                        {c.carrera}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campoDato campoFull">
                  <span className="labelDato">Semestre Actual *</span>
                  <select
                    value={semestreSeleccionado}
                    onChange={(e) => setSemestreSeleccionado(e.target.value)}
                    className="inputPerfil"
                    required
                  >
                    <option value="">-- Selecciona tu semestre --</option>
                    {semestres.map((s) => (
                      <option key={s.id_semestres} value={s.id_semestres}>
                        {s.semestre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campoDato campoFull">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span className="labelDato">Correo Institucional (ITFIP / UNIESPINAL) *</span>
                    <button
                      type="button"
                      className="btnLinkSugerencia"
                      onClick={() => setCorreoInst(correoSugerido)}
                      title="Haz clic para autocompletar con el formato institucional oficial"
                    >
                      💡 Sugerencia: <b>{correoSugerido}</b>
                    </button>
                  </div>
                  <input
                    type="email"
                    placeholder={`Ej: ${correoSugerido}`}
                    value={correoInst}
                    onChange={(e) => setCorreoInst(e.target.value)}
                    className="inputPerfil"
                    required
                  />
                  <small className="ayudaInput">
                    Formato oficial de correo (ej: <b>{correoSugerido}</b> con dominio <b>@itfip.edu.co</b> o <b>@uniespinal.edu.co</b>)
                  </small>
                </div>

                <div className="footerFormPerfil">
                  <button
                    type="submit"
                    className="btnSolicitarRol"
                    disabled={solicitandoRol}
                  >
                    {solicitandoRol ? "Enviando enlace..." : "📨 Enviar Enlace de Verificación (5 min)"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="cardDatosFooter">
          <small>Presiona <b>Datos</b> en el menú para ocultar o mostrar</small>
        </div>
      </div>
    </div>
  );
}

export default DatosUsuarios;
