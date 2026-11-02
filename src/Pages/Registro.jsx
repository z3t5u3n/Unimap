import React, { useState, useEffect } from "react";
import Header from "./Component/Header";
import "../CSS/global.css";
import "../CSS/registro.css";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function Registro() {
  const navigate = useNavigate();
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [numero_documento, setNumero_documento] = useState("");
  const [documentos, setDocumentos] = useState([]);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/documento`)
      .then((res) => res.json())
      .then((data) => {
        setDocumentos(data);
      })
      .catch((error) => {
        console.error("Error al conectar con Laravel:", error);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);

    const datos = {
      nombres: nombres,
      apellidos: apellidos,
      tipo_documento: documentoSeleccionado,
      numero_documento: numero_documento,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/registro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(datos),
      });
      const resultados = await response.json();

      if (response.ok) {
        alert("¡Registro exitoso! Ya puedes iniciar sesión con tu documento.");
        // Opcional: auto-iniciar sesión o redirigir al login
        navigate("/");
      } else {
        alert("Error: " + (resultados.message || "Revisa los campos ingresados"));
        console.error("Detalle:", resultados.errors);
      }
    } catch (error) {
      console.error("Error de red al registrar:", error);
      alert("Error de conexión con el servidor");
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

          <form className="RegistroForm" onSubmit={handleSubmit}>
            <div className="formRow">
              <div className="inputGroup">
                <label htmlFor="nombres">Nombres</label>
                <input
                  id="nombres"
                  type="text"
                  placeholder="Ej. Juan David"
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  required
                />
              </div>

              <div className="inputGroup">
                <label htmlFor="apellidos">Apellidos</label>
                <input
                  id="apellidos"
                  type="text"
                  placeholder="Ej. Hernandez"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="formRow">
              <div className="inputGroup">
                <label htmlFor="tipoDoc">Tipo de Documento</label>
                <select
                  id="tipoDoc"
                  value={documentoSeleccionado}
                  onChange={(e) => setDocumentoSeleccionado(e.target.value)}
                  required
                >
                  <option value="">-- Selecciona --</option>
                  {documentos.map((doc) => (
                    <option key={doc.id_documento} value={doc.id_documento}>
                      {doc.tipo_documento}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inputGroup">
                <label htmlFor="numDoc">Número de Documento</label>
                <input
                  id="numDoc"
                  type="text"
                  placeholder="8 a 10 dígitos"
                  value={numero_documento}
                  onChange={(e) => setNumero_documento(e.target.value)}
                  required
                />
              </div>
            </div>

            <button id="btn_registrar" type="submit" disabled={cargando}>
              {cargando ? "Registrando..." : "REGISTRARME"}
            </button>

            <div className="div_volver_login">
              <span>¿Ya tienes una cuenta registrada?</span>
              <button
                type="button"
                className="btn_login_link"
                onClick={() => navigate("/")}
              >
                Inicia sesión aquí
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Registro;
