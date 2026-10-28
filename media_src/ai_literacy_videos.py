"""ManimGL source for the four AI Literacy module videos (silent, captioned, paper-and-ink style).

Render (from this folder, with ManimGL 1.7 installed):
    manimgl ai_literacy_videos.py NextWordVideo BiasVideo ClaimsVideo DataTrailVideo -w --hd \
        --video_dir ../frontend/public/media/ai-literacy

The numbers match the 3D labs (energy-sketchbook js/lessons/ai*.js): softmax over the same
illustrative scores, the same stylised accuracy curve, the same closed-world library sources.
"""
import math

from manimlib import *

PAPER = [0.96, 0.94, 0.90, 1.0]
INK = "#2a241f"
MUTED = "#645b51"
ACCENT = "#c8402c"
GREEN = "#1f9d55"
WORD_COLORS = ["#3d7bff", "#ff7a1a", "#1fbf7a", "#a855f7", "#ff3b5c"]
FONT = "Arial"


def T(text, size=0.6, color=INK, weight=NORMAL):
    t = Text(text, font=FONT, weight=weight)
    t.scale(size)
    t.set_color(color)
    return t


def softmax(z, temp):
    s = [v / temp for v in z]
    m = max(s)
    e = [math.exp(v - m) for v in s]
    tot = sum(e)
    return [v / tot for v in e]


def tick(color=GREEN, scale=0.25):
    m = VMobject().set_points_as_corners([LEFT * 0.5 + UP * 0.05, DOWN * 0.45 + LEFT * 0.1, UP * 0.6 + RIGHT * 0.6])
    m.set_stroke(color, 8).scale(scale)
    return m


def cross(color=ACCENT, scale=0.22):
    a = Line(UL * 0.5, DR * 0.5).set_stroke(color, 8)
    b = Line(UR * 0.5, DL * 0.5).set_stroke(color, 8)
    return VGroup(a, b).scale(scale * 2)


class PaperScene(Scene):
    caption = None

    def setup(self):
        super().setup()
        self.camera.background_rgba = PAPER

    def title_card(self, title, subtitle):
        t = T(title, 1.0, INK, BOLD)
        s = T(subtitle, 0.55, MUTED).next_to(t, DOWN, buff=0.35)
        rule = Line(LEFT * 3, RIGHT * 3).set_stroke(INK, 2).next_to(s, DOWN, buff=0.3)
        self.play(Write(t), run_time=1.2)
        self.play(FadeIn(s, shift=UP * 0.2), ShowCreation(rule))
        self.wait(1.4)
        self.play(FadeOut(VGroup(t, s, rule)))

    def say(self, text, wait=2.2):
        new = T(text, 0.5, INK).to_edge(DOWN, buff=0.45)
        box = SurroundingRectangle(new, buff=0.18).set_stroke(INK, 1.5).set_fill("#fffaf0", 1)
        grp = VGroup(box, new)
        if self.caption is None:
            self.play(FadeIn(grp, shift=UP * 0.15), run_time=0.5)
        else:
            self.play(FadeOut(self.caption), FadeIn(grp), run_time=0.5)
        self.caption = grp
        self.wait(max(wait, 1.0 + 0.055 * len(text)))  # long enough to read the caption

    def end_card(self, lines):
        self.play(*[FadeOut(m) for m in self.mobjects])
        self.caption = None
        g = VGroup(*[T(l, 0.62 if i else 0.85, INK if i else ACCENT, BOLD if i == 0 else NORMAL) for i, l in enumerate(lines)]).arrange(DOWN, buff=0.35)
        self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.2) for m in g], lag_ratio=0.3))
        self.wait(3)


