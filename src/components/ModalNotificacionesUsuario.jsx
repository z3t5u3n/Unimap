import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Bell, X, Calendar, RefreshCw, AlertCircle, Info, Wrench, ShieldAlert } from 'lucide-react';

export default function ModalNotificacionesUsuario({
  isOpen,
  onCerrar,
  onActualizarTotal
}) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargarNotificaciones = async () => {
    setCargando(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/notificaciones/activas`);
      const lista = response.data?.notificaciones || [];
      setNotificaciones(lista);
      if (onActualizarTotal) {
        onActualizarTotal(lista.length);
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
      setError('No se pudieron obtener los comunicados en este momento.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarNotificaciones();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getBadgeTipo = (tipo) => {
    const t = (tipo || 'aviso').toLowerCase();
    switch (t) {
      case 'mantenimiento':
        return {
          icon: <Wrench size={13} />,
          text: 'Mantenimiento',
          className: 'badgeNotifMantenimiento'
        };
      case 'urgente':
        return {
          icon: <ShieldAlert size={13} />,
          text: 'Urgente',
          className: 'badgeNotifUrgente'
        };
      case 'actualizacion':
        return {
          icon: <RefreshCw size={13} />,
          text: 'Actualización',
          className: 'badgeNotifActualizacion'
        };
      case 'aviso':
      default:
        return {
          icon: <Info size={13} />,
          text: 'Comunicado',
          className: 'badgeNotifAviso'
        };
    }
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '';
    try {
      const d = new Date(fechaStr);
      return d.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return fechaStr;
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
            <div className="avatarCircle" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              <Bell size={24} />
            </div>
            <div>
              <h3>Avisos y Comunicados</h3>
              <span className="badgeRol" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                Notificaciones Oficiales UniMap
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btnClosePanel"
              onClick={cargarNotificaciones}
              title="Recargar avisos"
              disabled={cargando}
            >
              <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="btnClosePanel"
              onClick={onCerrar}
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Lista de Notificaciones */}
        <div className="contenidoNotificacionesUsuario">
          {cargando ? (
            <div className="cargandoNotificaciones">
              <RefreshCw size={24} className="animate-spin" color="#38bdf8" />
              <p>Consultando anuncios activos...</p>
            </div>
          ) : error ? (
            <div className="modalAlertError">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="notificacionesVacias">
              <Bell size={40} className="iconoNotifVacio" />
              <h4>No hay avisos pendientes</h4>
              <p>El campus y la plataforma se encuentran operando con total normalidad.</p>
            </div>
          ) : (
            <div className="listaNotificacionesUsuario">
              {notificaciones.map((notif) => {
                const badge = getBadgeTipo(notif.tipo);
                return (
                  <div key={notif.id_notificacion || notif.id} className="itemNotificacionUsuario">
                    <div className="itemNotifHeader">
                      <span className={`badgeNotifTipo ${badge.className}`}>
                        {badge.icon}
                        <span>{badge.text}</span>
                      </span>
                      <span className="itemNotifFecha">
                        <Calendar size={12} />
                        {formatearFecha(notif.fecha_creacion || notif.created_at)}
                      </span>
                    </div>

                    <h4 className="itemNotifTitulo">{notif.titulo}</h4>
                    <p className="itemNotifMensaje">{notif.mensaje}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="accionesModalFooter" style={{ marginTop: '16px' }}>
          <button type="button" className="btnModalSubmit" style={{ width: '100%' }} onClick={onCerrar}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
