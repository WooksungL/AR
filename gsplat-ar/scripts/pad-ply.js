// gsplat-ar/scripts/pad-ply.js
import fs from "fs";
import path from "path";

const src = path.resolve("public/models/K.ply");          // 원본
const dst = path.resolve("public/models/K_align.ply");    // 패딩된 결과

// 헤더는 1MB 안에 들어온다고 가정 (충분히 큼)
const HEADER_SCAN_BYTES = 1024 * 1024;

const fd = fs.openSync(src, "r");
const stat = fs.statSync(src);
const headBuf = Buffer.alloc(Math.min(HEADER_SCAN_BYTES, stat.size));
const bytesRead = fs.readSync(fd, headBuf, 0, headBuf.length, 0);
const headerText = headBuf.slice(0, bytesRead).toString("utf8");

const endIdx = headerText.indexOf("end_header");
if (endIdx < 0) throw new Error("end_header not found in PLY");

const endNL = headerText.indexOf("\n", endIdx);
if (endNL < 0) throw new Error("newline after end_header not found");

// 헤더의 실제 바이트 길이(= 바이너리 시작 오프셋)
const headerLen = Buffer.byteLength(headerText.slice(0, endNL + 1), "utf8");
// 4바이트 정렬을 위한 패딩 크기(0~3)
const pad = (4 - (headerLen % 4)) % 4;

console.log(`headerLen=${headerLen}, pad=${pad}`);

const out = fs.createWriteStream(dst);
// 헤더 그대로 작성
out.write(headBuf.slice(0, endNL + 1));
// 패딩(최대 3바이트)
if (pad) out.write(Buffer.alloc(pad));

// 나머지(바이너리 본문)는 스트림으로 복사
const bodyStream = fs.createReadStream(src, { start: endNL + 1 });
bodyStream.pipe(out);
bodyStream.on("end", () => {
  console.log(`DONE -> ${dst}`);
});
