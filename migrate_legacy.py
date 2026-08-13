#!/usr/bin/env python3
"""
Migrar dados do banco legado (SQL Server dump) para o Sistema Recrescer (MySQL).

Le o arquivo database.sql do legado, extrai os 178 requerimentos completos
e cria as tabelas novas: students, fathers, mothers, medical_records, enrollments.

Uso:
  python3 migrate_legacy.py                            # conecta local: root, porta 3307
  python3 migrate_legacy.py --dry-run                  # só analisa sem inserir
  python3 migrate_legacy.py --clear                    # limpa dados antes de migrar
  python3 migrate_legacy.py --reset                    # DROP e recria tabelas
"""

import re
import sys
import os
import argparse
from pathlib import Path
from collections import defaultdict

try:
    import pymysql
except ImportError:
    print("Instale pymysql: pip3 install pymysql")
    sys.exit(1)


# ─── Constantes ──────────────────────────────────────────────────────

LEGADO_ZIP = "/data/workspace/projects/recrescer_legado/database.zip"
LEGADO_SQL = "/tmp/legado_analysis/database.sql"

SCHEMA_PATH = "/data/workspace/projects/SistemaRecrescerGlobal/server/schema.sql"

# ─── Parser T-SQL ────────────────────────────────────────────────────

def split_by_external_commas(s: str) -> list[str]:
    """Dividir string por vírgulas que estão FORA de aspas (N'...' ou '...')."""
    fields = []
    start = 0
    in_string = False

    i = 0
    while i < len(s):
        ch = s[i]

        if ch == "'" and not in_string:
            in_string = True
        elif ch == "'" and in_string:
            if i + 1 < len(s) and s[i + 1] == "'":
                i += 2
                continue
            else:
                in_string = False
        elif ch == "," and not in_string:
            fields.append(s[start:i].strip())
            start = i + 1
        i += 1

    last = s[start:].strip().rstrip(")").strip()
    if last:
        fields.append(last)

    return fields


def clean_value(raw: str) -> any:
    """Converter um valor T-SQL formatado para Python."""
    raw = raw.strip()

    # N'...' string → remover prefixo e aspas
    if raw.startswith("N'") and raw.endswith("'"):
        return raw[2:-1].replace("''", "'")

    # '...' string simples
    if raw.startswith("'") and raw.endswith("'"):
        return raw[1:-1].replace("''", "'")

    # bN'0' / bN'1' → bit
    if raw in ("bN'0'", "bN'1'"):
        return raw[4]

    # NULL
    if raw == "NULL":
        return None

    # Número
    try:
        if "." in raw:
            return float(raw)
        return int(raw)
    except (ValueError, TypeError):
        return raw


# ─── Extração do dump legado ─────────────────────────────────────────

def ensure_sql_file() -> str:
    """Extrair database.sql do ZIP se necessário."""
    if not os.path.exists(LEGADO_SQL):
        os.makedirs(os.path.dirname(LEGADO_SQL), exist_ok=True)
        import zipfile
        with zipfile.ZipFile(LEGADO_ZIP, "r") as z:
            z.extract("database.sql", os.path.dirname(LEGADO_SQL))
    return LEGADO_SQL


