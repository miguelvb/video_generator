from __future__ import annotations

import math
import os

from manim import *


SCENE_ID = os.environ.get("VIDEO_ANIMATION_SCENE_ID", "000")
ANIMATION_TYPE = os.environ.get("VIDEO_ANIMATION_TYPE", "network").lower()
DURATION = float(os.environ.get("VIDEO_ANIMATION_DURATION", "8"))
FPS = int(os.environ.get("VIDEO_ANIMATION_FPS", "30"))


class GeneratedScene(Scene):
    def construct(self):
        self.camera.background_color = "#f2eadb"

        if ANIMATION_TYPE in {"graph", "curve", "math"}:
            self.render_graph()
        else:
            self.render_network()

        self.wait(max(0.1, DURATION - 3.0))

    def render_network(self):
        nodes = VGroup()
        positions = [
            LEFT * 5.2 + UP * 1.8,
            LEFT * 2.6 + UP * 2.4,
            ORIGIN + UP * 1.2,
            RIGHT * 2.8 + UP * 2.2,
            RIGHT * 5.0 + UP * 0.4,
            LEFT * 3.8 + DOWN * 1.5,
            LEFT * 0.9 + DOWN * 2.2,
            RIGHT * 1.8 + DOWN * 1.4,
            RIGHT * 4.4 + DOWN * 2.0,
        ]
        for pos in positions:
            nodes.add(Dot(pos, radius=0.11, color="#25334a"))

        edges = VGroup()
        for a, b in [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(2,6),(2,7),(3,7),(4,8),(7,8)]:
            edges.add(Line(positions[a], positions[b], color="#496b7a", stroke_width=3))

        title = Text(
            f"AGENT NETWORK — {SCENE_ID}",
            font="DejaVu Sans",
            font_size=0.36,
            color="#2f2a24",
        ).to_edge(UP, buff=0.35)

        self.play(FadeIn(title, run_time=0.5))
        self.play(
            LaggedStart(
                *[Create(edge) for edge in edges],
                lag_ratio=0.06,
                run_time=1.5,
            )
        )
        self.play(
            LaggedStart(
                *[GrowFromCenter(node) for node in nodes],
                lag_ratio=0.08,
                run_time=1.0,
            )
        )

        pulses = VGroup()
        for idx in [1, 2, 3, 6, 7]:
            pulse = Circle(radius=0.24, color="#6c8b7b", stroke_width=2).move_to(nodes[idx])
            pulses.add(pulse)
        self.play(
            LaggedStart(*[Create(p) for p in pulses], lag_ratio=0.12, run_time=1.0)
        )
        self.play(
            LaggedStart(*[FadeOut(p) for p in pulses], lag_ratio=0.12, run_time=0.7)
        )

    def render_graph(self):
        axes = Axes(
            x_range=[0, 10, 1],
            y_range=[0, 100, 20],
            x_length=9.5,
            y_length=4.8,
            axis_config={"color": "#4b463f", "stroke_width": 2},
            tips=False,
        ).shift(DOWN * 0.25)
        curve = axes.plot(
            lambda x: 4 * x**2 + 2 * x + 5,
            x_range=[0, 4.7],
            color="#496b7a",
            stroke_width=5,
        )
        label = Text(
            "ACTIVIDAD DEL SISTEMA",
            font="DejaVu Sans",
            font_size=0.36,
            color="#2f2a24",
        ).to_edge(UP, buff=0.35)

        self.play(FadeIn(label, run_time=0.5))
        self.play(Create(axes), run_time=0.8)
        self.play(Create(curve), run_time=2.0)
