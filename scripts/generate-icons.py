#!/usr/bin/env python3
"""assets/icon-source.png → public/ 아이콘 5종 생성.

원본은 raster 렌더라 색이 ±1~2 흔들리고 포인트 컬러가 브랜드 토큰과
어긋나 있다. 그래서 단순 리사이즈가 아니라 팔레트를 의도한 값으로
정규화한 뒤 크롭·축소한다.

  글씨   #111827  = Tailwind gray-900   (Header.tsx의 text-gray-900)
  포인트 #ff2e98  = --color-brand       (src/index.css)

의존성 없음 (ImageMagick·PIL 불필요). 실행:  python3 scripts/generate-icons.py
"""
import os
import struct
import zlib

SRC = 'assets/icon-source.png'
OUTDIR = 'public'

# 목표 팔레트 — 메인화면 로고와 동일하게 맞춘다
BG = (255, 255, 255)
INK = (0x11, 0x18, 0x27)      # #111827
POINT = (0xFF, 0x2E, 0x98)    # #ff2e98

# 원본 실측 색 (히스토그램 지배색)
SRC_BG = (254, 254, 254)
SRC_INK = (17, 24, 39)
SRC_POINT = (251, 20, 118)    # #FB1476 — 브랜드 컬러가 아니라 이걸 보정한다

# 크롭 좌표 (원본 1254x1254 좌표계)
# 워드마크: 로고 중심 기준 정사각형. 가로폭 88%를 차지하고 원본의
# 좌우 여백 비대칭(125px/93px)이 보정된다.
WORDMARK = dict(left=54, top=40, size=1177)
# 포인트 슬래시 bbox. 슬래시는 위쪽이 오른쪽으로 기울어 AX의 'A' 발과
# x축 범위가 겹치므로, 사각 크롭 후 픽셀 단위로 글씨색을 걷어낸다.
SLASH = dict(left=526, top=395, w=156, h=299, square=383)

TARGETS = [
    ('apple-touch-icon.png', 180, 'wordmark'),
    ('icon-192.png', 192, 'wordmark'),
    ('icon-512.png', 512, 'wordmark'),
    ('favicon-32.png', 32, 'slash'),
    ('favicon-16.png', 16, 'slash'),
]


def decode_png(path):
    """RGB8 non-interlaced PNG → (w, h, [bytearray rows])."""
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit('PNG이 아님: %s' % path)
    w = h = None
    idat = []
    i = 8
    while i < len(d):
        ln = struct.unpack_from('>I', d, i)[0]
        typ = d[i + 4:i + 8]
        data = d[i + 8:i + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', data)
            if (bd, ct, il) != (8, 2, 0):
                raise SystemExit('RGB8 non-interlaced PNG만 지원 '
                                 '(bitdepth=%d colortype=%d interlace=%d)' % (bd, ct, il))
        elif typ == b'IDAT':
            idat.append(data)
        elif typ == b'IEND':
            break
        i += 12 + ln
    raw = zlib.decompress(b''.join(idat))
    stride = w * 3
    rows = []
    prev = bytearray(stride)
    p = 0
    for _ in range(h):
        ft = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ft == 1:
            for x in range(3, stride):
                line[x] = (line[x] + line[x - 3]) & 0xFF
        elif ft == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 0xFF
        elif ft == 3:
            for x in range(stride):
                a = line[x - 3] if x >= 3 else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 0xFF
        elif ft == 4:
            for x in range(stride):
                a = line[x - 3] if x >= 3 else 0
                b = prev[x]
                c = prev[x - 3] if x >= 3 else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 0xFF
        elif ft != 0:
            raise SystemExit('알 수 없는 filter type %d' % ft)
        rows.append(line)
        prev = line
    return w, h, rows


def encode_png(path, w, h, rows):
    def chunk(t, d):
        return (struct.pack('>I', len(d)) + t + d
                + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF))
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(raw, 9))
    out += chunk(b'IEND', b'')
    open(path, 'wb').write(out)


