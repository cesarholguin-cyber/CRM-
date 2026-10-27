# Actualización de seguridad del CRM — 27 de octubre de 2026

Esta actualización corrige las dependencias y los controles de aplicación
identificados en la auditoría. No cambia proyectos, precios, estados de lotes,
clientes, ventas, roles ni el diseño de la interfaz. No requiere migraciones.
La base de datos de producción no se utilizó para pruebas de escritura.

## Cambios

- FastAPI 0.162.0 y Starlette 1.10.0 actualizados juntos. Se renovaron también
  multipart, criptografía, OCI y las dependencias compatibles de Python.
- Se sustituyó python-jose por PyJWT 2.15.1. Los JWT locales anteriores mantienen
  su formato; Supabase sigue verificando la identidad y la vigencia de la sesión.
- certifi 2026.10.23 y pip 26.2.2. Docker fija Python 3.12.16 y Node 22.23.4 por
  versión y digest verificados en el registro oficial. La construcción renueva
  además ca-certificates del sistema.
- Dependencias de producción de Python fijadas en `backend/requirements.lock`,
  incluyendo transitivas y hashes SHA-256. Docker exige comprobar esos hashes.
  Los hashes proceden de los metadatos HTTPS de cada versión en PyPI. npm usa
  `npm ci` y el lockfile actualizado; Axios, React Router, Vite, Zod y las
  transitivas señaladas en la auditoría fueron corregidas.
- PostgreSQL en modo Supabase verifica certificado y nombre del servidor
  (`verify-full`) usando la CA pública oficial incluida. La variable opcional
  `DATABASE_SSL_ROOT_CERT` permite indicar otra CA oficial para una rotación.
- Las rutas antiguas y nuevas de apartados comparten un límite de 10 solicitudes
  por minuto y dirección IP. La API aplica también el presupuesto configurado en
  `RATE_LIMIT_PER_MINUTE`, por IP y sección, antes de leer el cuerpo. Las consultas
  normales del dashboard, los archivos estáticos y `/health` conservan su función.
- Los cuerpos JSON se limitan a 1 MiB antes del parser, incluso sin Content-Length.
  La subida de documentos admite 52 MiB de cuerpo multipart para preservar el
  límite existente de 50 MiB por envío y 10 MiB por archivo. Se utiliza un archivo
  temporal al superar 1 MiB de memoria. Se rechaza el exceso antes de ejecutar la
  operación del CRM.
- Se incorporó Content-Security-Policy y Referrer-Policy. La documentación
  interactiva de la API queda desactivada con `DEBUG=false`. Se agregó un
  HEALTHCHECK al contenedor, conservando el puerto interno 80 y el usuario no root.

## Validación

- 126 pruebas aprobadas y 2 pruebas de importación PostgreSQL omitidas por ser
  optativas y requerir una base independiente. Las pruebas usan SQLite temporal.
- Pruebas específicas de JWT antiguos, tokens falsificados/caducados, Supabase,
  permisos, apartados, inventario, expedientes, cuotas compartidas, errores del
  almacén de cuotas, límites de cuerpos y archivos multipart mayores a 1 MiB.
- Construcción de frontend correcta. Lint sin errores; conserva advertencias
  previas de variables sin uso y dependencias de hooks.
- Pantalla de acceso comprobada en navegador local con la nueva CSP.
- `pip check` sin conflictos; auditorías de dependencias sin avisos conocidos
  detectados en la fecha de ejecución. Esto no certifica ausencia de otras fallas.
- Los 83 paquetes fijados coinciden con el entorno de pruebas. Se descargaron
  también sus distribuciones para Linux x86_64 / Python 3.12 comprobando todos
  los hashes y resolviendo el conjunto sin conflictos.
- Consulta `SELECT 1` de solo lectura al pooler configurado de Supabase con
  verificación de CA y hostname correcta. No se cambiaron registros ni permisos.

No se dispone de Docker en la máquina de trabajo: aún debe validarse la imagen
construida y el funcionamiento dentro del contenedor real de Easypanel. El runtime
local de pruebas es Python 3.12.14; el Dockerfile fija 3.12.16 para producción.

## Publicación en Easypanel

1. Publicar esta revisión en el repositorio configurado para el servicio CRM.
2. Mantener las variables actuales de Supabase, secretos, CORS y almacenamiento;
   usar `DATABASE_MODE=supabase` y `DEBUG=false`. No cambiar contraseñas ni cargar
   datos de demostración. Conservar el puerto interno **80**.
3. Reconstruir la imagen sin caché y desplegar. Un simple reinicio no instala estas
   actualizaciones. Conservar el digest de la imagen anterior para poder volver.
4. Comprobar `/health`, iniciar sesión con un administrador y revisar clientes,
   proyectos, apartados y expedientes. Comprobar lectura del inventario desde
   El Triunfo y Maculí Sur. Las pruebas que creen ventas o apartados deben hacerse
   exclusivamente en un proyecto/base de ensayo, nunca sobre lotes vendidos.
5. Revisar logs por errores de certificados, permisos o dependencias; inspeccionar
   versiones y escanear la imagen final (incluyendo paquetes del SO y su almacén
   de CA). No publicar valores de variables o credenciales en los logs.

## Configuración que requiere trabajo adicional

- Un rol PostgreSQL dedicado con privilegios mínimos: la conexión auditada utiliza
  `postgres` y elude RLS. Esta actualización no cambia permisos de producción.
- Inscribir MFA en las cuentas administrativas; no se forzó su activación para
  evitar bloquear a los usuarios durante esta actualización.
- Retirar credenciales embebidas en la URL remota local de Git y rotar las que se
  hayan compartido. No se incorporaron credenciales a estos cambios.
- Con varios procesos o réplicas, configurar `REDIS_URL` privado para compartir
  cuotas. Sin Redis, las cuotas son por proceso. Si Redis configurado falla, la API
  devuelve 503 en vez de desactivar la protección. La conexión debe estar protegida
  según el entorno y los permisos del servicio.
- Configurar en Uvicorn los proxies de confianza reales de Easypanel para que la
  IP usada en las cuotas sea la del cliente. No confiar en cualquier origen ni
  aceptar un X-Forwarded-For arbitrario.
- Un límite por IP reduce abuso, pero no verifica la identidad del contacto ni
  impide ataques distribuidos. Una confirmación de contacto/CAPTCHA exige acordar
  el flujo comercial. No se retiró la ruta antigua que todavía usa el widget.
- Las sesiones siguen usando el almacenamiento actual del navegador. Migrarlas a
  cookies HttpOnly con CSRF, acotar datos por promotor y evaluar cifrado por campo
  requieren cambios funcionales y de permisos adicionales.

La landing de El Triunfo y el contenedor de Maculí no forman parte de esta revisión
de código del CRM; conservan los pendientes señalados en la auditoría original.
