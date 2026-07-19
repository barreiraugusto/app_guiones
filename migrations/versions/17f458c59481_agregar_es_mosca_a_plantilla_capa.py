"""agregar es_mosca a plantilla_capa

Revision ID: 17f458c59481
Revises: e94331861967
Create Date: 2026-07-15 22:52:37.789074

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '17f458c59481'
down_revision = 'e94331861967'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('es_mosca', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_column('es_mosca')
