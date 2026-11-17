"""Dependency-free tests for request and configuration guards."""
import unittest

from request_validation import (
    authorization_matches,
    valid_model_revision,
    valid_service_token,
    validate_audio_upload,
)


class RequestValidationTests(unittest.TestCase):
    def test_requires_full_immutable_commit_sha(self):
        self.assertTrue(valid_model_revision("a" * 40))
        self.assertTrue(valid_model_revision("b" * 64))
        self.assertFalse(valid_model_revision("main"))
        self.assertFalse(valid_model_revision("a" * 39))
        self.assertFalse(valid_model_revision("g" * 40))

    def test_service_token_minimum_length(self):
        self.assertTrue(valid_service_token("x" * 32))
        self.assertFalse(valid_service_token("short"))
        self.assertFalse(valid_service_token(""))

    def test_bearer_authentication_is_exact(self):
        token = "secret-" + "x" * 32
        self.assertTrue(authorization_matches("Bearer " + token, token))
        self.assertFalse(authorization_matches("bearer " + token, token))
        self.assertFalse(authorization_matches("Bearer wrong", token))
        self.assertFalse(authorization_matches(None, token))

    def test_rejects_wrong_content_type(self):
        self.assertEqual(
            validate_audio_upload(b"RIFF" + b"0000" + b"WAVE", "audio/mpeg"),
            "Only WAV audio is accepted.",
        )

    def test_rejects_empty_and_non_wav_payloads(self):
        self.assertEqual(
            validate_audio_upload(b"", "audio/wav"),
            "Audio file is empty.",
        )
        self.assertEqual(
            validate_audio_upload(b"not-a-wav-file", "audio/wav"),
            "Only RIFF/WAVE audio is accepted.",
        )

    def test_accepts_wav_container_header(self):
        payload = b"RIFF" + b"0000" + b"WAVE" + b"data"
        self.assertIsNone(validate_audio_upload(payload, "audio/wav"))


if __name__ == "__main__":
    unittest.main()
