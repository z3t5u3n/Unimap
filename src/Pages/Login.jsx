import React, { useState } from "react";
import Header from "./Component/Header";
import "../CSS/global.css";
import "../CSS/login.css";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function Login() {
  const navigate = useNavigate();
  const [numero_documento, setNumero_documento] = useState("");
  const [cargando, setCargando] = useState(false);

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

  return (
    <div className="LoginPage">
      <Header />
      <div className="LoginContainer">
        <div className="LoginCard">
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

            <div style={{ marginTop: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" }}>
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
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
