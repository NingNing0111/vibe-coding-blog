"""add book_annotations table (划线注解)

Revision ID: add_book_annotations
Revises: add_book_tables
Create Date: 2026-02-03 12:00:00.000000

"""
from alembic import op

revision = "add_book_annotations"
down_revision = "add_book_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS book_annotations (
            id SERIAL NOT NULL,
            book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            cfi_range VARCHAR(512) NOT NULL,
            selected_text TEXT NOT NULL,
            note TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_book_annotations_book_id ON book_annotations (book_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_book_annotations_user_id ON book_annotations (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_book_annotations_cfi_range ON book_annotations (cfi_range)")


def downgrade() -> None:
    op.drop_index("ix_book_annotations_cfi_range", table_name="book_annotations")
    op.drop_index("ix_book_annotations_user_id", table_name="book_annotations")
    op.drop_index("ix_book_annotations_book_id", table_name="book_annotations")
    op.drop_table("book_annotations")
