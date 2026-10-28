"""ManimGL source for the four AI Literacy module videos: narrated, pen-annotated mini-lectures.

A pen cursor draws every annotation (rough circles, underlines, arrows, strike-throughs and
handwritten notes in Ink Free) while the narration plays. Narration clips in narration/vN_bM.mp3
are made by make_narration.py with Kokoro (open-source TTS) from narration_script.json;
durations.json drives the timing so each beat waits for its narration to finish, and each render
also writes WebVTT captions next to the video.

Render (ManimGL 1.7):
    manimgl ai_literacy_videos.py NextWordVideo BiasVideo ClaimsVideo DataTrailVideo -w --hd \
        --video_dir ../frontend/public/media/ai-literacy

The numbers match the 3D labs (energy-sketchbook js/lessons/ai*.js).
"""
import json
import math
import random
from pathlib import Path

from manimlib import *

HERE = Path(__file__).resolve().parent
NARRATION = HERE / "narration"
DUR = json.loads((NARRATION / "durations.json").read_text(encoding="utf-8-sig"))
SCRIPT = json.loads((HERE / "narration_script.json").read_text(encoding="utf-8"))

PAPER = [0.96, 0.94, 0.90, 1.0]
INK = "#2a241f"
MUTED = "#645b51"
RED = "#c8402c"
GREEN = "#1f9d55"
BLUE = "#2f6fd6"
WORD_COLORS = ["#3d7bff", "#ff7a1a", "#1fbf7a", "#a855f7", "#ff3b5c"]
FONT = "Arial"
HAND = "Ink Free"


def T(text, size=0.6, color=INK, weight=NORMAL, font=FONT):
    t = Text(text, font=font, weight=weight)
    t.scale(size)
    t.set_color(color)
    return t


def H(text, size=0.8, color=RED):
    """Handwritten note."""
    return T(text, size, color, font=HAND)


def softmax(z, temp):
    s = [v / temp for v in z]
    m = max(s)
    e = [math.exp(v - m) for v in s]
    tot = sum(e)
    return [v / tot for v in e]


def acc(share):
    return 0.55 + 0.42 * (1 - math.exp(-share / 0.075))


# ---------------------------------------------------------------- rough, hand-drawn strokes
RNG = random.Random(7)


def jitter(points, amount=0.025):
    return [p + np.array([RNG.uniform(-amount, amount), RNG.uniform(-amount, amount), 0]) for p in points]


def stroke(points, color=RED, width=5, corners=False):
    m = VMobject()
    if corners:
        m.set_points_as_corners(jitter(points, 0.012))
    else:
        m.set_points_smoothly(jitter(points))
    m.set_stroke(color, width)
    m.set_fill(opacity=0)
    return m


def rough_circle(mob, color=RED, pad=0.22, turns=1.12):
    c, w, h = mob.get_center(), mob.get_width() / 2 + pad, mob.get_height() / 2 + pad
    n, start = 48, 2.3
    pts = [c + np.array([w * math.cos(start - turns * 2 * math.pi * i / n), h * math.sin(start - turns * 2 * math.pi * i / n), 0]) for i in range(n + 1)]
    return stroke(pts, color)


def rough_underline(mob, color=RED, gap=0.12):
    l, r = mob.get_corner(DL) + DOWN * gap, mob.get_corner(DR) + DOWN * gap
    mid = (l + r) / 2 + DOWN * 0.05
    return stroke([l + LEFT * 0.05, mid, r + RIGHT * 0.08], color)


def rough_strike(mob, color=RED):
    l, r = mob.get_left() + LEFT * 0.08, mob.get_right() + RIGHT * 0.08
    return stroke([l + DOWN * 0.03, (l + r) / 2 + UP * 0.04, r + DOWN * 0.02], color)


