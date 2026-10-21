# CRM en Supabase

Proyecto `nxpqpowuslnsujrlmppx`. PostgreSQL por Session pooler, puerto 5432,
esquema privado `crm`. El backend sigue siendo FastAPI; Supabase Auth valida
contraseñas y emite las sesiones. No se copian hashes desde `auth.users`.

## Estado al 21 de octubre de 2026

- Se importó el inventario cotejado con el catálogo público del CRM: 358 lotes,
  178 vendidos y 180 disponibles. Todos pertenecen a Campestre del Triunfo.
- Los IDs de los lotes, manzanas, superficies y precios se conservan. No se
  importaron los clientes, ventas, documentos ni usuarios de prueba.
- El usuario confirmó que todos los vendidos son reales. El estado vendido se
  conserva aunque no haya una venta o cliente asociado en la base nueva.
- La cuenta que el usuario creó en Supabase Auth se vinculó explícitamente como
  administradora. La contraseña sigue siendo la que configuró en Supabase.
- Marcadores `supabase-v1-ready` y `supabase-auth-v2-ready` verificados.
- El respaldo original y el inventario publicado se guardaron fuera del repo, en
  `../Respaldos-CRM/20261021T172937Z/`. Ese respaldo es local; no es una copia del
  disco completo de Easypanel.
- La activación en el servidor requiere configurar sus variables y desplegar.
  Una importación hecha desde este equipo no modifica la configuración del VPS.

## Activación en Easypanel

1. Servicio CRM, repositorio `cesarholguin-cyber/CRM-`, rama `master`.
2. Copiar los valores del archivo privado `EASYPANEL-SUPABASE.env` entregado en
   `../Respaldos-CRM/activacion-supabase/` al apartado Entorno del servicio CRM.
3. Guardar y hacer Deploy. Puerto interno del CRM: **80**.
4. Consultar `/health`: debe indicar `database_mode: supabase` y
   `auth_provider: supabase`. Iniciar sesión con el correo y contraseña de Auth.
5. Comprobar el inventario y su disponibilidad en la landing.

Variables: `DATABASE_MODE`, `DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SECRET_KEY`,
`ENCRYPTION_KEY`, `DOCUMENT_STORAGE` y `CORS_ORIGINS`.

Las claves privadas no están en Git ni en la imagen Docker. No poner ninguna
clave de servidor o conexión PostgreSQL en variables frontend `VITE_*`.
`DATABASE_URL_SYNC` se calcula automáticamente a partir de `DATABASE_URL`.
No cambiar las claves nuevas después de empezar a guardar datos reales.
Se generaron claves nuevas porque no se migraron campos cifrados ni sesiones de
prueba. Las sesiones anteriores no son válidas en el nuevo acceso.

Supabase es el modo por defecto. Si faltan variables o el marcador de importación,
el proceso falla explícitamente; nunca vuelve a una base demo como alternativa.
El endpoint de reinicio de lotes de prueba está bloqueado en producción.
El archivo SQLite del VPS queda fuera de uso tras activar Supabase; su eliminación
física requiere acceso al VPS, y no la realiza este despliegue automáticamente.

## Acceso y permisos

Las cuentas del CRM tienen un vínculo único con el UUID de Supabase Auth.
Cambiar metadatos personales o crear otra cuenta con el mismo correo no concede
permisos. Una cuenta de Auth sin vínculo autorizado no entra al CRM.
Los administradores pueden crear cuentas desde Usuarios; se crean en Supabase
Auth y se les asigna el rol solicitado en el perfil privado del CRM.
Desactivar o retirar el perfil del CRM impide entrar aunque la cuenta de Auth
siga existiendo. El acceso verifica la sesión y el estado de la cuenta en Supabase.
Cerrar sesión revoca la sesión remota. El cambio de contraseña se realiza en Auth.
El frontend comparte una única renovación entre solicitudes simultáneas.

## Esquema y protección

Las 13 tablas privadas tienen RLS y el esquema no tiene permisos de acceso para
`anon`/`authenticated`. Las consultas de negocio pasan por el backend autenticado.
Las claves privilegiadas sólo se usan en el backend.
El usuario de conexión PostgreSQL conserva acceso a `auth.users` y `auth.sessions`
para comprobar sesiones activas, sin leer contraseñas.

Migraciones:
- `20261021170621_crm_private_schema.sql`: tablas, índices, RLS y revocaciones.
- `20261021174956_crm_supabase_auth_identity.sql`: vínculo único al usuario Auth.

Se aplicaron con Supabase CLI y se registraron en su historial. No volver a
aplicar CREATE TABLE a la base existente. `db pull` requiere Docker, que no está
instalado aquí; las migraciones conservan el mismo DDL ejecutado con la CLI.

## Inicialización y respaldo

`backend/scripts/initialize_supabase.py` es la ruta para una base **vacía** y un
inventario verificado. Lee el respaldo sin modificarlo, coteja cada lote con el
catálogo publicado, exige coincidencia exacta de los vendidos, vincula el UUID de
Auth especificado y verifica los registros antes de confirmar la transacción.
Por defecto es simulación; `--apply` aplica. Rechaza destinos con datos, lotes
faltantes/duplicados, discrepancias de vendidos o apartados pendientes.
No ejecutarlo otra vez sobre la base activa.

El script antiguo `migrate_to_supabase.py` conserva su función de copia completa
para otros escenarios, pero **no es el procedimiento de esta activación**: aquí
se excluyeron datos de prueba y se pasó a Supabase Auth por instrucción del usuario.

Los documentos nuevos quedan privados dentro de PostgreSQL. Todavía no se ha
migrado su almacenamiento a un bucket de Supabase Storage.

## Verificación y recuperación

Pruebas locales: `.venv-integration/bin/python -m pytest backend/tests -q`.
Se verificó además el arranque real contra Supabase, login por contraseña,
perfil, permisos de administrador/promotor, renovación, inventario, bloqueo del
reinicio demo, logout y rechazo de sesión revocada. La cuenta temporal usada para
la verificación se eliminó al finalizar. La contraseña del administrador no se
cambió ni se utilizó para esta verificación.

No ejecutar los tests opcionales de importación de `test_supabase.py` con
`SUPABASE_TEST_ENV` contra esta base: requieren un destino vacío.

No restaurar el respaldo antiguo encima de nuevos datos reales. Detener primero
las escrituras y respaldar Supabase. La copia antigua contiene datos de prueba y
no contiene operaciones posteriores a su fecha. Volver a SQLite requiere la
versión y configuración anteriores, guardadas junto al respaldo; el código
actual utiliza Supabase Auth y no acepta sesiones locales en modo Supabase.
