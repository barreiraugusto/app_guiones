"""agregar recording_id y archivo a texto

Revision ID: c3a71f5d90b2
Revises: 995fbaf3844d
Create Date: 2026-09-18

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3a71f5d90b2'
down_revision = '995fbaf3844d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('texto', schema=None) as batch_op:
        batch_op.add_column(sa.Column('recording_id', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column('archivo', sa.String(length=512), nullable=True))


def downgrade():
    with op.batch_alter_table('texto', schema=None) as batch_op:
        batch_op.drop_column('archivo')
        batch_op.drop_column('recording_id')
