import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { User, GraduationCap, IdCard, Mail, Calendar, Compass, X, Check, Edit2, AlertCircle } from 'lucide-react';

export default function PanelDatos({ usuario, onCerrar, onUsuarioActualizado }) {
  const [perfil, setPerfil] = useState(usuario || {});
  const [stats, setStats] = useState(null);
  const [editando, setEditando] = useState(false);

  const [nombres, setNombres] = useState(usuario?.nombres || '');
  const [apellidos, setApellidos] = useState(usuario?.apellidos || '');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

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
  }, [usuario?.id_usuario, onUsuarioActualizado]);

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

  const esEstudiante = perfil.nombre_tipo === 'Estudiante' || perfil.tipo_usuario === 2;

  return (
    <div
      className="panelDatosOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="panelDatosCard" onClick={(e) => e.stopPropagation()}>
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

        {mensaje && (
          <div className="alertSuccess" style={{ margin: '14px 0 0 0' }}>
            <Check size={16} />
            <span>{mensaje}</span>
          </div>
        )}

        {error && (
          <div className="alertError" style={{ margin: '14px 0 0 0' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario / Visualización de Datos */}
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
            {/* 1. Datos Personales */}
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

            {/* 2. Datos Académicos si es estudiante */}
            {esEstudiante && (
              <div className="seccionDatosItem academico">
                <div className="itemRow">
                  <GraduationCap size={18} color="#10b981" />
                  <div>
                    <small>Programa Académico</small>
                    <b>{perfil.nombre_carrera || 'Ingeniería de Sistemas'}</b>
                  </div>
                </div>

                <div className="itemRow">
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
                      <b>{perfil.correo_institucional}</b>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Estadísticas personales del campus */}
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
    </div>
  );
}