def rough_arrow(start, end, color=RED, bend=0.35):
    start, end = np.array(start, dtype=float), np.array(end, dtype=float)
    d = end - start
    normal = np.array([-d[1], d[0], 0]) / (np.linalg.norm(d) + 1e-9)
    mid = (start + end) / 2 + normal * bend
    shaft = stroke([start, mid, end], color)
    back = -d / (np.linalg.norm(d) + 1e-9)
    left = end + 0.25 * (back * math.cos(0.5) + normal * math.sin(0.5))
    right = end + 0.25 * (back * math.cos(0.5) - normal * math.sin(0.5))
    head = stroke([left, end, right], color)
    return VGroup(shaft, head)


def rough_tick(point, color=GREEN, size=0.3):
    p = np.array(point, dtype=float)
    return stroke([p + np.array([-size, 0.05, 0]), p + np.array([-size * 0.35, -size * 0.55, 0]), p + np.array([size * 0.9, size * 0.8, 0])], color, 6)


def rough_bracket(mob, color=RED, gap=0.3):
    l, r, top = mob.get_left()[0], mob.get_right()[0], mob.get_top()[1] + gap
    return stroke([[l, top - 0.2, 0], [l + 0.05, top, 0], [(l + r) / 2, top + 0.05, 0], [r - 0.05, top, 0], [r, top - 0.2, 0]], color)


def make_pen():
    """A pen whose nib tip is submobject 0, so the pen can be placed by its tip."""
    tip = Dot(radius=0.001).set_opacity(0)
    nib = Polygon(ORIGIN, [0.09, 0.28, 0], [-0.09, 0.28, 0]).set_fill("#3a3330", 1).set_stroke(INK, 1.5)
    body = Rectangle(width=0.2, height=1.25).set_fill("#f2ead8", 1).set_stroke(INK, 2).move_to([0, 0.28 + 0.625, 0])
    band = Rectangle(width=0.2, height=0.12).set_fill(RED, 1).set_stroke(INK, 1.5).move_to([0, 0.42, 0])
    cap = Rectangle(width=0.2, height=0.3).set_fill(INK, 1).set_stroke(INK, 1.5).move_to([0, 1.38, 0])
    pen = VGroup(tip, nib, body, band, cap)
    pen.rotate(-0.45, about_point=ORIGIN)
    return pen


