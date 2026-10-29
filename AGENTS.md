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


- Corrección 2026-10-22: este CRM no lleva biblioteca de videos ni rol Sistemas. Mantener únicamente Administrador y Promotor, con correo y nombre de usuario separados. Retirar navegación, API, carga/reproducción/eliminación y conexión B2 de tutoriales. Conservar bucket y archivos para el CRM correcto; no tocar expedientes documentales de ventas. La integración anterior y credenciales se entregan fuera del repositorio.

- Dominio público confirmado por los errores de producción del 23 de octubre de 2026: `https://eltriunfo.mx` (y variante `https://www.eltriunfo.mx`). El backend debe permitir ambos orígenes exactos en CORS aunque Easypanel tenga un `CORS_ORIGINS` antiguo. Verificar GET de catálogo y preflight POST de solicitudes con ese Origin; HTTP 200 sin Access-Control-Allow-Origin no demuestra que el navegador pueda leer el inventario. No usar comodines ni modificar datos comerciales para corregir este permiso.

- Maculi sur (23 de octubre de 2026): proyecto nuevo y separado, slug `maculi-sur`, 50 lotes numerados sin manzana. Fuente: landing `/Users/cesarholguin/Documents/Aztrotech/maculi/site/dist/lots.json`; $1,200/m², 20% enganche, tasa mensual .0141033227511898 y plazos 12–72 meses en incrementos de 12. No aplicar las condiciones de El Triunfo. Conservar estados existentes en reimportaciones; los estados no confirmados se cargan bloqueados. Dominio autorizado `https://maculisur.com.mx` y www. No cambiar inventario previo ni clientes de El Triunfo.

- Citas desde la landing (29 de octubre de 2026): la disponibilidad horaria vive en CRM, en hora local del proyecto; mostrar 24 espacios fijos cada hora (00:00–23:00). El endpoint público solo puede devolver horas ocupadas, nunca datos del cliente. Las citas pendientes, en seguimiento o confirmadas ocupan su franja; canceladas, realizadas o cerradas la liberan. Validar de nuevo al crear la cita bajo un bloqueo transaccional por proyecto y fecha para impedir dobles registros simultáneos. No registrar una visita sin hora exacta.
