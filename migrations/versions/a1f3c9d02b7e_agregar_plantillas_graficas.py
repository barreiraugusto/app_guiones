"""agregar plantillas de gráficas

Revision ID: a1f3c9d02b7e
Revises: 7e6c4d0ed190
Create Date: 2026-07-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1f3c9d02b7e'
down_revision = '7e6c4d0ed190'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('plantilla',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('ancho', sa.Integer(), nullable=False),
        sa.Column('alto', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    op.create_table('plantilla_capa',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plantilla_id', sa.Integer(), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=10), nullable=False),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('ancho', sa.Integer(), nullable=False),
        sa.Column('alto', sa.Integer(), nullable=False),
        sa.Column('archivo', sa.String(length=500), nullable=True),
        sa.Column('loop', sa.Boolean(), nullable=False),
        sa.Column('campo_dato', sa.String(length=20), nullable=True),
        sa.Column('texto_fijo', sa.String(length=255), nullable=True),
        sa.Column('fuente', sa.String(length=100), nullable=False),
        sa.Column('tamano_fuente', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=False),
        sa.Column('alineacion', sa.String(length=10), nullable=False),
        sa.Column('animacion_entrada', sa.String(length=10), nullable=False),
        sa.Column('animacion_salida', sa.String(length=10), nullable=False),
        sa.Column('duracion_transicion_ms', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['plantilla_id'], ['plantilla.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.add_column(sa.Column('plantilla_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_graph_plantilla', 'plantilla', ['plantilla_id'], ['id'], ondelete='SET NULL'
        )

    plantilla_table = sa.table(
        'plantilla',
        sa.column('id', sa.Integer),
        sa.column('nombre', sa.String),
        sa.column('ancho', sa.Integer),
        sa.column('alto', sa.Integer),
    )
    capa_table = sa.table(
        'plantilla_capa',
        sa.column('id', sa.Integer),
        sa.column('plantilla_id', sa.Integer),
        sa.column('orden', sa.Integer),
        sa.column('tipo', sa.String),
        sa.column('x', sa.Integer),
        sa.column('y', sa.Integer),
        sa.column('ancho', sa.Integer),
        sa.column('alto', sa.Integer),
        sa.column('archivo', sa.String),
        sa.column('loop', sa.Boolean),
        sa.column('campo_dato', sa.String),
        sa.column('texto_fijo', sa.String),
        sa.column('fuente', sa.String),
        sa.column('tamano_fuente', sa.Integer),
        sa.column('color', sa.String),
        sa.column('alineacion', sa.String),
        sa.column('animacion_entrada', sa.String),
        sa.column('animacion_salida', sa.String),
        sa.column('duracion_transicion_ms', sa.Integer),
    )
    graph_table = sa.table(
        'graph',
        sa.column('id', sa.Integer),
        sa.column('plantilla_id', sa.Integer),
    )

    conn = op.get_bind()
    conn.execute(
        plantilla_table.insert().values(nombre='Zócalo clásico', ancho=1920, alto=1080)
    )
    # Get the inserted plantilla_id
    resultado = conn.execute(sa.text("SELECT id FROM plantilla WHERE nombre = 'Zócalo clásico'"))
    plantilla_id = resultado.scalar()

    base_capa = dict(
        plantilla_id=plantilla_id, archivo=None, loop=True, campo_dato=None, texto_fijo=None,
        fuente='Arial', tamano_fuente=24, color='#ffffff', alineacion='left',
        animacion_entrada='fade', animacion_salida='fade', duracion_transicion_ms=400,
    )

    conn.execute(capa_table.insert(), [
        {**base_capa, 'orden': 1, 'tipo': 'imagen', 'x': 50, 'y': 850, 'ancho': 150, 'alto': 150,
         'archivo': 'img/grafica/mosca.gif'},
        {**base_capa, 'orden': 2, 'tipo': 'imagen', 'x': 200, 'y': 850, 'ancho': 1737, 'alto': 152,
         'archivo': 'img/grafica/zocalo_sin_bordes.png'},
        {**base_capa, 'orden': 3, 'tipo': 'texto', 'x': 230, 'y': 860, 'ancho': 1600, 'alto': 50,
         'campo_dato': 'tema', 'color': '#00ccff', 'tamano_fuente': 30},
        {**base_capa, 'orden': 4, 'tipo': 'texto', 'x': 230, 'y': 920, 'ancho': 1600, 'alto': 70,
         'campo_dato': 'bajada_1', 'color': '#ffffff', 'tamano_fuente': 36},
        {**base_capa, 'orden': 5, 'tipo': 'imagen', 'x': 1623, 'y': 882, 'ancho': 291, 'alto': 45,
         'archivo': 'img/grafica/subida_localidad.png'},
        {**base_capa, 'orden': 6, 'tipo': 'texto', 'x': 1623, 'y': 882, 'ancho': 291, 'alto': 45,
         'campo_dato': 'lugar', 'color': '#003685', 'tamano_fuente': 24, 'alineacion': 'center'},
        {**base_capa, 'orden': 7, 'tipo': 'imagen', 'x': 1021, 'y': 929, 'ancho': 893, 'alto': 45,
         'archivo': 'img/grafica/subida_nombre.png'},
        {**base_capa, 'orden': 8, 'tipo': 'texto', 'x': 1021, 'y': 929, 'ancho': 893, 'alto': 45,
         'campo_dato': 'entrevistado', 'color': '#02b2ef', 'tamano_fuente': 24},
    ])

    conn.execute(graph_table.update().values(plantilla_id=plantilla_id))


def downgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.drop_constraint('fk_graph_plantilla', type_='foreignkey')
        batch_op.drop_column('plantilla_id')
    op.drop_table('plantilla_capa')
    op.drop_table('plantilla')
