import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { CheckCircle2, Clock, AlertTriangle, GraduationCap, MapPin, ArrowRight } from 'lucide-react';

export default function VerificarRol() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const errorParam = searchParams.get('error');
  const exitoParam = searchParams.get('exito');

  const [estado, setEstado] = useState('verificando'); // 'verificando' | 'exito' | 'expirado' | 'error'
  const [mensaje, setMensaje] = useState('');
  const [usuarioActualizado, setUsuarioActualizado] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Si la redirección trae parámetros de error en la query
    if (errorParam === 'token_expirado') {
      setEstado('expirado');
      setMensaje('El enlace de verificación ha expirado (tiempo límite de 5 minutos excedido). Por favor solicita uno nuevo desde tu perfil.');
      return;
    }
    if (errorParam === 'token_utilizado') {
      setEstado('error');
      setMensaje('Este enlace de verificación ya ha sido utilizado anteriormente.');
      return;
    }
    if (errorParam === 'token_invalido' || !token) {
      setEstado('error');
      setMensaje('El token o enlace de verificación no es válido o está incompleto.');
      return;
    }

    if (exitoParam === '1') {
      setEstado('exito');
      setMensaje('¡Tu cuenta ha sido verificada y activada como Estudiante exitosamente!');
      return;
    }

    // Confirmar token contra el backend de Laravel
    const confirmarToken = async () => {
      try {
        const response = await axios.post(
          `${API_BASE_URL}/usuario/confirmar-cambio-rol`,
          { token },
          { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
        );

        if (response.data && response.status === 200) {
          setEstado('exito');
          setMensaje(response.data.mensaje || '¡Rol actualizado a Estudiante exitosamente!');
          if (response.data.usuario) {
            setUsuarioActualizado(response.data.usuario);
            // Sincronizar en localStorage
            try {
              const local = JSON.parse(localStorage.getItem('usuario') || '{}');
              const fusionado = { ...local, ...response.data.usuario, tipo_usuario: 2, nombre_tipo: 'Estudiante' };
              localStorage.setItem('usuario', JSON.stringify(fusionado));
            } catch (e) {
              console.error('Error al actualizar datos locales:', e);
            }
          }
        }
      } catch (err) {
        if (err.response?.status === 410 || err.response?.data?.expirado) {
          setEstado('expirado');
          setMensaje(err.response?.data?.mensaje || 'El enlace de verificación ha expirado (tiempo límite de 5 minutos excedido).');
        } else {
          setEstado('error');
          setMensaje(err.response?.data?.mensaje || 'No fue posible validar el enlace de verificación.');
        }
      }
    };

    confirmarToken();
  }, [token, errorParam, exitoParam]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a0f1d',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '18px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden'
      }}>
        {/* Cabecera */}
        <div style={{
          padding: '24px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0f172a'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '10px'
          }}>
            <GraduationCap size={14} />
            <span>ITFIP &bull; UniMap 3D</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.28rem', color: '#f8fafc', fontWeight: 700 }}>
            Verificación de Estudiante
          </h2>
        </div>

        {/* Contenido según el estado */}
        <div style={{ padding: '32px 28px', textAlign: 'center' }}>
          {/* 1. Verificando */}
          {estado === 'verificando' && (
            <div>
              <div style={{
                width: '42px',
                height: '42px',
                border: '3px solid rgba(56, 189, 248, 0.2)',
                borderTop: '3px solid #38bdf8',
                borderRadius: '50%',
                margin: '0 auto 16px auto',
                animation: 'spin 0.8s linear infinite'
              }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#f8fafc' }}>
                Validando enlace institucional...
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
                Comprobando la autenticidad y vigencia de tu confirmación académica.
              </p>
            </div>
          )}

          {/* 2. Éxito */}
          {estado === 'exito' && (
            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <CheckCircle2 size={34} />
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#10b981', fontWeight: 700 }}>
                ¡Verificación Exitosa!
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {mensaje}
              </p>

              <div style={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '18px',
                textAlign: 'left',
                marginBottom: '26px'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Privilegios Desbloqueados:
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                  <li>Acceso total a <strong>salones, aulas y laboratorios</strong> de los bloques del campus.</li>
                  <li>Recorridos y búsquedas 3D guiadas completas sin restricciones de visitante.</li>
                  <li>Distintivo de <strong>Estudiante ITFIP</strong> en tu perfil institucional.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => navigate('/mapa')}
                style={{
                  width: '100%',
                  padding: '13px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.98rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                }}
              >
                <span>Entrar al Campus 3D</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* 3. Expirado (> 5 minutos) */}
          {estado === 'expirado' && (
            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <Clock size={34} />
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#f59e0b', fontWeight: 700 }}>
                Enlace Expirado
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {mensaje}
              </p>

              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '6px',
                padding: '12px 14px',
                textAlign: 'left',
                fontSize: '0.85rem',
                color: '#fed7aa',
                marginBottom: '24px'
              }}>
                Por motivos de seguridad académica, cada enlace institucional caduca estrictamente tras <strong>5 minutos</strong> de su emisión.
              </div>

              <button
                type="button"
                onClick={() => navigate('/mapa')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer'
                }}
              >
                Volver al Campus y Solicitar Nuevo Enlace
              </button>
            </div>
          )}

          {/* 4. Error o Token Invalido */}
          {estado === 'error' && (
            <div>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <AlertTriangle size={34} />
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#ef4444', fontWeight: 700 }}>
                No se pudo validar el enlace
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {mensaje}
              </p>

              <button
                type="button"
                onClick={() => navigate('/mapa')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  cursor: 'pointer'
                }}
              >
                Volver a UniMap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
