import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import Header from '../components/Header';
import { AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!numeroDocumento.trim()) {
      setError('Por favor ingresa tu número de documento.');
      return;
    }

    setCargando(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/login`, {
        numero_documento: numeroDocumento.trim(),
      });

      if (response.data && response.data.usuario) {
        localStorage.setItem('usuario', JSON.stringify(response.data.usuario));
        navigate('/mapa');
      } else {
        setError('Documento no registrado.');
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      const msg =
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'Error de conexión con el servidor.';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="LoginPage">
      <Header />
      <div className="LoginContainer">
        <div className="LoginCard">
          <div className="LoginHeader">
            <h2>Iniciar Sesión</h2>
            <p>Ingresa tu número de documento para acceder a UniMap</p>
          </div>

          {error && (
            <div className="alertError">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="LoginForm">
            <div className="inputGroup">
              <label htmlFor="documento">Número de Documento</label>
              <input
                id="documento"
                type="text"
                placeholder="Ej. 1005829102"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value.replace(/\D/g, ''))}
                disabled={cargando}
                autoFocus
                required
              />
            </div>

            <button type="submit" id="btn_login" disabled={cargando}>
              {cargando ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="div_registro">
            <span>¿No tienes una cuenta?</span>
            <Link to="/registro" className="btn_registro">
              Regístrate aquí
            </Link>
          </div>

          <div className="div_admin_link">
            <span>¿Eres administrador?</span>
            <Link to="/admin-login" className="btn_admin_link">
              Acceso Administrativo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
