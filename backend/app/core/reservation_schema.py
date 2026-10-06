"""Idempotent migration: retain cancelled sales while allowing a new reservation."""
from sqlalchemy import inspect, text

async def ensure_reservation_history(connection):
    if connection.dialect.name != 'postgresql':
        return
    def inspect_constraints(conn):
        inspector = inspect(conn)
        return inspector.get_unique_constraints('sales'), inspector.get_indexes('sales')
    constraints, indexes = await connection.run_sync(inspect_constraints)
    quote = connection.dialect.identifier_preparer.quote
    for constraint in constraints:
        if constraint['column_names'] == ['lot_id']:
            await connection.execute(text(f'ALTER TABLE sales DROP CONSTRAINT {quote(constraint["name"])}'))
    for index in indexes:
        if index.get('unique') and index['column_names'] == ['lot_id'] and not index.get('duplicates_constraint') and index['name'] != 'uq_sales_active_lot':
            await connection.execute(text(f'DROP INDEX {quote(index["name"])}'))
    await connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_active_lot ON sales (lot_id) WHERE status NOT IN ('CANCELLED', 'REVERSED')"))
