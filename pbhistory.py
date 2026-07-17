import csv
import re

def format_tsv_time(input_tsv: str, output_tsv: str):
    """
    Rules:
    1. Keep first row header & first column unchanged
    2. Empty cells stay empty
    3. Split all digits into 3 groups regardless separators
    4. Format final as MM:SS.FF
    5. Single decimal digit → pad 0 at end: 30:21.9 → 30:21.90
    6. No numeric conversion, pure string rearrange
    """
    def standard_time_str(raw: str) -> str:
        s = raw.strip()
        if not s:
            return ""

        # Extract all digit sequences
        digit_parts = re.findall(r'\d+', s)
        
        # Fill to 3 parts
        while len(digit_parts) < 3:
            digit_parts.append("0")
        # Truncate extra parts
        digit_parts = digit_parts[:3]

        minute = digit_parts[0].zfill(2)[:2]
        second = digit_parts[1].zfill(2)[:2]
        frac = digit_parts[2]
        
        # Pad zero AFTER to make 2 digits
        frac_formatted = frac.ljust(2, "0")[:2]

        return f"{minute}:{second}.{frac_formatted}"

    out_rows = []
    with open(input_tsv, "r", encoding="utf-8", newline="") as f_in:
        reader = csv.reader(f_in, delimiter="\t")
        for row_idx, row in enumerate(reader):
            new_row = []
            for col_idx, cell_val in enumerate(row):
                if row_idx == 0 or col_idx == 0:
                    new_row.append(cell_val)
                else:
                    new_row.append(standard_time_str(cell_val))
            out_rows.append(new_row)

    with open(output_tsv, "w", encoding="utf-8", newline="") as f_out:
        writer = csv.writer(f_out, delimiter="\t")
        writer.writerows(out_rows)

def cn_date_to_iso(cn_date_str: str, year: int = 2026) -> str:
    s = cn_date_str.strip()
    if "月" not in s or "日" not in s:
        return s
    try:
        month_part, day_part = s.replace("月","|").replace("日","").split("|")
        m = int(month_part.strip())
        d = int(day_part.strip())
        return f"{year:04d}-{m:02d}-{d:02d}"
    except:
        return s


def analyze_time_history(formatted_tsv_path: str, stat_output_tsv: str):
    """
    Read formatted time TSV, generate statistics table:
    Columns: ItemName | OccurrenceCount | ShortestTime | DateOfShortestTime
    
    Rules:
    1. First row = date headers
    2. First column = item names
    3. Empty time cells are ignored
    4. Compare mm:ss.ff string directly to find shortest
    5. Output new TSV with 4 columns
    """
    all_rows = []
    date_headers = []
    with open(formatted_tsv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t")
        all_rows = list(reader)

    if not all_rows:
        return
    
    # First row: date list (skip first cell)
    date_headers = all_rows[0][1:]
    result_data = []

    # Iterate each data row (skip header row 0)
    for row in all_rows[1:]:
        if not row:
            continue
        item_name = row[0]
        time_cells = row[1:]

        time_info_list = []
        for idx, time_str in enumerate(time_cells):
            t = time_str.strip()
            if not t:
                continue
            # Get corresponding date if available, else empty string
            date = cn_date_to_iso(date_headers[idx]) if idx < len(date_headers) else ""
            time_info_list.append((t, date))
        
        if not time_info_list:
            # no valid time data
            result_data.append([item_name, "0", "", ""])
            continue
    
        occurrence_count = len(time_info_list)
        # Find shortest time
        shortest_time, shortest_date = min(time_info_list, key=lambda x: x[0])
        
        result_data.append([item_name, occurrence_count, shortest_time, shortest_date])
    
    # write stats TSV
    with open(stat_output_tsv, "w", encoding="utf-8", newline="") as f_out:
        writer = csv.writer(f_out, delimiter="\t")
        writer.writerow(["ItemName", "OccurrenceCount", "ShortestTime", "DateOfShortestTime"])
        writer.writerows(result_data)



# Example usage
if __name__ == "__main__":
    #format_tsv_time("pbrun_history.txt", "pbrun_history_formatted.txt")
    analyze_time_history("pbrun_history_formatted.txt", "pbrun_history_stat.txt")