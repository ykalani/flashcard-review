from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

QUALITY_FORGOT = 0
QUALITY_HARD = 1
QUALITY_GOOD = 2
QUALITY_EASY = 3

QUALITY_LABELS = {
    QUALITY_FORGOT: "Forgot",
    QUALITY_HARD: "Hard",
    QUALITY_GOOD: "Good",
    QUALITY_EASY: "Easy",
}

QUALITY_COLORS = {
    QUALITY_FORGOT: "#ef4444",
    QUALITY_HARD: "#f97316",
    QUALITY_GOOD: "#22c55e",
    QUALITY_EASY: "#3b82f6",
}

MINUTES_1 = timedelta(minutes=1)
MINUTES_10 = timedelta(minutes=10)
MINUTES_1440 = timedelta(minutes=1440)

def next_review(current_interval: timedelta, ease_factor: float, quality: int) -> timedelta:
    if quality == QUALITY_FORGOT:
        return MINUTES_1
    if quality == QUALITY_HARD:
        return MINUTES_10
    if quality == QUALITY_GOOD:
        if current_interval.total_seconds() < 1:
            return MINUTES_1
        return timedelta(seconds=current_interval.total_seconds() * ease_factor)
    if quality == QUALITY_EASY:
        if current_interval.total_seconds() < 1:
            return MINUTES_10
        return timedelta(seconds=current_interval.total_seconds() * ease_factor * 1.3)
    return MINUTES_1

def update_ease_factor(ease_factor: float, quality: int) -> float:
    new = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    return max(1.3, new)
