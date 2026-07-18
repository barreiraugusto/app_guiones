"""agregar negrita y cursiva a plantilla_capa

Revision ID: 8a400de5674e
Revises: 17f458c59481
Create Date: 2026-07-18 14:32:04.527753

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a400de5674e'
down_revision = '17f458c59481'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('negrita', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('cursiva', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_column('cursiva')
        batch_op.drop_column('negrita')
