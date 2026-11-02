import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "../CSS/interfaz.css";

function VerificarRol() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");
  const exitoParam = searchParams.get("exito");

  const [estado, setEstado] = useState("verificando"); // 'verificando' | 'exito' | 'expirado' | 'error'
  const [mensaje, setMensaje] = useState("");
  const [usuarioActualizado, setUsuarioActualizado] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Si viene redirigido con error en query
    if (errorParam === "token_expirado") {
      setEstado("expirado");
      setMensaje("El enlace de verificación ha expirado (tiempo límite de 5 minutos excedido). Por favor solicita uno nuevo desde tu perfil.");
      return;
    }
    if (errorParam === "token_utilizado") {
      setEstado("error");
      setMensaje("Este enlace de verificación ya ha sido utilizado anteriormente.");
      return;
    }
    if (errorParam === "token_invalido" || !token) {
      setEstado("error");
      setMensaje("Token o enlace de verificación no válido o ausente.");
      return;
    }

    // Si viene con exitoParam directo
    if (exitoParam === "1") {
      setEstado("exito");
      setMensaje("¡Tu rol ha sido actualizado a Estudiante exitosamente!");
      return;
    }

    // Confirmar token contra la API
    const confirmarToken = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/usuario/confirmar-cambio-rol`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setEstado("exito");
          setMensaje(data.mensaje || "¡Rol actualizado a Estudiante exitosamente!");
          if (data.usuario) {
            setUsuarioActualizado(data.usuario);
            // Sincronizar localStorage si coincide con el usuario activo o actualizarlo
            try {
              const usuarioLocal = JSON.parse(localStorage.getItem("usuario") || "{}");
              if (usuarioLocal.id_usuario === data.usuario.id_usuario || !usuarioLocal.id_usuario) {
                localStorage.setItem("usuario", JSON.stringify(data.usuario));
              }
            } catch (e) {
              console.error("Error al actualizar localStorage:", e);
            }
          }
        } else if (response.status === 410 || data.expirado) {
          setEstado("expirado");
          setMensaje(data.mensaje || "El enlace de verificación ha expirado (límite de 5 minutos excedido).");
        } else {
          setEstado("error");
          setMensaje(data.mensaje || "No fue posible verificar el cambio de rol.");
        }
      } catch (err) {
        console.error("Error en verificación de rol:", err);
        setEstado("error");
        setMensaje("Error de conexión al servidor al intentar verificar el rol.");
      }
    };

    confirmarToken();
  }, [token, errorParam, exitoParam]);

  return (
    <div className="contenedorVerificarRol">
      <div className="cardVerificacionRol">
        {/* Encabezado Institucional */}
        <div className="encabezadoVerif">
          <div className="badgeInstitucion">ITFIP &bull; UniMap 3D</div>
          <h2>Verificación de Rol Institucional</h2>
        </div>

        {/* Estado: Verificando */}
        {estado === "verificando" && (
          <div className="contenidoVerif">
            <div className="spinnerVerif"></div>
            <h3>Validando credenciales...</h3>
            <p className="textoSecundarioVerif">
              Estamos comprobando el enlace y la validez de tu correo institucional.
            </p>
          </div>
        )}

        {/* Estado: Éxito */}
        {estado === "exito" && (
          <div className="contenidoVerif exito">
            <h3 className="tituloExito">Verificación Exitosa</h3>
            <p className="mensajePrincipalVerif">{mensaje}</p>

            <div className="cajaPrivilegiosEstudiante">
              <h4>Beneficios Habilitados:</h4>
              <ul>
                <li>Acceso completo a todos los <strong>salones, aulas y laboratorios</strong> de los bloques A, B, C, D y E.</li>
                <li>Recorridos interactivos guiados en 3D sin restricciones.</li>
                <li>Identificación institucional con correo <strong>{usuarioActualizado?.correo_institucional || "verificado"}</strong>.</li>
              </ul>
            </div>

            <button
              className="btnIrAlMapa"
              onClick={() => navigate("/Interfaz")}
            >
              Ir al Mapa 3D
            </button>
          </div>
        )}

        {/* Estado: Expirado (> 5 minutos) */}
        {estado === "expirado" && (
          <div className="contenidoVerif expirado">
            <h3 className="tituloExpirado">Enlace de Verificación Expirado</h3>
            <p className="mensajePrincipalVerif">{mensaje}</p>
            <div className="cajaAdvertenciaExpirado">
              <p>
                Por razones de seguridad institucional, los enlaces de cambio de rol tienen una vigencia estricta de <strong>5 minutos</strong>.
              </p>
            </div>
            <button
              className="btnVolverPerfil"
              onClick={() => navigate("/Interfaz")}
            >
              Volver a la Interfaz y Solicitar Nuevo Enlace
            </button>
          </div>
        )}

        {/* Estado: Error general o token ya utilizado */}
        {estado === "error" && (
          <div className="contenidoVerif error">
            <h3 className="tituloError">No se pudo completar la verificación</h3>
            <p className="mensajePrincipalVerif">{mensaje}</p>
            <button
              className="btnVolverPerfil"
              onClick={() => navigate("/Interfaz")}
            >
              Volver a la Interfaz
            </button>
          </div>
        )}

        <div className="footerVerif">
          Instituto Tolimense de Formación Técnica Profesional &bull; ITFIP
        </div>
      </div>
    </div>
  );
}

export default VerificarRol;