class Lecture(Scene):
    VID = "v1"

    def setup(self):
        super().setup()
        self.camera.background_rgba = PAPER
        self.pen = make_pen()
        self.pen.move_to(np.array([7.5, -4.5, 0]))  # parked off-screen
        self.add(self.pen)
        self.beat_end = 0.0
        self.cues = []
        self.marks = []  # pen annotations, cleared together with clear_marks()

    # --- narration timing
    def beat(self, n):
        key = f"{self.VID}_b{n}"
        self.add_sound(str(NARRATION / f"{key}.mp3"))
        self.cues.append((self.time, self.time + DUR[key], SCRIPT[self.VID][n - 1]))
        self.beat_end = self.time + DUR[key] + 0.45

    def tear_down(self):
        """Write WebVTT captions from the narration script and the actual beat start times."""
        def ts(t):
            return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}"
        lines = ["WEBVTT", ""]
        for i, (a, b, text) in enumerate(self.cues, start=1):
            lines += [str(i), f"{ts(a)} --> {ts(b)}", text, ""]
        out = HERE.parent / "frontend" / "public" / "media" / "ai-literacy" / f"{type(self).__name__}.vtt"
        out.write_text("\n".join(lines), encoding="utf-8")
        super().tear_down()

    def settle(self):
        rest = self.beat_end - self.time
        if rest > 0.02:
            self.wait(rest)

    # --- pen helpers
    def pen_to(self, point, run_time=0.35):
        point = np.array(point, dtype=float)
        self.bring_to_front(self.pen)
        self.play(self.pen.animate.shift(point - self.pen[0].get_center()), run_time=run_time)

    def draw(self, *strokes, run_time=0.8, mark=True):
        """Draw strokes one after another with the pen tip following each."""
        for s in strokes:
            if mark:
                self.marks.append(s)
            parts = s.submobjects if isinstance(s, VGroup) and len(s.submobjects) else [s]
            for part in parts:
                self.pen_to(part.get_start(), 0.25)
                self.add(part)
                pen = self.pen

                def follow(m, a, part=part):
                    m.shift(part.point_from_proportion(min(a, 0.999)) - m[0].get_center())

                self.bring_to_front(pen)
                self.play(ShowCreation(part), UpdateFromAlphaFunc(pen, follow), run_time=run_time * (0.6 if len(parts) > 1 else 1))

    def write(self, text_mob, run_time=None, mark=True):
        """Write a (handwritten) text with the pen moving along it."""
        if mark:
            self.marks.append(text_mob)
        run_time = run_time or max(0.6, 0.06 * len(text_mob.submobjects))
        a = text_mob.get_corner(DL) + UP * text_mob.get_height() * 0.35
        b = text_mob.get_corner(DR) + UP * text_mob.get_height() * 0.35
        self.pen_to(a, 0.25)

        def follow(m, t):
            m.shift(a + (b - a) * t - m[0].get_center())

        self.bring_to_front(self.pen)
        self.play(Write(text_mob), UpdateFromAlphaFunc(self.pen, follow), run_time=run_time)

    def clear_marks(self, run_time=0.35):
        marks = [m for m in self.marks if m in self.mobjects or any(p in self.mobjects for p in m.get_family())]
        self.marks = []
        if marks:
            self.play(*[FadeOut(m) for m in marks], run_time=run_time)

    def park(self):
        self.play(self.pen.animate.shift(np.array([7.5, -4.5, 0]) - self.pen[0].get_center()), run_time=0.4)

    def clear(self, keep=()):
        self.marks = []
        out = [m for m in self.mobjects if m is not self.pen and m not in keep]
        if out:
            self.play(*[FadeOut(m) for m in out], run_time=0.5)

    def end_card(self, big, lines):
        self.clear()
        title = H(big, 1.25, RED).shift(UP * 1.2)
        self.write(title, 1.2)
        self.draw(rough_underline(title), run_time=0.5)
        g = VGroup(*[T(l, 0.62) for l in lines]).arrange(DOWN, buff=0.3).next_to(title, DOWN, buff=0.8)
        self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.15) for m in g], lag_ratio=0.35))
        self.park()