def extract_requerimentos(sql_path: str) -> list[dict]:
    """
    Extrair todos os RE_Requerimento do dump T-SQL.
    Retorna lista de dicts com as 43 colunas.
    """
    with open(sql_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Cabeçalho com nomes das colunas
    header_match = re.search(
        r'INSERT INTO "RE_Requerimento"\s*\(([^)]+)\)', content
    )
    if not header_match:
        print("Erro: não encontrou cabeçalho INSERT RE_Requerimento")
        return []

    cols = [c.strip().strip('"') for c in header_match.group(1).split(",")]

    # Bloco de dados após VALUES até ENABLE KEYS
    req_idx = content.find('INSERT INTO "RE_Requerimento"')
    after_vals = re.split(r"VALUES\s*\n", content[req_idx:], maxsplit=1)
    data_block = after_vals[1] if len(after_vals) > 1 else ""

    enable_match = re.search(
        r'ALTER TABLE "RE_Requerimento" ENABLE KEYS', data_block[:5000]
    )
    data_only = (
        data_block[:enable_match.start()] if enable_match else data_block[:20000]
    )

    # Extrair linhas de dados
    lines = [l for l in data_only.split("\n") if "(" in l and "N'" in l]

    requerimentos = []
    for line in lines:
        fields = split_by_external_commas(line)
        if len(fields) != 43:
            # Tentar ajustar se campos extra ou faltando
            pass

        row = {}
        for i, col in enumerate(cols):
            if i < len(fields):
                row[col] = clean_value(fields[i])
            else:
                row[col] = None

        requerimentos.append(row)

    return requerimentos


def extract_reference_tables(sql_path: str) -> dict[str, list[dict]]:
    """Extrair turmas, turnos e horas contratadas (dados de referência)."""
    with open(sql_path, "r", encoding="utf-8") as f:
        content = f.read()

    result = {}

    for table in ["RE_Turma", "RE_Turno", "RE_HorasContratadas", "RE_TipoResidencia"]:
        # Encontrar INSERT INTO para esta tabela
        pattern = rf'INSERT INTO "{table}"\s*\(([^)]+)\)'
        m = re.search(pattern, content)
        if not m:
            continue

        cols = [c.strip().strip('"') for c in m.group(1).split(",")]

        # Extrair dados (após o INSERT desta tabela até ENABLE KEYS)
        insert_idx = content.find(f'INSERT INTO "{table}"')
        if insert_idx < 0:
            continue

        after_vals = re.split(r"VALUES\s*\n", content[insert_idx:], maxsplit=1)
        data_block = after_vals[1] if len(after_vals) > 1 else ""

        enable_match = re.search(
            rf'ALTER TABLE "{table}" ENABLE KEYS', data_block[:5000]
        )
        data_only = (
            data_block[:enable_match.start()]
            if enable_match
            else data_block[:5000]
        )

        lines = [l for l in data_only.split("\n") if "(" in l]
        rows = []
        for line in lines:
            fields = split_by_external_commas(line)
            row = {}
            for i, col in enumerate(cols):
                if i < len(fields):
                    row[col] = clean_value(fields[i])
                else:
                    row[col] = None
            rows.append(row)

        result[table] = rows

    return result


# ─── Banco de dados (MySQL) ──────────────────────────────────────────

def get_connection(args) -> pymysql.Connection:
    return pymysql.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        database="recrescer",
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def clear_database(conn):
    """Limpar dados das tabelas principais (DELETE, sem DROP)."""
    tables = [
        "medical_records", "enrollments", "students",
        "mothers", "fathers", "classes", "shifts", "sessions",
    ]

    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for table in tables:
            try:
                cur.execute(f"DELETE FROM `{table}`")
                print(f"  Limpo: {table}")
            except Exception as e:
                print(f"  SKIP: {table} → {e}")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")


def truncate_and_reset(conn):
    """DROP e recria as tabelas do zero."""
    tables_to_drop = [
        "medical_records", "enrollments", "students",
        "mothers", "fathers", "classes", "shifts",
        "sessions", "users",
    ]

    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for table in tables_to_drop:
            try:
                cur.execute(f"DROP TABLE IF EXISTS `{table}`")
            except Exception:
                pass

        # Views
        views = [
            "vw_enrollments", "vw_enrollment_forms",
            "vw_medical_forms", "vw_attendance_list", "vw_students_by_class",
        ]
        for v in views:
            try:
                cur.execute(f"DROP VIEW IF EXISTS `{v}`")
            except Exception:
                pass

        cur.execute("SET FOREIGN_KEY_CHECKS = 1")

    # Recriar schema
    if os.path.exists(SCHEMA_PATH):
        with open(SCHEMA_PATH, "r") as f:
            schema_sql = f.read()

        statements = [s.strip() for s in schema_sql.split(";")
                      if s.strip() and not s.strip().startswith("DELIMITER")]

        with conn.cursor() as cur:
            for stmt in statements:
                try:
                    cur.execute(stmt)
                except Exception as e:
                    if "already exists" not in str(e).lower():
                        print(f"  WARN CREATE: {stmt[:60]}... → {e}")


# ─── Mapeamento e Migração ──────────────────────────────────────────

class MigrationLog:
    def __init__(self):
        self.stats = {
            "requerimentos_lidos": 0,
            "alunos_migrados": 0,
            "pais_migrados": 0,
            "maes_migradas": 0,
            "matriculas_criadas": 0,
            "turmas_reativas": 0,
            "turnos_migrados": 0,
        }
        self.warnings = []

    def warn(self, msg):
        self.warnings.append(msg)
        if len(self.warnings) <= 30:
            print(f"  ⚠️  {msg}")

    def summary(self):
        s = self.stats
        print("\n" + "=" * 60)
        print("📊 RESUMO DA MIGRAÇÃO")
        print("=" * 60)
        print(f"  Requerimentos lidos:       {s['requerimentos_lidos']:>5}")
        print(f"  Alunos criados (students): {s['alunos_migrados']:>5}")
        print(f"  Pais criados (fathers):    {s['pais_migrados']:>5}")
        print(f"  Mães criadas (mothers):    {s['maes_migradas']:>5}")
        print(f"  Matrículas criadas:        {s['matriculas_criadas']:>5}")
        print(f"  Turnos migrados:           {s['turnos_migrados']:>5}")
        if self.warnings:
            print(f"\n  Avisos ({len(self.warnings)}):")
            for w in self.warnings[-15:]:
                print(f"    • {w}")


def run_migration(args):
    log = MigrationLog()

    # ── Passo 0: Garantir SQL e extrair dados ──
    sql_file = ensure_sql_file()
    print(f"📂 Analisando: {sql_file}")

    requerimentos = extract_requerimentos(sql_file)
    refs = extract_reference_tables(sql_file)

    log.stats["requerimentos_lidos"] = len(requerimentos)
    print(f"\n✅ Dados extraídos:")
    print(f"   Requerimentos: {len(requerimentos)}")
    for table, rows in refs.items():
        print(f"   {table}: {len(rows)} registros")

    if not requerimentos:
        print("\n❌ Nenhum requerimento encontrado no dump!")
        return False

    # ── Passo 1: Conectar e preparar banco ──
    conn = get_connection(args)

    if args.reset:
        print("\n🧹 DROP + recriar tabelas...")
        truncate_and_reset(conn)
        conn.commit()
    elif args.clear:
        print("\n🧹 Limpar dados existentes (DELETE)...")
        clear_database(conn)
        conn.commit()

    # ── Passo 2: Migrar TURNOS → shifts ──
    turnos = refs.get("RE_Turno", [])
    turno_map_legacy_to_new = {}  # legacy_cod → new_id

    with conn.cursor() as cur:
        cur.execute("DELETE FROM `shifts`")
        for t in turnos:
            cod = t.get("Cod_Turno")
            desc = str(t.get("Desc_Turno", ""))
            if not cod or not desc.strip():
                continue
            cur.execute(
                "INSERT INTO `shifts` (`name`) VALUES (%s)", (desc,)
            )
            turno_map_legacy_to_new[int(cod)] = cur.lastrowid

    conn.commit()
    log.stats["turnos_migrados"] = len(turno_map_legacy_to_new)
    print(f"\n🕐 Turnos → shifts: {log.stats['turnos_migrados']} mapeados")
    print(f"   Mapeamento: {turno_map_legacy_to_new}")

    # ── Passo 3: Migrar TURMAS → classes ──
    turmas = refs.get("RE_Turma", [])
    turma_map_legacy_to_new = {}

    with conn.cursor() as cur:
        cur.execute("DELETE FROM `classes`")
        for t in turmas:
            cod = t.get("Cod_Turma")
            desc = str(t.get("Desc_Turma", "")).strip()
            if not cod or not desc:
                log.warn(f"Turma sem nome (cod={cod}) — pulada")
                continue

            # Extrair info da turma para preencher grade/education_level
            edu_level = None
            grade = desc
            parts = desc.split(" / ")
            if len(parts) > 1:
                grade_name = parts[0].strip()
                shift_name_part = parts[1].strip()

                # Mapear nome → education level
                for key, val in {
                    "Berçário": "Creche",
                    "Maternal": "Creche",
                    "Pré-Escola": "Educação Infantil",
                    "1º Ano do E.F.": "Ensino Fundamental",
                    "1º Ano do E.F /": "Ensino Fundamental",
                    "1º Ano do E.F": "Ensino Fundamental",
                }.items():
                    if key in grade_name:
                        edu_level = val
                        break

            # Tentar mapear shift_id da turma (se o nome contém turno)
            shift_id = None
            for cod_t, new_id in turno_map_legacy_to_new.items():
                t_desc = str(refs["RE_Turno"][int(cod_t)-1].get("Desc_Turno", "")).strip() if int(cod_t)-1 < len(refs.get("RE_Turno",[])) else ""
                # Não temos turnos por turma no legado — deixar NULL

            cur.execute(
                """INSERT INTO `classes` (`name`, `grade`, `education_level`)
                   VALUES (%s, %s, %s)""",
                (desc, grade, edu_level),
            )
            turma_map_legacy_to_new[int(cod)] = cur.lastrowid

    conn.commit()
    log.stats["turmas_reativas"] = len(turma_map_legacy_to_new)
    print(f"\n🏫 Turmas → classes: {log.stats['turmas_reativas']} criadas")

    # ── Passo 4: Extrair pais/mães/alunos dos requerimentos ──
    # Agrupar por nome para evitar duplicatas
    pais_seen = {}   # nome_lower → {id, name, data}
    maes_seen = {}   # mesmo
    alunos_seen = {} # (nome, nascimento) → student_id

    print(f"\n📝 Processando {len(requerimentos)} requerimentos...")

    with conn.cursor() as cur:
        for idx, req in enumerate(requerimentos):
            nome_aluno = str(req.get("Nome_Aluno", "")).strip()
            nome_pai = str(req.get("Nome_Pai", "") or "").strip()
            nome_mae = str(req.get("Nome_Mae", "") or "").strip()
            nascimento = req.get("Data_Nascimento")
            sexo = req.get("Sexo")
            nacionalidade = str(req.get("Nacionalidade", "") or "").strip()
            naturalidade = str(req.get("Naturalidade", "") or "").strip()

            if not nome_aluno:
                log.warn(f"Requerimento {idx+1} sem nome de aluno — pulado")
                continue

            # Normalizar data
            birth_date = None
            if nascimento:
                s = str(nascimento)
                try:
                    birth_date = s[:19]  # YYYY-MM-DD HH:MM:SS
                except:
                    pass

            # ── Pai ──
            father_id = None
            if nome_pai:
                key = nome_pai.lower().strip()
                if key not in pais_seen:
                    profissao = str(req.get("Profissao_Pai", "") or "").strip()
                    tel_pai = str(req.get("Telefone_Pai", "") or "").strip()
                    cpf_pai = str(req.get("CPF_Pai", "") or "").strip()
                    end_pai = str(req.get("Endereco_Aluno", "") or "").strip()  # usar endereço genérico

                    cur.execute(
                        """INSERT INTO `fathers` (`name`, `cpf`, `residential_address`, `residential_phone`)
                           VALUES (%s, %s, %s, %s)""",
                        (nome_pai, cpf_pai if len(cpf_pai) > 5 else None,
                         end_pai if end_pai else None,
                         tel_pai if tel_pai and len(tel_pai) > 5 else None),
                    )
                    father_id = cur.lastrowid
                    pais_seen[key] = {"id": father_id, "name": nome_pai}

                    log.stats["pais_migrados"] += 1
                else:
                    father_id = pais_seen[key]["id"]

            # ── Mãe ──
            mother_id = None
            if nome_mae:
                key = nome_mae.lower().strip()
                if key not in maes_seen:
                    profissao_mae = str(req.get("Profissao_Mae", "") or "").strip()
                    tel_mae = str(req.get("Telefone_Mae", "") or "").strip()
                    cpf_mae = str(req.get("CPF_Mae", "") or "").strip()
                    end_mae = str(req.get("Endereco_Aluno", "") or "").strip()

                    cur.execute(
                        """INSERT INTO `mothers` (`name`, `cpf`, `residential_address`, `residential_phone`)
                           VALUES (%s, %s, %s, %s)""",
                        (nome_mae, cpf_mae if len(cpf_mae) > 5 else None,
                         end_mae if end_mae else None,
                         tel_mae if tel_mae and len(tel_mae) > 5 else None),
                    )
                    mother_id = cur.lastrowid
                    maes_seen[key] = {"id": mother_id, "name": nome_mae}

                    log.stats["maes_migradas"] += 1
                else:
                    mother_id = maes_seen[key]["id"]

            # ── Aluno (student) ──
            student_key = (nome_aluno.lower(), nascimento)
            if student_key not in alunos_seen:
                grade_val = str(req.get("CursoAnoAnterior", "") or "").strip()
                serie_val = str(req.get("SerieAnoAnterior", "") or "").strip()

                cur.execute(
                    """INSERT INTO `students` (
                        `registration`, `name`, `birth_date`, `gender`,
                        `nationality`, `birthplace`, `grade`,
                        `father_id`, `mother_id`
                       ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        f"LEGADO-{req.get('Cod_Requerimento', '')}",
                        nome_aluno, birth_date, sexo,
                        nacionalidade if len(nacionalidade) > 1 else None,
                        naturalidade if len(naturalidade) > 1 else None,
                        serie_val if serie_val and serie_val.lower() != "am" else None,
                        father_id, mother_id,
                    ),
                )
                student_id = cur.lastrowid
                alunos_seen[student_key] = {"id": student_id, "name": nome_aluno}

                log.stats["alunos_migrados"] += 1
            else:
                student_id = alunos_seen[student_key]["id"]

            # ── Matrícula (enrollment) ──
            ano_requerimento = req.get("Ano_Requerimento")
            if isinstance(ano_requerimento, int):
                year = ano_requerimento
            elif isinstance(ano_requerimento, str) and len(ano_requerimento) == 4:
                year = int(ano_requerimento)
            else:
                year = 2026

            # Turma e turno da matrícula
            turma_cod = req.get("Cod_Turma")
            turno_cod = req.get("Cod_Turno")
            horas_cod = req.get("Cod_HorasContratadas")
            serie_cod = req.get("Cod_Serie")

            requested_class_id = None
            requested_shift_id = None
            contracted_hours = None

            if turma_cod is not None:
                tc = int(turma_cod)
                requested_class_id = turma_map_legacy_to_new.get(tc)
                if requested_class_id is None and tc > 0:
                    log.warn(f"Turma legacy {tc} não mapeada para aluno {nome_aluno}")

            if turno_cod is not None:
                tcode = int(turno_cod)
                requested_shift_id = turno_map_legacy_to_new.get(tcode)

            # Horas contratadas (texto simples, FK depois)
            if horas_cod is not None and str(horas_cod).strip():
                # Extrair descrição do refs
                for h in refs.get("RE_HorasContratadas", []):
                    if int(h.get("Cod_HorasContratadas")) == int(horas_cod):
                        contracted_hours = str(h.get("Desc_HorasContratadas", "")).strip()
                        break

            irmaos = req.get("IrmaosCreche")
            irmaos_bool = 1 if str(irmaos) in ("1", "bN'1'") else 0
            sibling_details = None
            if irmaos_bool and str(req.get("Dados_Irmaos", "") or "").strip():
                sibling_details = str(req.get("Dados_Irmaos")).strip()

            cur.execute(
                """INSERT INTO `enrollments` (
                    `year`, `student_id`, `previous_grade_course_shift`,
                    `lives_with`, `siblings_in_daycare`, `siblings_details`,
                    `new_student`, `origin_school`,
                    `requested_class_id`, `requested_shift_id`,
                    `contracted_hours`
                   ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    year, student_id,
                    f"{serie_val} / {grade_val}" if serie_val and grade_val else None,
                    "Mãe" if req.get("Nome_Responsavel") == nome_mae or not req.get("Nome_Responsavel") else None,
                    irmaos_bool, sibling_details,
                    1,  # new_student = sim (todos são novos no sistema)
                    str(req.get("EscolaOrigem", "") or "").strip() if req.get("EscolaOrigem") and str(req.get("EscolaOrigem")).strip().lower() != "a própria" else None,
                    requested_class_id, requested_shift_id,
                    contracted_hours,
                ),
            )

            log.stats["matriculas_criadas"] += 1

    conn.commit()
    print(f"\n   ✅ Alunos: {log.stats['alunos_migrados']}")
    print(f"   ✅ Pais: {log.stats['pais_migrados']}")
    print(f"   ✅ Mães: {log.stats['maes_migradas']}")
    print(f"   ✅ Matrículas: {log.stats['matriculas_criadas']}")

    # ── Passo 5: Verificação final ──
    with conn.cursor() as cur:
        checks = ["students", "mothers", "fathers", "enrollments"]
        print("\n🔍 Verificação no banco:")
        for table in checks:
            cur.execute(f"SELECT COUNT(*) as cnt FROM `{table}`")
            cnt = cur.fetchone()["cnt"]
            status = "✅" if cnt > 0 else "❌"
            print(f"   {status} {table}: {cnt}")

    log.summary()
    conn.close()
    return True


def dry_run(args):
    sql_file = ensure_sql_file()
    print(f"🔍 Dry-run — analisando: {sql_file}")

    requerimentos = extract_requerimentos(sql_file)
    refs = extract_reference_tables(sql_file)

    print(f"\n📊 Dados encontrados:")
    print(f"   Requerimentos: {len(requerimentos)}")
    for table, rows in refs.items():
        print(f"   {table}: {len(rows)} registros")

    # Análise de consistência
    nomes_alunos = set()
    nomes_pais = defaultdict(int)
    maes = defaultdict(int)

    for req in requerimentos:
        nome_a = str(req.get("Nome_Aluno", "")).strip()
        nome_p = str(req.get("Nome_Pai", "") or "").strip()
        nome_m = str(req.get("Nome_Mae", "") or "").strip()
        if nome_a:
            nomes_alunos.add(nome_a)
        if nome_p:
            nomes_pais[nome_p] += 1
        if nome_m:
            maes[nome_m] += 1

    print(f"\n📋 Análise:")
    print(f"   Alunos únicos: {len(nomes_alunos)}")
    print(f"   Pais (únicos): {len(nomes_pais)}")
    print(f"   Mães (únicas): {len(maes)}")

    # Turmas/turnos
    turmas = refs.get("RE_Turma", [])
    turnos = refs.get("RE_Turno", [])
    print(f"\n   Turmas disponíveis: {len(turmas)}")
    for t in turmas:
        desc = str(t.get("Desc_Turma", "")).strip()
        cod = t.get("Cod_Turma")
        print(f"     [{cod}] {desc}")

    print(f"\n   Turnos disponíveis: {len(turnos)}")
    for t in turnos:
        print(f"     [{t.get('Cod_Turno')}] {t.get('Desc_Turno')}")


# ─── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Migrar dados do legado Recrescer para o novo sistema"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3307)
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", default="", help="Senha MySQL root")
    parser.add_argument("--database", default="recrescer")
    parser.add_argument("--dry-run", action="store_true", help="Só analisar sem inserir")
    parser.add_argument("--reset", action="store_true", help="DROP + recriar tabelas")
    parser.add_argument("--clear", action="store_true", help="Apenas limpa dados (DELETE)")

    args = parser.parse_args()

    if args.dry_run:
        dry_run(args)
    else:
        success = run_migration(args)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
