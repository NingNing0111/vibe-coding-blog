"""add media table

Revision ID: add_media_table
Revises: 
Create Date: 2026-01-26 12:00:00.000000

"""
from alembic import op

revision = 'add_media_table'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 使用 IF NOT EXISTS，表/索引已存在时不报错，兼容由 create_all 先建表的情况
    op.execute("""
        CREATE TABLE IF NOT EXISTS media (
            id SERIAL NOT NULL,
            file_name VARCHAR NOT NULL,
            file_size BIGINT NOT NULL,
            file_type VARCHAR NOT NULL,
            file_url VARCHAR NOT NULL,
            file_key VARCHAR NOT NULL,
            uploader_id INTEGER,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_media_id ON media (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_media_file_name ON media (file_name)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_media_file_key ON media (file_key)")


def downgrade() -> None:
    op.drop_index('ix_media_file_key', table_name='media')
    op.drop_index('ix_media_file_name', table_name='media')
    op.drop_index('ix_media_id', table_name='media')
    op.drop_table('media')
