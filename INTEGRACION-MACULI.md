# Maculi sur — conexión con landing

Proyecto nuevo `Maculi sur`, slug `maculi-sur`. Los 50 lotes se identifican por su número, sin manzana. Dominio: https://maculisur.com.mx. El catálogo comercial está en backend/app/data/maculi-lots.json, importado de la landing del cliente, con superficies 14/15 de 139.62 m².

El importador `cd backend && python scripts/seed_maculi.py --apply` agrega sólo registros faltantes. Sin `--apply` simula y revierte. No reinicia estados ni precios existentes y no se ejecuta automáticamente al arrancar. La primera carga mantiene bloqueados los lotes cuya disponibilidad no está confirmada.

GET `/api/v1/public/catalog/maculi-sur` devuelve sólo inventario comercial. POST `/api/v1/public/requests` admite proyecto `maculi-sur`, `block: null`, número de lote, datos de contacto, tipo reservation/visit/information y `payment_plan: financed/cash/undecided`. Financiado requiere `financing_months` de 12, 24, 36, 48, 60 o 72; contado/por definir no incluyen plazo. El servidor calcula importes a partir del inventario, sin aceptar precios del navegador. Conserva cotización en las solicitudes y al convertir una visita en venta.

Las reservas usan bloqueo transaccional, idempotencia y el mismo flujo de cancelación del CRM. Una visita o consulta no bloquea el inventario. El esquema privado y la autenticación permanecen sin cambios; no hay claves de base de datos en la landing.

Despliegue: primero CRM, luego Maculi sur. No se requieren nuevas variables de entorno. Las direcciones CORS exactas se incluyen aunque Easypanel conserve una lista antigua. El proyecto ya provisionado no requiere volver a importar al desplegar.

Pruebas: `.venv-integration/bin/python -m pytest backend/tests/test_maculi.py backend/tests/test_web_requests.py backend/tests/test_landing_cors.py -q`. Incluyen los seis plazos, contado, solicitudes sin manzana, duplicados, cancelaciones y aislamiento del inventario anterior.
