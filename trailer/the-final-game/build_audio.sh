#!/usr/bin/env bash
# Sprecher erzeugen (espeak-ng + MBROLA) und mit score.wav mischen -> final_audio.wav
set -euo pipefail
mkdir -p vo && cd vo
say(){ espeak-ng -v "$2" -s "$3" -p "$4" -g 4 -w "raw_$1.wav" "$5"
  ffmpeg -loglevel error -y -i "raw_$1.wav" -af "aresample=48000,rubberband=pitch=0.84:formant=preserved,highpass=f=60,equalizer=f=140:t=q:w=1:g=4,equalizer=f=3200:t=q:w=1:g=2,acompressor=threshold=-20dB:ratio=4:attack=5:release=120,volume=1.4" "$1.wav"; }
say n1 mb-de6 112 28 "Hundert Spieler."
say n2 mb-de6 108 24 "Unzählige Entscheidungen."
say n3 mb-de6 110 26 "Nur eine Frage:"
say n4 mb-de6 104 22 "Wie weit wirst du gehen?"
say n5 mb-de6 108 24 "Deine Entscheidung verändert das Spiel."
say n6 mb-de6 104 26 "Manche spielen, um zu gewinnen."
say n7 mb-de6 100 22 "Andere, um zu überleben."
say n8 mb-de6 92 18 "Und du?"
espeak-ng -v mb-de2 -s 105 -p 40 -w raw_c1.wav "Du wurdest ausgewählt."
ffmpeg -loglevel error -y -i raw_c1.wav -af "aresample=48000,rubberband=pitch=0.9,highpass=f=120,lowpass=f=6000,aecho=0.8:0.6:12|23:0.35|0.25,vibrato=f=55:d=0.15,acompressor=threshold=-18dB:ratio=4,volume=1.6" c1.wav
TRIM="silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
for f in c1 n1 n2 n3 n4 n5 n6 n7 n8; do ffmpeg -loglevel error -y -i $f.wav -af "$TRIM" t_$f.wav; done
for f in n6 n7; do ffmpeg -loglevel error -y -i t_$f.wav -af "rubberband=tempo=1.12" f_$f.wav; done
cd ..
V=vo; ffmpeg -loglevel error -y -i score.wav \
 -i $V/t_c1.wav -i $V/t_n1.wav -i $V/t_n2.wav -i $V/t_n3.wav -i $V/t_n4.wav -i $V/t_n5.wav -i $V/f_n6.wav -i $V/f_n7.wav -i $V/t_n8.wav \
 -filter_complex "
 [1]adelay=1150|1150[a1];[2]adelay=7700|7700[a2];[3]adelay=9650|9650[a3];[4]adelay=12350|12350[a4];[5]adelay=14250|14250[a5];
 [6]adelay=37000|37000[a6];[7]adelay=45400|45400[a7];[8]adelay=49500|49500[a8];[9]adelay=53850|53850[a9];
 [a1][a2][a3][a4][a5][a6][a7][a8][a9]amix=inputs=9:normalize=0,aformat=channel_layouts=stereo,apad=whole_dur=60,
 asplit=3[vo][vrev][sc];
 [vrev]aecho=0.8:0.5:60|120|240:0.25|0.18|0.1,lowpass=f=4000,volume=0.6[wet];
 [vo][wet]amix=inputs=2:normalize=0,volume=2.2[voice];
 [0]volume=0.75[mus];
 [mus][sc]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=400[ducked];
 [ducked][voice]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=false,loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000[out]" \
 -map "[out]" -ar 48000 -t 60 final_audio.wav
# Endmaster: Filmkorn + Ton
ffmpeg -loglevel error -y -i video_raw.mp4 -i final_audio.wav -vf "noise=alls=7:allf=t,format=yuv420p" \
 -c:v libx264 -preset slow -crf 17 -profile:v high -movflags +faststart -c:a aac -b:a 256k -shortest THE_FINAL_GAME_Trailer_1080p.mp4