def _remap(rgb, cache={}):
    """원본 픽셀 → 목표 팔레트. 안티에일리어싱은 커버리지로 보존한다.

    AA 픽셀은 배경과 잉크의 선형 블렌드이므로, 두 잉크 각각에 대해
    최소제곱 커버리지 a를 구하고 잔차가 작은 쪽을 채택한 뒤 목표색으로
    같은 a를 다시 적용한다. 원본의 ±노이즈는 이 과정에서 함께 정리된다.
    """
    hit = cache.get(rgb)
    if hit is not None:
        return hit
    r, g, b = rgb
    best = None
    for src_ink, dst_ink in ((SRC_INK, INK), (SRC_POINT, POINT)):
        dr = SRC_BG[0] - src_ink[0]
        dg = SRC_BG[1] - src_ink[1]
        db = SRC_BG[2] - src_ink[2]
        den = dr * dr + dg * dg + db * db
        a = ((SRC_BG[0] - r) * dr + (SRC_BG[1] - g) * dg + (SRC_BG[2] - b) * db) / den
        a = 0.0 if a < 0 else (1.0 if a > 1 else a)
        er = r - (SRC_BG[0] - a * dr)
        eg = g - (SRC_BG[1] - a * dg)
        eb = b - (SRC_BG[2] - a * db)
        res = er * er + eg * eg + eb * eb
        if best is None or res < best[0]:
            best = (res, a, dst_ink)
    _, a, ink = best
    # 원본 배경의 ±1 노이즈가 아주 작은 커버리지로 잡혀 #FEFEFE 같은
    # 잔여색을 남긴다. 2% 미만은 배경으로 스냅해 완전히 평탄하게 만든다.
    if a < 0.02:
        a = 0.0
    val = (int(round(BG[0] + a * (ink[0] - BG[0]))),
           int(round(BG[1] + a * (ink[1] - BG[1]))),
           int(round(BG[2] + a * (ink[2] - BG[2]))))
    cache[rgb] = val
    return val


def recolor(w, h, rows):
    out = []
    for y in range(h):
        src = rows[y]
        line = bytearray(w * 3)
        for x in range(w):
            o = x * 3
            line[o], line[o + 1], line[o + 2] = _remap((src[o], src[o + 1], src[o + 2]))
        out.append(line)
    return out


def crop(rows, left, top, w, h):
    return [bytearray(rows[top + y][left * 3:(left + w) * 3]) for y in range(h)]


def pad_square(rows, w, h, side):
    """배경색으로 가운데 정렬 패딩."""
    out = []
    x0 = (side - w) // 2
    y0 = (side - h) // 2
    blank = bytearray(bytes(BG) * side)
    for y in range(side):
        if y < y0 or y >= y0 + h:
            out.append(bytearray(blank))
            continue
        line = bytearray(blank)
        line[x0 * 3:(x0 + w) * 3] = rows[y - y0]
        out.append(line)
    return out


def isolate_point(rows, w, h):
    """포인트 색만 남기고 글씨색 조각을 배경으로 치환.

    배경(흰색)→POINT 블렌드는 r이 255로 유지되고, 배경→INK 블렌드는
    r이 함께 떨어진다. 그래서 r만 보면 두 잉크가 구분된다.
    """
    out = []
    for y in range(h):
        src = rows[y]
        line = bytearray(src)
        for x in range(w):
            o = x * 3
            if src[o] < 250:
                line[o], line[o + 1], line[o + 2] = BG
        out.append(line)
    return out


def downscale(rows, w, h, n):
    """면적 평균 축소."""
    out = []
    for oy in range(n):
        y0 = oy * h // n
        y1 = max(y0 + 1, (oy + 1) * h // n)
        line = bytearray(n * 3)
        for ox in range(n):
            x0 = ox * w // n
            x1 = max(x0 + 1, (ox + 1) * w // n)
            sr = sg = sb = cnt = 0
            for yy in range(y0, y1):
                row = rows[yy]
                for xx in range(x0, x1):
                    o = xx * 3
                    sr += row[o]
                    sg += row[o + 1]
                    sb += row[o + 2]
                    cnt += 1
            o = ox * 3
            line[o] = sr // cnt
            line[o + 1] = sg // cnt
            line[o + 2] = sb // cnt
        out.append(line)
    return out


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    print('원본 읽는 중: %s' % SRC)
    w, h, rows = decode_png(SRC)
    print('  %dx%d' % (w, h))

    print('팔레트 정규화: 글씨 #%02X%02X%02X / 포인트 #%02X%02X%02X'
          % (INK + POINT))
    rows = recolor(w, h, rows)

    wm = crop(rows, WORDMARK['left'], WORDMARK['top'],
              WORDMARK['size'], WORDMARK['size'])
    wm_side = WORDMARK['size']

    sl = crop(rows, SLASH['left'], SLASH['top'], SLASH['w'], SLASH['h'])
    sl = isolate_point(sl, SLASH['w'], SLASH['h'])
    sl = pad_square(sl, SLASH['w'], SLASH['h'], SLASH['square'])
    sl_side = SLASH['square']

    for name, size, kind in TARGETS:
        base, side = (wm, wm_side) if kind == 'wordmark' else (sl, sl_side)
        small = downscale(base, side, side, size)
        path = os.path.join(OUTDIR, name)
        encode_png(path, size, size, small)
        print('  %-24s %3dx%-3d  %6d B  (%s)'
              % (path, size, size, os.path.getsize(path), kind))
    print('완료.')


if __name__ == '__main__':
    main()
