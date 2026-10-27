# Supabase: certificado público de confianza

`supabase-prod-root-2021.crt` es una CA pública, **no una clave privada**.
Se usa exclusivamente para verificar CA y hostname al conectar PostgreSQL con
`sslmode=verify-full`. No se añade al almacén HTTPS general.

Fuente utilizada por el dashboard oficial de Supabase:

- https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
- https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- https://supabase.com/docs/guides/platform/ssl-enforcement

Descargado el 2026-10-27. SHA-256 del archivo:
`700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
Vencimiento: 2031-04-26. Para otros certificados/rotaciones, montar la CA oficial
y configurar `DATABASE_SSL_ROOT_CERT` con su ruta dentro del contenedor.
No desactivar verificación TLS para resolver errores de certificado.
