"""
tests/test_intent.py — Behavioural tests for the context/intent-aware extractor.

These encode the failure modes of the old keyword classifier: "decide" in a
sentence is *not* a decision, "will" is *not* a to-do, and context (who asked,
who accepted) determines owners.
"""

from __future__ import annotations

from nlp.intent import Utterance, analyse_sentence, extract, infer_speaker_names


def _u(*texts_with_speakers):
    return [Utterance(i, spk, txt) for i, (spk, txt) in enumerate(texts_with_speakers)]


# ── Decisions vs. things that merely mention deciding ────────────────────────

class TestDecisions:
    def test_need_to_decide_is_open_item_not_decision(self):
        a = analyse_sentence("We still need to decide on the vendor for the cloud migration.")
        assert a.intent == "open_item"
        assert a.description == "Decide on the vendor for the cloud migration"

    def test_question_about_deciding_is_not_decision(self):
        assert analyse_sentence("Did we decide anything about the pricing page?").intent == "question"

    def test_hypothetical_decision_is_not_decision(self):
        assert analyse_sentence("If we decide to go with AWS, the cost will double.").intent != "decision"

    def test_noun_mention_is_not_decision(self):
        assert analyse_sentence("The decision making process here is painfully slow.").intent == "general"

    def test_negated_decision_is_open_item(self):
        a = analyse_sentence("Nobody has decided who owns the onboarding flow.")
        assert a.intent == "open_item"
        assert a.description.startswith("Decide")

    def test_explicit_decision_with_rationale(self):
        a = analyse_sentence("So we decided to postpone the launch to March because QA is not done.")
        assert a.intent == "decision"
        assert a.description == "Postpone the launch to March"
        assert a.rationale == "QA is not done"

    def test_lets_go_with_is_decision(self):
        a = analyse_sentence("Okay, let's go with Postgres for the main database.")
        assert a.intent == "decision" and a.confidence >= 0.6
        assert a.description == "Go with Postgres for the main database"

    def test_passive_agreement(self):
        a = analyse_sentence("It was agreed that the budget will be cut by 10 percent.")
        assert a.intent == "decision"
        assert a.description == "The budget will be cut by 10 percent"

    def test_negative_decision(self):
        a = analyse_sentence("We're not going ahead with the redesign this quarter.")
        assert a.intent == "decision"
        assert a.description.startswith("Not going ahead")

    def test_hedged_suggestion_is_not_decision(self):
        a = analyse_sentence("I think we should maybe use Redis for caching.")
        assert not (a.intent == "decision" and a.confidence >= 0.45)

    def test_meeting_flow_is_not_decision(self):
        a = analyse_sentence("Let's move on to the next topic.")
        assert a.intent == "general"

    def test_proposal_accepted_by_other_speaker_becomes_decision(self):
        r = extract(_u(
            ("Priya", "Should we go with Postgres instead of Mongo?"),
            ("Karan", "Yeah, sounds good."),
        ))
        assert [d.description for d in r.decisions] == ["Go with Postgres instead of Mongo"]

    def test_proposal_rejected_is_not_decision(self):
        r = extract(_u(
            ("Priya", "Should we go with Postgres instead of Mongo?"),
            ("Karan", "No, I don't think so."),
        ))
        assert r.decisions == []


# ── Action items ─────────────────────────────────────────────────────────────

