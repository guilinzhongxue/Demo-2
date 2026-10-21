import zlib, struct

path = r"C:\Users\HUAWEI\.workbuddy\clipboard-images\clipboard-2026-10-21T03-16-47-344Z-3ff53beb.png"
data = open(path, "rb").read()
pos = 8; idat = b""; w = h = bd = ct = None
while pos < len(data):
    ln = struct.unpack(">I", data[pos:pos+4])[0]
    typ = data[pos+4:pos+8]; chunk = data[pos+8:pos+8+ln]
    if typ == b"IHDR": w, h, bd, ct = struct.unpack(">IIBB", chunk[:10])
    elif typ == b"IDAT": idat += chunk
    elif typ == b"IEND": break
    pos += 12 + ln
raw = zlib.decompress(idat)
nch = {0:1,2:3,3:1,4:2,6:4}[ct]; bpp = nch*bd//8; stride = w*bpp
out = bytearray(); prev = bytearray(stride); i = 0
for y in range(h):
    f = raw[i]; i += 1
    line = bytearray(raw[i:i+stride]); i += stride
    if f == 1:
        for x in range(bpp, stride): line[x] = (line[x]+line[x-bpp]) & 255
    elif f == 2:
        for x in range(stride): line[x] = (line[x]+prev[x]) & 255
    elif f == 3:
        for x in range(stride):
            a = line[x-bpp] if x >= bpp else 0
            line[x] = (line[x]+((a+prev[x])>>1)) & 255
    elif f == 4:
        for x in range(stride):
            a = line[x-bpp] if x >= bpp else 0
            b = prev[x]; c = prev[x-bpp] if x >= bpp else 0
            p = a+b-c; pa,pb,pc = abs(p-a),abs(p-b),abs(p-c)
            pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
            line[x] = (line[x]+pr) & 255
    out += line; prev = line
def px(x, y):
    o = y*stride + x*bpp
    return tuple(out[o:o+3])

# 在右侧区域找灯笼：灯体 #6a5a48 (106,90,72) 比背景亮且偏棕
print("右侧区域 (x>700) 的棕色灯体候选：")
cand = []
for y in range(300, 520):
    for x in range(700, w):
        r, g, b = px(x, y)
        # 灯体色，允许暗角
        if 60 < r < 140 and 48 < g < 120 and 38 < b < 100 and r > b + 15 and r >= g:
            cand.append((x, y))
if cand:
    xs = [c[0] for c in cand]; ys = [c[1] for c in cand]
    print(f"  像素数 {len(cand)}, bbox x {min(xs)}..{max(xs)} y {min(ys)}..{max(ys)}")
    # 聚类按 x
    from collections import Counter
    xc = Counter(x for x, y in cand)
    print("  x 分布(前20):", sorted(xc.items())[:20])
    yc = Counter(y for x, y in cand)
    print("  y 分布:", sorted(yc.items())[:20])

# 打印该区域每 10px 的颜色，人工辨认
print("\n区域采样 (x 760..1000, y 380..470)：")
for y in range(380, 471, 10):
    row = []
    for x in range(760, 1001, 20):
        row.append(f"{x}:{px(x,y)[0]},{px(x,y)[1]},{px(x,y)[2]}")
    print(f"  y={y}: " + "  ".join(row))
