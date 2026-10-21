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

Los nuevos archivos se guardan en el bucket privado `CRM-Terrenos` de Backblaze B2. La tabla privada `crm.tutorials` conserva solo metadatos; no almacena los videos en PostgreSQL. La reproducción obtiene una dirección firmada de una hora después de verificar la sesión y el rol; no se entrega la clave de servicio. Una dirección firmada ya emitida funciona hasta que vence. El reproductor permite volver a abrir el video si venció o falló la conexión.

## Despliegue

La migración `20261021190506_crm_tutorials_and_usernames.sql` ya está aplicada. Este cambio de almacenamiento no necesita otra migración. Antes de desplegar, agrega estas variables al servicio del CRM en Easypanel, conservando las variables Supabase existentes:

```dotenv
B2_ENDPOINT_URL=https://s3.us-east-005.backblazeb2.com
B2_REGION=us-east-005
B2_BUCKET=CRM-Terrenos
B2_APPLICATION_KEY_ID=<keyID de Backblaze>
B2_APPLICATION_KEY=<applicationKey de la misma credencial>
```

Las credenciales están excluidas de Git y de la imagen Docker; no se configuran en el frontend. El archivo privado `EASYPANEL-BACKBLAZE.env`, fuera del repositorio, reúne los valores del panel; no usarlo mientras indique que la credencial está pendiente de validar. Sin configuración B2, el CRM conserva su funcionamiento y muestra un error claro al intentar subir o abrir un video nuevo.

Los objetos nuevos llevan el prefijo `b2/tutorials/` en su referencia privada; los videos anteriores conservan su referencia a Supabase para seguir reproduciéndose. No se envían cargas nuevas a Supabase ni se cambia de proveedor automáticamente si Backblaze falla. No se modifica el almacenamiento de expedientes de ventas.

La carga usa el servidor del CRM y la reproducción usa enlaces temporales firmados directamente a Backblaze. No hace falta abrir el bucket ni agregar permisos CORS para el reproductor de video normal. El límite del CRM permanece en 50 MB por archivo (es un límite de la aplicación). El servidor envía el archivo desde su archivo temporal, sin cargarlo completo en memoria. Si falla el registro del tutorial, elimina todas las versiones del objeto de ese intento para no consumir espacio por versiones ocultas.

Para instalar en otro entorno:

- Aplicar la migración con la herramienta de migraciones habitual, conservando las migraciones anteriores. El marcador `supabase-tutorials-v3-ready` impide arrancar esta versión antes de actualizar el esquema.
- Con `backend/.env` configurado de forma privada, ejecutar `python backend/scripts/setup_tutorial_storage.py`. Usa las variables `B2_*` y verifica el bucket existente sin modificarlo. No habilitar acceso público.
- No recrear la base, volver a importar inventario ni ejecutar inicializadores de pruebas.

La migración convierte los nombres de usuario antiguos que eran correos en identificadores únicos y conserva el correo de acceso, el ID, el rol y el vínculo a Supabase Auth. No modifica contraseñas, clientes, ventas ni lotes. El respaldo de los identificadores previos está fuera del repositorio.

## Verificación realizada

- Pruebas de permisos para los tres roles; Sistemas rechazado incluso si conserva una bandera de superusuario antigua.
- Archivos vacíos, formato inválido, exceso de tamaño, fallos de almacenamiento y limpieza ante fallo de metadatos.
- Edición y unicidad del nombre de usuario; creación de cuentas Sistemas con rol privado.
- Carga y reproducción en el almacenamiento privado con un archivo temporal, lectura pública rechazada y limpieza posterior. Las filas temporales se revierten; los 178 lotes vendidos siguen intactos.
- Escritorio y móvil, tema claro y oscuro, formulario accesible con teclado, publicación y reproductor con API de prueba aislada.
- Asesor de seguridad Supabase sin hallazgos. Se conserva el SQL ejecutado en una migración creada por CLI; la extracción automática mediante `db pull` requiere el Docker local no disponible en este equipo.
