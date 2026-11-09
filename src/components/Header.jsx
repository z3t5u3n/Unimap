import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  ShieldAlert,
  Snowflake,
  LogOut,
  User,
  Shield,
} from 'lucide-react';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [tema, setTema] = useState(() => {
    return localStorage.getItem('unimap_theme') || 'dark';
  });

  const [usuario, setUsuario] = useState(() => {
    try {
      const u = localStorage.getItem('usuario');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const [adminSesion, setAdminSesion] = useState(() => {
    try {
      const a = localStorage.getItem('admin_session');
      return a ? JSON.parse(a) : null;
    } catch {
      return null;
    }
  });

  // Estado de temporada navideña
  const [temporadaActiva, setTemporadaActiva] = useState(() => {
    const g = localStorage.getItem('unimap_temporada_activa');
    return g === null ? true : g === 'true';
  });
  const [lucesNavidenas, setLucesNavidenas] = useState(() => {
    const g = localStorage.getItem('unimap_temporada_luces');
    return g === null ? true : g === 'true';
  });

  useEffect(() => {
    const handleTemporada = (e) => {
      if (e.detail) {
        if (typeof e.detail.activa === 'boolean') setTemporadaActiva(e.detail.activa);
        if (typeof e.detail.luces === 'boolean') setLucesNavidenas(e.detail.luces);
      }
    };
    window.addEventListener('unimap_temporada_changed', handleTemporada);
    return () => window.removeEventListener('unimap_temporada_changed', handleTemporada);
  }, []);

  useEffect(() => {
    try {
      const u = localStorage.getItem('usuario');
      setUsuario(u ? JSON.parse(u) : null);
    } catch {
      setUsuario(null);
    }
    try {
      const a = localStorage.getItem('admin_session');
      setAdminSesion(a ? JSON.parse(a) : null);
    } catch {
      setAdminSesion(null);
    }
  }, [location]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('unimap_theme', tema);
    window.dispatchEvent(new CustomEvent('unimap_theme_changed', { detail: { tema } }));
  }, [tema]);

  const toggleTema = () => {
    setTema((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const abrirModalTemporada = () => {
    window.dispatchEvent(new CustomEvent('unimap_abrir_modal_temporada'));
  };

  const handleLogoutUsuario = () => {
    localStorage.removeItem('usuario');
    localStorage.removeItem('admin_session');
    setUsuario(null);
    navigate('/login');
  };

  const handleLogoutAdmin = () => {
    localStorage.removeItem('admin_session');
    setAdminSesion(null);
    navigate('/admin-login');
  };

  // Identificación de ruta actual normalizada
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  const esRutaMapa = currentPath === '/mapa' || currentPath === '/interfaz';
  const esRutaAdmin = currentPath === '/admin';
  const esRutaAdminLogin = currentPath === '/admin-login';
  const esRutaRegistro = currentPath === '/registro';
  const esRutaLogin = currentPath === '/login' || currentPath === '/';

  // Destino inteligente para el logotipo UniMap
  const getLogoDestino = () => {
    if (esRutaMapa) return '/mapa';
    if (esRutaAdmin) return '/admin';
    return '/login';
  };

  return (
    <header className={`ContenedorHeader ${temporadaActiva ? 'headerTemporadaNavidena' : ''}`}>
      {/* Guirnalda de luces navideñas parpadeantes cuando la temporada está activa */}
      {temporadaActiva && lucesNavidenas && (
        <div className="guirnaldaNavidadHeader" aria-hidden="true">
          <span className="luzNavidad luzRojo" />
          <span className="luzNavidad luzVerde" />
          <span className="luzNavidad luzOro" />
          <span className="luzNavidad luzAzul" />
          <span className="luzNavidad luzBlanco" />
          <span className="luzNavidad luzRojo" />
          <span className="luzNavidad luzVerde" />
          <span className="luzNavidad luzOro" />
          <span className="luzNavidad luzAzul" />
          <span className="luzNavidad luzBlanco" />
          <span className="luzNavidad luzRojo" />
          <span className="luzNavidad luzVerde" />
          <span className="luzNavidad luzOro" />
          <span className="luzNavidad luzAzul" />
        </div>
      )}

      <div className="headerLeft">
        <Link to={getLogoDestino()} className="headerLogo" style={{ textDecoration: 'none' }}>
          <span className="Uni">Uni</span>
          <span className="Map">Map</span>
          {temporadaActiva && (
            <span className="badgeNavidadLogo" title="¡Temporada Navideña Activa!">
              🎄
            </span>
          )}
        </Link>
      </div>

      <div className="headerRight">
        {/* NAVEGACIÓN DINÁMICA SEGÚN LA RUTA ACTUAL */}
        <nav className="headerNav">
          {/* 1. EN EL MAPA: NO MOSTRAR ADMIN NI REGISTRO NI INGRESAR */}
          {esRutaMapa && (
            <>
              {usuario && (
                <button
                  type="button"
                  className="headerUserBadge"
                  onClick={() => window.dispatchEvent(new CustomEvent('unimap_abrir_panel_datos'))}
                  title={`Mi Perfil / Datos: ${usuario.nombres || usuario.nombre || ''} ${usuario.apellidos || ''}`}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8'
                  }}
                >
                  <User size={13} />
                  <span>
                    {(usuario.nombres || usuario.nombre || 'Estudiante').split(' ')[0]}
                  </span>
                </button>
              )}
              <button
                type="button"
                className="headerNavLink headerLogoutBtn"
                onClick={handleLogoutUsuario}
                title="Cerrar sesión"
              >
                <LogOut size={15} />
                <span>Cerrar Sesión</span>
              </button>
            </>
          )}

          {/* 2. EN ADMIN: NO MOSTRAR ADMIN NI REGISTRO NI INGRESAR */}
          {esRutaAdmin && (
            <>
              <span className="headerAdminBadge" title="Panel Administrativo">
                <Shield size={13} />
                <span>{adminSesion?.nombre || adminSesion?.username || 'Admin'}</span>
              </span>
              <button
                type="button"
                className="headerNavLink headerLogoutBtn"
                onClick={handleLogoutAdmin}
                title="Cerrar sesión administrativa"
              >
                <LogOut size={15} />
                <span>Cerrar Sesión</span>
              </button>
            </>
          )}

          {/* 3. EN LOGIN: MOSTRAR REGISTRARSE Y ADMIN (NO INGRESAR PORQUE YA ESTÁ AQUÍ) */}
          {esRutaLogin && (
            <>
              <Link to="/registro" className="headerNavLink">
                <UserPlus size={15} />
                <span>Registrarse</span>
              </Link>
              <Link to="/admin-login" className="headerNavLink adminNavLink">
                <ShieldAlert size={15} />
                <span>Admin</span>
              </Link>
            </>
          )}

          {/* 4. EN REGISTRO: MOSTRAR INGRESAR Y ADMIN (NO REGISTRARSE PORQUE YA ESTÁ AQUÍ) */}
          {esRutaRegistro && (
            <>
              <Link to="/login" className="headerNavLink">
                <LogIn size={15} />
                <span>Ingresar</span>
              </Link>
              <Link to="/admin-login" className="headerNavLink adminNavLink">
                <ShieldAlert size={15} />
                <span>Admin</span>
              </Link>
            </>
          )}

          {/* 5. EN ADMIN-LOGIN: MOSTRAR INGRESAR Y REGISTRARSE (NO ADMIN PORQUE YA ESTÁ AQUÍ) */}
          {esRutaAdminLogin && (
            <>
              <Link to="/login" className="headerNavLink" title="Volver al acceso de estudiantes">
                <LogIn size={15} />
                <span>Ingresar</span>
              </Link>
              <Link to="/registro" className="headerNavLink">
                <UserPlus size={15} />
                <span>Registrarse</span>
              </Link>
            </>
          )}
        </nav>

        {/* Botón de Configuración de Temporada Navideña */}
        <button
          type="button"
          className={`btnTemporadaHeader ${temporadaActiva ? 'temporadaOn' : ''}`}
          onClick={abrirModalTemporada}
          title="Configuración de Temporada"
          aria-label="Configuración de Temporada"
        >
          <Snowflake size={14} className={temporadaActiva ? 'iconoNieveGirando' : ''} />
          <span className="textoTemporadaHeader">Temporada</span>
          {temporadaActiva && <span className="chipNavidadHeader">❄️</span>}
        </button>

        {/* Botón de alternancia de tema Claro / Oscuro */}
        <button
          type="button"
          className="btnThemeToggle"
          onClick={toggleTema}
          title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema de color"
        >
          <span className="themeIcon">{tema === 'dark' ? '☀️' : '🌙'}</span>
          <span className="themeText">{tema === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>
      </div>
    </header>
  );
}
