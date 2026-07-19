"""agregar rotacion automatica de bajadas a graph

Revision ID: 5e0e3b8f8016
Revises: 8a400de5674e
Create Date: 2026-07-19 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '5e0e3b8f8016'
down_revision = '8a400de5674e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bajadas_auto_activo', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('bajadas_auto_loop', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('bajadas_auto_duracion_segundos', sa.Integer(), nullable=False, server_default='5'))
        batch_op.add_column(sa.Column('bajadas_auto_epoch_inicio', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('bajadas_auto_indice_inicio', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.drop_column('bajadas_auto_indice_inicio')
        batch_op.drop_column('bajadas_auto_epoch_inicio')
        batch_op.drop_column('bajadas_auto_duracion_segundos')
        batch_op.drop_column('bajadas_auto_loop')
        batch_op.drop_column('bajadas_auto_activo')
