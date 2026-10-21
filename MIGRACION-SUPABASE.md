# CRM → Supabase PostgreSQL

Proyecto: `nxpqpowuslnsujrlmppx`. Conexión probada por Session pooler, puerto 5432.
La web y el CRM siguen usando la API FastAPI y sus usuarios existentes; no se
sustituye el acceso del CRM por Supabase Auth.

## Estado de preparación

- Esquema privado `crm` creado con 13 tablas, índices y relaciones.
- RLS habilitada y acceso al esquema revocado para `PUBLIC`, `anon` y
  `authenticated`. El frontend no recibe claves privilegiadas ni contraseñas.
- Revisión de seguridad de Supabase sin incidencias en la comprobación realizada.
- Importación de datos ficticios probada contra PostgreSQL y revertida; sin datos
  reales importados ni marcador de activación.
- `backend/.env.supabase.local` está ignorado por Git. Contiene la conexión
  verificada, pero faltan las claves de sesión y cifrado de la instancia real.
- No se cambió la configuración del CRM en Easypanel.

## Respaldo y claves de origen

1. Preparar una ventana de mantenimiento y detener las escrituras en el CRM y las
   solicitudes de la landing durante la importación final.
2. Obtener una copia consistente de `/app/backend/data/crm-pruebas.db` usando la
   API de backup de SQLite, o copiarla con el servicio detenido y el WAL integrado.
   No copiar solamente el archivo principal mientras SQLite está escribiendo.
3. Conservar el `SECRET_KEY` de Easypanel; si se usaba la clave automática,
   conservar el contenido de `/app/backend/data/.session-key`.
4. Conservar exactamente `ENCRYPTION_KEY`, incluyendo el caso de valor vacío.
   Cambiarlo impediría descifrar los datos de clientes. No usar claves de la copia
   local como sustituto de las del VPS.

## Esquema y comprobación

La migración SQL fue creada mediante Supabase CLI y generada desde los modelos
SQLAlchemy. El esquema ya está aplicado en el proyecto indicado: **no volver a
ejecutar CREATE TABLE sobre esa base**. `db pull` no pudo ejecutarse porque este
equipo no tiene Docker/Podman; el archivo se conserva desde el mismo DDL aplicado.

Para otro proyecto vacío, emitir el DDL con:

```sh
python backend/scripts/migrate_to_supabase.py --schema-sql > crm-schema.sql
```

Aplicarlo con las herramientas SQL de Supabase. Si `db query` rechaza varios
comandos preparados, ejecutarlos dentro de un único bloque DO transaccional.
Después comprobar RLS y permisos con `supabase db advisors`.

## Importación final

Desde la raíz del repositorio, con las dependencias del backend instaladas:

```sh
python backend/scripts/migrate_to_supabase.py --source /ruta/respaldo-vigente.db --env-file backend/.env.supabase.local
python backend/scripts/migrate_to_supabase.py --source /ruta/respaldo-vigente.db --env-file backend/.env.supabase.local --apply --confirm-offline
python backend/scripts/migrate_to_supabase.py --source /ruta/respaldo-vigente.db --env-file backend/.env.supabase.local --verify-only
```

El primer comando sólo revisa. La importación exige destino vacío, genera otra
copia de seguridad local con permisos privados, preserva IDs, hashes de usuarios,
archivos, fechas y relaciones, y compara el contenido de cada tabla. Se aplica en
una transacción; sólo al finalizar guarda `supabase-v1-ready` y ajusta secuencias.
No modifica el respaldo ni reemplaza registros del destino. Ante un error no se
debe habilitar Supabase en el servidor.

## Activación en Easypanel

Después de verificar la importación, desplegar esta versión con:

- `DATABASE_MODE=supabase`
- `DATABASE_URL`: conexión privada del Session pooler. Usar contraseña codificada
  para URL cuando contenga caracteres especiales. No subirla a GitHub.
- `SECRET_KEY` y `ENCRYPTION_KEY`: los mismos valores de la instancia de origen.
- `DOCUMENT_STORAGE=database`: mantiene los bytes archivados durante esta etapa.

El motor de auditoría usa la misma base. Ambas conexiones fijan explícitamente
`search_path=crm` y UTC, incluso cuando el pooler ignora opciones iniciales.
No usar el Transaction pooler para este esquema basado en estado de sesión.
El arranque se bloquea si falta el marcador de importación verificada.

Comprobar login, Proyectos, Apartados, cancelación/disponibilidad en la landing,
Ventas y descarga de expedientes. No borrar el volumen SQLite original. Si hay
que volver atrás después de aceptar nuevas escrituras, reconciliar esas nuevas
operaciones antes de reactivar SQLite.

Los documentos permanecen dentro del límite de base de datos, no del espacio de
Supabase Storage. La separación a un bucket privado será una migración posterior.

## Verificación

`python -m pytest backend/tests -q` ejecuta pruebas locales. La prueba PostgreSQL
opcional usa `SUPABASE_TEST_ENV=backend/.env.supabase.local` y exige esquema vacío:
inserta datos ficticios en una transacción y siempre revierte las filas. No usarla
una vez importados los datos reales. El historial de migraciones y los datos de
la aplicación son independientes.