# ------------------------------------------------------------------ Module 1
class NextWordVideo(PaperScene):
    def bars(self, words, probs, colors=WORD_COLORS):
        group = VGroup()
        for w, p, c in zip(words, probs, colors):
            bar = Rectangle(width=0.9, height=max(0.02, 4.2 * p)).set_fill(c, 0.85).set_stroke(INK, 2)
            label = T(w, 0.45)
            pct = T(f"{round(p * 100)}%", 0.42, MUTED)
            col = VGroup(bar, label, pct)
            label.next_to(bar, DOWN, buff=0.15)
            pct.next_to(bar, UP, buff=0.1)
            group.add(col)
        group.arrange(RIGHT, buff=0.45, aligned_edge=DOWN)
        return group

    def construct(self):
        self.title_card("How a language model writes", "one word at a time, by probability")
        cat = (["mat", "sofa", "floor", "roof", "moon"], [3.2, 2.4, 2.2, 1.0, -0.8])
        sentence = T("The cat sat on the", 0.75)
        blank = Rectangle(width=1.4, height=0.6).set_stroke(INK, 2)
        line = VGroup(sentence, blank).arrange(RIGHT, buff=0.25).to_edge(UP, buff=0.7)
        self.play(Write(sentence), ShowCreation(blank))
        self.say("The model must choose the next word.", 1.6)

        bars = self.bars(cat[0], softmax(cat[1], 1.0)).move_to(DOWN * 0.3)
        self.play(LaggedStart(*[GrowFromEdge(col[0], DOWN) for col in bars], lag_ratio=0.15), *[FadeIn(VGroup(col[1], col[2])) for col in bars])
        self.say("Every possible next word gets a probability.", 2.0)
        left, right, top = bars.get_left()[0], bars.get_right()[0], bars.get_top()[1] + 0.35
        brace = VMobject().set_points_as_corners([[left, top - 0.15, 0], [left, top, 0], [right, top, 0], [right, top - 0.15, 0]]).set_stroke(INK, 3)
        total = T("together: 100%", 0.5).next_to(brace, UP, buff=0.1)
        self.play(ShowCreation(brace), FadeIn(total))
        self.say("However the bars change, they always add up to 100%.", 2.0)
        self.play(FadeOut(VGroup(brace, total)))

        # sampling: three draws, mostly the top word, once not
        self.say("Then it samples: likely words win most of the time, not always.", 0.8)
        for pick in [0, 0, 1]:
            col = bars[pick]
            word = T(cat[0][pick], 0.7, WORD_COLORS[pick]).move_to(col[0].get_top() + UP * 0.3)
            self.play(Indicate(col[0], color=WORD_COLORS[pick], scale_factor=1.08), run_time=0.6)
            self.play(word.animate.move_to(blank), run_time=0.7)
            self.wait(0.5)
            self.play(FadeOut(word), run_time=0.3)
        self.say("So the same question can get different answers.", 1.8)

        for temp, msg in [(0.3, "Low temperature: the top word becomes nearly certain."), (1.8, "High temperature: the bars even out, and surprises appear."), (1.0, "Temperature reshapes the probabilities. It does not add knowledge.")]:
            new = self.bars(cat[0], softmax(cat[1], temp)).move_to(bars)
            self.play(Transform(bars, new), run_time=1.2)
            self.say(msg, 1.8)

        cap = (["Canberra", "Sydney", "Melbourne", "Perth", "Vienna"], [2.6, 2.2, 1.2, 0.0, -1.5])
        new_sentence = T("The capital of Australia is", 0.75).move_to(sentence, aligned_edge=RIGHT)
        self.play(Transform(sentence, new_sentence))
        new = self.bars(cap[0], softmax(cap[1], 1.0)).move_to(bars)
        self.play(Transform(bars, new), run_time=1.2)
        ring = SurroundingRectangle(bars[1], buff=0.12).set_stroke(ACCENT, 4)
        self.play(ShowCreation(ring))
        self.say("Likely is not the same as true: 'Sydney' gets a big share, but the capital is Canberra.", 3.2)
        self.end_card(["Fluent text still needs checking.", "A model predicts likely words; it does not look facts up.", "Try it yourself in the 3D lab: the probability wheel."])


# ------------------------------------------------------------------ Module 2
def acc(share):
    return 0.55 + 0.42 * (1 - math.exp(-share / 0.075))


