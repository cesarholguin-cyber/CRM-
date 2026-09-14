from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings

# Supabase uses pgbouncer which doesn't support prepared statements
# We need to disable them at multiple levels
DATABASE_URL = settings.DATABASE_URL

# Append pgbouncer-compatible params to URL if not present
if "?" not in DATABASE_URL:
    DATABASE_URL += "?prepared_statement_cache_size=0"
elif "prepared_statement_cache_size" not in DATABASE_URL:
    DATABASE_URL += "&prepared_statement_cache_size=0"

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
)

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
