# Preferencias del CRM R&F

- Mantener las funciones existentes, la autenticación y la conexión entre inventario, apartados y landing.
- El usuario quiere un CRM cuidado visualmente, interactivo, con desenfoques y efectos elegantes. Dirección aprobada por contexto: verde bosque, arena, paneles translúcidos y movimiento discreto.
- Priorizar lectura, contraste y rapidez de gestión. Respetar movimiento reducido; no ocultar lotes con animaciones escalonadas largas.
- Verificar escritorio, móvil, modo oscuro y navegación por teclado cuando se modifica el diseño compartido.
- Las credenciales y bases de prueba no se versionan. No mostrar tokens presentes en las direcciones remotas de Git.

- Inventario: separar visualmente los lotes por manzana, ordenar manzanas numéricamente (1, 2, …, 10) y lotes de menor a mayor dentro de cada sección. Mantener esta organización al entrar desde «Ver lotes» de un proyecto.

- Apartados: gestionar cada lote individualmente con Venta, Ya se ha vendido el lote y Cancelado. Conservar historial; cancelar libera únicamente el apartado vinculado, nunca ventas ni reservas de otras solicitudes.

- Ventas y Clientes comparten un expediente documental por venta/lote. Permitir cargas múltiples clasificadas (titularidad, cliente, contratos, pagos y otros), conservar archivo original, descripción y fecha, y mostrar el plazo existente del apartado de 15 días. Abrir el cliente debe mostrar sus datos y expedientes separados por venta. No duplicar archivos entre secciones ni cambiar el estado del lote al subir documentos. Archivos y descargas requieren sesión y se conservan en el historial.

- El catálogo antes llamado Floresta Campestre pertenece ahora a Campestre del Triunfo (`campestre-el-triunfo`). No recrear Floresta ni duplicar sus lotes. Conservar `floresta-campestre` únicamente como alias público para la landing ya publicada. La consolidación conserva IDs, estados y expedientes.

- Base definitiva elegida el 21 de octubre de 2026: Supabase PostgreSQL, proyecto `nxpqpowuslnsujrlmppx`. Conservar el backend FastAPI y la autenticación del CRM. Esquema privado `crm`, sin acceso para anon/authenticated; claves y contraseñas sólo en configuración privada. Migrar únicamente un respaldo reciente del CRM de Easypanel, nunca asumir que la copia local es la vigente. No activar `DATABASE_MODE=supabase` antes de verificar la importación y conservar las claves actuales de sesión/cifrado.

- Actualización autorizada el 21 de octubre de 2026: usar Supabase Auth para las contraseñas y sesiones, con roles explícitos en `crm.users` enlazados por `supabase_auth_id`. No derivar roles de metadatos editables ni dar acceso automáticamente a cualquier cuenta creada en Supabase. El usuario confirmó que todos los 178 lotes vendidos son reales; conservarlos. Autorizó usar el respaldo local tras cotejar los 358 lotes con el catálogo publicado, excluyendo clientes, ventas y cuentas de prueba. La cuenta de Supabase indicada por el usuario es la administradora; no copiar hashes de `auth.users`. El respaldo anterior queda archivado fuera del repositorio. Producción usa Supabase por defecto y el reinicio de datos demo queda deshabilitado.

- Tutoriales: desde el 21 de octubre de 2026 los videos nuevos se guardan en Backblaze B2, bucket privado CRM-Terrenos. Supabase conserva metadatos y autenticación. Configuración B2_* privada, sin credenciales en Git ni frontend. Mantener lectura de tutoriales antiguos; no volver a subir videos nuevos a Supabase.
