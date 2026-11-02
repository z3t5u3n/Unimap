import React, { useState } from "react";
import Header from "./Component/Header";
import "../CSS/global.css";
import "../CSS/login.css";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function Login() {
  const navigate = useNavigate();

  // Modo de acceso: 'usuario' (estudiantes/visitantes) o 'tester' (entorno de pruebas)
  const [modoAcceso, setModoAcceso] = useState("usuario");

  // Estados login usuario general
  const [numero_documento, setNumero_documento] = useState("");
  const [cargando, setCargando] = useState(false);

  // Estados login tester
  const [testerForm, setTesterForm] = useState({
    username: "",
    password: "",
  });
  const [testerCargando, setTesterCargando] = useState(false);
  const [testerError, setTesterError] = useState("");

  // Manejar login de usuario regular
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!numero_documento.trim()) {
      alert("Por favor ingrese su número de documento");
      return;
    }
    setCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          numero_documento: numero_documento,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("usuario", JSON.stringify(data.usuario));
        alert("¡Bienvenido, " + data.usuario.nombres + "!");
        navigate("/Interfaz");
      } else {
        alert(data.mensaje || "Documento no registrado.");
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      alert("Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  };

  // Manejar login de tester
  const handleTesterLogin = async (e) => {
    e.preventDefault();
    setTesterError("");

    if (!testerForm.username.trim() || !testerForm.password.trim()) {
      setTesterError("Por favor ingrese usuario y contraseña de tester.");
      return;
    }

    setTesterCargando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tester/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(testerForm),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("unimap_tester_session", JSON.stringify(data.tester));
        navigate("/InterfazPruebas");
      } else {
        setTesterError(data.message || "Credenciales de tester inválidas.");
      }
    } catch (error) {
      console.error("Error al conectar con el servidor tester:", error);
      setTesterError("Error de conexión con el servidor de pruebas.");
    } finally {
      setTesterCargando(false);
    }
  };

  return (
    <div className="LoginPage">
      <Header />
      <div className="LoginContainer">
        <div className="LoginCard">
          {/* Selector de modo de acceso */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              background: "rgba(15, 23, 42, 0.6)",
              padding: "4px",
              borderRadius: "8px",
              marginBottom: "18px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setModoAcceso("usuario");
                setTesterError("");
              }}
              style={{
                background: modoAcceso === "usuario" ? "#2563eb" : "transparent",
                color: modoAcceso === "usuario" ? "#ffffff" : "#94a3b8",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: modoAcceso === "usuario" ? 600 : 500,
                fontSize: "13px",
                transition: "all 0.2s ease",
              }}
            >
              👤 Usuario
            </button>
            <button
              type="button"
              onClick={() => {
                setModoAcceso("tester");
                setTesterError("");
              }}
              style={{
                background: modoAcceso === "tester" ? "#0891b2" : "transparent",
                color: modoAcceso === "tester" ? "#ffffff" : "#94a3b8",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: modoAcceso === "tester" ? 600 : 500,
                fontSize: "13px",
                transition: "all 0.2s ease",
              }}
            >
              🧪 Acceso Tester
            </button>
          </div>

          {modoAcceso === "usuario" ? (
            <>
              <div className="LoginHeader">
                <h2>Iniciar Sesión</h2>
                <p>Ingresa tu número de documento para acceder al mapa</p>
              </div>

              <form className="LoginForm" onSubmit={handleLogin}>
                <div className="inputGroup">
                  <label htmlFor="documento">Número de Documento</label>
                  <input
                    id="documento"
                    type="text"
                    placeholder="Ej. 1025489632"
                    value={numero_documento}
                    onChange={(e) => setNumero_documento(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <button id="btn_login" type="submit" disabled={cargando}>
                  {cargando ? "Verificando..." : "INGRESAR AL MAPA"}
                </button>

                <div className="div_registro">
                  <span>¿No tienes una cuenta aún?</span>
                  <button
                    type="button"
                    className="btn_registro"
                    onClick={() => navigate("/Registro")}
                  >
                    Registrarme aquí
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="LoginHeader">
                <h2 style={{ color: "#38bdf8" }}>Acceso a Entorno de Pruebas</h2>
                <p>Ingresa tus credenciales de tester para validar funciones y GPS</p>
              </div>

              {testerError && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    color: "#fca5a5",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    marginBottom: "14px",
                    textAlign: "center",
                  }}
                >
                  {testerError}
                </div>
              )}

              <form className="LoginForm" onSubmit={handleTesterLogin}>
                <div className="inputGroup">
                  <label htmlFor="tester_user">Usuario de Tester</label>
                  <input
                    id="tester_user"
                    type="text"
                    placeholder="Ej. tester@Unimap"
                    value={testerForm.username}
                    onChange={(e) =>
                      setTesterForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    autoFocus
                    required
                  />
                </div>

                <div className="inputGroup">
                  <label htmlFor="tester_pass">Contraseña</label>
                  <input
                    id="tester_pass"
                    type="password"
                    placeholder="••••••••"
                    value={testerForm.password}
                    onChange={(e) =>
                      setTesterForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                </div>

                <button
                  id="btn_login"
                  type="submit"
                  disabled={testerCargando}
                  style={{ background: "#0891b2" }}
                >
                  {testerCargando ? "Validando Tester..." : "INGRESAR A PRUEBAS"}
                </button>

                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    background: "rgba(6, 182, 212, 0.08)",
                    border: "1px dashed rgba(6, 182, 212, 0.3)",
                    borderRadius: "6px",
                    fontSize: "11.5px",
                    color: "#94a3b8",
                    lineHeight: "1.4",
                  }}
                >
                  ℹ️ <b>¿Qué es este modo?</b> Permite calibrar el GPS, probar rutas simuladas y verificar la navegación WebGL sin alterar la experiencia de los estudiantes.
                </div>
              </form>
            </>
          )}

          <div
            style={{
              marginTop: "18px",
              textAlign: "center",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/Admin")}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              🛡️ ¿Eres administrador? Acceder al Panel de Control
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