# ---------------------------------------------------------------- Module 1: how a language model writes
class NextWordVideo(Lecture):
    VID = "v1"

    def bars(self, words, probs):
        group = VGroup()
        for w, p, c in zip(words, probs, WORD_COLORS):
            bar = Rectangle(width=0.95, height=max(0.03, 3.6 * p)).set_fill(c, 0.85).set_stroke(INK, 2)
            label = T(w, 0.45)
            pct = T(f"{round(p * 100)}%", 0.4, MUTED)
            label.next_to(bar, DOWN, buff=0.15)
            pct.next_to(bar, UP, buff=0.1)
            group.add(VGroup(bar, label, pct))
        group.arrange(RIGHT, buff=0.5, aligned_edge=DOWN)
        return group

    def construct(self):
        cat = (["mat", "sofa", "floor", "roof", "moon"], [3.2, 2.4, 2.2, 1.0, -0.8])

        self.beat(1)
        q = H("Same question twice:", 1.0, INK).shift(UP * 0.6)
        q2 = H("same answer?", 1.25, RED).next_to(q, DOWN, buff=0.35)
        self.write(q, 1.4)
        self.write(q2, 1.0)
        self.draw(rough_circle(q2), run_time=0.8)
        self.settle()

        self.beat(2)
        self.clear()
        sentence = T("The cat sat on the", 0.8)
        blank = Rectangle(width=1.6, height=0.65).set_stroke(INK, 2)
        line = VGroup(sentence, blank).arrange(RIGHT, buff=0.3).to_edge(UP, buff=0.6)
        self.play(FadeIn(sentence, shift=RIGHT * 0.2))
        self.draw(stroke([blank.get_corner(UL), blank.get_corner(UR), blank.get_corner(DR), blank.get_corner(DL), blank.get_corner(UL)], INK, 3, corners=True), run_time=0.9, mark=False)
        note = H("next word?", 0.75).next_to(blank, DOWN, buff=0.35)
        self.write(note, 0.8)
        self.settle()

        self.beat(3)
        bars = self.bars(cat[0], softmax(cat[1], 1.0)).shift(DOWN * 0.9)
        self.clear_marks()
        self.play(LaggedStart(*[GrowFromEdge(c[0], DOWN) for c in bars], lag_ratio=0.12), *[FadeIn(c[1]) for c in bars], *[FadeIn(c[2]) for c in bars], run_time=1.4)
        self.add(bars)
        prob = H("probabilities", 0.75).next_to(bars, LEFT, buff=0.4).shift(UP * 1.2)
        self.write(prob, 0.8)
        self.draw(rough_arrow(prob.get_bottom() + DOWN * 0.1, bars[0][0].get_left() + LEFT * 0.1 + UP * 0.6, bend=0.3), run_time=0.5)
        self.settle()

        self.beat(4)
        self.draw(rough_circle(bars[0][1], RED, pad=0.15), run_time=0.6)
        self.wait(1.4)
        self.draw(rough_circle(bars[4][0], MUTED, pad=0.12), run_time=0.5)
        self.wait(1.3)
        br = rough_bracket(bars, RED, 0.75)
        self.draw(br, run_time=0.8)
        total = H("= 100%", 0.85).next_to(br, UP, buff=0.1)
        self.write(total, 0.6)
        self.settle()

        self.beat(5)
        self.clear_marks()
        for pick in [0, 0, 1]:
            col = bars[pick]
            word = T(cat[0][pick], 0.7, WORD_COLORS[pick]).move_to(col[0].get_top() + UP * 0.35)
            self.play(Indicate(col[0], color=WORD_COLORS[pick], scale_factor=1.06), run_time=0.45)
            self.play(word.animate.move_to(blank), run_time=0.55)
            if pick == 1:
                self.last_word = word
            else:
                self.play(FadeOut(word), run_time=0.2)
        self.settle()

        self.beat(6)
        self.draw(rough_underline(blank, RED, 0.15), run_time=0.5)
        diff = H("a different answer", 0.75).next_to(blank, RIGHT, buff=0.35).shift(DOWN * 0.1)
        self.write(diff, 0.9)
        self.settle()

        self.beat(7)
        self.marks.append(self.last_word)
        self.clear_marks()
        dial = H("temperature", 0.8, BLUE).to_edge(LEFT, buff=0.6).shift(UP * 0.4)
        self.write(dial, 0.8)
        for temp, label, hold in [(0.3, "low: top word takes over", 2.4), (1.8, "high: bars even out", 2.4), (1.0, "", 0.0)]:
            new = self.bars(cat[0], softmax(cat[1], temp)).move_to(bars, aligned_edge=DOWN)
            self.play(Transform(bars, new), run_time=0.9)
            if label:
                n = H(label, 0.6, BLUE).next_to(dial, DOWN, buff=0.25, aligned_edge=LEFT)
                self.write(n, 0.7, mark=False)
                self.wait(hold - 0.7)
                self.play(FadeOut(n), run_time=0.3)
        self.settle()

        self.beat(8)
        self.clear_marks()
        cap = (["Canberra", "Sydney", "Melbourne", "Perth", "Vienna"], [2.6, 2.2, 1.2, 0.0, -1.5])
        new_sentence = T("The capital of Australia is", 0.8).move_to(sentence, aligned_edge=RIGHT)
        self.play(Transform(sentence, new_sentence), Transform(bars, self.bars(cap[0], softmax(cap[1], 1.0)).move_to(bars, aligned_edge=DOWN)), run_time=1.0)
        self.wait(1.5)
        self.draw(rough_circle(bars[1], RED, pad=0.18), run_time=0.7)
        likely = H("likely...", 0.7).next_to(bars[1], UP, buff=0.9)
        self.write(likely, 0.6)
        self.wait(1.6)
        self.draw(rough_strike(bars[1][1]), run_time=0.4)
        true = H("true: Canberra", 0.7, GREEN).next_to(bars[0], UP, buff=1.4).shift(LEFT * 0.6)
        self.write(true, 0.8)
        self.draw(rough_tick(bars[0][0].get_top() + UP * 0.45 + RIGHT * 0.1), run_time=0.4)
        self.settle()

        self.beat(9)
        self.end_card("likely ≠ true", ["A model predicts likely words; it does not look facts up.", "Fluent answers still need checking.", "Try it: the probability wheel lab."])
        self.settle()


