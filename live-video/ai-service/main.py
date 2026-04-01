"""
BleacherBox Live Video — AI Frame Pipeline

Reads from camera or video file, runs YOLO player/ball tracking,
draws overlays, and writes raw BGR frames to stdout for FFmpeg to encode.

Usage:
  # Stream to YouTube
  python main.py --input /dev/video0 | ffmpeg -f rawvideo -pix_fmt bgr24 \
    -s 1280x720 -r 30 -i pipe:0 -c:v libx264 -preset veryfast \
    -b:v 4500k -f flv rtmp://a.rtmp.youtube.com/live2/STREAM_KEY

  # Test: save to file instead
  python main.py --input game_footage.mp4 --output test_out.mp4

  # Test: display in window (requires display)
  python main.py --input game_footage.mp4 --display
"""
import argparse
import sys
import time
import cv2
import numpy as np
from tracker import Tracker
from overlay import draw_frame, load_calibration

TARGET_W = 1280
TARGET_H = 720
TARGET_FPS = 30


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="0",
                   help="Camera index (0), /dev/video0, or video file path")
    p.add_argument("--output", default=None,
                   help="Output file path (optional, skips stdout pipe)")
    p.add_argument("--display", action="store_true",
                   help="Show processed frames in a window (requires display)")
    p.add_argument("--model", default="yolov8n.pt",
                   help="YOLO model weights (yolov8n.pt, yolov8s.pt, etc.)")
    p.add_argument("--conf", type=float, default=0.35,
                   help="Detection confidence threshold")
    p.add_argument("--width", type=int, default=TARGET_W)
    p.add_argument("--height", type=int, default=TARGET_H)
    p.add_argument("--fps", type=int, default=TARGET_FPS)
    return p.parse_args()


def open_capture(input_arg, width, height, fps):
    src = int(input_arg) if input_arg.isdigit() else input_arg
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print(f"[main] ERROR: Cannot open input: {input_arg}", file=sys.stderr)
        sys.exit(1)
    # Request resolution from camera (ignored for files)
    if isinstance(src, int) or input_arg.startswith("/dev/"):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        cap.set(cv2.CAP_PROP_FPS, fps)
    return cap


def main():
    args = parse_args()
    print(f"[main] Loading YOLO model: {args.model}", file=sys.stderr)
    tracker = Tracker(model_path=args.model, conf=args.conf)
    calibration = load_calibration()
    if calibration:
        print("[main] Strike zone calibration loaded.", file=sys.stderr)
    else:
        print("[main] No calibration.json found — strike zone disabled. Run calibration.py first.", file=sys.stderr)

    cap = open_capture(args.input, args.width, args.height, args.fps)

    # Output setup
    out = None
    if args.output:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(args.output, fourcc, args.fps, (args.width, args.height))
        print(f"[main] Writing to file: {args.output}", file=sys.stderr)
    elif not args.display:
        # Pipe raw BGR frames to stdout for FFmpeg
        print(f"[main] Piping {args.width}x{args.height}@{args.fps} BGR frames to stdout", file=sys.stderr)

    if args.display:
        cv2.namedWindow("BleacherBox Live", cv2.WINDOW_NORMAL)

    frame_count = 0
    t_start = time.time()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Resize to target resolution
            if frame.shape[1] != args.width or frame.shape[0] != args.height:
                frame = cv2.resize(frame, (args.width, args.height))

            # Run tracking
            players, ball_det = tracker.process_frame(frame)
            ball_trail = tracker.get_ball_trail()

            # Draw overlays
            draw_frame(frame, players, ball_det, ball_trail, calibration)

            # Output
            if out:
                out.write(frame)
            elif args.display:
                cv2.imshow("BleacherBox Live", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            else:
                sys.stdout.buffer.write(frame.tobytes())

            frame_count += 1
            if frame_count % 150 == 0:
                elapsed = time.time() - t_start
                fps_actual = frame_count / elapsed
                print(f"[main] {frame_count} frames | {fps_actual:.1f} fps | "
                      f"{len(players)} players | ball={'yes' if ball_det else 'no'}",
                      file=sys.stderr)

    except KeyboardInterrupt:
        print("\n[main] Stopped by user.", file=sys.stderr)
    finally:
        cap.release()
        if out:
            out.release()
        if args.display:
            cv2.destroyAllWindows()
        elapsed = time.time() - t_start
        print(f"[main] Done. {frame_count} frames in {elapsed:.1f}s ({frame_count/max(elapsed,1):.1f} fps)",
              file=sys.stderr)


if __name__ == "__main__":
    main()
