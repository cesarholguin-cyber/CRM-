# Usuarios y tutoriales

El correo sigue siendo el dato para iniciar sesión mediante Supabase Auth. El nombre de usuario es un identificador independiente, editable desde Configuración → Perfil. Admite 3–100 caracteres: letras sin acentos, números, puntos, guiones y guiones bajos. Se normaliza a minúsculas; no admite correos y no puede duplicarse, incluso con diferencias de mayúsculas.

Configuración → Usuarios → Nuevo Usuario ofrece tres roles:

| Rol | Acceso |
| --- | --- |
| Administrador | Operación existente, gestión de usuarios y Ver videos |
| Promotor | Operación comercial existente, sin biblioteca de tutoriales |
| Sistemas | Subir y ver tutoriales, su perfil y contraseña; sin datos comerciales ni gestión de usuarios |

Los permisos se verifican en el servidor y en la navegación. Sistemas entra directamente a `/videos`; no consulta automáticamente apartados ni puede abrir rutas comerciales escribiendo la dirección.

## Publicar un tutorial

1. El administrador crea una cuenta con rol Sistemas, correo y nombre de usuario separados.
2. Sistemas inicia sesión y abre Ver videos → Subir video.
3. Escribe un título, una descripción opcional y selecciona un MP4 o WebM de hasta 50 MB. Se recomienda MP4 con video H.264 y audio AAC para compatibilidad con los navegadores.
4. Al completar la carga, los administradores lo encuentran en Ver videos. Pueden buscar por título o descripción y reproducirlo dentro del CRM.

Los archivos se guardan en el bucket privado `crm-tutoriales`. La tabla privada `crm.tutorials` conserva solo metadatos; no almacena los videos en PostgreSQL. La reproducción obtiene una dirección firmada de una hora después de verificar la sesión y el rol; no se entrega la clave de servicio. Una dirección firmada ya emitida funciona hasta que vence. El reproductor permite volver a abrir el video si venció o falló la conexión.

## Despliegue

Para este proyecto ya se aplicó y verificó `20261021190506_crm_tutorials_and_usernames.sql` y se provisionó el bucket privado. Basta desplegar el commit correspondiente del CRM en Easypanel con las variables Supabase existentes. No hay variables nuevas.

Para instalar en otro entorno:

- Aplicar la migración con la herramienta de migraciones habitual, conservando las migraciones anteriores. El marcador `supabase-tutorials-v3-ready` impide arrancar esta versión antes de actualizar el esquema.
- Con `backend/.env` configurado de forma privada, ejecutar `python backend/scripts/setup_tutorial_storage.py`. Usa `SUPABASE_URL` y `SUPABASE_SECRET_KEY`; verifica privacidad, tipos MIME y tamaño. No habilitar acceso público ni políticas abiertas de Storage.
- No recrear la base, volver a importar inventario ni ejecutar inicializadores de pruebas.

La migración convierte los nombres de usuario antiguos que eran correos en identificadores únicos y conserva el correo de acceso, el ID, el rol y el vínculo a Supabase Auth. No modifica contraseñas, clientes, ventas ni lotes. El respaldo de los identificadores previos está fuera del repositorio.

## Verificación realizada

- Pruebas de permisos para los tres roles; Sistemas rechazado incluso si conserva una bandera de superusuario antigua.
- Archivos vacíos, formato inválido, exceso de tamaño, fallos de almacenamiento y limpieza ante fallo de metadatos.
- Edición y unicidad del nombre de usuario; creación de cuentas Sistemas con rol privado.
- Carga y reproducción reales en Storage con un archivo temporal, lectura pública rechazada y limpieza posterior. Las filas temporales se revierten; los 178 lotes vendidos siguen intactos.
- Escritorio y móvil, tema claro y oscuro, formulario accesible con teclado, publicación y reproductor con API de prueba aislada.
- Asesor de seguridad Supabase sin hallazgos. Se conserva el SQL ejecutado en una migración creada por CLI; la extracción automática mediante `db pull` requiere el Docker local no disponible en este equipo.
