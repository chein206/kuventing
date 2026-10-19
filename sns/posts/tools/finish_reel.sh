#!/bin/bash
# 릴스 마무리: Remotion 렌더 → 소리 합성 → -14 LUFS / TP -2 → mux → 컷 시트 · 표지
#   bash tools/finish_reel.sh <CompositionId> <포스트 폴더> <표지 프레임>
set -e
COMP=$1; POST=$2; CF=${3:-20}
HERE=$(cd "$(dirname "$0")/.." && pwd); RM=$HERE/../../../vidops/remotion
OUT=$HERE/$POST; mkdir -p "$OUT/_work"
(cd "$RM" && npx remotion render $COMP "$OUT/_work/video.mp4" --codec=h264 --pixel-format=yuv420p --crf=16 --log=error)
PYTHONUTF8=1 python "$HERE/tools/reel_sfx.py" "$OUT/audio.json" "$OUT/_work/mix_raw.wav"
J=$(ffmpeg -hide_banner -i "$OUT/_work/mix_raw.wav" -af loudnorm=I=-14:TP=-2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g(){ echo "$J" | grep "\"$1\"" | grep -o '\-\?[0-9.]*' | head -1; }
ffmpeg -v error -y -i "$OUT/_work/mix_raw.wav" -af "loudnorm=I=-14:TP=-2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" "$OUT/_work/mix.wav"
ffmpeg -v error -y -i "$OUT/_work/video.mp4" -i "$OUT/_work/mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -t $(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$OUT/_work/video.mp4") -movflags +faststart "$OUT/reel.mp4"
(cd "$RM" && npx remotion still $COMP "$OUT/cover.png" --frame=$CF --log=error)
PYTHONUTF8=1 python "$HERE/tools/contact_1s.py" "$OUT/reel.mp4" "$OUT/contact_1s.jpg"
ffmpeg -hide_banner -i "$OUT/reel.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)"
echo "done $OUT"
