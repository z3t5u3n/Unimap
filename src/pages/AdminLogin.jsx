import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import Header from '../components/Header';
import { AlertCircle } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor ingrese usuario y contraseña de administrador.');
      return;
    }

    setCargando(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        username: username.trim(),
        password: password.trim(),
      });

      if (response.data && (response.data.admin || response.data.message)) {
        localStorage.setItem('admin_session', JSON.stringify(response.data.admin || { username }));
        navigate('/admin');
      } else {
        setError('No se pudo verificar la sesión administrativa.');
      }
    } catch (err) {
      console.error('Error al iniciar sesión de admin:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.mensaje ||
        'Credenciales administrativas incorrectas o sin autorización.';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="LoginPage">
      <Header />
      <div className="adminLoginWrapper">
        <div className="adminLoginCard">
          <div className="adminLoginHeader">
            <div className="adminLoginIcon">🛡️</div>
            <h2>Acceso Administrativo</h2>
            <p>Panel de Control y Gestión Central UniMap</p>
          </div>

          {error && (
            <div className="adminErrorAlert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="adminLoginForm">
            <div className="adminFormGroup">
              <label htmlFor="admin_user">Usuario Administrador:</label>
              <input
                id="admin_user"
                name="username"
                type="text"
                placeholder="admin@Unimap"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={cargando}
                autoFocus
                required
              />
            </div>

            <div className="adminFormGroup">
              <label htmlFor="admin_pass">Contraseña:</label>
              <input
                id="admin_pass"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={cargando}
                required
              />
            </div>

            <button type="submit" className="btnAdminLoginSubmit" disabled={cargando}>
              {cargando ? 'Verificando...' : 'Iniciar Sesión'}
            </button>

            <Link to="/login" className="btnVolverMapa" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Volver al Login de Estudiantes
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
