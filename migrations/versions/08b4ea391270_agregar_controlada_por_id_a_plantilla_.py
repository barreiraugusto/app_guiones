"""agregar controlada_por_id a plantilla_capa

Revision ID: 08b4ea391270
Revises: f28a71c9de63
Create Date: 2026-07-15 21:15:56.007363

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '08b4ea391270'
down_revision = 'f28a71c9de63'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('controlada_por_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_plantilla_capa_controlada_por_id', 'plantilla_capa',
            ['controlada_por_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_constraint('fk_plantilla_capa_controlada_por_id', type_='foreignkey')
        batch_op.drop_column('controlada_por_id')
