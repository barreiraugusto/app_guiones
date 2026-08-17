"""agregar grabando a texto

Revision ID: 995fbaf3844d
Revises: ba5037d0bc2f
Create Date: 2026-08-17 10:28:42.649561

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '995fbaf3844d'
down_revision = 'ba5037d0bc2f'
branch_labels = None
depends_on = None


def upgrade():
    # Nota: 'seccion'/'texto.seccion_id' se omiten intencionalmente (ver
    # 7e6c4d0ed190) para no perder datos.
    with op.batch_alter_table('texto', schema=None) as batch_op:
        batch_op.add_column(sa.Column('grabando', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('texto', schema=None) as batch_op:
        batch_op.drop_column('grabando')