# ---------------------------------------------------------------- Module 2: accurate for whom?
class BiasVideo(Lecture):
    VID = "v2"

    def grid(self, n_night, total=20):
        g = VGroup(*[Square(0.42).set_fill("#9fb0d6" if i >= total - n_night else "#fff3c4", 1).set_stroke(INK, 1.5) for i in range(total)])
        g.arrange_in_grid(n_cols=10, buff=0.08)
        return g

    def bar(self, label, value, color, width=5.2):
        frame = Rectangle(width=width, height=0.45).set_stroke(INK, 2)
        fill = Rectangle(width=max(0.01, width * value), height=0.45).set_fill(color, 0.85).set_stroke(width=0).align_to(frame, LEFT)
        name = T(label, 0.45).next_to(frame, LEFT, buff=0.3)
        val = T(f"{value * 100:.0f}%", 0.45).next_to(frame, RIGHT, buff=0.25)
        return VGroup(frame, fill, name, val)

    def construct(self):
        self.beat(1)
        claim = H("\"90% accurate!\"", 1.2, INK).shift(UP * 0.5)
        self.write(claim, 1.3)
        self.wait(2.0)
        self.draw(rough_circle(claim, RED), run_time=0.8)
        whom = H("...for whom?", 1.0).next_to(claim, DOWN, buff=0.5)
        self.write(whom, 0.9)
        self.settle()

        self.beat(2)
        self.clear()
        head = T("Training photos", 0.6, INK, BOLD).to_edge(UP, buff=0.5)
        grid = self.grid(1).next_to(head, DOWN, buff=0.3)
        self.play(FadeIn(head), LaggedStart(*[FadeIn(s, scale=0.8) for s in grid], lag_ratio=0.03), run_time=1.3)
        self.wait(1.2)
        self.draw(rough_circle(grid[-1], RED, pad=0.15), run_time=0.6)
        one = H("1 in 20 at night", 0.65).next_to(grid, RIGHT, buff=0.3).shift(DOWN * 0.6)
        self.write(one, 0.9)
        self.settle()

        self.beat(3)
        test = H("test: real uploads, 30% at night", 0.7, BLUE).next_to(grid, DOWN, buff=0.5)
        self.write(test, 1.4)
        self.settle()

        day, night = acc(0.95), acc(0.05)
        overall = 0.7 * day + 0.3 * night
        self.beat(4)
        self.clear_marks()
        ob = self.bar("overall", overall, "#64748b").move_to(DOWN * 0.7)
        self.play(FadeIn(ob[0]), FadeIn(ob[2]), GrowFromEdge(ob[1], LEFT), FadeIn(ob[3]))
        avg = H("the average", 0.6).next_to(ob, RIGHT, buff=0.3).shift(UP * 0.45)
        self.write(avg, 0.7)
        self.settle()

        self.beat(5)
        db = self.bar("day photos", day, "#f2b400").next_to(ob, DOWN, buff=0.35, aligned_edge=RIGHT)
        nb = self.bar("night photos", night, "#3d7bff").next_to(db, DOWN, buff=0.35, aligned_edge=RIGHT)
        for b in (db, nb):
            self.play(FadeIn(b[0]), FadeIn(b[2]), GrowFromEdge(b[1], LEFT), FadeIn(b[3]), run_time=0.8)
        self.draw(rough_circle(nb[1:], RED, pad=0.15), run_time=0.7)
        gap = H("the gap!", 0.75).next_to(nb, RIGHT, buff=0.35)
        self.write(gap, 0.6)
        self.settle()

        self.beat(6)
        self.clear_marks()
        more = H("more day photos?", 0.65, MUTED).next_to(grid, RIGHT, buff=0.3).shift(UP * 0.1)
        self.write(more, 0.8)
        self.draw(rough_strike(more), run_time=0.4)
        self.wait(1.2)
        self.play(Transform(grid, self.grid(5).move_to(grid)), run_time=1.0)
        quarter = H("25% night photos", 0.65, GREEN).next_to(grid, RIGHT, buff=0.3).shift(DOWN * 0.55)
        self.write(quarter, 0.8)
        self.settle()

        self.beat(7)
        day2, night2 = acc(0.75), acc(0.25)
        for old, (lab, v, c) in zip((ob, db, nb), [("overall", 0.7 * day2 + 0.3 * night2, "#64748b"), ("day photos", day2, "#f2b400"), ("night photos", night2, "#3d7bff")]):
            self.play(Transform(old, self.bar(lab, v, c).move_to(old)), run_time=0.45)
        self.draw(rough_tick(nb.get_right() + RIGHT * 0.5), run_time=0.3)
        self.settle()

        self.beat(8)
        self.end_card("accurate for whom?", ["Ask for results broken down by group.", "Real cases: face analysis (Buolamwini & Gebru, 2018)", "and speech recognition (Koenecke et al., 2020)."])
        self.settle()


