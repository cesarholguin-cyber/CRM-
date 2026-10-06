# Preparación de Oracle para el CRM

Estado: código y migraciones preparados. **No se ha creado una base ni un bucket en una cuenta OCI, ni se ha cambiado la conexión de Easypanel.** Falta confirmar cuenta, región, compartimento y tipo de Oracle contratado. Las pruebas locales verifican SQL generado, transferencia entre copias SQLite, integridad documental y almacenamiento simulado; la conexión y el recorrido completo en Oracle requieren una instancia real.

## Recursos y acceso pendientes

- Base Oracle 19c o superior. La opción de Autonomous Database es compatible mediante python-oracledb Thin y wallet mTLS; confirmar región y capacidad antes de crear recursos facturables. No se presupone disponibilidad de una modalidad gratuita.
- Usuario/esquema exclusivo `RF_CRM`, distinto de ADMIN, con `CREATE SESSION`, `CREATE TABLE`, `CREATE SEQUENCE` y cuota en el tablespace correspondiente. En Autonomous, el tablespace de datos es `DATA`. El administrador crea el usuario y su contraseña desde la consola; no poner contraseñas en scripts versionados.
- Permitir la conexión TLS desde la IP de salida del servidor Easypanel. Si la base usa un endpoint privado, hace falta conectividad desde ese servidor (VPN/red privada) antes de importar.
- Wallet con `tnsnames.ora` y `ewallet.pem`, si la base exige mTLS. Montarlo en solo lectura y accesible al usuario del contenedor. El archivo `.env.oracle.example` muestra las rutas dentro del contenedor; para ejecutar desde Mac se usan rutas locales reales.
- Object Storage: namespace, región y OCID del compartimento. Nombre propuesto: `rf-crm-documentos`; privado, Standard, con versiones para un bucket nuevo.
- Configuración OCI de una identidad de servicio y llave privada montada en solo lectura. No introducir llaves en Git, Docker ni en el frontend. El perfil OCI incluye `user`, `fingerprint`, `tenancy`, `region`, `key_file`; esta última ruta debe existir dentro del contenedor.
- Permisos OCI limitados al bucket: lectura de metadatos del bucket, creación y lectura de objetos. La identidad que crea el bucket necesita permiso adicional para crearlo; ese permiso no es necesario en el CRM. Las políticas exactas se completan con el grupo y compartimento reales. No usar enlaces públicos ni enlaces preautenticados para documentos.