class BiasVideo(PaperScene):
    def photo_grid(self, n_night, total=20, cols=10):
        g = VGroup()
        for i in range(total):
            night = i >= total - n_night
            sq = Square(0.42).set_fill("#9fb0d6" if night else "#fff3c4", 1).set_stroke(INK, 1.5)
            g.add(sq)
        g.arrange_in_grid(n_cols=cols, buff=0.08)
        return g

    def accuracy_bar(self, label, value, color, width=5.0):
        frame = Rectangle(width=width, height=0.45).set_stroke(INK, 2)
        fill = Rectangle(width=max(0.01, width * value), height=0.45).set_fill(color, 0.85).set_stroke(width=0)
        fill.align_to(frame, LEFT)
        name = T(label, 0.45).next_to(frame, LEFT, buff=0.3)
        val = T(f"{value * 100:.1f}%", 0.45).next_to(frame, RIGHT, buff=0.25)
        return VGroup(frame, fill, name, val)

    def construct(self):
        self.title_card("Accurate for whom?", "how an average can hide a gap")
        head = T("Training photos", 0.6, INK, BOLD).to_edge(UP, buff=0.6)
        grid = self.photo_grid(1).next_to(head, DOWN, buff=0.3)
        self.play(FadeIn(head), LaggedStart(*[FadeIn(s, scale=0.8) for s in grid], lag_ratio=0.03))
        self.say("A pet-photo model learns from 95% day photos and only 5% night photos.", 2.4)

        day, night = acc(0.95), acc(0.05)
        overall = 0.7 * day + 0.3 * night
        o_bar = self.accuracy_bar("overall", overall, "#64748b").move_to(DOWN * 0.6)
        self.play(FadeIn(o_bar[0]), FadeIn(o_bar[2]), GrowFromEdge(o_bar[1], LEFT), FadeIn(o_bar[3]))
        self.say("Tested on real uploads (70% day, 30% night): about 90% overall. Looks fine...", 2.6)
        d_bar = self.accuracy_bar("day photos", day, "#f2b400").next_to(o_bar, DOWN, buff=0.35, aligned_edge=RIGHT)
        n_bar = self.accuracy_bar("night photos", night, "#3d7bff").next_to(d_bar, DOWN, buff=0.35, aligned_edge=RIGHT)
        for b in (d_bar, n_bar):
            self.play(FadeIn(b[0]), FadeIn(b[2]), GrowFromEdge(b[1], LEFT), FadeIn(b[3]), run_time=0.9)
        gap = SurroundingRectangle(n_bar, buff=0.12).set_stroke(ACCENT, 4)
        self.play(ShowCreation(gap))
        self.say("...but night photos fail about 1 time in 4. The average hid the gap.", 2.8)

        self.play(FadeOut(gap))
        new_grid = self.photo_grid(5).move_to(grid)
        self.play(Transform(grid, new_grid))
        self.say("Fix the data, not the average: make 25% of the training photos night photos.", 2.2)
        day2, night2 = acc(0.75), acc(0.25)
        overall2 = 0.7 * day2 + 0.3 * night2
        for old, (lab, v, c) in zip((o_bar, d_bar, n_bar), [("overall", overall2, "#64748b"), ("day photos", day2, "#f2b400"), ("night photos", night2, "#3d7bff")]):
            self.play(Transform(old, self.accuracy_bar(lab, v, c).move_to(old)), run_time=0.8)
        self.say("Both groups now above 95%. Adding more day photos would not have helped.", 2.6)
        self.end_card(["Ask: accurate for whom?", "Real cases: face analysis (Buolamwini & Gebru, 2018)", "and speech recognition (Koenecke et al., 2020)."])


# ------------------------------------------------------------------ Module 3
CLAIMS = [
    ("The library opens at 9 a.m. on Saturdays.", "Library Hours: Saturday 10 a.m. - 8 p.m.", "contradicted"),
    ("After 8 p.m. you must show a student ID.", "Access Rules: after 8 p.m., show a student ID.", "supported"),
    ("Guests may enter free under section 4.2 of the access policy.", "Campus Access Policy: sections 1-3 only. No section 4.", "missing"),
    ("Study rooms can be booked up to 7 days ahead.", "Access Rules: book online up to 7 days ahead.", "supported"),
]
VERDICT = {"supported": ("SUPPORTED", GREEN), "contradicted": ("CONTRADICTED", ACCENT), "missing": ("NO REAL SOURCE", "#a855f7")}


class ClaimsVideo(PaperScene):
    def construct(self):
        self.title_card("Check claim by claim", "a citation is a claim too")
        q = T("AI answer: When is the library open on Saturday?", 0.55, INK, BOLD).to_edge(UP, buff=0.5)
        cards = VGroup()
        for i, (text, _, _) in enumerate(CLAIMS):
            t = T(f"{i + 1}. {text}", 0.42)
            box = SurroundingRectangle(t, buff=0.15).set_stroke(INK, 1.5).set_fill("#fffaf0", 1)
            box.stretch_to_fit_width(9.6)
            t.align_to(box, LEFT).shift(RIGHT * 0.2)
            cards.add(VGroup(box, t))
        cards.arrange(DOWN, buff=0.18).next_to(q, DOWN, buff=0.35).to_edge(LEFT, buff=0.6)
        self.play(FadeIn(q))
        self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.3) for c in cards], lag_ratio=0.2))
        self.say("Split the answer into separate claims. Each one can be checked on its own.", 2.2)

        for i, (card, (_, source, verdict)) in enumerate(zip(cards, CLAIMS)):
            src = T(source, 0.4, MUTED)
            src_box = SurroundingRectangle(src, buff=0.15).set_stroke(MUTED, 1.5).set_fill("#eef3ff", 1)
            label = T(f"Source for claim {i + 1}:", 0.4, MUTED, BOLD)
            src_grp = VGroup(label, VGroup(src_box, src)).arrange(RIGHT, buff=0.25).next_to(cards, DOWN, buff=0.6)
            self.play(card[0].animate.set_stroke(ACCENT, 3), FadeIn(src_grp, shift=LEFT * 0.2), run_time=0.7)
            word, color = VERDICT[verdict]
            stamp = T(word, 0.42, color, BOLD)
            frame = SurroundingRectangle(stamp, buff=0.08).set_stroke(color, 3)
            mark = VGroup(frame, stamp).rotate(-0.12).move_to(card[0].get_right() + LEFT * 1.4)
            self.play(FadeIn(mark, scale=1.6), run_time=0.4)
            if verdict == "missing":
                self.say("The cited section does not exist. A precise-looking citation can be invented.", 2.6)
            elif verdict == "contradicted":
                self.say("Open the source and find the exact line: Saturday opens at 10, not 9.", 2.4)
            else:
                self.wait(0.8)
            self.play(FadeOut(src_grp), card[0].animate.set_stroke(INK, 1.5), run_time=0.4)
        self.say("Two supported, one contradicted, one with no real source. All four had citations.", 2.8)
        self.end_card(["Check each claim, not the whole answer.", "1. Split into claims   2. Find the source yourself", "3. Confirm it says the same   4. Keep, fix or drop"])