# ---------------------------------------------------------------- Module 3: check claim by claim
CLAIMS = [
    ("The library opens at 9 a.m. on Saturdays.", "Library Hours: Saturday 10 a.m. - 8 p.m.", "CONTRADICTED", RED),
    ("After 8 p.m. you must show a student ID.", "Access Rules: after 8 p.m., show a student ID.", "SUPPORTED", GREEN),
    ("Guests may enter free under section 4.2 of the access policy.", "Campus Access Policy: sections 1-3 only.", "NO REAL SOURCE", "#a855f7"),
    ("Study rooms can be booked up to 7 days ahead.", "Access Rules: book online up to 7 days ahead.", "SUPPORTED", GREEN),
]


class ClaimsVideo(Lecture):
    VID = "v3"

    def construct(self):
        self.beat(1)
        a = H("Every sentence has a citation.", 0.95, INK).shift(UP * 0.5)
        b = H("Can you trust it?", 1.1).next_to(a, DOWN, buff=0.5)
        self.write(a, 1.4)
        self.write(b, 0.9)
        self.settle()

        self.beat(2)
        self.clear()
        q = T("AI answer: When is the library open on Saturday?", 0.55, INK, BOLD).to_edge(UP, buff=0.45)
        cards = VGroup()
        for i, (text, *_rest) in enumerate(CLAIMS):
            t = T(f"{i + 1}. {text}", 0.42)
            box = SurroundingRectangle(t, buff=0.15).set_stroke(INK, 1.5).set_fill("#fffaf0", 1)
            box.stretch_to_fit_width(9.0)
            t.align_to(box, LEFT).shift(RIGHT * 0.2)
            cards.add(VGroup(box, t))
        cards.arrange(DOWN, buff=0.18).next_to(q, DOWN, buff=0.35).to_edge(LEFT, buff=0.7)
        self.play(FadeIn(q), LaggedStart(*[FadeIn(c, shift=RIGHT * 0.3) for c in cards], lag_ratio=0.2), run_time=1.6)
        left = cards.get_left() + LEFT * 0.2
        self.draw(stroke([cards.get_corner(UL) + LEFT * 0.12 + RIGHT * 0.1, cards.get_corner(UL) + LEFT * 0.2, cards.get_corner(DL) + LEFT * 0.2, cards.get_corner(DL) + LEFT * 0.12 + RIGHT * 0.1], RED), run_time=0.7)
        split = H("4 claims", 0.7).next_to(cards, DOWN, buff=0.35).align_to(cards, LEFT)
        self.write(split, 0.6)
        self.settle()

        stamps = []
        for i, (card, (text, source, verdict, color)) in enumerate(zip(cards, CLAIMS)):
            self.beat(3 + i)
            if i == 0:
                self.play(FadeOut(split), run_time=0.3)
            src = T(source, 0.42, MUTED)
            box = SurroundingRectangle(src, buff=0.15).set_stroke(MUTED, 1.5).set_fill("#eef3ff", 1)
            label = T(f"Source for claim {i + 1}:", 0.4, MUTED, BOLD)
            grp = VGroup(label, VGroup(box, src)).arrange(RIGHT, buff=0.25).next_to(cards, DOWN, buff=0.7)
            self.draw(rough_underline(card[1], RED, 0.06), run_time=0.5)
            keep = len(self.marks)  # the card underline stays; source-side notes go with the source
            self.play(FadeIn(grp, shift=UP * 0.2), run_time=0.5)
            if i == 2:
                cite = H("section 4.2 ?", 0.65).next_to(card, RIGHT, buff=0.25)
                self.write(cite, 0.6)
                self.wait(2.0)
                self.draw(rough_circle(src, RED, pad=0.15), run_time=0.6)
                self.draw(rough_strike(cite), run_time=0.35)
            elif i == 0:
                self.wait(1.6)
                self.draw(rough_circle(src, RED, pad=0.15), run_time=0.6)
            else:
                self.wait(0.8)
                self.draw(rough_tick(box.get_right() + RIGHT * 0.4), run_time=0.35)
            st = T(verdict, 0.42, color, BOLD)
            frame = SurroundingRectangle(st, buff=0.08).set_stroke(color, 3)
            stamp = VGroup(frame, st).rotate(-0.12).move_to(card[0].get_right() + LEFT * 1.4)
            self.play(FadeIn(stamp, scale=1.6), run_time=0.35)
            stamps.append(stamp)
            self.settle()
            temp, self.marks = self.marks[keep:], self.marks[:keep]
            self.play(FadeOut(grp), *[FadeOut(m) for m in temp], run_time=0.3)

        self.beat(7)
        self.draw(rough_circle(cards, RED, pad=0.3, turns=1.05), run_time=0.9)
        too = H("a citation is a claim too", 0.85).next_to(cards, DOWN, buff=0.6)
        self.write(too, 1.2)
        self.settle()

        self.beat(8)
        self.end_card("check each claim", ["1. Split the answer into claims.   2. Find each source yourself.", "3. Confirm it says the same thing.   4. Keep, fix or drop.", "Practice: the claim-checking lab."])
        self.settle()


