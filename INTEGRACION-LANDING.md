# Landing → CRM de pruebas

La aplicación usa por defecto SQLite integrado (`DATABASE_MODE=embedded`). No necesita Supabase ni PostgreSQL. Al arrancar crea las tablas, un administrador de pruebas y los 358 lotes de Floresta por manzana y número, respetando los registros existentes. Campestre El Triunfo recibe consultas generales sin inventar lotes.

Las credenciales se entregan en el archivo local `ACCESO-CRM-PRUEBAS.txt`, excluido de Git. El repositorio contiene únicamente el hash de la contraseña del administrador de pruebas. La cuenta se crea solo en una base temporal vacía.

## Easypanel

Construir desde `master` con el Dockerfile del repositorio; puerto interno 80. La base se guarda en `/app/backend/data/crm-pruebas.db`. Para conservar pruebas entre reconstrucciones, montar un volumen en `/app/backend/data` y permitir escritura al usuario `appuser`. Sin volumen, una nueva implementación puede reiniciar los datos temporales. No introducir clientes reales.

`GET /health` informa `database_mode: embedded` e `integration_version: landing-requests-v1` cuando la nueva versión está publicada.

## Conexión

La landing usa `https://aztrotech-crm-terrenos.9wq2vl.easypanel.host/api/v1`; se puede cambiar con `VITE_CRM_API_URL` al construirla.

- `GET /api/v1/public/catalog/{slug}`: inventario público, sin datos del cliente.
- `POST /api/v1/public/requests`: apartado, cita o información, con folio y clave de reintento.
- `GET /api/v1/web-requests`: solicitudes, exige sesión del CRM.
- `PATCH /api/v1/web-requests/{id}`: seguimiento de una cita o consulta.

Apartar crea cliente, venta reservada por 15 días e interacción. Pedir cita guarda fecha y horario preferidos sin bloquear el lote. Apartados refresca cada 15 segundos. Las reservas se venden o cancelan desde el flujo existente; las citas permiten seguimiento. Vencer marca el plazo, no ejecuta una cancelación automática.

Las operaciones se serializan con `BEGIN IMMEDIATE` en SQLite, y con bloqueos de fila/transacción en PostgreSQL. Un índice único parcial impide dos ventas activas para el mismo lote, conservando el historial de cancelaciones. No se envían WhatsApps, correos ni cobros automáticamente.

## Pruebas

`python -m pytest backend/tests -q`: recepción, reintentos, concurrencia, contacto, aislamiento entre manzanas, citas, cancelación y acceso autenticado. `npm run build` en frontend. La landing cuenta además con su compilación y `npm run test:sites`.

## Base definitiva

Configurar `DATABASE_MODE=external`, `DATABASE_URL` y `DATABASE_URL_SYNC` con el servidor PostgreSQL definitivo y credenciales privadas. Migrar datos de forma deliberada; el cambio de modo no traslada los datos temporales. Configurar claves propias de autenticación y cifrado, usuarios definitivos y orígenes CORS de la landing. El administrador de prueba no se crea en modo externo.


## Acciones individuales de Apartados

Al abrir un apartado o una cita aparecen Venta, Ya se ha vendido el lote y Cancelado. Venta abre el registro vinculado; para una cita con lote disponible, primero confirma la creación del apartado y luego abre Ventas. Marcar vendido actualiza el inventario público. Cancelado libera el lote cuando hay un apartado vinculado; una cita sin apartado sólo cancela su seguimiento. Las operaciones cerradas permanecen en el historial y no pueden reactivarse accidentalmente.

Las acciones requieren sesión. Las transiciones bloquean el registro del lote, verifican su propietario y recalculan los contadores del proyecto. Reintentar una cancelación anterior no afecta una reserva posterior. No se permite liberar un lote vendido mediante la cancelación de un apartado. No hay cambios de esquema ni migraciones.

Validación (2026-10-06): 29 pruebas de integración; recorrido local en navegador con reserva M1/L4 → cancelación → Disponible en el plano sin recarga; cita M1/L5 → Venta → cancelación → Disponible. Ambos registros QA quedan cancelados en el historial local. Verificados diálogo, teclado, tema claro/oscuro y consola sin errores. El control de viewport no aplicó el ancho móvil solicitado, por lo que esa comprobación visual queda pendiente.

Publicación: desplegar la nueva versión del CRM en Easypanel (frontend y backend). La landing existente consume el catálogo actualizado y no necesita cambios para estas acciones.


## Expedientes de Ventas y Clientes

Ventas incorpora «Subir archivos» y «Ver expediente» en ambas vistas. La ficha de Clientes abre sus datos y las ventas asociadas, con los mismos documentos agrupados por lote. «Editar información» conserva la edición previa del cliente.

Cada archivo se vincula únicamente a `sale_id`; cliente y lote se obtienen de esa venta. Categorías: titularidad, documentos del cliente, contratos, comprobantes y otros. Cada carga permite hasta 10 archivos, 10 MB por archivo y 50 MB por lote de carga, con descripción opcional. Formatos: PDF, JPG/JPEG, PNG, WebP, DOCX, XLSX y TXT UTF-8. Las cargas se validan completas antes de guardar; no se guardan lotes parciales. Se registran cargas y descargas en auditoría. Los archivos no se publican en la landing ni en recursos estáticos; su descarga exige la sesión del CRM.

Al iniciar, el backend crea automáticamente la nueva tabla `sale_documents` si no existe. Los bytes originales se guardan en la propia base de datos (columna binaria), junto con tamaño, hash, categoría, descripción, fecha y usuario que subió el archivo. Consultar los listados no carga el contenido binario. No requiere otro proveedor de archivos. Cancelar una operación conserva sus documentos; no hay borrado de archivos en esta entrega.

El expediente muestra `reservation_expires_at` y días restantes para apartados. No renueva los 15 días, no convierte un archivo en una venta finalizada y no modifica disponibilidad al cargar documentación. La formalización sigue utilizando las acciones de venta existentes.

Despliegue: actualizar frontend y backend desde `master` en Easypanel. Es indispensable conservar el volumen existente en `/app/backend/data`: contiene SQLite, sus archivos y la clave de sesión. Los documentos persisten con la base, por lo que las copias de seguridad deben incluirla. Un despliegue sin ese volumen puede reiniciar la base temporal y perder los expedientes.

Validación: 38 pruebas de integración, incluidas persistencia de archivos, acceso autenticado, separación entre clientes/ventas, descarga exacta, conservación tras cancelación, cargas múltiples, lotes inválidos sin escrituras parciales, límites y nombres de archivo. Compilación del frontend y revisión local con datos ficticios: carga desde Ventas → consulta desde Clientes, respuesta de descarga 200, diálogo por teclado, tema claro/oscuro y formulario móvil de 390 px sin desbordamiento horizontal. El navegador integrado no notificó el evento de descarga, aunque el servidor entregó el archivo y las pruebas comprobaron sus bytes.
