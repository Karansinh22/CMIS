"""
tests/test_reports.py — Phase 6 document generation from the context store.
"""

from __future__ import annotations

import io
import zipfile

from db.models import ActionItem, ContextEntry, Decision, Meeting, Speaker, Topic, TranscriptSegment


def _seed(db):
    m = Meeting(title="Design Review: Q3 Roadmap", status="done", summary_type="balanced", source="live")
    db.add(m); db.commit()
    spk = Speaker(label="SPEAKER_00", name="Karan", meeting_id=m.id); db.add(spk); db.commit()
    db.add(TranscriptSegment(meeting_id=m.id, speaker_id=spk.id, text="Let's go with Postgres.", start_time=0.0, end_time=3.0, segment_index=0))
    entry = ContextEntry(meeting_id=m.id, summary="## Meeting Overview\n\nThis meeting **centred** around the database.\n\n- **Agreed:** Go with Postgres\n", summary_type="balanced")
    db.add(entry); db.commit()
    db.add(Topic(context_id=entry.id, title="Database Choice", summary="Postgres vs Mongo.", is_recurring=True))
    db.add(Decision(context_id=entry.id, description="Go with Postgres", rationale="Better tooling"))
    db.add(ActionItem(context_id=entry.id, description="Set up the staging database", owner="Karan", urgency="high", due="by Thursday"))
    db.commit()
    return m


def _zip_text(data: bytes, member: str) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return z.read(member).decode("utf-8", errors="ignore")


def test_generate_docx_and_download(client, db, tmp_path, monkeypatch):
    from config import settings
    monkeypatch.setattr(settings, "reports_dir", tmp_path)
    m = _seed(db)

    res = client.post(f"/meetings/{m.id}/reports?format=docx")
    assert res.status_code == 201, res.text
    report = res.json()
    assert report["format"] == "docx" and report["file_path"].endswith("_MoM.docx")

    dl = client.get(f"/reports/{report['id']}/download")
    assert dl.status_code == 200
    xml = _zip_text(dl.content, "word/document.xml")
    for needle in ("MINUTES OF MEETING", "Design Review", "Go with Postgres", "Better tooling",
                   "Set up the staging database", "Karan", "by Thursday", "Database Choice", "Appendix"):
        assert needle in xml, needle

    listed = client.get(f"/meetings/{m.id}/reports").json()
    assert [r["id"] for r in listed] == [report["id"]]


def test_generate_pptx_and_markdown(client, db, tmp_path, monkeypatch):
    from config import settings
    monkeypatch.setattr(settings, "reports_dir", tmp_path)
    m = _seed(db)

    res = client.post(f"/meetings/{m.id}/reports?format=pptx")
    assert res.status_code == 201, res.text
    dl = client.get(f"/reports/{res.json()['id']}/download")
    assert dl.status_code == 200
    with zipfile.ZipFile(io.BytesIO(dl.content)) as z:
        slides = [n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")]
        assert len(slides) >= 5
        alltext = " ".join(z.read(s).decode("utf-8", errors="ignore") for s in slides)
    assert "Go with Postgres" in alltext and "Set up the staging database" in alltext

    res = client.post(f"/meetings/{m.id}/reports?format=md&include_transcript=true")
    assert res.status_code == 201
    md = client.get(f"/reports/{res.json()['id']}/download").text
    assert md.startswith("# Minutes of Meeting")
    assert "| Set up the staging database | Karan | by Thursday | High | Open |" in md
    assert "**Karan:** Let's go with Postgres." in md


def test_report_requires_finished_meeting(client, db, tmp_path, monkeypatch):
    from config import settings
    monkeypatch.setattr(settings, "reports_dir", tmp_path)
    m = Meeting(title="still running", status="transcribing"); db.add(m); db.commit()
    assert client.post(f"/meetings/{m.id}/reports?format=docx").status_code == 409
    assert client.post(f"/meetings/{m.id}/reports?format=exe").status_code == 422


def test_delete_report_removes_file(client, db, tmp_path, monkeypatch):
    from config import settings
    from pathlib import Path
    monkeypatch.setattr(settings, "reports_dir", tmp_path)
    m = _seed(db)
    report = client.post(f"/meetings/{m.id}/reports?format=md").json()
    assert Path(report["file_path"]).exists()
    assert client.delete(f"/reports/{report['id']}").status_code == 200
    assert not Path(report["file_path"]).exists()
    assert client.get(f"/reports/{report['id']}/download").status_code == 404
