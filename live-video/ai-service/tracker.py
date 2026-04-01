"""
Player and ball detection + tracking using YOLOv8 with BoT-SORT.
"""
import numpy as np
from ultralytics import YOLO
from collections import deque

# COCO class IDs relevant to baseball
PERSON_CLASS = 0
BALL_CLASS = 32  # sports ball in COCO


class Detection:
    def __init__(self, track_id, cls, x1, y1, x2, y2, conf):
        self.track_id = int(track_id)
        self.cls = int(cls)
        self.x1, self.y1, self.x2, self.y2 = int(x1), int(y1), int(x2), int(y2)
        self.conf = float(conf)

    @property
    def center(self):
        return ((self.x1 + self.x2) // 2, (self.y1 + self.y2) // 2)

    @property
    def bbox(self):
        return (self.x1, self.y1, self.x2, self.y2)


class Tracker:
    def __init__(self, model_path="yolov8n.pt", conf=0.35, ball_trail_len=20):
        self.model = YOLO(model_path)
        self.conf = conf
        # Rolling trail for ball positions: deque of (cx, cy, age)
        self.ball_trail = deque(maxlen=ball_trail_len)

    def process_frame(self, frame):
        """
        Run YOLO tracking on a frame.
        Returns (players: list[Detection], ball: Detection|None)
        """
        results = self.model.track(
            frame,
            persist=True,
            conf=self.conf,
            classes=[PERSON_CLASS, BALL_CLASS],
            tracker="botsort.yaml",
            verbose=False,
        )

        players = []
        ball = None

        if results and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                if box.id is None:
                    continue
                cls = int(box.cls[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                track_id = int(box.id[0])
                det = Detection(track_id, cls, x1, y1, x2, y2, conf)

                if cls == PERSON_CLASS:
                    players.append(det)
                elif cls == BALL_CLASS:
                    # Keep highest-confidence ball detection
                    if ball is None or conf > ball.conf:
                        ball = det

        # Update ball trail
        if ball is not None:
            self.ball_trail.append(ball.center)

        return players, ball

    def get_ball_trail(self):
        """Returns list of (x, y) positions, oldest first."""
        return list(self.ball_trail)

    def clear_ball_trail(self):
        self.ball_trail.clear()
