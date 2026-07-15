"""agregar columnas de forma geometrica a plantilla_capa

Revision ID: f28a71c9de63
Revises: d4e8f1a92c67
Create Date: 2026-07-15 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f28a71c9de63'
down_revision = 'd4e8f1a92c67'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('radio_esquina', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('color_fondo', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('opacidad', sa.Integer(), nullable=False, server_default='100'))
        batch_op.add_column(sa.Column('color_borde', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('ancho_borde', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('usar_gradiente', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('gradiente_color_inicio', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('gradiente_color_fin', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('gradiente_angulo', sa.Integer(), nullable=False, server_default='90'))


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_column('gradiente_angulo')
        batch_op.drop_column('gradiente_color_fin')
        batch_op.drop_column('gradiente_color_inicio')
        batch_op.drop_column('usar_gradiente')
        batch_op.drop_column('ancho_borde')
        batch_op.drop_column('color_borde')
        batch_op.drop_column('opacidad')
        batch_op.drop_column('color_fondo')
        batch_op.drop_column('radio_esquina')