class TestActionItems:
    def test_commitment_with_deadline(self):
        a = analyse_sentence("Yeah, I'll send the deck to the client by Friday.")
        assert a.intent == "commitment"
        assert a.description == "Send the deck to the client by Friday"
        assert a.due == "by Friday"

    def test_in_meeting_talk_is_not_task(self):
        assert analyse_sentence("I'll be honest, this sprint was rough.").intent == "general"
        assert analyse_sentence("I'll share my screen.").intent == "general"

    def test_named_request(self):
        a = analyse_sentence("Karan, can you update the API docs before the demo?")
        assert a.intent == "request"
        assert a.owner == "Karan"
        assert a.description == "Update the API docs before the demo"

    def test_information_question_is_not_task(self):
        assert analyse_sentence("Can you tell me more about the architecture?").intent == "question"

    def test_third_person_assignment(self):
        a = analyse_sentence("Priya will handle the database migration next week.")
        assert a.intent == "assignment"
        assert a.owner == "Priya"
        assert a.due == "next week"

    def test_already_done_is_not_task(self):
        a = analyse_sentence("I already sent the report yesterday.")
        assert a.intent != "commitment"

    def test_explicit_action_item_label(self):
        a = analyse_sentence("Action item for Dev: set up the CI pipeline by Wednesday.")
        assert a.intent == "assignment" and a.owner == "Dev"
        assert a.description == "Set up the CI pipeline by Wednesday"

    def test_hedged_maybe_is_low_confidence(self):
        a = analyse_sentence("Maybe we could look into Kubernetes at some point.")
        assert a.intent not in ("commitment", "assignment") or a.confidence < 0.45

    def test_conditional_is_not_task(self):
        a = analyse_sentence("If the client agrees, I'll send the invoice.")
        assert a.confidence < 0.45

    def test_owner_is_speaker_for_first_person(self):
        r = extract(_u(("Karan", "I'll draft the comparison doc and share it tomorrow.")))
        assert len(r.action_items) == 1
        assert r.action_items[0].owner == "Karan"
        assert r.action_items[0].due == "tomorrow"

    def test_vague_acceptance_resolves_from_request(self):
        r = extract(_u(
            ("Priya", "Can you set up the staging database by Thursday?"),
            ("Karan", "Sure, I'll do it."),
        ))
        assert len(r.action_items) == 1
        item = r.action_items[0]
        assert item.description == "Set up the staging database by Thursday"
        assert item.owner == "Karan"
        assert item.due == "by Thursday"

    def test_request_in_two_person_meeting_defaults_to_other_speaker(self):
        r = extract(_u(
            ("Priya", "Please review the pull request today."),
            ("Karan", "The build is green by the way."),
        ))
        assert len(r.action_items) == 1
        assert r.action_items[0].owner == "Karan"

    def test_pronouns_resolved_to_speaker(self):
        r = extract(_u(("Priya", "Karan, can you send me the numbers by Monday?"), ("Karan", "Will do.")))
        assert r.action_items and "Priya" in r.action_items[0].description

    def test_duplicates_are_merged(self):
        r = extract(_u(
            ("Karan", "I'll send the deck to the client by Friday."),
            ("Karan", "So yeah, I will send the deck to the client by Friday."),
        ))
        assert len(r.action_items) == 1

    def test_evidence_and_segment_index_kept(self):
        r = extract(_u(("Karan", "Hello."), ("Karan", "I'll fix the login bug tonight.")))
        assert r.action_items[0].segment_index == 1
        assert r.action_items[0].evidence == "I'll fix the login bug tonight."

    def test_no_items_for_small_talk(self):
        r = extract(_u(
            ("Karan", "The weather was nice yesterday."),
            ("Priya", "Yeah, honestly the demo went great and the panel liked it."),
        ))
        assert r.action_items == [] and r.decisions == []


# ── Speaker names ────────────────────────────────────────────────────────────

class TestSpeakerNames:
    def test_self_introduction_maps_label(self):
        names = infer_speaker_names(_u(
            ("SPEAKER_00", "Hi everyone, this is Karan."),
            ("SPEAKER_01", "Hey, Priya here."),
        ))
        assert names == {"SPEAKER_00": "Karan", "SPEAKER_01": "Priya"}

    def test_names_used_as_owners(self):
        r = extract(_u(
            ("SPEAKER_00", "Hi, this is Karan. I'll send the invoice tomorrow."),
        ))
        assert r.action_items[0].owner == "Karan"
