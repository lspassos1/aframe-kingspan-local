import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const root = process.cwd();
const outDir = join(root, "public", "hero");
const frameDir = join(root, ".hero-frames");
const width = 1280;
const height = 800;
const fps = 20;
const durationS = 8;
const frameCount = fps * durationS;

const ease = (value) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const phase = (t, start, end) => ease((t - start) / (end - start));
const lerp = (a, b, t) => a + (b - a) * t;

const plot = { width: 17, depth: 26 };
const house = { width: 9.64, depth: 17.3, height: 5.75, z0: 4.1 };

function projectPoint(x, z, y = 0) {
  return {
    x: 640 + x * 28 - z * 14,
    y: 575 + z * 15 - y * 58,
  };
}

function point(value) {
  return `${value.x.toFixed(1)},${value.y.toFixed(1)}`;
}

function polygon(points) {
  return points.map(point).join(" ");
}

function line(a, b, attrs = "") {
  return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" ${attrs}/>`;
}

function roofPoint(side, z, slopeT) {
  const baseX = side === "left" ? -house.width / 2 : house.width / 2;
  return projectPoint(lerp(baseX, 0, slopeT), z, lerp(0, house.height, slopeT));
}

function frameLine(z, opacity) {
  const left = projectPoint(-house.width / 2, z, 0);
  const right = projectPoint(house.width / 2, z, 0);
  const top = projectPoint(0, z, house.height);
  return [
    line(left, top, `stroke="#14233a" stroke-width="8" stroke-linecap="round" opacity="${opacity}"`),
    line(right, top, `stroke="#14233a" stroke-width="8" stroke-linecap="round" opacity="${opacity}"`),
    line(left, right, `stroke="#24364f" stroke-width="5" stroke-linecap="round" opacity="${opacity * 0.8}"`),
  ].join("");
}

