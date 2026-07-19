# archivo: crear_secciones_final.py
from app import create_app, db
from sqlalchemy import text

app = create_app()
with app.app_context():
    print("🔧 Creando estructura de SECCIONES...")

    # 1. Verificar/Crear columna guion_id en seccion
    print("1. Creando tabla seccion con guion_id...")
    db.session.execute(text("""
        CREATE TABLE IF NOT EXISTS seccion (
            id SERIAL PRIMARY KEY,
            titulo VARCHAR(200) NOT NULL,
            orden INTEGER DEFAULT 0,
            color_borde VARCHAR(7) DEFAULT '#007bff',
            guion_id INTEGER NOT NULL
        );
    """))

    # 2. Agregar foreign key a guion
    print("2. Agregando clave foránea a guion...")
    db.session.execute(text("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                          WHERE constraint_name='fk_seccion_guion') THEN
                ALTER TABLE seccion ADD CONSTRAINT fk_seccion_guion 
                    FOREIGN KEY (guion_id) REFERENCES guion(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """))

    # 3. Agregar columna seccion_id a texto
    print("3. Agregando columna seccion_id a texto...")
    db.session.execute(text("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_name='texto' AND column_name='seccion_id') THEN
                ALTER TABLE texto ADD COLUMN seccion_id INTEGER;
            END IF;
        END $$;
    """))

    # 4. Agregar foreign key de texto a seccion
    print("4. Agregando clave foránea de texto a seccion...")
    db.session.execute(text("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                          WHERE constraint_name='fk_texto_seccion') THEN
                ALTER TABLE texto ADD CONSTRAINT fk_texto_seccion 
                    FOREIGN KEY (seccion_id) REFERENCES seccion(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))

    # 5. Crear índices
    print("5. Creando índices...")
    db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_texto_seccion ON texto(seccion_id);"))
    db.session.execute(text("CREATE INDEX IF NOT EXISTS idx_seccion_guion ON seccion(guion_id);"))

    db.session.commit()
    print("\n✅ ESTRUCTURA CREADA CORRECTAMENTE")
    print("\n📌 Tablas y relaciones:")
    print("   - seccion (id, titulo, orden, color_borde, guion_id)")
    print("   - texto.seccion_id → seccion.id")
    print("\n🎉 Ya puedes usar secciones desde la interfaz")