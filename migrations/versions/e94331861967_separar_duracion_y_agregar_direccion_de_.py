"""separar duracion y agregar direccion de entrada/salida en plantilla_capa

Revision ID: e94331861967
Revises: 08b4ea391270
Create Date: 2026-07-15 21:44:22.011749

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e94331861967'
down_revision = '08b4ea391270'
branch_labels = None
depends_on = None


plantilla_capa = sa.table(
    'plantilla_capa',
    sa.column('duracion_transicion_ms', sa.Integer()),
    sa.column('duracion_entrada_ms', sa.Integer()),
    sa.column('duracion_salida_ms', sa.Integer()),
    sa.column('direccion_entrada', sa.String()),
    sa.column('direccion_salida', sa.String()),
)


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('duracion_entrada_ms', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('duracion_salida_ms', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('direccion_entrada', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('direccion_salida', sa.String(length=10), nullable=True))

    # Backfill: las capas existentes conservan su duración previa para ambas
    # fases, y arrancan con dirección 'izquierda' (comportamiento anterior).
    op.execute(
        plantilla_capa.update().values(
            duracion_entrada_ms=plantilla_capa.c.duracion_transicion_ms,
            duracion_salida_ms=plantilla_capa.c.duracion_transicion_ms,
            direccion_entrada='izquierda',
            direccion_salida='izquierda',
        )
    )

    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.alter_column('duracion_entrada_ms', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('duracion_salida_ms', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('direccion_entrada', existing_type=sa.String(length=10), nullable=False)
        batch_op.alter_column('direccion_salida', existing_type=sa.String(length=10), nullable=False)
        batch_op.drop_column('duracion_transicion_ms')


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('duracion_transicion_ms', sa.Integer(), nullable=True))

    op.execute(
        plantilla_capa.update().values(duracion_transicion_ms=plantilla_capa.c.duracion_entrada_ms)
    )

    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.alter_column('duracion_transicion_ms', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('direccion_salida')
        batch_op.drop_column('direccion_entrada')
        batch_op.drop_column('duracion_salida_ms')
        batch_op.drop_column('duracion_entrada_ms')
