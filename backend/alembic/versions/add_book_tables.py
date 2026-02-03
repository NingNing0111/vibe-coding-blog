"""add book tables (book_category_list, books, book_categories, book_reading_progress)

Revision ID: add_book_tables
Revises: add_user_is_subscribed
Create Date: 2026-02-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "add_book_tables"
down_revision = "add_user_is_subscribed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 书籍分类表（书库专用）
    op.execute("""
        CREATE TABLE IF NOT EXISTS book_category_list (
            id SERIAL NOT NULL,
            name VARCHAR(64) NOT NULL,
            slug VARCHAR(64) NOT NULL,
            description VARCHAR(256),
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_book_category_list_slug ON book_category_list (slug)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_book_category_list_name ON book_category_list (name)")

    # 书籍表
    op.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id SERIAL NOT NULL,
            title VARCHAR(256) NOT NULL,
            author VARCHAR(128),
            cover_url VARCHAR(512),
            file_url VARCHAR(512) NOT NULL,
            file_key VARCHAR(512) NOT NULL,
            file_size BIGINT NOT NULL,
            uploader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_books_file_key ON books (file_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_books_title ON books (title)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_books_author ON books (author)")

    # 书籍-分类多对多
    op.execute("""
        CREATE TABLE IF NOT EXISTS book_categories (
            book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES book_category_list(id) ON DELETE CASCADE,
            PRIMARY KEY (book_id, category_id)
        )
    """)

    # 阅读进度表
    op.execute("""
        CREATE TABLE IF NOT EXISTS book_reading_progress (
            id SERIAL NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            current_position VARCHAR(512),
            reading_duration_seconds INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id),
            UNIQUE (user_id, book_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_book_reading_progress_user_id ON book_reading_progress (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_book_reading_progress_book_id ON book_reading_progress (book_id)")


def downgrade() -> None:
    op.drop_table("book_reading_progress")
    op.drop_table("book_categories")
    op.drop_index("ix_books_author", table_name="books")
    op.drop_index("ix_books_title", table_name="books")
    op.drop_index("ix_books_file_key", table_name="books")
    op.drop_table("books")
    op.drop_index("ix_book_category_list_name", table_name="book_category_list")
    op.drop_index("ix_book_category_list_slug", table_name="book_category_list")
    op.drop_table("book_category_list")