# ---------------------------------------------------------------- Module 4: your data trail
PIECES = [("my name: Jordan Lee", True), ("student ID 4021-883", True), ("I have an ADHD diagnosis", True), ("my essay draft", False)]
PLACES = [("Provider servers", "#64748b"), ("Saved history", "#3d7bff"), ("Could train models", "#ff7a1a"), ("Anyone with the link", "#ff3b5c")]


class DataTrailVideo(Lecture):
    VID = "v4"

    def construct(self):
        self.beat(1)
        q = H("Where does your prompt go?", 1.1, INK)
        self.write(q, 1.6)
        self.draw(rough_underline(q), run_time=0.5)
        self.settle()

        self.beat(2)
        self.clear()
        lines = VGroup(*[T(text, 0.45, INK) for text, _ in PIECES]).arrange(DOWN, aligned_edge=LEFT, buff=0.22)
        head = T("Prompt: please give feedback on", 0.45, INK, BOLD)
        prompt = VGroup(head, lines).arrange(DOWN, aligned_edge=LEFT, buff=0.25)
        frame = SurroundingRectangle(prompt, buff=0.3).set_stroke(INK, 2).set_fill("#fffaf0", 1)
        card = VGroup(frame, prompt).to_edge(LEFT, buff=0.6).shift(UP * 0.4)
        self.play(FadeIn(card, shift=RIGHT * 0.3), run_time=0.7)
        self.wait(1.4)
        self.draw(rough_circle(lines[:3], RED, pad=0.12), run_time=0.9)
        pers = H("personal", 0.65).next_to(lines[:3], RIGHT, buff=0.35)
        self.write(pers, 0.6)
        self.settle()

        self.beat(3)
        self.play(FadeOut(pers), run_time=0.3)
        boxes = VGroup()
        for name, color in PLACES:
            b = RoundedRectangle(width=2.7, height=1.0, corner_radius=0.12).set_stroke(color, 3).set_fill(color, 0.08)
            t = T(name, 0.4).move_to(b)
            n = T("0 personal", 0.36, MUTED).next_to(b, DOWN, buff=0.08)
            boxes.add(VGroup(b, t, n))
        boxes.arrange_in_grid(n_rows=2, n_cols=2, buff=0.55).to_edge(RIGHT, buff=0.55).shift(UP * 0.4)
        self.play(FadeIn(boxes[0]), run_time=0.5)
        self.draw(rough_arrow(card.get_right() + RIGHT * 0.1, boxes[0][0].get_left() + LEFT * 0.1, RED, 0.3), run_time=0.6)
        self.wait(1.2)
        for k in (1, 2, 3):
            self.play(FadeIn(boxes[k]), run_time=0.4)
            self.draw(rough_arrow(boxes[0][0].get_bottom() + DOWN * 0.05 if k != 1 else boxes[0][0].get_right(), boxes[k][0].get_left() + LEFT * 0.05 if k != 2 else boxes[k][0].get_top(), MUTED, 0.2), run_time=0.45)
            self.wait(0.6)
        self.settle()

        self.beat(4)
        dots = []
        for k in range(4):
            for j in range(3):
                d = Dot(radius=0.07).set_fill(RED, 1).move_to(card.get_right())
                dots.append((d, boxes[k][0].get_center() + RIGHT * (0.25 * j - 0.25) + DOWN * 0.25))
        self.add(*[d for d, _ in dots])
        self.play(LaggedStart(*[d.animate.move_to(p) for d, p in dots], lag_ratio=0.05), run_time=1.8)
        self.play(*[Transform(boxes[k][2], T("3 personal", 0.36, RED).move_to(boxes[k][2])) for k in range(4)], run_time=0.4)
        count = H("3 details x 4 places", 0.7).next_to(boxes, DOWN, buff=0.45)
        self.write(count, 0.9)
        self.settle()

        self.beat(5)
        self.play(FadeOut(count), *[FadeOut(d) for d, _ in dots], run_time=0.4)
        for l in lines[:3]:
            self.draw(rough_strike(l), run_time=0.35)
        self.play(*[Transform(l, T("[removed]", 0.45, MUTED).move_to(l, aligned_edge=LEFT)) for l in lines[:3]], run_time=0.6)
        for k in (2, 3):
            self.draw(VGroup(stroke([boxes[k][0].get_corner(UL), boxes[k][0].get_corner(DR)], RED), stroke([boxes[k][0].get_corner(UR), boxes[k][0].get_corner(DL)], RED)), run_time=0.5)
        self.settle()

        self.beat(6)
        self.play(*[Transform(boxes[k][2], T("0 personal", 0.36, GREEN).move_to(boxes[k][2])) for k in range(4)], run_time=0.4)
        self.draw(rough_tick(card.get_bottom() + DOWN * 0.4), run_time=0.35)
        self.settle()

        self.beat(7)
        self.end_card("share only what's needed", ["Check each tool's settings and terms.", "Prefer tools your university has approved.", "Try it: the data trail lab."])
        self.settle()
