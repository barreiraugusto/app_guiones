"""agregar grabado a texto

Revision ID: ba5037d0bc2f
Revises: 9c1d7a4b6f3e
Create Date: 2026-08-16 22:01:56.757054

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ba5037d0bc2f'
down_revision = '9c1d7a4b6f3e'
branch_labels = None
depends_on = None


def upgrade():
    # Nota: las tablas/columnas 'seccion'/'texto.seccion_id' existen en la BD
    # pero no en los modelos actuales; se omiten intencionalmente (ver
    # 7e6c4d0ed190) para no perder datos.
    with op.batch_alter_table('texto', schema=None) as batch_op:
        batch_op.add_column(sa.Column('grabado', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('texto', schema=None) as batch_op:
        batch_op.drop_column('grabado')