function createSvg(index) {
  const t = index / (frameCount - 1);
  const terrainP = phase(t, 0, 0.22);
  const structureP = phase(t, 0.16, 0.46);
  const panelP = phase(t, 0.38, 0.68);
  const finishP = phase(t, 0.62, 0.88);
  const cameraLift = Math.sin(t * Math.PI) * 10;

  const plotCorners = [
    projectPoint(-plot.width / 2, 0),
    projectPoint(plot.width / 2, 0),
    projectPoint(plot.width / 2, plot.depth),
    projectPoint(-plot.width / 2, plot.depth),
  ];

  const z1 = house.z0;
  const z2 = house.z0 + house.depth;
  const leftFront = projectPoint(-house.width / 2, z1, 0);
  const leftBack = projectPoint(-house.width / 2, z2, 0);
  const rightFront = projectPoint(house.width / 2, z1, 0);
  const rightBack = projectPoint(house.width / 2, z2, 0);
  const apexFront = projectPoint(0, z1, house.height + cameraLift * 0.005);
  const apexBack = projectPoint(0, z2, house.height + cameraLift * 0.005);

  const leftPanel = [leftFront, leftBack, apexBack, apexFront];
  const rightPanel = [apexFront, apexBack, rightBack, rightFront];
  const slab = [leftFront, rightFront, rightBack, leftBack];

  const grid = [];
  for (let x = -8; x <= 8; x += 1) {
    grid.push(line(projectPoint(x, 0), projectPoint(x, plot.depth), `stroke="#cbd5df" stroke-width="1" opacity="${terrainP * 0.55}"`));
  }
  for (let z = 0; z <= plot.depth; z += 1) {
    grid.push(line(projectPoint(-plot.width / 2, z), projectPoint(plot.width / 2, z), `stroke="#cbd5df" stroke-width="1" opacity="${terrainP * 0.55}"`));
  }

  const frames = [];
  for (let z = z1; z <= z2 + 0.01; z += 3) {
    frames.push(frameLine(z, structureP));
  }

  const purlins = [];
  for (let s = 0.18; s <= 0.82; s += 0.16) {
    purlins.push(line(roofPoint("left", z1, s), roofPoint("left", z2, s), `stroke="#1d2b3e" stroke-width="4" opacity="${structureP * 0.88}"`));
    purlins.push(line(roofPoint("right", z1, s), roofPoint("right", z2, s), `stroke="#1d2b3e" stroke-width="4" opacity="${structureP * 0.88}"`));
  }

  const seams = [];
  for (let z = z1; z <= z2 + 0.001; z += 1) {
    const seamP = Math.min(1, Math.max(0, (panelP * house.depth - (z - z1)) / 1.5));
    seams.push(line(roofPoint("left", z, 0.02), roofPoint("left", z, 0.98), `stroke="#2b65d9" stroke-width="1.5" opacity="${seamP * 0.75}"`));
    seams.push(line(roofPoint("right", z, 0.02), roofPoint("right", z, 0.98), `stroke="#2b65d9" stroke-width="1.5" opacity="${seamP * 0.75}"`));
  }

  const ribs = [];
  for (let s = 0.05; s <= 0.95; s += 0.055) {
    ribs.push(line(roofPoint("left", z1, s), roofPoint("left", z2, s), `stroke="#8a9298" stroke-width="1" opacity="${panelP * 0.38}"`));
    ribs.push(line(roofPoint("right", z1, s), roofPoint("right", z2, s), `stroke="#8a9298" stroke-width="1" opacity="${panelP * 0.38}"`));
  }

  const glassFront = [leftFront, rightFront, apexFront];
  const glassBack = [leftBack, apexBack, rightBack];
  const facadeOpacity = finishP * 0.72;
  const shadow = [projectPoint(-house.width / 2, z2 + 1.2), projectPoint(house.width / 2, z2 + 1.2), projectPoint(house.width / 2, z2 + 3.8), projectPoint(-house.width / 2, z2 + 3.8)];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#eef4f7"/>
      <stop offset="1" stop-color="#fbfaf5"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f6f5ee"/>
      <stop offset="1" stop-color="#cfd2cc"/>
    </linearGradient>
    <filter id="softShadow" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="1280" height="800" fill="url(#sky)"/>
  <circle cx="1120" cy="110" r="62" fill="#f0d58b" opacity="0.45"/>
  <polygon points="${polygon(plotCorners)}" fill="#dfe6df" stroke="#087f72" stroke-width="5" opacity="${terrainP}"/>
  ${grid.join("")}
  <polygon points="${polygon(shadow)}" fill="#0f172a" opacity="${finishP * 0.1}"/>
  <g filter="url(#softShadow)">
    <polygon points="${polygon(slab)}" fill="#9bb9a5" stroke="#6f947d" stroke-width="3" opacity="${Math.max(terrainP, structureP * 0.82)}"/>
    ${frames.join("")}
    ${purlins.join("")}
    <polygon points="${polygon(leftPanel)}" fill="url(#panel)" stroke="#78818a" stroke-width="2" opacity="${panelP * 0.72}"/>
    <polygon points="${polygon(rightPanel)}" fill="url(#panel)" stroke="#78818a" stroke-width="2" opacity="${panelP * 0.82}"/>
    ${ribs.join("")}
    ${seams.join("")}
    <polygon points="${polygon(glassBack)}" fill="#64748b" stroke="#24364f" stroke-width="2" opacity="${facadeOpacity * 0.55}"/>
    <polygon points="${polygon(glassFront)}" fill="#a7c6d9" stroke="#24364f" stroke-width="3" opacity="${facadeOpacity}"/>
    ${line(apexFront, apexBack, `stroke="#da2f26" stroke-width="8" stroke-linecap="round" opacity="${finishP}"`)}
    ${line(leftFront, leftBack, `stroke="#b87344" stroke-width="6" opacity="${finishP * 0.75}"`)}
    ${line(rightFront, rightBack, `stroke="#b87344" stroke-width="6" opacity="${finishP * 0.75}"`)}
  </g>
  <path d="M910 720 C1000 690 1102 698 1182 736" fill="none" stroke="#0f766e" stroke-width="4" opacity="${finishP * 0.65}"/>
</svg>`;
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const poster = createSvg(frameCount - 1);
  await writeFile(join(outDir, "aframe-transform-poster.svg"), poster);

  for (let index = 0; index < frameCount; index += 1) {
    const svg = createSvg(index);
    await sharp(Buffer.from(svg)).png().toFile(join(frameDir, `frame-${String(index).padStart(4, "0")}.png`));
  }

  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const input = join(frameDir, "frame-%04d.png");
  await run(ffmpeg, [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    input,
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "38",
    "-pix_fmt",
    "yuv420p",
    join(outDir, "aframe-transform.webm"),
  ]);
  await run(ffmpeg, [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    input,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "24",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    join(outDir, "aframe-transform.mp4"),
  ]);
}

main().catch((error) => {
  console.error(error.message);
  console.error("Instale ffmpeg ou defina FFMPEG_PATH para gerar mp4/webm.");
  process.exit(1);
});
