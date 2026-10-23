#!/usr/bin/env python3
"""Exercise the pinned Core executable with a simulated harness, never inference."""
import argparse
import shutil
import sys
import unittest
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
root = args.source.resolve()
if not (root / "target/debug/cloudroom").is_file():
    parser.error("Build the pinned Core source with cargo build --locked first")
sys.path.insert(0, str(root / "tests"))
import core_fixture  # noqa: E402

original_setup = core_fixture.ReplayTests.setUp

def setup_with_node(self):
    original_setup(self)
    # Managed environments may install Node outside the system PATH used by Core.
    # Supply it in the fixture account's supported user-tools directory.
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js 24 is required")
    directory = Path(self.env["CLOUDROOM_ACCOUNT_HOME"]) / ".local/bin"
    directory.mkdir(parents=True)
    (directory / "node").symlink_to(node)

core_fixture.ReplayTests.setUp = setup_with_node
core_fixture.RecoveryTests.setUp = setup_with_node
names = [
    "ReplayTests.test_loopback_http_needs_no_permission_and_remains_authenticated",
    "ReplayTests.test_session_workspace_reports_live_cloud_checkout",
    "ReplayTests.test_replay_does_not_read_other_sessions",
    "RecoveryTests.test_partial_acceptance_and_legacy_enqueue_run_once",
    "RecoveryTests.test_graceful_restart_preserves_queue_and_close_settles_it",
    "RecoveryTests.test_manual_stop_keeps_queue_paused_across_restart_until_resume",
    "RecoveryTests.test_recovery_preflight_distinguishes_empty_and_missing_history",
]
suite = unittest.TestLoader().loadTestsFromNames(names, core_fixture)
print("FIXTURE CONTRACT CHECKS — no model inference or production isolation evidence", flush=True)
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(not result.wasSuccessful())
