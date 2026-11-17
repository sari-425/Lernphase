"""THE FINAL GAME – Originalscore und Sounddesign, vollständig synthetisiert."""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
T = np.arange(N) / SR

def buf():
    return np.zeros((N, 2))

def place(dst, x, t, gain=1.0, pan=0.0):
    """Mono- oder Stereosignal x bei Sekunde t einfügen."""
    i = int(t * SR)
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    n = min(len(x), N - i)
    if n > 0:
        dst[i:i + n] += x[:n] * gain

def env_adsr(n, a, d, s, r):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    e = np.ones(n) * s
    e[:a] = np.linspace(0, 1, a)
    e[a:a + d] = np.linspace(1, s, len(e[a:a + d]))
    if r > 0:
        e[-r:] *= np.linspace(1, 0, r)
    return e

def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=0)

def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=0)

def bp(x, f1, f2, order=2):
    b, a = signal.butter(order, [f1 / (SR / 2), f2 / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=0)

def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1.0) - 1

def tvlp(x, cutoffs, block=512):
    """Zeitvariabler Tiefpass (blockweise, Zustand bleibt erhalten)."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        fc = float(np.clip(cutoffs[min(i, len(cutoffs) - 1)], 30, SR / 2.2))
        b, a = signal.butter(2, fc / (SR / 2), 'low')
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y

def reverb(x, secs=3.0, damp=3000, mix=.35):
    n = int(secs * SR)
    ir = rng.standard_normal((n, 2)) * np.exp(-np.linspace(0, 7, n))[:, None]
    ir = lp(ir, damp)
    ir /= np.sqrt((ir ** 2).sum(0))
    wet = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix * 2.2

mus = buf()   # Musik
sfx = buf()   # Effekte

mtof = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---------- 1. Sub-Drone (D) über den ganzen Trailer ----------
drone_env = np.interp(T, [0, .4, 5.4, 5.6, 17, 32, 43.4, 44, 52.5, 53.9, 55, 55.3, 59, 60],
                         [0, .5, .8, .3, .7, 1.0, .5, .6, 1.0, .25, .1, 1.0, .5, 0])
d = (np.sin(2 * np.pi * mtof(26) * T) + .5 * np.sin(2 * np.pi * mtof(38) * T + .3)
     + .25 * np.sin(2 * np.pi * mtof(45) * T)) * (1 + .15 * np.sin(2 * np.pi * .13 * T))
place(mus, (d * drone_env * .22), 0)

# ---------- 2. Streicherflächen (Superposition verstimmter Sägezähne) ----------
def strings(notes, t0, t1, gain, bright=1800, att=1.2, rel=1.5):
    n = int((t1 - t0) * SR)
    out = np.zeros((n, 2))
    for k, m in enumerate(notes):
        for v in range(5):
            det = (v - 2) * 0.06
            f = mtof(m + det)
            ph = rng.random()
            s = saw(f, n, ph)
            vib = 1 + .003 * np.sin(2 * np.pi * (4.7 + v * .3) * np.arange(n) / SR + ph * 6)
            pan = (v - 2) / 2.5
            out[:, 0] += s * vib * (1 - pan) * .5
            out[:, 1] += s * vib * (1 + pan) * .5
    out = lp(out, bright, 4)
    out = hp(out, 60)
    e = env_adsr(n, att, .1, 1, rel)
    return out * e[:, None] * gain / (len(notes) * 5)

# d-Moll-Welt, eigene Progression: Dm – Dm(add9) – Bb – Gm/D – A(sus) – Dm
place(mus, strings([50, 57, 62], 5.4, 17.4, .55, 1200, 1.5, 1.0), 5.4)
place(mus, strings([46, 53, 58, 62], 17.2, 24.2, .6, 1600, .4, .8), 17.2)
place(mus, strings([43, 50, 55, 58, 62], 23.2, 32.0, .7, 2200, .4, .6), 23.2)
place(mus, strings([45, 52, 57, 62, 64], 31.8, 43.4, .55, 1800, .3, .8), 31.8)
place(mus, strings([38, 50, 57, 62, 65], 43.4, 53.6, .5, 900, 2.0, 1.2), 43.4)
# hohe Cluster-Spannung im Finale
place(mus, strings([81, 82, 86], 46.0, 53.7, .18, 5000, 4.0, .3), 46.0)

# ---------- 3. Pulsierende Elektronik / Herzschlag ----------
def kick(dur=.6, f0=110, f1=38, gain=1.0, click=.3):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-t * 6.5)
    k[:200] += rng.standard_normal(200) * click * np.linspace(1, 0, 200)
    return np.tanh(k * 1.6) * gain

def tick(gain=.2, f=5200):
    n = int(.04 * SR); t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), f * .7, min(f * 1.4, 20000)) * np.exp(-t * 160)
    return x * gain

def bass_pulse(m, dur, gain):
    n = int(dur * SR); t = np.arange(n) / SR
    x = saw(mtof(m), n) + .6 * saw(mtof(m) * 1.005, n)
    e = np.exp(-t * 7)
    return lp(x, 380) * e * gain

# Herzschlag 7.6–17: 66 BPM, doppelt
bpm = 66; b = 60 / bpm; t = 7.6
while t < 17.0:
    place(mus, kick(gain=.55), t); place(mus, kick(gain=.32), t + .26)
    t += b
# Montage 17.2–32: 98 BPM mit Bass-Achteln und Ticks
bpm = 98; b = 60 / bpm; t = 17.2; i = 0
roots = {17.2: 38, 23.2: 31, 28.6: 33}
while t < 31.75:
    r = [v for k, v in roots.items() if t >= k][-1]
    if i % 4 == 0:
        place(mus, kick(gain=.7), t)
    if i % 2 == 0:
        place(mus, bass_pulse(r + 12 * (i % 4 == 2), b / 2 * .95, .22), t)
    if i % 2 == 1:
        place(mus, tick(.07, 7000), t, pan=.4 if i % 4 == 1 else -.4)
    t += b / 2; i += 1
# Community 31.8–43: druckvoller, mit Arpeggio-Glitzern
bpm = 104; b = 60 / bpm; t = 31.8; i = 0
arp = [69, 72, 76, 79, 76, 72]
while t < 43.2:
    if i % 4 == 0:
        place(mus, kick(gain=.75), t)
    if i % 2 == 0:
        place(mus, bass_pulse(33, b / 2 * .9, .24), t)
    n = int(.18 * SR)
    pl = np.sin(2 * np.pi * mtof(arp[i % 6]) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 18)
    place(mus, pl * .05, t, pan=np.sin(i))
    t += b / 2; i += 1
# Finale: langsamer Herzschlag, der ausdünnt
for t in [44.4, 45.4, 46.5, 47.7, 49.0, 50.4, 51.9]:
    place(mus, kick(gain=.6, f1=34), t); place(mus, kick(gain=.35, f1=34), t + .28)

# ---------- 4. Hits, Braams, Riser ----------
def braam(dur=3.5, m=26, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for mm, g in [(m, 1), (m + 12, .7), (m + 19, .4), (m + 24, .3)]:
        for dt in (-.08, .0, .07):
            x += saw(mtof(mm + dt), n, rng.random()) * g
    cut = 120 + 2200 * np.exp(-t * 2.2) * np.minimum(1, t * 30)
    y = tvlp(x, np.interp(np.arange(n), np.arange(n), cut))
    y = np.tanh(y * .6) * np.exp(-t * .9) * np.minimum(1, t * 60)
    return y * gain * .5

def boom(dur=4.0, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 28 + 70 * np.exp(-t * 9)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    nz = lp(rng.standard_normal(n), 400) * np.exp(-t * 4) * .8
    return np.tanh((x + nz) * 1.5) * gain

def riser(dur, gain=.5, f0=200, f1=9000):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    y = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        fc = f0 * (f1 / f0) ** (i / n)
        y[i:i + blk] = bp(nz[i:i + blk + 2048], fc * .7, min(fc * 1.3, 20000))[:len(y[i:i + blk])]
    e = (t / dur) ** 2.2
    tone = saw(1, n) * 0
    sweep = np.sin(2 * np.pi * np.cumsum(mtof(50) * 2 ** (2 * t / dur)) / SR) * e * .3
    return (y * e + sweep) * gain

def metal_hit(dur=3.0, gain=.5):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for f, dcy in [(211, 1.5), (347, 2.2), (563, 2.8), (911, 3.5), (1489, 5), (2393, 7)]:
        x += np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t * dcy)
    x += hp(rng.standard_normal(n), 3000) * np.exp(-t * 30) * .5
    return x / 4 * gain

def reverse_swell(dur=1.0, gain=.6):
    n = int(dur * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 2500) * (t / dur) ** 3
    return x * gain

def whoosh(dur=.8, gain=.3):
    n = int(dur * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * t / dur) ** 2
    return bp(rng.standard_normal(n), 300, 2500) * e * gain

# Einladung: tiefer Ton bei 0.3, Ziffer-Glitch, Halle
place(sfx, boom(5, .55), 0.25)
place(sfx, riser(2.0, .25, 300, 6000), 3.6)
for k in range(14):
    place(sfx, tick(.12, 3000 + 300 * k), 3.7 + k * 0.085, pan=(k % 2) * .6 - .3)
place(sfx, reverse_swell(.9, .5), 4.7)
place(sfx, boom(5, 1.0), 5.6); place(mus, braam(4.5, 26, .9), 5.6)
place(sfx, metal_hit(4, .35), 5.6)
# Schnitte in der Spielwelt
for t in (7.6, 9.6, 13.7, 15.4):
    place(sfx, whoosh(.6, .25), t - .35)
place(sfx, kick(.8, 90, 30, .6), 9.6)
# Korridor: tiefes Brummen der Lichtlinien
n = int(2 * SR); hum = (np.sin(2 * np.pi * 50 * np.arange(n) / SR) + .4 * np.sin(2 * np.pi * 100 * np.arange(n) / SR)) * env_adsr(n, .1, .1, 1, .3)
place(sfx, hum * .06, 9.6)
# Das Tor: schweres Gleiten
n = int(2.2 * SR); tt = np.arange(n) / SR
grind = lp(rng.standard_normal(n), 220) * (np.minimum(1, tt * 3) * np.exp(-tt * .8)) * 1.2
squeal = np.sin(2 * np.pi * np.cumsum(180 + 40 * np.sin(tt * 3)) / SR) * .05 * np.exp(-tt)
place(sfx, grind + squeal, 11.8)
place(sfx, kick(1.0, 70, 28, .8), 11.6)
# Beobachter: elektrischer Ton beim roten Schlitz
n = int(1.6 * SR); tt = np.arange(n) / SR
zap = np.sign(np.sin(2 * np.pi * 61 * tt)) * .04 * np.exp(-tt * 1.5)
place(sfx, lp(zap, 1500), 13.7)
# Spielerkennungen: Datenpiepser
for k in range(10):
    n = int(.06 * SR)
    bl = np.sin(2 * np.pi * (1800 + 120 * k) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 60)
    place(sfx, bl * .06, 15.55 + .15 + k * .1, pan=(k / 9) * 1.2 - .6)
# Herausforderungen
place(sfx, riser(1.6, .35), 15.6)
place(sfx, boom(4, .9), 17.2); place(mus, braam(3.0, 26, .8), 17.2)
for t in (20.2, 23.2, 25.9, 28.6):
    place(sfx, whoosh(.5, .25), t - .3); place(sfx, kick(.6, 100, 34, .55), t)
# Rätselkacheln
for k in range(9):
    n = int(.25 * SR)
    m = [74, 77, 81, 74, 79, 82, 77, 81, 86][k]
    pt = np.sin(2 * np.pi * mtof(m) * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 10)
    place(sfx, pt * .05, 20.2 + k * .22, pan=(k % 3 - 1) * .5)
# Countdown-Ticks
t = 25.9
while t < 28.6:
    place(sfx, tick(.22, 2600), t); place(sfx, tick(.12, 4200), t + .155)
    t += .3125
# Vertrauen: Stille vor der Entscheidung, Puls der roten Tasten
for t in (29.1, 30.15, 31.2):
    n = int(.4 * SR)
    pt = np.sin(2 * np.pi * 110 * np.arange(n) / SR) * np.exp(-np.arange(n) / SR * 8)
    place(sfx, pt * .12, t)
# Community: Kommentar-Pops
for k in range(8):
    n = int(.09 * SR); tt = np.arange(n) / SR
    pop = np.sin(2 * np.pi * (900 + 500 * np.exp(-tt * 60)) * tt) * np.exp(-tt * 45)
    place(sfx, pop * .14, 31.8 + .6 + k * .55, pan=.25)
place(sfx, boom(3, .6), 31.8); place(sfx, metal_hit(2.5, .2), 31.8)
place(sfx, whoosh(.7, .3), 37.85)
# Rangliste: Umsortieren
for k in range(6):
    place(sfx, tick(.1, 3500), 38.2 + .9 + k * .18, pan=.5)
# Tür B öffnet sich
place(sfx, riser(1.4, .3, 200, 5000), 40.9)
place(sfx, boom(4, .8), 41.5)
n = int(1.6 * SR); tt = np.arange(n) / SR
place(sfx, lp(rng.standard_normal(n), 300) * np.minimum(1, tt * 4) * np.exp(-tt * 1.2) * .8, 41.5)
# Finale: Schalterklacken + rotes Licht
place(sfx, riser(1.0, .25, 200, 3000), 42.4)
place(sfx, kick(1.2, 60, 26, .9, 1.0), 44.4)
n = int(.12 * SR); place(sfx, hp(rng.standard_normal(n), 1500) * np.exp(-np.arange(n) / SR * 40) * .4, 44.4)
n = int(8 * SR); tt = np.arange(n) / SR
redhum = (np.sin(2 * np.pi * 55 * tt) + .3 * np.sin(2 * np.pi * 165 * tt)) * np.minimum(1, tt * 2) * .05
place(sfx, redhum * np.interp(tt, [0, 7, 8], [1, 1, 0]), 44.4)
# Stille vor "Und du?", dann Marke
place(sfx, reverse_swell(1.2, .55), 54.05)
place(sfx, boom(5, 1.15), 55.25); place(mus, braam(4.5, 26, 1.0), 55.25)
place(sfx, metal_hit(4.5, .55), 55.25)
# Signatur-Motiv zum Logo: D – A – F – E (eigene Tonfolge)
for k, (m, dt) in enumerate([(74, 0), (81, .38), (77, .76), (76, 1.14)]):
    n = int(2.2 * SR); tt = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * mtof(m) * tt) + .3 * np.sin(2 * np.pi * mtof(m) * 2.01 * tt)) * np.exp(-tt * 1.6) * np.minimum(1, tt * 200)
    place(mus, tone * .09, 55.9 + dt, pan=(k - 1.5) * .3)

# Ducking: Musik vor "Und du?" fast stumm
duck = np.interp(T, [0, 53.3, 53.8, 55.15, 55.25, 60], [1, 1, .12, .12, 1, 1])
mus *= duck[:, None]

mus = reverb(mus, 3.5, 3500, .4)
sfx = reverb(sfx, 2.5, 5000, .3)
mix = mus * .9 + sfx * .85
mix = hp(mix, 22)
wavfile.write('score.wav', SR, (mix / np.abs(mix).max() * .9).astype(np.float32))
print('ok', np.abs(mix).max())