# ------------------------------------------------------------------ Module 4
PIECES = [("my name: Jordan Lee", True), ("student ID 4021-883", True), ("I have an ADHD diagnosis", True), ("my essay draft", False)]
PLACES = [("Provider servers", "#64748b"), ("Saved history", "#3d7bff"), ("Could train models", "#ff7a1a"), ("Anyone with the link", "#ff3b5c")]


class DataTrailVideo(PaperScene):
    def construct(self):
        self.title_card("Where does your prompt go?", "what you include, and where settings send it")
        lines = VGroup(*[T(text, 0.45, ACCENT if personal else INK) for text, personal in PIECES]).arrange(DOWN, aligned_edge=LEFT, buff=0.2)
        head = T("Prompt: please give feedback on", 0.45, INK, BOLD)
        prompt = VGroup(head, lines).arrange(DOWN, aligned_edge=LEFT, buff=0.25)
        frame = SurroundingRectangle(prompt, buff=0.3).set_stroke(INK, 2).set_fill("#fffaf0", 1)
        card = VGroup(frame, prompt).to_edge(LEFT, buff=0.6).shift(UP * 0.6)
        self.play(FadeIn(card, shift=RIGHT * 0.3))
        boxes = VGroup()
        for name, color in PLACES:
            b = RoundedRectangle(width=2.6, height=1.0, corner_radius=0.12).set_stroke(color, 3).set_fill(color, 0.08)
            t = T(name, 0.4).move_to(b)
            n = T("0 personal", 0.36, MUTED).next_to(b, DOWN, buff=0.08)
            boxes.add(VGroup(b, t, n))
        boxes.arrange_in_grid(n_rows=2, n_cols=2, buff=0.5).to_edge(RIGHT, buff=0.6).shift(UP * 0.5)
        self.play(LaggedStart(*[FadeIn(b) for b in boxes], lag_ratio=0.15))
        self.say("Everything in a prompt is processed on the provider's servers.", 2.0)

        def send(personal_count, routes, msg):
            dots = []
            for k in routes:
                target = boxes[k]
                for i in range(personal_count):
                    d = Dot(radius=0.07).set_fill(ACCENT, 1).move_to(card.get_right())
                    dots.append((d, target))
            anims = [d.animate.move_to(t[0].get_center() + RIGHT * (0.15 * (j % 3) - 0.15)) for j, (d, t) in enumerate(dots)]
            if dots:
                self.add(*[d for d, _ in dots])
                self.play(LaggedStart(*anims, lag_ratio=0.05), run_time=1.6)
            for k in range(4):
                n = personal_count if k in routes else 0
                new = T(f"{n} personal", 0.36, ACCENT if n else MUTED).move_to(boxes[k][2])
                self.play(Transform(boxes[k][2], new), run_time=0.25)
            self.say(msg, 2.6)
            self.play(*[FadeOut(d) for d, _ in dots]) if dots else None

        send(3, [0, 1, 2, 3], "With history, training and a share link on: three personal details, copied to four places.")
        self.say("Deleting the chat from your list may not remove every copy.", 2.2)

        removed = VGroup(*[T("[removed]", 0.45, MUTED) for _ in range(3)])
        for r, l in zip(removed, lines[:3]):
            r.move_to(l, aligned_edge=LEFT)
        self.play(*[Transform(l, r) for l, r in zip(lines[:3], removed)])
        self.play(*[boxes[k].animate.set_opacity(0.25) for k in (2, 3)])
        self.say("Leave personal details out. Turn off training and sharing where you can.", 2.2)
        send(0, [0, 1], "Same help with the essay, and no personal details anywhere.")
        self.end_card(["Share only what the task needs.", "Check each tool's settings and your university's approved tools.", "Try it yourself in the 3D lab: your data trail."])
