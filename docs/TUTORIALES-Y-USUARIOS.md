# Usuarios del CRM de terrenos

Este CRM conserva únicamente Administrador y Promotor. El correo es el acceso mediante Supabase Auth; el nombre de usuario sigue siendo un identificador independiente (3–100 letras, números, puntos, guiones o guiones bajos; sin @ ni espacios).

## Retirada de tutoriales — 22 octubre 2026

Se retiraron el rol Sistemas, la ruta `/videos`, la navegación, el reproductor, la carga, la eliminación y las rutas `/api/v1/tutorials`. Las cinco variables B2_* ya no se leen y boto3/botocore ya no son dependencias de esta aplicación. No afecta al expediente documental de Ventas/Clientes, a inventario ni a apartados.

Antes de desplegar, aplicar `supabase/migrations/20261022173430_retire_tutorials_and_systems.sql`. El arranque requiere `supabase-commercial-v5-ready`. La migración elimina los perfiles CRM de Sistemas únicamente si no tienen relaciones comerciales; de lo contrario se detiene. Los tokens anteriores pierden acceso porque cada petición comprueba que exista un perfil activo. Las identidades de Supabase Auth no se eliminan globalmente.

Las tablas históricas de tutoriales y cargas quedan como archivo privado fuera del modelo activo, sin API ni acceso anon/authenticated. No se borran objetos ni se cambia el bucket, sus claves o CORS. Las migraciones históricas se conservan para poder reconstruir el esquema.

Respaldo de perfiles y metadatos, copia del código anterior y configuración privada: carpeta local `traspaso-videos-crm-20261022` junto al repositorio. Las credenciales no se incluyen en Git ni en el ZIP de código.

En Easypanel del CRM de terrenos pueden retirarse `B2_ENDPOINT_URL`, `B2_REGION`, `B2_BUCKET`, `B2_APPLICATION_KEY_ID` y `B2_APPLICATION_KEY` después de guardarlas para el CRM de destino. Este cambio no configura ni despliega el otro CRM.
