"""agregar tabla audit_log

Revision ID: 7e6c4d0ed190
Revises: b149fa6291ea
Create Date: 2026-07-04 16:38:13.578751

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7e6c4d0ed190'
down_revision = 'b149fa6291ea'
branch_labels = None
depends_on = None


def upgrade():
    # Solo crea la tabla audit_log.
    # Las tablas 'seccion' y 'texto.seccion_id' existen en la BD pero no en los
    # modelos actuales; se omiten intencionalmente para no perder datos.
    op.create_table('audit_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('timestamp', sa.DateTime(), nullable=False),
    sa.Column('nivel', sa.String(length=10), nullable=False),
    sa.Column('ip', sa.String(length=45), nullable=False),
    sa.Column('user_agent', sa.String(length=300), nullable=True),
    sa.Column('accion', sa.String(length=255), nullable=False),
    sa.Column('tipo_entidad', sa.String(length=50), nullable=True),
    sa.Column('id_entidad', sa.Integer(), nullable=True),
    sa.Column('nombre_entidad', sa.String(length=255), nullable=True),
    sa.Column('detalle', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_log_timestamp'), ['timestamp'], unique=False)


def downgrade():
    with op.batch_alter_table('audit_log', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_log_timestamp'))
    op.drop_table('audit_log')