Fuentes: [conexión Oracle con SQLAlchemy](https://docs.sqlalchemy.org/en/20/dialects/oracle.html#connecting-to-oracle-autonomous-database), [usuarios de Autonomous](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/manage-users-create.html), [creación de buckets](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/managingbuckets_topic-To_create_a_bucket.htm).

## Archivos preparados

- `backend/.env.oracle.example`: plantilla sin credenciales; copiar a `backend/.env.oracle`, que queda excluido de Git y Docker.
- `backend/migrations/002_oracle_schema.sql`: esquema inicial Oracle revisable. No ejecutar el antiguo `001_initial_schema.sql` de PostgreSQL en Oracle. El importador crea este esquema desde los mismos modelos, por lo que no hace falta ejecutar ambos.
- `backend/scripts/migrate_to_oracle.py`: revisión, respaldo, importación a destino vacío, comparación de todas las columnas, recuperación de identidades y registro de versión.
- `backend/scripts/oracle_storage.py`: creación del bucket privado y copia reanudable de documentos al bucket.

El CRM conserva el modo SQLite por defecto. `DATABASE_MODE=oracle` exige credenciales y una clave de sesión válida; además exige la marca de migración completada antes de arrancar. No crea un administrador de prueba en Oracle. Los usuarios existentes y hashes se trasladan con sus identificadores; cambiar la contraseña de prueba antes de usar datos reales. Conservar exactamente las claves actuales `SECRET_KEY`/`.session-key` y `ENCRYPTION_KEY` durante la migración; no rotarlas simultáneamente.

## Orden de ejecución

Los comandos se ejecutan desde la raíz del repositorio, usando Python del entorno con `backend/requirements.txt` instalado. Sustituir `/ruta/copia-crm.db` por el respaldo real del servidor; **la base local del desarrollador no representa automáticamente la de Easypanel**.

1. Desplegar esta versión manteniendo SQLite y el volumen `/app/backend/data`. Comprobar el CRM antes del cambio de proveedor.
2. Preparar los recursos Oracle, usuario, wallet y configuración OCI. Completar `backend/.env.oracle` sin activar aún esas variables en Easypanel. Usar `DOCUMENT_STORAGE=database` durante la copia inicial.
3. Programar una ventana de mantenimiento. Detener las escrituras del CRM/landing y todas las réplicas del backend. Crear y descargar una copia consistente de SQLite (mediante su API de backup, o con el servicio detenido incluyendo WAL); respaldar también claves de sesión/cifrado. No copiar solamente el `.db` de un proceso activo ignorando el WAL.
4. Revisar la copia sin conexión a Oracle:

```sh
PYTHONPATH=backend python backend/scripts/migrate_to_oracle.py --source /ruta/copia-crm.db
```

5. Importar al esquema **vacío** de Oracle. Antes de la escritura se genera otro respaldo local con permisos `0600`; se imprimen únicamente cantidades y rutas, no registros ni credenciales:

```sh
PYTHONPATH=backend python backend/scripts/migrate_to_oracle.py --source /ruta/copia-crm.db --env-file backend/.env.oracle --apply
PYTHONPATH=backend python backend/scripts/migrate_to_oracle.py --source /ruta/copia-crm.db --env-file backend/.env.oracle --verify-only
```

La importación conserva IDs, contraseñas cifradas/hash, estados, historial, fechas, importes y archivos. Rechaza destinos ocupados, relaciones rotas, campos obligatorios vacíos y múltiples ventas activas del mismo lote. El índice Oracle permite conservar ventas canceladas y reservar de nuevo el mismo lote. SQLite guarda fechas sin zona; en la copia se interpretan como UTC, conforme al backend actual. Oracle normaliza cadenas vacías a NULL.

La transferencia y su comparación se hacen antes del commit. Oracle confirma DDL implícitamente: si falla el ajuste final de identidades, no reimportar ni borrar; mantener el servicio detenido y usar `--finalize` con la **misma copia**, que vuelve a comparar todos los registros antes de terminar. Un fallo de creación del esquema puede dejar tablas vacías; `--apply` puede retomarlo mientras no haya datos. La marca `oracle-v1-ready` sólo se crea después de verificar los datos y ajustar identidades.

6. Revisar/crear el bucket (sin `--apply` sólo consulta):

```sh
PYTHONPATH=backend python backend/scripts/oracle_storage.py bucket --env-file backend/.env.oracle
PYTHONPATH=backend python backend/scripts/oracle_storage.py bucket --env-file backend/.env.oracle --apply
```

Un bucket existente debe ser privado y pertenecer al compartimento indicado; el comando no cambia sus políticas ni borra objetos.

7. Copiar expedientes después de verificar la base y antes de reabrir el CRM:

```sh
PYTHONPATH=backend python backend/scripts/oracle_storage.py documents --env-file backend/.env.oracle
PYTHONPATH=backend python backend/scripts/oracle_storage.py documents --env-file backend/.env.oracle --apply
```

Cada archivo se vuelve a descargar y se comprueba su tamaño y SHA-256 antes de registrar su ubicación. Las ejecuciones posteriores verifican y omiten los ya copiados. Los bytes originales importados se conservan como respaldo dentro de Oracle; no hay purga automática. Ventas y Clientes siguen leyendo el mismo expediente. La ubicación del bucket no se expone en la respuesta al navegador.

8. Cambiar Easypanel a `DATABASE_MODE=oracle` y `DOCUMENT_STORAGE=oci`, añadir las demás variables privadas y montar wallet/config/llave. Desplegar y probar inicio de sesión, inventario, apartado → cancelación → nueva reserva, cita, venta, carga y descarga desde Ventas y Clientes. La URL de API de la landing no cambia. Las cargas nuevas guardan sus bytes en OCI y sólo su referencia/metadatos en la base.

## Recuperación y operación

- Si el ensayo falla antes de reabrir escrituras, volver a `DATABASE_MODE=embedded` y `DOCUMENT_STORAGE=database`, usando el volumen SQLite y las claves originales. Conservar todos los recursos para diagnóstico.
- Después de aceptar nuevas operaciones en Oracle, volver a una copia antigua de SQLite perdería esas operaciones. Se requiere reconciliar/exportar los cambios antes de retroceder; este importador no hace una migración inversa.
- Base de datos y bucket no comparten transacción. Si una carga múltiple falla, no se publica un expediente parcial, pero podrían quedar objetos privados sin referencia. Se conservan para revisión, especialmente ante respuestas inciertas; no hay borrado automático que arriesgue un documento confirmado. Conciliar prefijo `crm/sales/` con `document_objects` antes de limpiar objetos y versiones.
- Mantener respaldos de Oracle, claves y versiones del bucket. Versionado del bucket no sustituye el respaldo de metadatos/relaciones.
- Un error de bucket devuelve un mensaje temporal desde el CRM; nunca entrega un archivo cuyo hash/tamaño no coincidan. El modo de almacenamiento no cambia los 15 días ni la disponibilidad del lote.
- El bloqueo de entrada de solicitudes Oracle usa una fila dedicada para serializar reintentos/contactos; prioriza consistencia. Revisar su capacidad con carga real antes de escalar a mucho tráfico.

## Validación local

47 pruebas aprobadas: comportamiento existente de apartados y expedientes, esquema Oracle, conexión configurada sin abrir red, copia de registros con IDs originales, rechazo de destino ocupado, comparación de contenido, respaldos de sólo lectura, bucket simulado, acceso autenticado y errores de carga sin expediente parcial. Revisión de una copia QA con 359 lotes y dos archivos completada sin escrituras. Dependencias verificadas sin conflictos.

## Validación pendiente en la cuenta real

Crear una instancia/esquema de ensayo, ejecutar importación, comprobar IDs generados después de la copia, concurrencia de reservas, autenticación, carga múltiple, caída temporal de OCI y descarga exacta de documentos. Sólo después hacer el cambio final en Easypanel. No se declara completada una migración basándose únicamente en el SQL compilado o en mocks.
