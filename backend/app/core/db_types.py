"""Keep native JSON on existing databases; use a CLOB on Oracle 19c+."""
import json
from sqlalchemy import JSON, Text
from sqlalchemy.types import TypeDecorator

class PortableJSON(TypeDecorator):
    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(Text() if dialect.name == "oracle" else JSON())

    def process_bind_param(self, value, dialect):
        return json.dumps(value, ensure_ascii=False) if dialect.name == "oracle" and value is not None else value

    def process_result_value(self, value, dialect):
        return json.loads(value) if dialect.name == "oracle" and value is not None else value
