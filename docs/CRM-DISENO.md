# Diseño del espacio de trabajo R&F

## Cambios

- Nueva estructura de navegación verde bosque y arena, con menú compacto y menú móvil mediante diálogo nativo.
- Fondo con profundidad y desplazamiento sutil al mover el puntero; encabezado y diálogos con desenfoque.
- Tarjetas, entradas, tablas y botones coherentes en las pantallas existentes, con contraste para modo claro y oscuro.
- Resumen con accesos a apartados e inventario, e indicadores que abren su sección correspondiente.
- Buscador de secciones con Ctrl/⌘ K, enfoque automático, navegación mediante Tab y cierre con Escape.
- Animaciones breves, sin la demora acumulada al mostrar cientos de lotes. Movimiento reducido respetado.
- Aviso de pruebas integrado en la altura de la pantalla; título e icono del navegador propios del CRM.

## Verificación

6 de octubre de 2026, contra el CRM local y su base de pruebas existente.

- Compilación de producción correcta; lint sin errores, con avisos previos de código no utilizado y dependencias de hooks.
- Navegación a resumen, proyectos, inventario, clientes, ventas, apartados, reportes y configuración.
- Búsqueda «inventario» y «clientes»: abre las pantallas correctas. El campo recibe el enfoque al abrir el diálogo.
- Inventario Floresta muestra los 358 lotes y conserva sus controles de estado.
- Apartados sigue mostrando las reservas y citas de prueba. No se alteraron registros durante esta revisión visual.
- Verificados modo oscuro y distribución móvil de 390 × 844, incluido el menú de navegación. Apartados sin desbordamiento horizontal.
- Apertura y cierre del formulario de importación comprobados sin guardar: queda centrado sobre el fondo desenfocado.
- Sin errores de consola observados durante la revisión.

El CSS compartido está en `frontend/src/workspace.css`. No se cambian endpoints, formatos de solicitudes ni persistencia de datos.
