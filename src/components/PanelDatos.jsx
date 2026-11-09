import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import {
  User,
  GraduationCap,
  IdCard,
  Mail,
  Calendar,
  Compass,
  X,
  Check,
  Edit2,
  AlertCircle,
  Clock,
  Send,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function PanelDatos({ usuario, onCerrar, onUsuarioActualizado }) {
  const [tabActiva, setTabActiva] = useState('perfil'); // 'perfil' | 'estudiante'
  const [perfil, setPerfil] = useState(usuario || {});
  const [stats, setStats] = useState(null);
  const [editando, setEditando] = useState(false);

  // Formulario editar nombres
  const [nombres, setNombres] = useState(usuario?.nombres || '');
  const [apellidos, setApellidos] = useState(usuario?.apellidos || '');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Formulario solicitar rol de estudiante
  const [carreras, setCarreras] = useState([]);
  const [semestres, setSemestres] = useState([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState('');
  const [semestreSeleccionado, setSemestreSeleccionado] = useState('');
  const [correoInst, setCorreoInst] = useState('');
  const [solicitandoRol, setSolicitandoRol] = useState(false);
  const [mensajeExitoRol, setMensajeExitoRol] = useState('');
  const [errorRol, setErrorRol] = useState('');

  // 1. Cargar perfil actualizado desde Laravel
  useEffect(() => {
    if (!usuario?.id_usuario) return;

    axios
      .get(`${API_BASE_URL}/usuario/${usuario.id_usuario}/perfil`)
      .then((res) => {
        if (res.data && res.data.usuario) {
          setPerfil(res.data.usuario);
          setNombres(res.data.usuario.nombres || '');
          setApellidos(res.data.usuario.apellidos || '');
          localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
          if (onUsuarioActualizado) onUsuarioActualizado(res.data.usuario);
        }
      })
      .catch((err) => console.log('Aviso perfil:', err.message));

    // Cargar estadísticas
    axios
      .get(`${API_BASE_URL}/usuario/${usuario.id_usuario}/estadisticas`)
      .then((res) => setStats(res.data))
      .catch((err) => console.log('Aviso stats:', err.message));

    // Cargar catálogo de datos académicos (carreras y semestres)
    axios
      .get(`${API_BASE_URL}/datos-academicos`)
      .then((res) => {
        if (res.data) {
          setCarreras(res.data.carreras || []);
          setSemestres(res.data.semestres || []);
        }
      })
      .catch((err) => console.log('Aviso carreras:', err.message));
  }, [usuario?.id_usuario, onUsuarioActualizado]);

  // Sugerencia de correo institucional según formato ITFIP:
  // 1ª letra del primer nombre + primer apellido + 2 últimos dígitos de la CC + @itfip.edu.co
  const correoSugerido = (() => {
    const normalizar = (str) =>
      (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // 1. Primera letra del primer nombre (ej: "Juan Carlos" -> "j")
    const nombreCompleto = (nombres || perfil.nombres || usuario?.nombres || '').trim();
    const primerNombre = nombreCompleto.split(/\s+/)[0] || '';
    const inicialNombre = normalizar(primerNombre).replace(/[^a-z0-9]/g, '').charAt(0) || 'e';

    // 2. Primer apellido (ej: "Hernández Pérez" -> "hernandez")
    const apellidoCompleto = (apellidos || perfil.apellidos || usuario?.apellidos || '').trim();
    const primerApellido = apellidoCompleto.split(/\s+/)[0] || '';
    const apellidoLimpio = normalizar(primerApellido).replace(/[^a-z0-9]/g, '') || 'estudiante';

    // 3. Dos últimos dígitos del número de documento / CC (ej: "1110594371" -> "71")
    const numDoc = String(perfil.numero_documento || usuario?.numero_documento || '').replace(/\D/g, '');
    const ultimosDosCC = numDoc.length >= 2 ? numDoc.slice(-2) : (numDoc || '00');

    return `${inicialNombre}${apellidoLimpio}${ultimosDosCC}@itfip.edu.co`;
  })();

  // 2. Guardar edición de nombres / apellidos
  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!nombres.trim() || !apellidos.trim()) {
      setError('Nombres y apellidos son requeridos.');
      return;
    }

    setGuardando(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/usuario/${usuario.id_usuario}`, {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
      });

      if (response.data && response.data.usuario) {
        setPerfil(response.data.usuario);
        localStorage.setItem('usuario', JSON.stringify(response.data.usuario));
        if (onUsuarioActualizado) onUsuarioActualizado(response.data.usuario);
        setMensaje('Datos actualizados con éxito.');
        setEditando(false);
      }
    } catch (err) {
      console.error('Error al actualizar:', err);
      setError('No se pudo guardar la información.');
    } finally {
      setGuardando(false);
    }
  };

  // 3. Solicitar cambio de rol a Estudiante
  const handleSolicitarRolEstudiante = async (e) => {
    e.preventDefault();
    setMensajeExitoRol('');
    setErrorRol('');

    const correoLimpio = correoInst.trim().toLowerCase();

    if (!correoLimpio) {
      setErrorRol('Por favor ingresa tu correo institucional.');
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@(itfip|uniespinal)\.edu\.co$/i.test(correoLimpio)) {
      setErrorRol('El correo debe pertenecer al dominio institucional @itfip.edu.co o @uniespinal.edu.co');
      return;
    }

    if (!carreraSeleccionada) {
      setErrorRol('Por favor selecciona tu carrera o programa académico.');
      return;
    }

    if (!semestreSeleccionado) {
      setErrorRol('Por favor selecciona tu semestre actual.');
      return;
    }

    setSolicitandoRol(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/usuario/solicitar-cambio-rol`, {
        id_usuario: perfil.id_usuario,
        correo_institucional: correoLimpio,
        id_carrera: parseInt(carreraSeleccionada, 10),
        id_semestre: parseInt(semestreSeleccionado, 10),
      });

      if (res.data) {
        setMensajeExitoRol(res.data.mensaje || 'Enlace de verificación enviado a tu correo institucional. Tienes 5 minutos para confirmarlo.');
      }
    } catch (err) {
      console.error('Error al solicitar rol:', err);
      setErrorRol(err.response?.data?.mensaje || 'No fue posible enviar la solicitud de cambio de rol.');
    } finally {
      setSolicitandoRol(false);
    }
  };

  const esEstudiante = perfil.nombre_tipo === 'Estudiante' || perfil.tipo_usuario === 2;

  return (
    <div
      className="panelDatosOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="panelDatosCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        {/* Cabecera del Panel */}
        <div className="panelDatosHeader">
          <div className="avatarGroup">
            <div className={`avatarCircle ${esEstudiante ? 'estudiante' : ''}`}>
              {esEstudiante ? <GraduationCap size={26} /> : <User size={26} />}
            </div>
            <div>
              <h3>{perfil.nombres} {perfil.apellidos}</h3>
              <span className={`badgeRol ${esEstudiante ? 'estudiante' : 'general'}`}>
                {esEstudiante ? '🎓 Estudiante ITFIP' : '👤 Usuario General / Visitante'}
              </span>
            </div>
          </div>

          <button type="button" className="btnClosePanel" onClick={onCerrar} title="Volver al Mapa">
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de Navegación del Panel */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          padding: '4px 16px 0 16px',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={() => setTabActiva('perfil')}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: 'transparent',
              color: tabActiva === 'perfil' ? '#38bdf8' : '#94a3b8',
              border: 'none',
              borderBottom: tabActiva === 'perfil' ? '2px solid #38bdf8' : '2px solid transparent',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <User size={15} />
            <span>Mi Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('estudiante')}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: 'transparent',
              color: tabActiva === 'estudiante' ? '#10b981' : '#94a3b8',
              border: 'none',
              borderBottom: tabActiva === 'estudiante' ? '2px solid #10b981' : '2px solid transparent',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <GraduationCap size={16} />
            <span>{esEstudiante ? 'Datos de Estudiante' : 'Activar como Estudiante'}</span>
          </button>
        </div>

        {/* PESTAÑA 1: MI PERFIL */}
        {tabActiva === 'perfil' && (
          <div style={{ padding: '20px' }}>
            {mensaje && (
              <div className="alertSuccess" style={{ margin: '0 0 16px 0' }}>
                <Check size={16} />
                <span>{mensaje}</span>
              </div>
            )}

            {error && (
              <div className="alertError" style={{ margin: '0 0 16px 0' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {editando ? (
              <form onSubmit={handleGuardarCambios} className="formEdicionDatos">
                <div className="inputGroup">
                  <label>Nombres</label>
                  <input
                    type="text"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    disabled={guardando}
                    required
                  />
                </div>

                <div className="inputGroup">
                  <label>Apellidos</label>
                  <input
                    type="text"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    disabled={guardando}
                    required
                  />
                </div>

                <div className="btnGroupEdicion">
                  <button type="submit" className="btnGuardarDatos" disabled={guardando}>
                    <Check size={16} />
                    <span>{guardando ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                  <button
                    type="button"
                    className="btnCancelarEdicion"
                    onClick={() => setEditando(false)}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="datosGridInfo">
                <div className="seccionDatosItem">
                  <div className="itemRow">
                    <IdCard size={18} color="var(--primary-map)" />
                    <div>
                      <small>Documento de Identidad</small>
                      <b>{perfil.numero_documento || 'No registrado'}</b>
                    </div>
                  </div>

                  <div className="itemRow">
                    <User size={18} color="var(--primary-uni)" />
                    <div>
                      <small>Código / ID de Usuario</small>
                      <code>{perfil.id_usuario || 'unimap...'}</code>
                    </div>
                  </div>
                </div>

                {/* Estadísticas personales */}
                {stats && (
                  <div className="seccionStatsUser">
                    <div className="statMiniCard">
                      <span>Sesiones</span>
                      <b>{stats.total_sesiones || 1}</b>
                    </div>
                    <div className="statMiniCard">
                      <span>Recorridos</span>
                      <b>{stats.total_recorridos || 0}</b>
                    </div>
                    {stats.bloque_top && (
                      <div className="statMiniCard">
                        <span>Bloque Frecuente</span>
                        <b>{stats.bloque_top.bloque}</b>
                      </div>
                    )}
                  </div>
                )}

                <button type="button" className="btnEditarPerfil" onClick={() => setEditando(true)}>
                  <Edit2 size={15} />
                  <span>Editar Nombres y Apellidos</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: ACTIVACIÓN Y GESTIÓN DE ROL ESTUDIANTE */}
        {tabActiva === 'estudiante' && (
          <div style={{ padding: '20px' }}>
            {esEstudiante ? (
              <div style={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '14px' }}>
                  <CheckCircle2 size={20} />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Estudiante ITFIP Verificado</h4>
                </div>

                <div className="seccionDatosItem academico" style={{ margin: 0, border: 'none', background: 'transparent', padding: 0 }}>
                  <div className="itemRow" style={{ marginBottom: '10px' }}>
                    <GraduationCap size={18} color="#10b981" />
                    <div>
                      <small>Programa Académico</small>
                      <b>{perfil.nombre_carrera || 'Ingeniería de Sistemas'}</b>
                    </div>
                  </div>

                  <div className="itemRow" style={{ marginBottom: '10px' }}>
                    <Calendar size={18} color="#10b981" />
                    <div>
                      <small>Semestre Activo</small>
                      <b>{perfil.nombre_semestre || 'Semestre Actual'}</b>
                    </div>
                  </div>

                  {perfil.correo_institucional && (
                    <div className="itemRow">
                      <Mail size={18} color="#10b981" />
                      <div>
                        <small>Correo Institucional</small>
                        <b style={{ color: '#38bdf8' }}>{perfil.correo_institucional}</b>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  color: '#a7f3d0',
                  lineHeight: '1.5'
                }}>
                  ✅ Tienes acceso total a todos los <strong>salones, aulas de clase, laboratorios y bloques</strong> del campus 3D.
                </div>
              </div>
            ) : (
              <div>
                <div style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', marginBottom: '6px' }}>
                    <Sparkles size={16} />
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Activar Rol de Estudiante</h4>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                    Vincula tu correo institucional de estudiante (<strong>@itfip.edu.co</strong> o <strong>@uniespinal.edu.co</strong>) para desbloquear el acceso a salones de clase y laboratorios en el mapa 3D.
                  </p>
                </div>

                {mensajeExitoRol && (
                  <div className="alertSuccess" style={{ margin: '0 0 16px 0' }}>
                    <Check size={16} />
                    <span>{mensajeExitoRol}</span>
                  </div>
                )}

                {errorRol && (
                  <div className="alertError" style={{ margin: '0 0 16px 0' }}>
                    <AlertCircle size={16} />
                    <span>{errorRol}</span>
                  </div>
                )}

                <form onSubmit={handleSolicitarRolEstudiante}>
                  <div className="inputGroup" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.84rem', color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                      Carrera o Programa Académico *
                    </label>
                    <select
                      value={carreraSeleccionada}
                      onChange={(e) => setCarreraSeleccionada(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem'
                      }}
                    >
                      <option value="">-- Selecciona tu carrera --</option>
                      {carreras.map((c) => (
                        <option key={c.id_carrera} value={c.id_carrera}>
                          {c.carrera}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="inputGroup" style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.84rem', color: '#cbd5e1', marginBottom: '4px', display: 'block' }}>
                      Semestre Actual *
                    </label>
                    <select
                      value={semestreSeleccionado}
                      onChange={(e) => setSemestreSeleccionado(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem'
                      }}
                    >
                      <option value="">-- Selecciona tu semestre --</option>
                      {semestres.map((s) => (
                        <option key={s.id_semestres} value={s.id_semestres}>
                          {s.semestre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="inputGroup" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
                        Correo Institucional *
                      </label>
                      <button
                        type="button"
                        onClick={() => setCorreoInst(correoSugerido)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline'
                        }}
                      >
                        Sugerir: {correoSugerido}
                      </button>
                    </div>
                    <input
                      type="email"
                      placeholder={`Ej: ${correoSugerido}`}
                      value={correoInst}
                      onChange={(e) => setCorreoInst(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem'
                      }}
                    />
                    <small style={{ display: 'block', marginTop: '6px', fontSize: '0.74rem', color: '#94a3b8' }}>
                      Estructura institucional: 1ª letra de tu nombre + 1er apellido + 2 últimos dígitos de tu documento + @itfip.edu.co
                    </small>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    marginBottom: '18px'
                  }}>
                    <Clock size={13} color="#f59e0b" />
                    <span>El enlace enviado a tu correo caducará en <strong>5 minutos</strong>.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={solicitandoRol}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <Send size={16} />
                    <span>{solicitandoRol ? 'Enviando enlace...' : 'Enviar Enlace de Verificación'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
