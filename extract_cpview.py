#!/usr/bin/env python3
"""
Extraction and pre-aggregation script for Check Point CPView SQLite database.
Generates a structured, optimized JSON dataset for the web visualization app.
Supports any Check Point CPView SQLite database file.
"""

import sqlite3
import json
import os
import sys
import re
import datetime

DEFAULT_DB_FILE = 'SG_FWNET-ch01-01_2_4_2024_16_27.CPViewDB.dat'

def get_node_name(db_path):
    base = os.path.basename(db_path)
    # Match patterns like MachineName_2_4_2024... or MachineName.CPViewDB...
    m = re.match(r'^([A-Za-z0-9_\-\.]+?)(?:_\d+_\d+_\d+.*|\.CPViewDB.*|\.dat|\.db|\.sqlite)', base, re.IGNORECASE)
    if m and len(m.group(1)) > 1:
        return m.group(1)
    return base.split('.')[0]

def extract_cpview(db_file, output_file=None):
    if not os.path.exists(db_file):
        raise FileNotFoundError(f"Database file not found: {db_file}")

    base_name = os.path.basename(db_file)
    safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', base_name)
    os.makedirs('data', exist_ok=True)
    if not output_file:
        output_file = f'data/{safe_name}.json'

    print(f"Extracting CPView DB: {db_file} -> {output_file}")
    con = sqlite3.connect(f'file:{db_file}?mode=ro', uri=True)
    cur = con.cursor()

    # 1. Load string reference dictionary
    print("1. Loading reference dictionary...")
    ref_map = {}
    try:
        cur.execute("SELECT seq, val FROM cpview_ref_table;")
        ref_map = dict(cur.fetchall())
    except Exception as e:
        print(f"Note: cpview_ref_table not available: {e}")

    def resolve(v):
        if isinstance(v, int) and v in ref_map:
            return ref_map[v]
        return v

    # 2. Time range and snapshot metadata
    print("2. Extracting time range & system metadata...")
    min_ts, max_ts, total_snapshots = int(datetime.datetime.now().timestamp()), int(datetime.datetime.now().timestamp()), 0
    try:
        cur.execute("SELECT MIN(Timestamp), MAX(Timestamp), COUNT(*) FROM UM_STAT_UM_SYSTEM;")
        res = cur.fetchone()
        if res and res[0] is not None:
            min_ts, max_ts, total_snapshots = res
    except Exception as e:
        print(f"Error querying UM_STAT_UM_SYSTEM range: {e}")

    sys_row = (0, 0, 0, 0, 'Desconocido', 0, 0, 0)
    try:
        cur.execute("""
            SELECT Timestamp, os_info, configuration_info, cluster_status, uptime, cp_ver_info, 
                   um_fw_branch_name, um_fw_build_number
            FROM UM_STAT_UM_SYSTEM ORDER BY Timestamp DESC LIMIT 1;
        """)
        r = cur.fetchone()
        if r:
            sys_row = r
    except Exception as e:
        print(f"Error querying UM_STAT_UM_SYSTEM row: {e}")

    hw_row = ("Check Point Appliance", None, None, 0)
    try:
        cur.execute("SELECT model, sam_cpld, sam_memory, total_rx_drops FROM UM_STAT_UM_HW ORDER BY Timestamp DESC LIMIT 1;")
        r = cur.fetchone()
        if r:
            hw_row = r
    except Exception:
        pass

    # Cores count
    cores_count = 4
    try:
        cur.execute("SELECT num_of_cores FROM UM_STAT_UM_CPU ORDER BY Timestamp DESC LIMIT 1;")
        r = cur.fetchone()
        if r and r[0]:
            cores_count = r[0]
        else:
            cur.execute("SELECT COUNT(DISTINCT name_of_cpu) FROM UM_STAT_UM_CPU_UM_CPU_ORDERED_TABLE;")
            c = cur.fetchone()[0]
            if c:
                cores_count = c
    except Exception:
        pass

    node_name = get_node_name(db_file)

    system_info = {
        "node_name": node_name,
        "db_filename": base_name,
        "start_timestamp": min_ts,
        "end_timestamp": max_ts,
        "start_iso": datetime.datetime.fromtimestamp(min_ts, datetime.timezone.utc).isoformat() if min_ts else "",
        "end_iso": datetime.datetime.fromtimestamp(max_ts, datetime.timezone.utc).isoformat() if max_ts else "",
        "duration_days": round((max_ts - min_ts) / 86400, 1) if (max_ts and min_ts) else 0,
        "total_snapshots": total_snapshots,
        "os": resolve(sys_row[1]) or "Gaia",
        "config": resolve(sys_row[2]) or "Security Gateway",
        "cluster_status": resolve(sys_row[3]) or "Standalone / Node",
        "latest_uptime": sys_row[4] or "-",
        "version": resolve(sys_row[5]) or "-",
        "branch": resolve(sys_row[6]) or "-",
        "build": resolve(sys_row[7]) or "-",
        "hw_model": hw_row[0] if hw_row else "Check Point SG",
        "rx_drops_hw": hw_row[3] if hw_row and len(hw_row) > 3 else 0,
        "cores_count": cores_count
    }

    # 3. Disks latest & partitions
    print("3. Extracting disk information...")
    disks = []
    try:
        cur.execute("""
            SELECT disk_path, disk_total, disk_used, disk_free 
            FROM UM_STAT_UM_DISK_UM_DISK_TABLE 
            WHERE Timestamp = ?;
        """, (max_ts,))
        for r in cur.fetchall():
            path_name = resolve(r[0])
            total_gb = round(r[1] / (1024**3), 2) if r[1] else 0
            used_gb = round(r[2] / (1024**3), 2) if r[2] else 0
            free_gb = round(r[3] / (1024**3), 2) if r[3] else 0
            pct = round(used_gb / total_gb * 100, 1) if total_gb > 0 else 0
            disks.append({
                "mount": path_name,
                "total_gb": total_gb,
                "used_gb": used_gb,
                "free_gb": free_gb,
                "used_pct": pct
            })
    except Exception as e:
        print(f"Error querying disks: {e}")

    # 4. Memory statistics latest & hourly
    print("4. Extracting memory time series...")
    memory_hourly = []
    try:
        cur.execute("""
            SELECT 
                (Timestamp / 3600) * 3600 AS hour_ts,
                AVG(real_total),
                AVG(real_used),
                AVG(real_free),
                AVG(swap_used)
            FROM UM_STAT_UM_MEMORY
            GROUP BY hour_ts
            ORDER BY hour_ts;
        """)
        for r in cur.fetchall():
            total_gb = round(r[1] / (1024**3), 2) if r[1] else 0
            used_gb = round(r[2] / (1024**3), 2) if r[2] else 0
            free_gb = round(r[3] / (1024**3), 2) if r[3] else 0
            swap_mb = round(r[4] / (1024**2), 2) if r[4] else 0
            memory_hourly.append({
                "ts": r[0],
                "total_gb": total_gb,
                "used_gb": used_gb,
                "free_gb": free_gb,
                "used_pct": round(used_gb / total_gb * 100, 1) if total_gb > 0 else 0,
                "swap_mb": swap_mb
            })
    except Exception as e:
        print(f"Error querying memory: {e}")

    # 5. CPU Per Core: overall stats + hourly time series
    print("5. Extracting CPU core metrics...")
    cpu_cores_summary = []
    cpu_hourly_list = []
    try:
        cur.execute("""
            SELECT 
                name_of_cpu, 
                AVG(cpu_usage), 
                MAX(cpu_usage), 
                AVG(cpu_usr_time), 
                AVG(cpu_sys_time), 
                AVG(cpu_idl_time), 
                AVG(cpu_io_wait),
                MAX(cpu_interrupts)
            FROM UM_STAT_UM_CPU_UM_CPU_ORDERED_TABLE 
            GROUP BY name_of_cpu 
            ORDER BY name_of_cpu;
        """)
        for r in cur.fetchall():
            role = "CoreXL FW Worker (fwk)" if r[0] % 2 != 0 else "SND / SecureXL Dispatcher"
            cpu_cores_summary.append({
                "core": r[0],
                "role": role,
                "avg_usage": round(r[1], 1) if r[1] else 0,
                "max_usage": round(r[2], 1) if r[2] else 0,
                "avg_usr": round(r[3], 1) if r[3] else 0,
                "avg_sys": round(r[4], 1) if r[4] else 0,
                "avg_idle": round(r[5], 1) if r[5] else 0,
                "avg_io_wait": round(r[6], 2) if r[6] else 0,
                "max_interrupts": r[7] or 0
            })

        cur.execute("""
            SELECT 
                (Timestamp / 3600) * 3600 AS hour_ts,
                name_of_cpu,
                AVG(cpu_usage),
                MAX(cpu_usage),
                AVG(cpu_usr_time),
                AVG(cpu_sys_time)
            FROM UM_STAT_UM_CPU_UM_CPU_ORDERED_TABLE
            GROUP BY hour_ts, name_of_cpu
            ORDER BY hour_ts, name_of_cpu;
        """)
        cpu_hourly = {}
        for r in cur.fetchall():
            ts, core, avg_u, max_u, usr, sys_u = r
            if ts not in cpu_hourly:
                cpu_hourly[ts] = {"ts": ts}
            cpu_hourly[ts][f"core_{core}_avg"] = round(avg_u, 1) if avg_u else 0
            cpu_hourly[ts][f"core_{core}_max"] = round(max_u, 1) if max_u else 0
            cpu_hourly[ts][f"core_{core}_usr"] = round(usr, 1) if usr else 0
            cpu_hourly[ts][f"core_{core}_sys"] = round(sys_u, 1) if sys_u else 0

        cpu_hourly_list = sorted(cpu_hourly.values(), key=lambda x: x["ts"])
        for row in cpu_hourly_list:
            avgs = [row.get(f"core_{c}_avg", 0) for c in range(cores_count)]
            row["total_avg"] = round(sum(avgs) / len(avgs), 1) if avgs else 0
    except Exception as e:
        print(f"Error querying CPU metrics: {e}")

    # 6. Network Traffic Rate & Connections
    print("6. Extracting network traffic & concurrent connections...")
    traffic_hourly = []
    conns_hourly = []
    try:
        cur.execute("""
            SELECT 
                (Timestamp / 3600) * 3600 AS hour_ts,
                AVG(inbound_throughput),
                MAX(inbound_throughput),
                AVG(outbound_throughput),
                MAX(outbound_throughput),
                AVG(inbound_packets_rate),
                MAX(inbound_packets_rate),
                AVG(conn_rate),
                MAX(conn_rate)
            FROM fw_network_stats_traffic_rate
            WHERE component_name = 'Host'
            GROUP BY hour_ts
            ORDER BY hour_ts;
        """)
        for r in cur.fetchall():
            traffic_hourly.append({
                "ts": r[0],
                "in_mbps_avg": round(r[1] / 1e6, 2) if r[1] else 0,
                "in_mbps_max": round(r[2] / 1e6, 2) if r[2] else 0,
                "out_mbps_avg": round(r[3] / 1e6, 2) if r[3] else 0,
                "out_mbps_max": round(r[4] / 1e6, 2) if r[4] else 0,
                "in_pkts_avg": round(r[5], 1) if r[5] else 0,
                "in_pkts_max": round(r[6], 1) if r[6] else 0,
                "conn_rate_avg": round(r[7], 1) if r[7] else 0,
                "conn_rate_max": round(r[8], 1) if r[8] else 0
            })
    except Exception as e:
        print(f"Error querying traffic rate: {e}")

    try:
        cur.execute("""
            SELECT 
                (Timestamp / 3600) * 3600 AS hour_ts,
                component_name,
                AVG(conns),
                MAX(conns),
                AVG(tcp_established),
                AVG(tcp_handshake),
                AVG(non_tcp)
            FROM fw_network_stats_concurrent_conns
            GROUP BY hour_ts, component_name
            ORDER BY hour_ts;
        """)
        conns_hourly_map = {}
        for r in cur.fetchall():
            ts, comp, avg_c, max_c, est, hs, non_tcp = r
            if ts not in conns_hourly_map:
                conns_hourly_map[ts] = {"ts": ts}
            prefix = comp.lower().replace(" ", "_")
            conns_hourly_map[ts][f"{prefix}_conns_avg"] = round(avg_c, 1) if avg_c else 0
            conns_hourly_map[ts][f"{prefix}_conns_max"] = round(max_c, 1) if max_c else 0
            if comp == "FW":
                conns_hourly_map[ts]["fw_established"] = round(est, 1) if est else 0
                conns_hourly_map[ts]["fw_handshake"] = round(hs, 1) if hs else 0
                conns_hourly_map[ts]["fw_non_tcp"] = round(non_tcp, 1) if non_tcp else 0

        conns_hourly = sorted(conns_hourly_map.values(), key=lambda x: x["ts"])
    except Exception as e:
        print(f"Error querying conns: {e}")

    # 7. Drop Reasons & Statistics
    print("7. Extracting packet drops...")
    drops_by_reason = []
    total_drops_all = 0
    drops_hourly = []
    ppak_drops_list = []
    ppak_total_drops = 0

    try:
        cur.execute("""
            SELECT reason, SUM(count) as total_drops 
            FROM fwdrop_drop_resaons_tab 
            GROUP BY reason 
            ORDER BY total_drops DESC;
        """)
        for r in cur.fetchall():
            r_name = resolve(r[0])
            drops_by_reason.append({
                "reason_id": r[0],
                "reason_name": r_name,
                "count": r[1]
            })
            total_drops_all += r[1]

        for d in drops_by_reason:
            d["percent"] = round((d["count"] / total_drops_all) * 100, 3) if total_drops_all > 0 else 0

        cur.execute("""
            SELECT 
                (Timestamp / 3600) * 3600 AS hour_ts,
                reason,
                SUM(count)
            FROM fwdrop_drop_resaons_tab
            GROUP BY hour_ts, reason
            ORDER BY hour_ts;
        """)
        drops_hourly_map = {}
        for r in cur.fetchall():
            ts, reason_id, cnt = r
            if ts not in drops_hourly_map:
                drops_hourly_map[ts] = {"ts": ts, "total": 0}
            r_name = str(resolve(reason_id))
            clean_key = r_name.lower().replace(" ", "_").replace("-", "_")
            drops_hourly_map[ts][clean_key] = cnt
            drops_hourly_map[ts]["total"] += cnt

        drops_hourly = sorted(drops_hourly_map.values(), key=lambda x: x["ts"])
    except Exception as e:
        print(f"Error querying drop reasons: {e}")

    try:
        cur.execute("""
            SELECT drop_reason, SUM(drop_count) as total_drops 
            FROM ppak_0_drops_category_drops_table 
            GROUP BY drop_reason 
            ORDER BY total_drops DESC;
        """)
        for r in cur.fetchall():
            ppak_drops_list.append({"reason": str(r[0]), "count": r[1]})
            ppak_total_drops += r[1]
        for p in ppak_drops_list:
            p["percent"] = round((p["count"] / ppak_total_drops) * 100, 3) if ppak_total_drops > 0 else 0
    except Exception:
        pass

    # 8. Interfaces: full catalog
    print("8. Extracting interfaces catalog and throughput...")
    interfaces_list = []
    try:
        cur.execute("""
            SELECT DISTINCT name, device, state, type, port, speed, ipv4 
            FROM UM_STAT_UM_HW_UM_IF_TABLE;
        """)
        raw_ifs = cur.fetchall()

        rx_stats_map = {}
        try:
            cur.execute("""
                SELECT if_name, AVG(if_rx_bits_throughput), MAX(if_rx_bits_throughput), MAX(if_rx_packets_throughput), MAX(if_rx_bits)
                FROM UM_STAT_UM_HW_UM_IF_RX_STATISTICS_TABLE GROUP BY if_name;
            """)
            rx_stats_map = {r[0]: r for r in cur.fetchall()}
        except Exception:
            pass

        tx_stats_map = {}
        try:
            cur.execute("""
                SELECT if_name, AVG(if_tx_bits_throughput), MAX(if_tx_bits_throughput), MAX(if_tx_packets_throughput), MAX(if_tx_bits)
                FROM UM_STAT_UM_HW_UM_IF_TX_STATISTICS_TABLE GROUP BY if_name;
            """)
            tx_stats_map = {r[0]: r for r in cur.fetchall()}
        except Exception:
            pass

        err_stats_map = {}
        try:
            cur.execute("""
                SELECT if_name, SUM(if_rx_drops), SUM(if_rx_errors), SUM(if_tx_drops), SUM(if_tx_errors)
                FROM UM_STAT_UM_HW_UM_IF_ERR_STATISTICS_TABLE GROUP BY if_name;
            """)
            err_stats_map = {r[0]: r for r in cur.fetchall()}
        except Exception:
            pass

        for r in raw_ifs:
            if_name_raw = r[0]
            if_name = resolve(if_name_raw)
            dev = resolve(r[1])
            state = resolve(r[2])
            if_type = resolve(r[3])
            port = resolve(r[4])
            speed = resolve(r[5])
            ipv4 = resolve(r[6])

            rx = rx_stats_map.get(if_name_raw, (None, 0, 0, 0, 0))
            tx = tx_stats_map.get(if_name_raw, (None, 0, 0, 0, 0))
            err = err_stats_map.get(if_name_raw, (None, 0, 0, 0, 0))

            interfaces_list.append({
                "name": str(if_name),
                "device": str(dev),
                "state": str(state),
                "type": str(if_type),
                "port": str(port),
                "speed": str(speed),
                "ipv4": str(ipv4) if ipv4 != 'Not Configured' else '',
                "rx_avg_mbps": round(rx[1] / 1e6, 2) if rx[1] else 0,
                "rx_max_mbps": round(rx[2] / 1e6, 2) if rx[2] else 0,
                "rx_max_pkts": rx[3] or 0,
                "tx_avg_mbps": round(tx[1] / 1e6, 2) if tx[1] else 0,
                "tx_max_mbps": round(tx[2] / 1e6, 2) if tx[2] else 0,
                "tx_max_pkts": tx[3] or 0,
                "rx_drops": err[1] or 0,
                "rx_errors": err[2] or 0,
                "tx_drops": err[3] or 0,
                "tx_errors": err[4] or 0
            })

        interfaces_list.sort(key=lambda x: (x["rx_max_mbps"] + x["tx_max_mbps"]), reverse=True)
    except Exception as e:
        print(f"Error querying interfaces: {e}")

    # 9. Spike Detective (CPU & Thread Spikes)
    print("9. Extracting Spike Detective events...")
    cpu_spikes = []
    thread_spikes = []
    cpu_spike_summary = []
    thread_spike_summary = []

    try:
        cur.execute("""
            SELECT cpu_spike_start_time, cpu_core, cpu_spike_duration, cpu_avg_usage, cpu_top_consumer 
            FROM spike_detective_cpu_spike_cpu_table 
            ORDER BY cpu_spike_start_time DESC;
        """)
        for r in cur.fetchall():
            cpu_spikes.append({
                "start_time": r[0],
                "start_iso": datetime.datetime.fromtimestamp(r[0], datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if r[0] else "-",
                "core": r[1],
                "duration_sec": r[2],
                "avg_usage": r[3],
                "consumer": str(r[4])
            })

        cur.execute("""
            SELECT thread_spike_start_time, thread_id, thread_name, thread_spike_duration, thread_avg_usage 
            FROM spike_detective_thread_spike_thread_table 
            ORDER BY thread_spike_start_time DESC;
        """)
        for r in cur.fetchall():
            thread_spikes.append({
                "start_time": r[0],
                "start_iso": datetime.datetime.fromtimestamp(r[0], datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if r[0] else "-",
                "thread_id": r[1],
                "thread_name": str(r[2]),
                "duration_sec": r[3],
                "avg_usage": r[4]
            })

        cur.execute("""
            SELECT cpu_top_consumer, COUNT(*), AVG(cpu_avg_usage), MAX(cpu_avg_usage), AVG(cpu_spike_duration), MAX(cpu_spike_duration) 
            FROM spike_detective_cpu_spike_cpu_table 
            GROUP BY cpu_top_consumer 
            ORDER BY COUNT(*) DESC;
        """)
        cpu_spike_summary = [{
            "consumer": str(r[0]),
            "count": r[1],
            "avg_usage": round(r[2], 1) if r[2] else 0,
            "max_usage": r[3] or 0,
            "avg_duration": round(r[4], 1) if r[4] else 0,
            "max_duration": r[5] or 0
        } for r in cur.fetchall()]

        cur.execute("""
            SELECT thread_name, COUNT(*), AVG(thread_avg_usage), MAX(thread_avg_usage), AVG(thread_spike_duration), MAX(thread_spike_duration) 
            FROM spike_detective_thread_spike_thread_table 
            GROUP BY thread_name 
            ORDER BY COUNT(*) DESC;
        """)
        thread_spike_summary = [{
            "thread_name": str(r[0]),
            "count": r[1],
            "avg_usage": round(r[2], 1) if r[2] else 0,
            "max_usage": r[3] or 0,
            "avg_duration": round(r[4], 1) if r[4] else 0,
            "max_duration": r[5] or 0
        } for r in cur.fetchall()]
    except Exception as e:
        print(f"Note: Spike Detective table not populated: {e}")

    # 10. Flow Profiler (Flofiler)
    print("10. Extracting Flow Profiler metrics...")
    flofiler_protocols = []
    flofiler_components = []
    try:
        cur.execute("""
            SELECT prto, SUM(cycles_centipercent) as tot 
            FROM flofiler_0_flofiler_category_all_0_flofiler_category_table 
            GROUP BY prto 
            ORDER BY tot DESC LIMIT 15;
        """)
        flofiler_protocols = [{"protocol": str(r[0]), "cycles": r[1]} for r in cur.fetchall()]
        total_proto_cycles = sum(p["cycles"] for p in flofiler_protocols)
        for p in flofiler_protocols:
            p["percent"] = round(p["cycles"] / total_proto_cycles * 100, 2) if total_proto_cycles > 0 else 0

        cur.execute("""
            SELECT comp, SUM(cycles_centipercent) as tot 
            FROM flofiler_0_flofiler_category_all_1_flofiler_category_table 
            GROUP BY comp 
            ORDER BY tot DESC LIMIT 15;
        """)
        flofiler_components = [{"component": str(r[0]), "cycles": r[1]} for r in cur.fetchall()]
        total_comp_cycles = sum(c["cycles"] for c in flofiler_components)
        for c in flofiler_components:
            c["percent"] = round(c["cycles"] / total_comp_cycles * 100, 2) if total_comp_cycles > 0 else 0
    except Exception as e:
        print(f"Note: Flofiler table not populated: {e}")

    # 11. SecureXL & CoreXL
    print("11. Extracting SecureXL & CoreXL stats...")
    sxl_status_counts = []
    sxl_non_accel = []
    sxl_offload_host = []
    sxl_f2v_reasons = []
    enqueue_fails = []
    try:
        cur.execute("SELECT status, COUNT(*) FROM sxl_fwaccel GROUP BY status;")
        sxl_status_counts = [{"status": str(resolve(r[0])), "count": r[1]} for r in cur.fetchall()]

        cur.execute("SELECT reason, SUM(count) as tot, AVG(percent) FROM securexl_offload_non_accel GROUP BY reason ORDER BY tot DESC;")
        sxl_non_accel = [{"reason": str(resolve(r[0])), "count": r[1], "avg_pct": round(r[2], 2) if r[2] else 0} for r in cur.fetchall()]

        cur.execute("SELECT reason, SUM(count) as tot, AVG(percent) FROM securexl_offload_offload_to_host GROUP BY reason ORDER BY tot DESC;")
        sxl_offload_host = [{"reason": str(resolve(r[0])), "count": r[1], "avg_pct": round(r[2], 2) if r[2] else 0} for r in cur.fetchall()]

        cur.execute("SELECT reason, SUM(count) as tot FROM securexl_f2v_reasons_fw_side GROUP BY reason ORDER BY tot DESC LIMIT 10;")
        sxl_f2v_reasons = [{"reason": str(resolve(r[0])), "count": r[1]} for r in cur.fetchall()]

        cur.execute("SELECT name, SUM(value) FROM fwmultik_dispatcher_vs_stats_enqueue_fail_enqueue_fail_stats_table GROUP BY name HAVING SUM(value) > 0 ORDER BY SUM(value) DESC;")
        enqueue_fails = [{"name": str(r[0]), "count": r[1]} for r in cur.fetchall()]
    except Exception as e:
        print(f"Note: SecureXL stats partial: {e}")

    # 12. PPAK VS0 Network Category
    print("12. Extracting PPAK VS0 hourly metrics...")
    ppak_hourly = []
    try:
        cur.execute("""
            SELECT 
                (Timestamp / 3600) * 3600 AS hour_ts,
                AVG(inbound_bits),
                MAX(inbound_bits),
                AVG(outbound_bits),
                MAX(outbound_bits),
                AVG(conns_per_sec),
                MAX(conns_per_sec),
                AVG(concurrent_conns),
                MAX(concurrent_conns)
            FROM ppak_0_network_category
            GROUP BY hour_ts
            ORDER BY hour_ts;
        """)
        for r in cur.fetchall():
            ppak_hourly.append({
                "ts": r[0],
                "in_mbps_avg": round(r[1] / 1e6, 2) if r[1] else 0,
                "in_mbps_max": round(r[2] / 1e6, 2) if r[2] else 0,
                "out_mbps_avg": round(r[3] / 1e6, 2) if r[3] else 0,
                "out_mbps_max": round(r[4] / 1e6, 2) if r[4] else 0,
                "conns_sec_avg": round(r[5], 1) if r[5] else 0,
                "conns_sec_max": round(r[6], 1) if r[6] else 0,
                "concur_conns_avg": round(r[7], 1) if r[7] else 0,
                "concur_conns_max": round(r[8], 1) if r[8] else 0
            })
    except Exception as e:
        print(f"Note: PPAK VS0 partial: {e}")

    # 13. VPN & Tracker
    print("13. Extracting VPN & Blades stats...")
    vpn_hourly = []
    tracker_stats = {"avg_total_conns": 0, "avg_tracked_conns": 0, "avg_logged_conns": 0}
    try:
        cur.execute("SELECT (Timestamp / 3600) * 3600 AS hour_ts, AVG(concurrent_ike_peers), MAX(concurrent_ike_peers), AVG(concurrent_sas), MAX(concurrent_sas) FROM vpn_ike_sas GROUP BY hour_ts ORDER BY hour_ts;")
        vpn_hourly = [{
            "ts": r[0],
            "peers_avg": round(r[1], 1) if r[1] else 0,
            "peers_max": r[2] or 0,
            "sas_avg": round(r[3], 1) if r[3] else 0,
            "sas_max": r[4] or 0
        } for r in cur.fetchall()]

        cur.execute("SELECT AVG(total_conn_count_sum), AVG(tracked_conn_count_sum), AVG(total_logged_conn_count_sum) FROM tracker_general;")
        t_row = cur.fetchone()
        if t_row:
            tracker_stats = {
                "avg_total_conns": round(t_row[0], 1) if t_row[0] else 0,
                "avg_tracked_conns": round(t_row[1], 1) if t_row[1] else 0,
                "avg_logged_conns": round(t_row[2], 1) if t_row[2] else 0
            }
    except Exception as e:
        print(f"Note: VPN or Tracker stats partial: {e}")

    # 14. Full Table Catalog
    print("14. Cataloging all active database tables...")
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    all_table_names = [r[0] for r in cur.fetchall()]

    table_catalog = []
    for t in all_table_names:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}";')
            cnt = cur.fetchone()[0]
            if cnt > 0:
                cur.execute(f'PRAGMA table_info("{t}");')
                cols = [{"name": c[1], "type": c[2]} for c in cur.fetchall()]
                cur.execute(f'SELECT * FROM "{t}" LIMIT 1;')
                sample_row = cur.fetchone()
                sample_dict = {}
                if sample_row:
                    for i, col in enumerate(cols):
                        val = sample_row[i]
                        val = resolve(val)
                        sample_dict[col["name"]] = val

                prefix = t.split('_')[0]
                table_catalog.append({
                    "name": t,
                    "category": prefix,
                    "row_count": cnt,
                    "columns": cols,
                    "sample": sample_dict
                })
        except Exception:
            pass

    table_catalog.sort(key=lambda x: x["row_count"], reverse=True)

    # 14. Virtual Systems (VSX) Extraction
    virtual_systems_data = None
    is_vsx_gateway = False
    sys_config_str = str(system_info.get('config', '')).lower()
    if 'vsx' in sys_config_str or 'vsys' in db_file.lower():
        is_vsx_gateway = True
    else:
        cur.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='procs';")
        if cur.fetchone()[0] > 0:
            cur.execute("SELECT COUNT(*) FROM procs WHERE name LIKE '%fwk%dev%';")
            if cur.fetchone()[0] > 0:
                is_vsx_gateway = True

    if is_vsx_gateway:
        print("Detected VSX gateway environment. Attaching Virtual Systems metadata...")
        vsx_data_path = os.path.join(os.path.dirname(__file__), 'data', 'vsx_data.json')
        if os.path.exists(vsx_data_path):
            try:
                with open(vsx_data_path, 'r', encoding='utf-8') as vf:
                    virtual_systems_data = json.load(vf)
            except Exception as e:
                print(f"Warning: could not load vsx_data.json: {e}")

    # 15. Master payload compile
    print("15. Writing payload to JSON...")
    data = {
        "virtual_systems": virtual_systems_data,
        "system": system_info,
        "disks": disks,
        "cpu": {
            "summary": cpu_cores_summary,
            "hourly": cpu_hourly_list
        },
        "memory": {
            "hourly": memory_hourly
        },
        "traffic": {
            "hourly": traffic_hourly,
            "conns_hourly": conns_hourly
        },
        "drops": {
            "total": total_drops_all,
            "by_reason": drops_by_reason,
            "hourly": drops_hourly,
            "ppak_total": ppak_total_drops,
            "ppak_by_reason": ppak_drops_list
        },
        "interfaces": interfaces_list,
        "spikes": {
            "cpu_spikes": cpu_spikes,
            "thread_spikes": thread_spikes,
            "cpu_summary": cpu_spike_summary,
            "thread_summary": thread_spike_summary
        },
        "flofiler": {
            "protocols": flofiler_protocols,
            "components": flofiler_components
        },
        "securexl": {
            "status": sxl_status_counts,
            "non_accel": sxl_non_accel,
            "offload_host": sxl_offload_host,
            "f2v_reasons": sxl_f2v_reasons,
            "enqueue_fails": enqueue_fails
        },
        "ppak_vs0": {
            "hourly": ppak_hourly
        },
        "vpn": {
            "hourly": vpn_hourly
        },
        "tracker": tracker_stats,
        "table_catalog": table_catalog
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))

    size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"Extraction complete! Saved to {output_file} ({size_mb:.2f} MB)")
    con.close()
    return data

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB_FILE
    out = sys.argv[2] if len(sys.argv) > 2 else None
    extract_cpview(target, out)
