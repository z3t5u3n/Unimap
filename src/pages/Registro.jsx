import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import Header from '../components/Header';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Registro() {
  const navigate = useNavigate();

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');

  const [documentos, setDocumentos] = useState([]);
  const [cargandoDocs, setCargandoDocs] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [exito, setExito] = useState(false);

  // Cargar catálogo de tipos de documento desde Laravel
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/documento`)
      .then((res) => {
        const docs = Array.isArray(res.data) ? res.data : [];
        setDocumentos(docs);
      })
      .catch((err) => {
        console.error('Error al cargar tipos de documento:', err);
        setErrorGeneral('No se pudieron cargar los tipos de documento. Verifica que el servidor esté activo.');
      })
      .finally(() => {
        setCargandoDocs(false);
      });
  }, []);

  // Manejadores con limpieza dinámica de error al escribir (mecánica del proyecto anterior)
  const handleNombresChange = (e) => {
    setNombres(e.target.value);
    setValidationErrors((prev) => ({ ...prev, nombres: null }));
  };

  const handleApellidosChange = (e) => {
    setApellidos(e.target.value);
    setValidationErrors((prev) => ({ ...prev, apellidos: null }));
  };

  const handleTipoDocChange = (e) => {
    setTipoDocumento(e.target.value);
    setValidationErrors((prev) => ({ ...prev, tipo_documento: null }));
  };

  const handleNumeroDocChange = (e) => {
    const value = e.target.value;
    // Solo permitir números en el campo de documento
    const re = /^[0-9\b]+$/;
    if (value === '' || re.test(value)) {
      setNumeroDocumento(value);
      setValidationErrors((prev) => ({ ...prev, numero_documento: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    setValidationErrors({});

    // Validaciones locales preliminares
    const erroresLocales = {};
    if (!nombres.trim()) {
      erroresLocales.nombres = ['El nombre es requerido.'];
    }
    if (!apellidos.trim()) {
      erroresLocales.apellidos = ['Los apellidos son requeridos.'];
    }
    if (!tipoDocumento) {
      erroresLocales.tipo_documento = ['Debes seleccionar un tipo de documento.'];
    }
    if (!numeroDocumento.trim()) {
      erroresLocales.numero_documento = ['El número de documento es requerido.'];
    } else if (numeroDocumento.length < 8 || numeroDocumento.length > 10) {
      erroresLocales.numero_documento = ['El documento debe tener entre 8 y 10 dígitos.'];
    }

    if (Object.keys(erroresLocales).length > 0) {
      setValidationErrors(erroresLocales);
      return;
    }

    setCargando(true);
    const datos = {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      tipo_documento: Number(tipoDocumento),
      numero_documento: numeroDocumento.trim(),
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/registro`, datos, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (response.status === 201 || response.status === 200) {
        setExito(true);
        // Limpiar formulario tras registro exitoso
        setNombres('');
        setApellidos('');
        setTipoDocumento('');
        setNumeroDocumento('');
        setValidationErrors({});

        // Redirección al login
        setTimeout(() => {
          navigate('/login');
        }, 2200);
      }
    } catch (err) {
      console.error('Error al registrar usuario:', err);
      const data = err.response?.data;

      // Si Laravel devuelve errores de validación (código 422)
      if (err.response?.status === 422 && data?.errors) {
        setValidationErrors(data.errors);
      } else {
        // Error general de servidor o red
        setErrorGeneral(data?.mensaje || data?.message || 'Error de conexión con el servidor al registrar.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="RegistroPage">
      <Header />
      <div className="RegistroContainer">
        <div className="RegistroCard">
          <div className="RegistroHeader">
            <h2>Crear Cuenta</h2>
            <p>Ingresa tus datos para registrarte en UniMap</p>
          </div>

          {exito ? (
            <div className="alertSuccess">
              <CheckCircle2 size={22} color="#10b981" />
              <div>
                <strong>¡Registro exitoso!</strong>
                <p>Tu cuenta ha sido creada. Ya puedes iniciar sesión con tu documento.</p>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                  Redirigiendo al inicio de sesión...
                </p>
              </div>
            </div>
          ) : (
            <>
              {errorGeneral && (
                <div className="alertError">
                  <AlertCircle size={16} />
                  <span>{errorGeneral}</span>
                </div>
              )}

              <form className="RegistroForm" onSubmit={handleSubmit} noValidate>
                {/* FILA 1: NOMBRES Y APELLIDOS */}
                <div className="formRow">
                  <div className="inputGroup">
                    <label htmlFor="nombres">Nombres</label>
                    <input
                      id="nombres"
                      name="nombres"
                      type="text"
                      placeholder="Ej. Juan David"
                      value={nombres}
                      onChange={handleNombresChange}
                      className={validationErrors.nombres ? 'input-error' : ''}
                      disabled={cargando}
                      required
                    />
                    {validationErrors.nombres && (
                      <p className="error-message">{validationErrors.nombres[0]}</p>
                    )}
                  </div>

                  <div className="inputGroup">
                    <label htmlFor="apellidos">Apellidos</label>
                    <input
                      id="apellidos"
                      name="apellidos"
                      type="text"
                      placeholder="Ej. Hernandez"
                      value={apellidos}
                      onChange={handleApellidosChange}
                      className={validationErrors.apellidos ? 'input-error' : ''}
                      disabled={cargando}
                      required
                    />
                    {validationErrors.apellidos && (
                      <p className="error-message">{validationErrors.apellidos[0]}</p>
                    )}
                  </div>
                </div>

                {/* FILA 2: TIPO DE DOCUMENTO Y NÚMERO DE DOCUMENTO */}
                <div className="formRow">
                  <div className="inputGroup">
                    <label htmlFor="tipoDoc">Tipo de Documento</label>
                    <select
                      id="tipoDoc"
                      name="tipo_documento"
                      value={tipoDocumento}
                      onChange={handleTipoDocChange}
                      className={validationErrors.tipo_documento ? 'input-error' : ''}
                      disabled={cargando || cargandoDocs}
                      required
                    >
                      <option value="">
                        {cargandoDocs ? 'Cargando catálogo...' : '-- Selecciona --'}
                      </option>
                      {documentos.map((doc) => (
                        <option key={doc.id_documento} value={doc.id_documento}>
                          {doc.tipo_documento || doc.documento}
                        </option>
                      ))}
                    </select>
                    {validationErrors.tipo_documento && (
                      <p className="error-message">{validationErrors.tipo_documento[0]}</p>
                    )}
                  </div>

                  <div className="inputGroup">
                    <label htmlFor="numDoc">Número de Documento</label>
                    <input
                      id="numDoc"
                      name="numero_documento"
                      type="text"
                      inputMode="numeric"
                      placeholder="8 a 10 dígitos"
                      value={numeroDocumento}
                      onChange={handleNumeroDocChange}
                      className={validationErrors.numero_documento ? 'input-error' : ''}
                      disabled={cargando}
                      required
                    />
                    {validationErrors.numero_documento && (
                      <p className="error-message">{validationErrors.numero_documento[0]}</p>
                    )}
                  </div>
                </div>

                <button
                  id="btn_registro_submit"
                  type="submit"
                  disabled={cargando || cargandoDocs}
                >
                  {cargando ? 'Registrando...' : 'REGISTRARME'}
                </button>
              </form>

              <div className="div_login_redirect">
                <span>¿Ya tienes una cuenta registrada?</span>
                <Link to="/login" className="btn_login_link">
                  Inicia sesión aquí
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
