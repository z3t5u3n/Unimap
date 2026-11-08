import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { LogOut, User, Shield, MapPin, Sparkles } from 'lucide-react';

export default function MapaPreview() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    const rawUser = localStorage.getItem('usuario');
    const rawAdmin = localStorage.getItem('admin_session');

    if (rawAdmin) {
      setEsAdmin(true);
      setUsuario(JSON.parse(rawAdmin));
    } else if (rawUser) {
      setUsuario(JSON.parse(rawUser));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    localStorage.removeItem('admin_session');
    navigate('/login');
  };

  return (
    <div className="LoginPage">
      <Header />
      <div className="LoginContainer">
        <div className="LoginCard" style={{ maxWidth: '480px', textAlign: 'center' }}>
          <div className="LoginHeader">
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
            <h2>
              {esAdmin
                ? `Bienvenido, Administrador`
                : `¡Hola, ${usuario?.nombres || 'Estudiante'}!`}
            </h2>
            <p>Has iniciado sesión correctamente en UniMap</p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '20px',
              background: 'var(--bg-body)',
              border: '1px solid var(--border-color)',
              marginBottom: '20px',
              color: esAdmin ? 'var(--primary-uni)' : 'var(--accent-primary)',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {esAdmin ? <Shield size={16} /> : <User size={16} />}
            <span>
              {esAdmin
                ? `Admin: ${usuario?.username || 'admin'}`
                : `${usuario?.nombres || ''} ${usuario?.apellidos || ''} (Doc: ${usuario?.numero_documento || ''})`}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
            El modelo 3D del campus está listo en <code>public/Modelo3D/Unimap.gltf</code> para ser montado con Three.js en la siguiente fase.
          </p>

          <button
            type="button"
            id="btn_login"
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
