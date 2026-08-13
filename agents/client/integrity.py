import json
import logging
from pathlib import Path

from pydantic import ValidationError

from client.schemas import FILE_MODELS

REQUIRED_FILES = tuple(FILE_MODELS.keys())
logger = logging.getLogger("client.integrity")


def validate_payload(name: str, payload):
    model = FILE_MODELS[name]
    validated = model.model_validate(payload)
    return validated.model_dump(by_alias=True, exclude_none=True, exclude_defaults=True)


def load_json_file(data_dir: Path, name: str):
    logger.debug("Validating JSON payload for %s", name)
    with open(data_dir / name, "r", encoding="utf-8") as file_handle:
        payload = json.load(file_handle)

    return validate_payload(name, payload)


def get_data_health_report(data_dir: Path) -> dict:
    files: dict[str, dict] = {}
    problems: list[str] = []

    for filename in REQUIRED_FILES:
        file_path = data_dir / filename
        file_report = {
            "path": str(file_path),
            "exists": file_path.exists(),
            "valid_json": False,
            "schema_valid": False,
        }

        if not file_report["exists"]:
            problems.append(f"missing {file_path}")
            files[filename] = file_report
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as file_handle:
                payload = json.load(file_handle)
            file_report["valid_json"] = True
            validate_payload(filename, payload)
            file_report["schema_valid"] = True
        except json.JSONDecodeError as error:
            problems.append(f"invalid JSON in {file_path}: {error.msg}")
            file_report["error"] = error.msg
            logger.warning("JSON decode failed for %s: %s", file_path, error.msg)
        except ValidationError as error:
            message = error.errors()[0]["msg"]
            problems.append(f"schema validation failed for {file_path}: {message}")
            file_report["error"] = message
            logger.warning("Schema validation failed for %s: %s", file_path, message)

        files[filename] = file_report

    return {
        "ok": len(problems) == 0,
        "data_dir": str(data_dir),
        "files": files,
        "problems": problems,
    }


def validate_data_directory(data_dir: Path) -> None:
    report = get_data_health_report(data_dir)
    problems = report["problems"]

    if problems:
        logger.error("Data integrity check failed with %s problem(s)", len(problems))
        raise RuntimeError("Data integrity check failed: " + "; ".join(problems))
