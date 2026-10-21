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
3. Escribe un título, una descripción opcional y selecciona un MP4 o WebM de hasta 200 MB. Se recomienda MP4 con video H.264 y audio AAC para compatibilidad con los navegadores.
4. Al completar la carga, los administradores lo encuentran en Ver videos. Pueden buscar por título o descripción y reproducirlo dentro del CRM.

Los nuevos archivos se guardan en el bucket privado `CRM-Terrenos` de Backblaze B2. La tabla privada `crm.tutorials` conserva solo metadatos; no almacena los videos en PostgreSQL. La reproducción obtiene una dirección firmada de una hora después de verificar la sesión y el rol; no se entrega la clave de servicio. Una dirección firmada ya emitida funciona hasta que vence. El reproductor permite volver a abrir el video si venció o falló la conexión.

## Despliegue

La migración `20261021190506_crm_tutorials_and_usernames.sql` ya está aplicada. El límite de 200 MB requiere también `20261021200853_crm_tutorials_200mb.sql`, ya aplicada en este proyecto. Antes de desplegar, agrega estas variables al servicio del CRM en Easypanel, conservando las variables Supabase existentes:

```dotenv
B2_ENDPOINT_URL=https://s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005
B2_BUCKET=CRM-Terrenos
B2_APPLICATION_KEY_ID=<keyID de Backblaze>
B2_APPLICATION_KEY=<applicationKey de la misma credencial>
```

Las credenciales están excluidas de Git y de la imagen Docker; no se configuran en el frontend. El archivo privado `EASYPANEL-BACKBLAZE.env`, fuera del repositorio, reúne los valores del panel; no usarlo mientras indique que la credencial está pendiente de validar. Sin configuración B2, el CRM conserva su funcionamiento y muestra un error claro al intentar subir o abrir un video nuevo.

Los objetos nuevos llevan el prefijo `b2/tutorials/` en su referencia privada; los videos anteriores conservan su referencia a Supabase para seguir reproduciéndose. No se envían cargas nuevas a Supabase ni se cambia de proveedor automáticamente si Backblaze falla. No se modifica el almacenamiento de expedientes de ventas.

La carga del formulario va directamente del navegador a Backblaze en partes de 8 MiB, mediante permisos firmados por una hora, restringidos al objeto, número de parte y tamaño. El CRM recibe únicamente solicitudes pequeñas para preparar y publicar. Esto elimina el doble traslado del video completo por Easypanel que podía terminar en un 502. No se envían claves de Backblaze ni la sesión del CRM al almacenamiento. El límite permanece en 200 MB (200 MiB).

Las partes se reintentan hasta tres veces ante interrupciones o errores transitorios. Si todavía falla, el botón «Reintentar carga» continúa con las partes recibidas mientras se conserve el archivo y formulario en esa página. No se promete reanudación después de cerrar la pestaña. La sesión privada `crm.tutorial_uploads` dura 24 horas; sólo Sistemas y su propietario pueden operarla. El servidor verifica tamaños reales y cabecera MP4/WebM antes de publicar. La confirmación es idempotente y bloquea la fila durante publicación/cancelación, de modo que una respuesta perdida no duplica el tutorial ni elimina uno publicado. Un fallo de metadatos conserva el archivo para recuperar la confirmación.

Backblaze necesita una regla CORS de carga para los orígenes exactos del CRM, manteniendo el bucket privado. Ya se configuraron `https://rfdesarrolloscampestre.com` y `https://aztrotech-crm-terrenos.9wq2vl.easypanel.host`. La reproducción continúa usando enlaces firmados; los tutoriales antiguos siguen funcionando.

Para instalar en otro entorno:

- Aplicar también `20261021202815_crm_tutorial_direct_uploads.sql`. El marcador `supabase-tutorials-v4-ready` impide arrancar esta versión antes de actualizar el esquema.
- Con `backend/.env` configurado de forma privada, ejecutar `python backend/scripts/setup_tutorial_storage.py`. Sin argumentos sólo verifica; para configurar carga directa usar `--upload-origin https://dominio-del-crm` (repetir para cada origen permitido). Conserva reglas ajenas y requiere permiso para actualizar CORS. No habilitar acceso público.
- Para descartar cargas abandonadas de más de 24 horas, ejecutar `python backend/scripts/cleanup_tutorial_uploads.py`. Sólo limpia objetos de sesiones pendientes vencidas registradas por el CRM, incluidas sus versiones; conserva tutoriales publicados y archivos anteriores.
- No recrear la base, volver a importar inventario ni ejecutar inicializadores de pruebas.

La migración convierte los nombres de usuario antiguos que eran correos en identificadores únicos y conserva el correo de acceso, el ID, el rol y el vínculo a Supabase Auth. No modifica contraseñas, clientes, ventas ni lotes. El respaldo de los identificadores previos está fuera del repositorio.

## Verificación realizada

- Pruebas de permisos para los tres roles; Sistemas rechazado incluso si conserva una bandera de superusuario antigua.
- Archivos vacíos, formato inválido, exceso de tamaño, fallos de almacenamiento y limpieza ante fallo de metadatos.
- Edición y unicidad del nombre de usuario; creación de cuentas Sistemas con rol privado.
- Carga y reproducción en el almacenamiento privado con un archivo temporal, lectura pública rechazada y limpieza posterior. Las filas temporales se revierten; los 178 lotes vendidos siguen intactos.
- Escritorio y móvil, tema claro y oscuro, formulario accesible con teclado, publicación y reproductor con API de prueba aislada.
- Asesor de seguridad Supabase sin hallazgos. Se conserva el SQL ejecutado en una migración creada por CLI; la extracción automática mediante `db pull` requiere el Docker local no disponible en este equipo.

### Validación de Backblaze — 21 de octubre de 2026

Con las credenciales definitivas se verificó el bucket privado CRM-Terrenos. La ruta del CRM cargó un MP4 temporal (201), emitió reproducción para un administrador (200), Backblaze entregó rangos de bytes (206) y Chromium reprodujo el video. La lectura sin firma fue rechazada. Se eliminaron el archivo temporal y todas sus versiones. Los metadatos de esta prueba se crearon en SQLite en memoria; no se crearon usuarios, clientes o ventas en producción.

El código de integración está en master. Para activarlo en Easypanel, agregar las cinco variables B2_* del archivo privado verificado, conservar las variables actuales y desplegar el CRM. Las credenciales no están incluidas en el repositorio ni en la imagen Docker.

### Corrección de carga 502 — 21 de octubre de 2026

La migración de cargas directas está aplicada y registrada; RLS activo y acceso `anon`/`authenticated` denegado. El asesor de seguridad no reportó hallazgos. Se cotejaron 178 lotes vendidos y 180 disponibles, sin cambios.

Se probó el frontend compilado en Chromium con un MP4 de 200 MiB contra Backblaze real, usando metadatos y cuentas aisladas en memoria: 25 partes de 8 MiB, error 502 simulado en una parte, renovación de sesión 401 y respuesta 502 perdida después de publicar. La carga se recuperó, quedó un único tutorial y se reprodujo correctamente. Ninguna petición al CRM llevó el contenido del video. El archivo temporal y todas sus versiones se eliminaron al terminar.

Validación: 143 pruebas backend aprobadas, 2 omitidas; 3 pruebas del flujo frontend aprobadas; compilación correcta. La comprobación utiliza la API local actualizada y el bucket real; requiere desplegar este commit para activar el flujo en Easypanel. No requiere nuevas variables de entorno si las cinco B2_* existentes ya están configuradas.
