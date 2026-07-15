"""agregar composicion de graph activo (bajada/cita activa, mostrar lugar/tema)

Revision ID: d4e8f1a92c67
Revises: a1f3c9d02b7e
Create Date: 2026-07-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e8f1a92c67'
down_revision = 'a1f3c9d02b7e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bajada_activa_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cita_activa_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('mostrar_lugar', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('mostrar_tema', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.create_foreign_key(
            'fk_graph_bajada_activa', 'bajada', ['bajada_activa_id'], ['id'], ondelete='SET NULL'
        )
        batch_op.create_foreign_key(
            'fk_graph_cita_activa', 'cita', ['cita_activa_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.drop_constraint('fk_graph_cita_activa', type_='foreignkey')
        batch_op.drop_constraint('fk_graph_bajada_activa', type_='foreignkey')
        batch_op.drop_column('mostrar_tema')
        batch_op.drop_column('mostrar_lugar')
        batch_op.drop_column('cita_activa_id')
        batch_op.drop_column('bajada_activa_id')
