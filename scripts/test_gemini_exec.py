import unittest

from gemini_exec import parse_answer


class ParseAnswerTests(unittest.TestCase):
    def test_two_blocks_parsed_with_bodies(self):
        answer = (
            "=== FILE: src/a.ts ===\n"
            "line one\n"
            "line two\n"
            "=== END FILE ===\n"
            "=== FILE: docs/X.md ===\n"
            "hello\n"
            "=== END FILE ===\n"
            "=== NOTES ===\n"
            "did things\n"
        )
        blocks, _, refused = parse_answer(answer, {"src/a.ts", "docs/X.md"}, lambda p: p)
        self.assertEqual(blocks, [("src/a.ts", "line one\nline two"), ("docs/X.md", "hello")])
        self.assertEqual(refused, [])

    def test_notes_section_returned(self):
        answer = (
            "=== FILE: src/a.ts ===\n"
            "body\n"
            "=== END FILE ===\n"
            "=== NOTES ===\n"
            "did this and that\n"
        )
        _, notes, _ = parse_answer(answer, {"src/a.ts"}, lambda p: p)
        self.assertEqual(notes, "did this and that")

    def test_no_blocks_gives_empty_list(self):
        answer = "just some text\n=== NOTES ===\nno files\n"
        blocks, notes, refused = parse_answer(answer, set(), lambda p: p)
        self.assertEqual(blocks, [])
        self.assertEqual(notes, "no files")
        self.assertEqual(refused, [])

    def test_disallowed_path_reported_as_refused(self):
        answer = (
            "=== FILE: src/a.ts ===\n"
            "body\n"
            "=== END FILE ===\n"
            "=== NOTES ===\n"
            "notes\n"
        )
        blocks, _, refused = parse_answer(answer, {"other/b.ts"}, lambda p: p)
        self.assertEqual(blocks, [("src/a.ts", "body")])
        self.assertEqual(refused, ["src/a.ts"])

    def test_crlf_line_endings_still_parse(self):
        answer = (
            "=== FILE: src/a.ts ===\r\n"
            "line one\r\n"
            "line two\r\n"
            "=== END FILE ===\r\n"
            "=== NOTES ===\r\n"
            "done\r\n"
        )
        blocks, notes, refused = parse_answer(answer, {"src/a.ts"}, lambda p: p)
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][0], "src/a.ts")
        self.assertIn("line one", blocks[0][1])
        self.assertIn("line two", blocks[0][1])
        self.assertEqual(refused, [])
        self.assertEqual(notes, "done")


if __name__ == "__main__":
    unittest.main()
