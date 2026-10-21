#!/usr/bin/env python3
"""Verify published evidence/package bytes only; no runtime or acceptance tests."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile

ROOT = Path(__file__).resolve().parent


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(value):
    path = PurePosixPath(value)
    assert not path.is_absolute() and ".." not in path.parts, value
    return path


def main():
    checks = 0
    for line in (ROOT / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split("  ", 1)
        target = ROOT / str(safe_path(name))
        assert target.is_file() and not target.is_symlink(), name
        assert sha256(target.read_bytes()) == digest, name
        checks += 1

    artifact = ROOT / "artifact"
    package = artifact / "codexless-0.1.2-preview.1.tgz"
    assert sha256(package.read_bytes()) == "43c7e2c6fe24a6b87a91bdeccd3fa574f96da6dca887daec9c605ca91ce497d4"
    inventory_document = json.loads((artifact / "payload-inventory.json").read_text())
    records = inventory_document if isinstance(inventory_document, list) else inventory_document["entries"]
    inventory = {row["path"]: row for row in records}
    assert len(inventory) == len(records) == 125
    with tarfile.open(package, "r:gz") as archive:
        members = archive.getmembers()
        assert all(member.isfile() for member in members), "unexpected non-regular tar entry"
        assert len({member.name for member in members}) == len(members) == 125
        payloads = {}
        for member in members:
            safe_path(member.name)
            assert member.name in inventory, member.name
            row = inventory[member.name]
            content = archive.extractfile(member).read()
            assert sha256(content) == row["sha256"], member.name
            assert member.size == row["size"], member.name
            assert member.mode == int(str(row["mode"]), 8), member.name
            payloads[member.name] = content
        manifest_bytes = (artifact / "release-manifest.json").read_bytes()
        assert payloads["package/config/release-manifest.json"] == manifest_bytes
        manifest = json.loads(manifest_bytes)
        assert manifest["buildId"] == "31dc0d0614200479c14822ea5536ffc4abefa0e52af486e9fad2728d7ded1b3d"
        assert manifest["sourceRevision"] == "394e8f4d356f064c27143a8580c3ba4028373e21"
        assert len(manifest["files"]) == 124
        expected = {"package/" + item["path"] for item in manifest["files"]}
        assert set(payloads) == expected | {"package/config/release-manifest.json"}
        for item in manifest["files"]:
            assert sha256(payloads["package/" + item["path"]]) == item["sha256"], item["path"]
        launchers = [member for member in members if member.name.startswith("package/bin/codexless-linux")]
        assert len(launchers) == 16
        assert all(member.mode & 0o111 and b"\r" not in payloads[member.name] for member in launchers)
    print(f"Verified {checks} public evidence digests, original package, 125 file hashes/modes/sizes, 124 manifest payloads and 16 Linux launchers. No acceptance tests run.")


if __name__ == "__main__":
    main()
