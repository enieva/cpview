#!/usr/bin/env python3
"""
Lightweight HTTP Server and Read-Only SQLite API for Check Point CPView Viewer.
Uses standard Python library (no external pip dependencies required).
Supports dynamic loading, switching, and uploading of multiple CPView SQLite files.
"""

import http.server
import socketserver
import urllib.parse
import sqlite3
import json
import os
import sys
import re
import datetime
from extract_cpview import extract_cpview, get_node_name

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DEFAULT_DB = 'SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat'

CURRENT_DB_FILE = DEFAULT_DB
_ref_map = {}

def load_ref_map(db_path):
    global _ref_map
    _ref_map = {}
    try:
        if os.path.exists(db_path):
            with sqlite3.connect(f'file:{db_path}?mode=ro', uri=True) as con:
                cur = con.cursor()
                cur.execute("SELECT seq, val FROM cpview_ref_table;")
                _ref_map = dict(cur.fetchall())
                print(f"Loaded {len(_ref_map)} reference strings from {db_path}")
    except Exception as e:
        print(f"Warning: could not load ref map from {db_path}: {e}")

# Initial load
load_ref_map(CURRENT_DB_FILE)

REF_COLUMNS = {
    'reason', 'drop_reason', 'f2v_reason', 'os_info', 'configuration_info',
    'cluster_status', 'cp_ver_info', 'um_fw_branch_name', 'um_fw_build_number',
    'um_accel_branch_name', 'um_accel_build_number', 'disk_path', 'cpu_type',
    'if_name', 'name', 'device', 'state', 'type', 'port', 'speed', 'ipv4', 'ipv6',
    'status', 'prto', 'comp', 'versions', 'model'
}

def resolve_col_val(col_name, v):
    col_lower = col_name.lower()
    is_ref = (col_lower in REF_COLUMNS) or col_lower.endswith('_info') or col_lower.endswith('_name') or col_lower.endswith('_reason')
    if is_ref and isinstance(v, int) and v in _ref_map:
        return _ref_map[v]
    return v

def get_json_cache_path(db_path):
    base = os.path.basename(db_path)
    if base == DEFAULT_DB and os.path.exists('data/cpview_data.json'):
        return 'data/cpview_data.json'
    safe = re.sub(r'[^a-zA-Z0-9_\-]', '_', base)
    return f'data/{safe}.json'

def find_available_databases():
    candidates = []
    # Search root and uploads/
    dirs_to_check = ['.', 'uploads']
    for d in dirs_to_check:
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            fpath = os.path.join(d, f)
            if not os.path.isfile(fpath):
                continue
            lower = f.lower()
            if lower.endswith('.dat') or lower.endswith('.db') or lower.endswith('.sqlite') or lower.endswith('.sqlite3') or 'cpview' in lower:
                # verify it's a sqlite db
                try:
                    with open(fpath, 'rb') as test_f:
                        header = test_f.read(16)
                        if b'SQLite format 3' not in header:
                            continue
                except:
                    continue

                stat = os.stat(fpath)
                mtime = datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).strftime('%Y-%m-%d %H:%M')
                json_path = get_json_cache_path(fpath)
                is_active = (os.path.basename(fpath) == os.path.basename(CURRENT_DB_FILE))

                candidates.append({
                    "filename": fpath,
                    "basename": f,
                    "node_name": get_node_name(f),
                    "size_bytes": stat.st_size,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "modified": mtime,
                    "is_current": is_active,
                    "has_json": os.path.exists(json_path),
                    "json_url": f"/{json_path}" if os.path.exists(json_path) else None
                })

    candidates.sort(key=lambda x: (not x["is_current"], x["node_name"]))
    return candidates

class CPViewHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/upload_db':
            self.handle_upload_db()
            return

        if path == '/api/client_debug':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            with open('client_debug.log', 'a') as f:
                f.write(body.decode('utf-8', errors='ignore') + '\n')
            self.send_json({"status": "ok"})
            return

        self.send_json({"error": "Ruta POST no encontrada"}, 404)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. List available databases
        if path == '/api/databases':
            dbs = find_available_databases()
            self.send_json({
                "current_db": CURRENT_DB_FILE,
                "current_node": get_node_name(CURRENT_DB_FILE),
                "databases": dbs
            })
            return

        # 2. Switch active database
        if path == '/api/switch_db':
            target_file = query.get('file', [''])[0].strip()
            self.handle_switch_db(target_file)
            return

        # 3. Load from arbitrary local path on server
        if path == '/api/load_path':
            target_path = query.get('path', [''])[0].strip()
            self.handle_load_path(target_path)
            return

        # 4. Table records browser
        if path.startswith('/api/table/'):
            table_name = urllib.parse.unquote(path[len('/api/table/'):])
            self.handle_table_query(table_name, query)
            return

        # 5. SQL live console
        if path == '/api/sql':
            sql = query.get('q', [''])[0]
            self.handle_sql_query(sql)
            return

        # Fallback to static file serving
        return super().do_GET()

    def handle_upload_db(self):
        global CURRENT_DB_FILE
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            raw_filename = self.headers.get('X-Filename', '')
            if not raw_filename:
                # try url decoding
                raw_filename = 'uploaded_node.CPViewDB.dat'
            else:
                raw_filename = urllib.parse.unquote(raw_filename)

            safe_basename = os.path.basename(raw_filename)
            os.makedirs('uploads', exist_ok=True)
            dest_path = os.path.join('uploads', safe_basename)

            print(f"Receiving file upload: {safe_basename} ({content_length / (1024*1024):.2f} MB)...")
            remaining = content_length
            with open(dest_path, 'wb') as f:
                while remaining > 0:
                    chunk_size = min(remaining, 1024 * 1024)
                    chunk = self.rfile.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)

            print(f"File saved to {dest_path}. Processing extraction...")
            # Extract metrics
            json_cache = get_json_cache_path(dest_path)
            data = extract_cpview(dest_path, json_cache)

            # Switch active DB
            CURRENT_DB_FILE = dest_path
            load_ref_map(CURRENT_DB_FILE)

            self.send_json({
                "success": True,
                "filename": dest_path,
                "node_name": data["system"]["node_name"],
                "json_url": f"/{json_cache}",
                "message": f"Base de datos {safe_basename} cargada y procesada con éxito."
            })
        except Exception as e:
            print(f"Upload error: {e}")
            self.send_json({"error": f"Error al procesar subida: {str(e)}"}, 500)

    def handle_switch_db(self, target_file):
        global CURRENT_DB_FILE
        if not target_file or not os.path.exists(target_file):
            self.send_json({"error": f"Fichero '{target_file}' no encontrado en el servidor."}, 404)
            return

        try:
            json_cache = get_json_cache_path(target_file)
            if not os.path.exists(json_cache):
                print(f"Cache no encontrado para {target_file}. Extrayendo...")
                data = extract_cpview(target_file, json_cache)
            else:
                with open(json_cache, 'r', encoding='utf-8') as f:
                    data = json.load(f)

            CURRENT_DB_FILE = target_file
            load_ref_map(CURRENT_DB_FILE)

            self.send_json({
                "success": True,
                "filename": target_file,
                "node_name": data["system"]["node_name"],
                "json_url": f"/{json_cache}",
                "message": f"Cambiado activamente a {target_file}"
            })
        except Exception as e:
            self.send_json({"error": f"Error al cambiar a la base de datos: {str(e)}"}, 500)

    def handle_load_path(self, target_path):
        global CURRENT_DB_FILE
        if not target_path:
            self.send_json({"error": "No se proporcionó ruta de fichero"}, 400)
            return

        if not os.path.exists(target_path):
            self.send_json({"error": f"Ruta no existe: {target_path}"}, 404)
            return

        try:
            json_cache = get_json_cache_path(target_path)
            data = extract_cpview(target_path, json_cache)
            CURRENT_DB_FILE = target_path
            load_ref_map(CURRENT_DB_FILE)

            self.send_json({
                "success": True,
                "filename": target_path,
                "node_name": data["system"]["node_name"],
                "json_url": f"/{json_cache}",
                "message": f"Fichero cargado y procesado desde {target_path}"
            })
        except Exception as e:
            self.send_json({"error": f"Error al procesar fichero: {str(e)}"}, 500)

    def handle_table_query(self, table_name, query):
        page = int(query.get('page', [1])[0])
        limit_param = query.get('limit', ['50'])[0]
        is_all = query.get('all', ['0'])[0] == '1' or limit_param in ['0', 'all', '-1']

        try:
            with sqlite3.connect(f'file:{CURRENT_DB_FILE}?mode=ro', uri=True) as con:
                cur = con.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", (table_name,))
                if not cur.fetchone():
                    self.send_json({"error": f"Tabla '{table_name}' no encontrada en la BD activa"}, 404)
                    return

                cur.execute(f'PRAGMA table_info("{table_name}");')
                col_defs = cur.fetchall()
                cols = [c[1] for c in col_defs]

                cur.execute(f'SELECT COUNT(*) FROM "{table_name}";')
                total_rows = cur.fetchone()[0]

                if is_all:
                    cur.execute(f'SELECT * FROM "{table_name}" ORDER BY rowid ASC LIMIT 100000;')
                    limit = total_rows
                    page = 1
                else:
                    try:
                        parsed_lim = int(limit_param)
                    except ValueError:
                        parsed_lim = 50
                    limit = min(max(parsed_lim, 1), 20000)
                    offset = (page - 1) * limit
                    cur.execute(f'SELECT * FROM "{table_name}" ORDER BY rowid DESC LIMIT ? OFFSET ?;', (limit, offset))

                raw_rows = cur.fetchall()

                rows = []
                for r in raw_rows:
                    row_dict = {}
                    for i, col in enumerate(cols):
                        val = r[i]
                        resolved = resolve_col_val(col, val)
                        if resolved != val:
                            row_dict[col] = f"{val} ({resolved})"
                        else:
                            row_dict[col] = val
                    rows.append(row_dict)

                self.send_json({
                    "table": table_name,
                    "columns": cols,
                    "total_rows": total_rows,
                    "page": page,
                    "limit": limit,
                    "rows": rows
                })
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def handle_sql_query(self, sql):
        if not sql:
            self.send_json({"error": "No se proporcionó consulta SQL"}, 400)
            return

        forbidden = [r'\bINSERT\b', r'\bUPDATE\b', r'\bDELETE\b', r'\bDROP\s+(TABLE|VIEW|DATABASE)\b', r'\bALTER\b', r'\bCREATE\b', r'\bTRUNCATE\b']
        if any(re.search(p, sql, re.IGNORECASE) for p in forbidden):
            self.send_json({"error": "Solo se permiten consultas de lectura (SELECT)"}, 403)
            return

        try:
            with sqlite3.connect(f'file:{CURRENT_DB_FILE}?mode=ro', uri=True) as con:
                cur = con.cursor()
                cur.execute(sql)
                cols = [d[0] for d in cur.description] if cur.description else []
                raw_rows = cur.fetchmany(100)
                rows = []
                for r in raw_rows:
                    rows.append([resolve_col_val(cols[i] if i < len(cols) else '', v) for i, v in enumerate(r)])
                self.send_json({
                    "columns": cols,
                    "rows": rows,
                    "count": len(rows)
                })
        except Exception as e:
            self.send_json({"error": str(e)}, 500)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def run():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CPViewHandler) as httpd:
        print(f"Check Point CPView Server activo en http://localhost:{PORT}")
        print(f"Base de datos activa por defecto: {CURRENT_DB_FILE}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")

if __name__ == '__main__':
    run()
