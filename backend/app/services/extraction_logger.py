"""
Extraction logger — per-document append-only JSONL audit trail.

Each document gets its own log file at {storage_path}/{document_id}/extraction_log.jsonl.
Writes are append-only. Log retention keeps the most recent 25 extraction runs.
Pruning uses atomic write-to-tmp-then-rename to prevent corruption on crash.

All writes are synchronous (microsecond-level for typical payloads).
The UI disables the extract button during extraction, serializing access per document.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings


class ExtractionLogger:
    """Per-document append-only extraction audit log."""

    LOG_FILENAME = "extraction_log.jsonl"
    MAX_RUNS = 25

    def __init__(self, document_id: str):
        """
        Initialize logger for a specific document.

        Creates the log directory if it does not exist.

        Args:
            document_id: UUID string of the document.
        """
        self.document_id = document_id
        self.log_dir = Path(settings.storage__path) / document_id
        self.log_path = self.log_dir / self.LOG_FILENAME
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def log(self, label: str, phase: str, data: dict) -> None:
        """
        Append a single JSONL entry to the log file.

        Args:
            label: Short event label (e.g. "START_EXTRACTION", "GEMINI_RESPONSE_RAW").
            phase: Stage name (e.g. "extraction", "gemini", "parse", "report").
            data: Arbitrary JSON-serializable dict (image blobs stripped automatically).
        """
        sanitized = self._sanitize(data)
        entry = {
            "t": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "label": label,
            "phase": phase,
            "data": sanitized,
        }

        # Console output
        ts = entry["t"][11:19]
        print(f"[{ts}] [{label}] phase={phase}", flush=True)
        for key, value in sanitized.items():
            v = str(value)
            if len(v) > 2000:
                v = v[:2000] + "..."
            print(f"    {key}: {v}", flush=True)

        # File output
        line = json.dumps(entry, default=str) + "\n"
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(line)

    def read_all(self) -> list[dict]:
        """
        Read the entire log file.

        Returns:
            List of parsed JSON entries. Corrupt lines are returned as error entries.
            Returns empty list if the log file does not exist.
        """
        if not self.log_path.exists():
            return []
        entries = []
        with open(self.log_path, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    entries.append(json.loads(stripped))
                except json.JSONDecodeError:
                    entries.append({
                        "t": "unknown",
                        "label": "LOG_PARSE_ERROR",
                        "phase": "system",
                        "data": {"corrupt_line": stripped[:200]},
                    })
        return entries

    def _sanitize(self, data: dict) -> dict:
        """
        Strip non-serializable or unsafe data from log entries.

        Removes image binary data (large + not useful in logs) while
        keeping metadata like dimensions and sizes.

        Args:
            data: Raw data dict.

        Returns:
            Sanitized copy safe for JSON serialization.
        """
        sanitized = {}
        for key, value in data.items():
            if key in ("images", "image_data", "image_bytes"):
                sanitized[key] = f"<{len(value)} bytes>"
            else:
                sanitized[key] = value
        return sanitized

    def _prune_old_runs(self) -> None:
        """
        Keep only the most recent MAX_RUNS extraction runs.

        Identifies runs by START_EXTRACTION markers. Pruning is atomic:
        writes new content to a temp file, then renames over the original.
        Called after logging EXTRACTION_COMPLETE or any ERROR_* event.
        """
        if not self.log_path.exists():
            return
        with open(self.log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        run_indices = [
            i for i, line in enumerate(lines)
            if '"START_EXTRACTION"' in line
        ]

        if len(run_indices) <= self.MAX_RUNS:
            return

        first_keep_index = run_indices[-self.MAX_RUNS]
        keep_lines = lines[first_keep_index:]

        tmp_path = self.log_path.with_suffix(".jsonl.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.writelines(keep_lines)
        os.replace(tmp_path, self.log_path)
