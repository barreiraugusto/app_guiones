"""agregar nombre a plantilla_capa

Revision ID: 9c1d7a4b6f3e
Revises: 5e0e3b8f8016
Create Date: 2026-07-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '9c1d7a4b6f3e'
down_revision = '5e0e3b8f8016'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('nombre', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_column('nombre')
