// src/Components/PainParticle.js

export class PainParticle {
  constructor(p5, x, y, type, color, speed, heading, bodyMode, pressure = 0.5, customProps = {}) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y);
    this.baseY = y;
    this.type = type;
    this.color = color || [211, 47, 47];
    this.life = 255;
    this.seed = p5.random(1000);
    this.bodyMode = bodyMode;
    this.pressureScale = Number.isFinite(pressure) ? Math.max(0.2, Math.min(1.0, pressure)) : 0.5;
    this.isDynamic = (type === 'wave' || type === 'twist' || type === 'heavy');

    const now = new Date();
    this.drawnAt = now.getTime();
    this.minuteOfDay = now.getHours() * 60 + now.getMinutes();

    // ===== 1. 刺痛 (Pierce) =====
    if (type === 'pierce') {
      const angle = Number.isFinite(heading) ? heading : p5.random(p5.TWO_PI);
      const thrust = p5.random(25, 37) * (0.85 + this.pressureScale * 0.3);
      this.pierceAngle = angle;
      this.thrustLen = thrust;
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(1.8, 3.8);

      this.fissures = [];
      const numFissures = p5.floor(p5.random(3, 5));
      for (let i = 0; i < numFissures; i++) {
        this.fissures.push({
          angle: angle + p5.random(-p5.PI * 0.65, p5.PI * 0.65),
          len: p5.random(3.5, 7.5) * this.pressureScale
        });
      }
    }

//  heavy
else if (type === 'heavy') {
  this.vel = p5.createVector(0, 0);
  this.isDynamic = true;
  this.life = Infinity;
  this.regionSize = customProps?.regionSize || 40;
  this.points = customProps?.points || [];
  this.springStretch = 1.0 / 3.0;
  this.heavyPhase = 'appear';  // ← 把 'drop' 改成 'appear'
  this.phaseFrame = Math.floor(p5.random(0, 20));
  this.pointSeeds = this.points.map(() => p5.random(1000));
  this.shapeSeed = p5.random(1000);
  this.smoothNorm = 0.05;
  this.sinkOffset = 0;
  this.sinkSpeed = 0.0004;
}

    // ===== 3. 绞痛 (Twist) =====
    else if (type === 'twist') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(20, 35) * (0.8 + this.pressureScale * 0.5);
      this.initialSize = this.size;
      this.angle = p5.random(p5.TWO_PI);
      this.minSize = this.size * 0.4;
      // 保存原始颜色
      this.originalColor = color || [211, 47, 47];
    }

    // ===== 4. 酸胀 (Wave) =====
    else if (type === 'wave') {
      this.vel = p5.createVector(0, 0);
      this.size = p5.random(8, 16);
      this.maxSize = p5.random(40, 70) * (0.6 + this.pressureScale * 0.5);
      this.pulseSize = this.size;
    }

    // ===== 5. 撕刮痛 (Scrape) - 修复版 =====
    else if (type === 'scrape') {
      this.vel = p5.createVector(0, 0);
      const moveSpeed = Number.isFinite(speed) ? speed : 6;
      const angle = Number.isFinite(heading) ? heading : p5.random(p5.TWO_PI);

      // 撕扯长度
      const tearLen = Math.max(12, Math.min(35, moveSpeed * 1.3)) * (0.5 + this.pressureScale * 0.8);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // ===== 1. 主纤维（丝丝缕缕）- 修复方向 =====
      this.fibers = [];
      const fiberCount = Math.floor(3 + this.pressureScale * 6);
      for (let i = 0; i < fiberCount; i++) {
        // 让纤维在撕扯方向两侧均匀分布，而不是固定朝上
        const t = (i / fiberCount) * 2 - 1; // -1 到 1 均匀分布
        const longPos = t * tearLen * 0.5;
        const latOffset = (p5.random() - 0.5) * 8 * this.pressureScale;

        // 沿着撕扯方向分布
        const fx = longPos * cosA - latOffset * sinA;
        const fy = longPos * sinA + latOffset * cosA;

        const fiberLen = p5.random(2, 8) * (0.3 + this.pressureScale * 0.7);
        // 纤维角度应该与撕扯方向相关，而不是完全随机
        const angleOffset = (p5.random() - 0.5) * 0.8; // 在撕扯方向附近小幅波动
        const width = p5.random(0.3, 0.7);

        const curlAmount = p5.random(0, 0.5) * this.pressureScale;
        const curlAngle = angle + angleOffset + (p5.random() - 0.5) * 0.5;

        this.fibers.push({
          x: fx, y: fy,
          len: fiberLen,
          width: width,
          angleOffset: angleOffset,
          curlAmount: curlAmount,
          curlAngle: curlAngle,
          alpha: p5.random(150, 230),
          isBroken: p5.random() < 0.3,
          phase: p5.random(p5.TWO_PI)
        });
      }

      // ===== 2. 撕裂碎屑 =====
      this.chunks = [];
      const chunkCount = Math.floor(2 + this.pressureScale * 4);
      for (let i = 0; i < chunkCount; i++) {
        const t = (i / chunkCount) * 2 - 1; // -1 到 1 均匀分布
        const longPos = t * tearLen * 0.35;
        const latOffset = (p5.random() - 0.5) * 10 * this.pressureScale;

        this.chunks.push({
          x: longPos * cosA - latOffset * sinA,
          y: longPos * sinA + latOffset * cosA,
          size: p5.random(1, 3.5) * (0.3 + this.pressureScale * 0.6),
          alpha: p5.random(180, 255),
          driftX: (p5.random() - 0.5) * 0.8, // 更随机的飘散
          driftY: (p5.random() - 0.5) * 0.8,
          rotation: p5.random(p5.TWO_PI),
          rotSpeed: p5.random(-0.02, 0.02),
          life: 30 + p5.random(40)
        });
      }
      // ===== 3. 撕裂组织片 - 模拟刮下的肉片 =====
      this.tissuePieces = [];
      const tissueCount = Math.floor(2 + this.pressureScale * 3);
      for (let i = 0; i < tissueCount; i++) {
        const t = p5.random(0, 1);
        const longPos = (t - 0.5) * tearLen * 0.6;
        const latOffset = (p5.random() - 0.5) * 12 * this.pressureScale;

        // 沿着撕扯方向
        const tx = longPos * cosA - latOffset * sinA;
        const ty = longPos * sinA + latOffset * cosA;

        this.tissuePieces.push({
          x: tx,
          y: ty,
          size: p5.random(3, 8) * (0.3 + this.pressureScale * 0.5),
          rotation: p5.random(p5.TWO_PI),
          rotSpeed: p5.random(-0.01, 0.01),
          alpha: p5.random(150, 220),
          // 组织片形状参数
          stretchX: p5.random(0.6, 1.4),
          stretchY: p5.random(0.6, 1.4),
          // 飘散
          driftX: (p5.random() - 0.5) * 0.3,
          driftY: (p5.random() - 0.5) * 0.3,
          life: 60 + p5.random(60)
        });
      }

      this.life = 150 + this.pressureScale * 80;
    }
  }

  update(p5) {
    if (!this.isDynamic && this.type !== 'pierce') {
      this.pos.add(this.vel);
    }

    if (this.type === 'twist') {
      if (this.size > this.minSize) {
        this.size *= 0.987; // 非常缓慢地缩小
        if (this.size < this.minSize) {
          this.size = this.minSize;
        }
      }
      this.angle += 0.15; // 持续旋转
    } else if (this.type === 'wave') {
      this.pulseSize = this.size + p5.sin(p5.frameCount * 0.05 + this.seed) * (this.maxSize - this.size);
    } else if (this.type === 'scrape') {
      this.life -= 0.8 + this.pressureScale * 0.3;
      this.vel.mult(0);

      // ✅ 碎屑飘散
      this.chunks.forEach(c => {
        c.x += c.driftX * 0.3;
        c.y += c.driftY * 0.3;
        c.rotation += c.rotSpeed;
        c.life -= 0.8;
        c.alpha = Math.max(0, c.alpha - 2);
        // 慢慢变淡消失
      });
      this.tissuePieces.forEach(t => {
        t.x += t.driftX * 0.2;
        t.y += t.driftY * 0.2;
        t.rotation += t.rotSpeed;
        t.life -= 0.5;
        t.alpha = Math.max(0, t.alpha - 1);
      });
    } else if (this.type === 'pierce') {
      this.life -= 25;
      this.vel.mult(0);
    }
    // ===== heavy =====
// ===== update 中的 heavy =====
else if (this.type === 'heavy') {
  const minStretch = 1.0 / 3.0;
  const stretchRange = 1.0 - minStretch;

  this.phaseFrame++;

  let normFactor = 0;

  if (this.heavyPhase === 'appear') {
    const u = Math.min(1.0, this.phaseFrame / 60);
    normFactor = 0.05 + u * u * 0.45;
    normFactor = Math.min(0.50, normFactor);

    if (this.phaseFrame >= 60) {
      this.heavyPhase = 'sinking';
      this.phaseFrame = 0;
      this.startNorm = normFactor;
    }
  } else if (this.heavyPhase === 'sinking') {
    // 总周期 600 帧 (10秒)
    const progress = this.phaseFrame / 600;
    
    const startVal = this.startNorm || 0.50;
    // 上升幅度缩小：从 0.50 到 0.85 (只上升 0.35)
    const maxVal = 0.85;
    const range = maxVal - startVal; // 0.35
    
    // 正弦波：0 → 1 → 0，周期 600 帧
    const angle = progress * Math.PI * 2;
    const raw = (Math.sin(angle) + 1) / 2; // 0-1
    
    // 让底部停留更久 (raw > 0.7 时放慢)
    let adjusted;
    if (raw > 0.7) {
      const t = (raw - 0.7) / 0.3;
      adjusted = 0.7 + t * 0.3 * 0.5; // 波峰更平缓
    } else {
      const t = raw / 0.7;
      adjusted = t * t * 0.7;
    }
    
    normFactor = startVal + adjusted * range;
    normFactor = Math.max(startVal, Math.min(maxVal, normFactor));

    if (this.phaseFrame >= 600) {
      this.phaseFrame = 0;
    }
  }

  this.normFactor = Math.max(0.05, Math.min(0.98, normFactor));
  this.springStretch = minStretch + this.normFactor * stretchRange;

  if (!this.history) this.history = [];
  this.history.push({ normFactor: this.normFactor, time: Date.now() });
  if (this.history.length > 15) this.history.shift();
}
  }

  show(pg) {
    const p = pg || this.p5;
    if (!p) return;

    // ===== 1. 刺痛 =====
    if (this.type === 'pierce') {
      const tipX = this.pos.x;
      const tipY = this.pos.y;
      const angle = this.pierceAngle;
      const thrust = this.thrustLen;

      const tailX = tipX - p.cos(angle) * thrust;
      const tailY = tipY - p.sin(angle) * thrust;
      const perpAngle = angle + p.PI / 2;

      p.push();

      const tailW = 0.9;
      p.noStroke();
      p.fill(
        Math.min(255, this.color[0] + 160),
        Math.min(255, this.color[1] + 140),
        Math.min(255, this.color[2] + 140),
        220
      );
      p.beginShape();
      p.vertex(tailX + p.cos(perpAngle) * tailW, tailY + p.sin(perpAngle) * tailW);
      p.vertex(tipX, tipY);
      p.vertex(tailX - p.cos(perpAngle) * tailW, tailY - p.sin(perpAngle) * tailW);
      p.endShape(p.CLOSE);

      p.stroke(255, 255, 255, 250);
      p.strokeWeight(0.55);
      p.line(tailX, tailY, tipX, tipY);

      p.stroke(this.color[0], this.color[1] * 0.3, this.color[2] * 0.3, 130);
      p.strokeWeight(1.0);
      p.line(tailX, tailY, tipX, tipY);

      p.fill(this.color[0], this.color[1], this.color[2], 220);
      p.noStroke();
      p.ellipse(tailX, tailY, 1.8, 1.8);
      p.fill(255, 255, 255, 255);
      p.ellipse(tipX, tipY, 1.2, 1.2);

      if (this.fissures) {
        p.stroke(this.color[0], 0, 0, 180);
        p.strokeWeight(0.5);
        this.fissures.forEach(fis => {
          const fEndX = tipX + p.cos(fis.angle) * fis.len;
          const fEndY = tipY + p.sin(fis.angle) * fis.len;
          p.line(tipX, tipY, fEndX, fEndY);
        });
      }

      p.pop();
    }

 // ===== 2. 坠痛 (Heavy) =====
else if (this.type === 'heavy') {
  if (!this.points || this.points.length < 2) return;

  const [r, g, b] = this.color;
  const d = this.normFactor || 0.05;
  const history = this.history || [];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  this.points.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });

  const boxW = Math.max(maxX - minX, 24);
  const boxH = Math.max(maxY - minY, 24);
  const cx = this.pos.x;
  const cy = this.pos.y;

  // ===== 残影 =====
  for (let h = 0; h < history.length - 1; h++) {
    const entry = history[h];
    if (!entry) continue;
    const alphaMul = (h / history.length) * 0.08;
    if (alphaMul < 0.01) continue;

    const histD = entry.normFactor || 0.05;
    const histBrightness = 0.35 + histD * 0.55;
    const histR = Math.min(255, r * (0.25 + histBrightness * 0.75));
    const histG = Math.min(255, g * (0.25 + histBrightness * 0.75));
    const histB = Math.min(255, b * (0.25 + histBrightness * 0.75));

    const histStretch = boxH * 2.8 * histD;
    const histOffsets = [0];
    const weights = [0.08, 0.14, 0.18, 0.20, 0.20, 0.20];
    for (let i = 1; i < 12; i++) {
      histOffsets.push(histOffsets[i - 1] + histStretch * weights[Math.min(i - 1, weights.length - 1)]);
    }

    p.push();
    p.translate(cx, cy);
    p.noStroke();

    const alphas = [0.01, 0.02, 0.035, 0.05, 0.065, 0.08, 0.09, 0.10, 0.105, 0.11, 0.115, 0.12];
    const sizes = [1.0, 0.97, 0.94, 0.90, 0.85, 0.79, 0.72, 0.64, 0.55, 0.45, 0.34, 0.22];
    for (let i = 0; i < 12; i++) {
      const w = boxW * 1.3 * sizes[i];
      const hh = boxH * 1.3 * sizes[i];
      p.fill(histR, histG, histB, alphas[i] * alphaMul * 35);
      p.ellipse(0, histOffsets[i] * 0.25, w, hh);
    }
    p.pop();
  }

  // ===== 主体：12层 =====
  const baseAlpha = Math.min(255, 170 + d * 85);
  const layerCount = 12;

  const layerBrightness = [];
  const layerAlphas = [];
  const sizeScales = [];

  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const brightness = 0.50 - t * 0.46;
    layerBrightness.push(Math.max(0.08, brightness));
    const alpha = baseAlpha * (0.04 + t * 0.92);
    layerAlphas.push(alpha);
    const scale = 0.35 + t * 0.75;
    sizeScales.push(scale);
  }

  const layerVisibility = [];
  for (let i = 0; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const start = 0.02 + t * 0.02;
    const end = 0.05 + t * 0.90;
    let vis = (d - start) / (end - start);
    vis = Math.max(0, Math.min(1, vis));
    vis = vis * vis * (3 - 2 * vis);
    layerVisibility.push(vis);
  }

  const baseLayers = sizeScales.map((scale, idx) => ({
    w: boxW * 1.3 * scale,
    h: boxH * 1.3 * scale,
    r: Math.min(255, r * layerBrightness[idx]),
    g: Math.min(255, g * layerBrightness[idx]),
    b: Math.min(255, b * layerBrightness[idx]),
    alpha: layerAlphas[idx] * layerVisibility[idx]
  }));

  // ===== 层间偏移 =====
  const layerYOffsets = [0];
  const totalStretch = boxH * 2.8 * d;
  for (let i = 1; i < layerCount; i++) {
    const t = i / (layerCount - 1);
    const weight = t * t * t * 0.7 + t * 0.3;
    const deltaY = totalStretch * weight / (layerCount - 1) * 2.0;
    layerYOffsets.push(layerYOffsets[i - 1] + deltaY);
  }

  const deepestY = layerYOffsets[layerYOffsets.length - 1] + baseLayers[baseLayers.length - 1].h * 0.5;

  p.push();
  p.translate(cx, cy);

  // ===== 平滑形状 =====
  const drawSmooth = (cx, cy, w, h, offsetY, alpha, color, irregularity = 0.02) => {
    if (alpha < 1) return;
    const numPoints = 28;
    p.fill(color[0], color[1], color[2], alpha);
    p.noStroke();
    p.beginShape();
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * p.TWO_PI;
      const noiseVal = 1 + Math.sin(i * 3.7 + this.seed) * irregularity;
      const x = cx + w * 0.5 * noiseVal * Math.cos(angle);
      const y = cy + offsetY + h * 0.5 * noiseVal * Math.sin(angle);
      p.vertex(x, y);
    }
    p.endShape(p.CLOSE);
  };

  // ===== 阴影 =====
  p.noStroke();
  const shadowAlpha = Math.min(140, 10 + d * 130);
  p.fill(0, 0, 0, shadowAlpha * 0.04);
  p.ellipse(0, deepestY + 4, baseLayers[11].w * 2.0, 5 + d * 10);
  p.fill(0, 0, 0, shadowAlpha * 0.07);
  p.ellipse(0, deepestY + 8, baseLayers[11].w * 1.4, 3 + d * 6);
  p.fill(0, 0, 0, shadowAlpha * 0.10);
  p.ellipse(0, deepestY + 12, baseLayers[11].w * 0.8, 2 + d * 3);

  // ===== 绘制所有层 =====
  for (let i = 0; i < baseLayers.length; i++) {
    const layer = baseLayers[i];
    if (layer.alpha < 1) continue;
    const offsetFactor = 0.10 + 0.90 * (i / (baseLayers.length - 1));
    const irreg = 0.01 + (i / (baseLayers.length - 1)) * 0.025;
    drawSmooth(
      0,
      layerYOffsets[i] * offsetFactor,
      layer.w,
      layer.h,
      0,
      layer.alpha,
      [layer.r, layer.g, layer.b],
      irreg
    );
  }

  // ===== 底部深色拉长块 =====
  if (d > 0.4) {
    const blockW = baseLayers[11].w * 0.35 + d * 10;
    const blockH = baseLayers[11].h * 0.10 + d * 7;
    const darkR = Math.min(255, r * 0.05);
    const darkG = Math.min(255, g * 0.05);
    const darkB = Math.min(255, b * 0.05);
    const blockAlpha = Math.min(200, 20 + d * 180) * Math.min(1, (d - 0.4) * 2.5);
    p.fill(darkR, darkG, darkB, blockAlpha);
    p.beginShape();
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * p.TWO_PI;
      const rFactor = 1 + Math.sin(i * 2.1 + this.seed + d) * 0.04;
      const x = blockW * 0.5 * rFactor * Math.cos(angle);
      const y = deepestY + (blockH * 0.5) * rFactor * Math.sin(angle) * 0.25;
      p.vertex(x, y);
    }
    p.endShape(p.CLOSE);
  }

  // ===== 笔触点 =====
  const numDots = Math.min(this.points.length, 30);
  for (let k = 0; k < numDots; k++) {
    const idx = Math.floor(k * this.points.length / numDots);
    const pt = this.points[idx];
    if (!pt) continue;
    const intensity = pt.intensity || 0.5;
    const dotSize = 1.5 + intensity * 3;
    p.noStroke();
    const dotBrightness = 0.15 + d * 0.35;
    p.fill(
      Math.min(255, r * dotBrightness * 0.5),
      Math.min(255, g * dotBrightness * 0.5),
      Math.min(255, b * dotBrightness * 0.5),
      50 + intensity * 70
    );
    const yRatio = (pt.y - minY) / (maxY - minY + 0.01);
    const layerIdx = Math.floor(yRatio * (baseLayers.length - 1));
    const offsetY = layerYOffsets[Math.min(layerIdx, baseLayers.length - 1)] || 0;
    p.ellipse(
      pt.x - cx,
      pt.y - cy + offsetY * 0.15,
      dotSize * 0.3,
      dotSize * 0.2
    );
  }

  p.pop();
}

    // ===== 3. 绞痛 (Twist)  =====
    else if (this.type === 'twist') {
      const sizeRatio = Math.max(0.25, this.size / this.initialSize);
      const [r, g, b] = this.originalColor || this.color;

      p.push();
      p.translate(this.pos.x, this.pos.y);
      p.rotate(this.angle);

      // ===== 1. 同心螺旋细丝 - 一圈一圈绕着中心 =====
      const numLayers = Math.max(12, Math.floor(20 * sizeRatio));
      for (let layer = 0; layer < numLayers; layer++) {
        const t = layer / numLayers;
        // 从外圈到内圈
        const radius = this.size * (0.9 - t * 0.75);
        const alpha = 40 + 30 * (1 - t) + 20 * Math.sin(layer * 1.3 + this.seed);
        const thickness = 0.6 + 1.2 * (1 - t * 0.5);

        p.stroke(
          Math.min(255, r * (0.7 + 0.2 * (1 - t))),
          Math.min(255, g * (0.4 + 0.2 * (1 - t))),
          Math.min(255, b * (0.4 + 0.2 * (1 - t))),
          alpha * 0.5 * Math.min(1, sizeRatio * 1.3)
        );
        p.strokeWeight(Math.max(0.4, thickness * sizeRatio));
        p.noFill();

        // 每一圈是不完整的圆，形成螺旋感
        const segmentStart = layer * 0.15;
        const segmentEnd = segmentStart + 0.6 + 0.3 * (1 - t);
        p.beginShape();
        for (let a = segmentStart * p.TWO_PI; a < segmentEnd * p.TWO_PI; a += 0.05) {
          const wave = Math.sin(a * 3 + layer * 0.5 + this.seed) * 0.03 * this.size;
          const x = (radius + wave) * Math.cos(a + this.angle * 0.1 * (1 - t));
          const y = (radius + wave) * Math.sin(a + this.angle * 0.1 * (1 - t));
          p.vertex(x, y);
        }
        p.endShape();
      }

      // ===== 2. 细密同心环 - 增加密度 =====
      const numRings = Math.max(20, Math.floor(32 * sizeRatio));
      for (let i = 0; i < numRings; i++) {
        const t = i / numRings;
        const radius = this.size * (0.85 - t * 0.75);
        const alpha = 20 + 20 * (1 - t) + 15 * Math.sin(i * 2.1 + this.seed * 0.7);

        p.stroke(
          Math.min(255, r * 0.5),
          Math.min(255, g * 0.25),
          Math.min(255, b * 0.25),
          alpha * 0.35 * Math.min(1, sizeRatio * 1.3)
        );
        p.strokeWeight(Math.max(0.2, 0.5 * sizeRatio));
        p.noFill();

        // 每个环也是不完整的，形成绞拧的纹理
        const startA = i * 0.2;
        const endA = startA + 0.5 + 0.3 * (1 - t);
        p.beginShape();
        for (let a = startA * p.TWO_PI; a < endA * p.TWO_PI; a += 0.04) {
          const wave = Math.sin(a * 4 + i * 0.7 + this.seed + this.angle * 0.05) * 0.02 * this.size;
          const x = (radius + wave) * Math.cos(a + this.angle * 0.08 * (1 - t));
          const y = (radius + wave) * Math.sin(a + this.angle * 0.08 * (1 - t));
          p.vertex(x, y);
        }
        p.endShape();
      }

      // ===== 3. 第一组交叉螺旋（顺时针） =====
      p.noFill();
      p.stroke(
        Math.min(255, r * 0.9),
        Math.min(255, g * 0.6),
        Math.min(255, b * 0.6),
        Math.min(255, (170 + this.pressureScale * 60) * Math.min(1, sizeRatio * 1.4))
      );
      p.strokeWeight(Math.max(1.2, 2.5 * sizeRatio));
      p.beginShape();
      const turns1 = 2.2;
      for (let a = 0; a < p.TWO_PI * turns1; a += 0.04) {
        const t = a / (p.TWO_PI * turns1);
        const radius = this.size * (1.1 - t * 0.85);
        // 轻微波浪扭曲
        const wave = Math.sin(a * 2.5 + this.seed) * 0.03 * this.size;
        const x = (radius + wave) * Math.cos(a + this.angle * 0.3);
        const y = (radius + wave) * Math.sin(a + this.angle * 0.3);
        p.vertex(x, y);
      }
      p.endShape();

      // ===== 4. 第二组交叉螺旋（逆时针）- 与第一组交叉 =====
      p.stroke(
        Math.min(255, r * 0.75),
        Math.min(255, g * 0.45),
        Math.min(255, b * 0.45),
        Math.min(255, (140 + this.pressureScale * 45) * Math.min(1, sizeRatio * 1.4))
      );
      p.strokeWeight(Math.max(1.0, 2.0 * sizeRatio));
      p.beginShape();
      const turns2 = 2.0;
      for (let a = 0; a < p.TWO_PI * turns2; a += 0.04) {
        const t = a / (p.TWO_PI * turns2);
        const radius = this.size * (1.0 - t * 0.8);
        const wave = Math.sin(a * 2.8 + this.seed * 1.3 + 0.5) * 0.03 * this.size;
        // 逆时针：使用 -a
        const x = (radius + wave) * Math.cos(-a + this.angle * 0.25 + 0.2);
        const y = (radius + wave) * Math.sin(-a + this.angle * 0.25 + 0.2);
        p.vertex(x, y);
      }
      p.endShape();

      // ===== 5. 交叉节点 - 在交叉处加强，突出绞拧感 =====
      const numNodes = Math.max(8, Math.floor(14 * sizeRatio));
      for (let i = 0; i < numNodes; i++) {
        const t = i / numNodes;
        const radius = this.size * (0.15 + 0.7 * (1 - t * 0.6));
        const angle1 = t * p.TWO_PI * 1.8 + this.angle * 0.2;
        const angle2 = -t * p.TWO_PI * 1.6 + this.angle * 0.15 + 0.3;

        // 两个螺旋交叉的位置
        const x1 = radius * Math.cos(angle1);
        const y1 = radius * Math.sin(angle1);
        const x2 = radius * Math.cos(angle2);
        const y2 = radius * Math.sin(angle2);
        const cx = (x1 + x2) * 0.5;
        const cy = (y1 + y2) * 0.5;

        // 交叉点加深
        const nodeSize = 2 + 4 * (1 - t * 0.4) * sizeRatio;
        const nodeAlpha = 60 + 60 * (1 - t * 0.3);
        p.noStroke();
        p.fill(
          Math.min(255, r * 0.6),
          Math.min(255, g * 0.3),
          Math.min(255, b * 0.3),
          nodeAlpha * Math.min(1, sizeRatio * 1.3)
        );
        p.ellipse(cx, cy, nodeSize, nodeSize);
      }

      // ===== 6. 中心交叉核心 =====
      const coreSize = this.size * 0.25;
      if (coreSize > 0.15) {
        // 交叉拧紧的核心 - 两个螺旋在中心交汇
        p.noStroke();

        // 核心外层 - 交叉纹路
        p.fill(
          Math.min(255, r * 0.8),
          Math.min(255, g * 0.45),
          Math.min(255, b * 0.45),
          Math.min(255, (200 + this.pressureScale * 50) * Math.min(1, sizeRatio * 1.6))
        );
        p.beginShape();
        const numPoints = 16;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * p.TWO_PI;
          // 心形扭曲 - 模拟交叉拧紧
          const twistFactor = 1 + 0.3 * Math.sin(angle * 2 + this.angle * 0.5 + this.seed);
          const rad = coreSize * (0.6 + 0.4 * twistFactor * (0.5 + 0.5 * Math.sin(i * 0.5 + this.seed)));
          p.vertex(rad * Math.cos(angle + this.angle * 0.2), rad * Math.sin(angle + this.angle * 0.2));
        }
        p.endShape(p.CLOSE);

        // 核心中层 - 交叉加深
        const midCore = coreSize * 0.55;
        p.fill(
          Math.min(255, r * 0.55),
          Math.min(255, g * 0.28),
          Math.min(255, b * 0.28),
          Math.min(255, (170 + this.pressureScale * 35) * Math.min(1, sizeRatio * 1.6))
        );
        p.beginShape();
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * p.TWO_PI;
          const twistFactor = 1 + 0.25 * Math.sin(angle * 3 + this.angle * 0.4 + this.seed * 1.3);
          const rad = midCore * (0.6 + 0.4 * twistFactor * (0.5 + 0.5 * Math.sin(i * 0.7 + this.seed)));
          p.vertex(rad * Math.cos(angle + this.angle * 0.3), rad * Math.sin(angle + this.angle * 0.3));
        }
        p.endShape(p.CLOSE);

        // 核心内层 - 最紧
        const innerCore = coreSize * 0.3;
        p.fill(
          Math.min(255, r * 0.3),
          Math.min(255, g * 0.15),
          Math.min(255, b * 0.15),
          Math.min(255, (140 + this.pressureScale * 25) * Math.min(1, sizeRatio * 1.5))
        );
        p.beginShape();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * p.TWO_PI;
          const rad = innerCore * (0.5 + 0.5 * Math.sin(i * 4 + this.angle * 0.5 + this.seed * 0.7));
          p.vertex(rad * Math.cos(angle + this.angle * 0.4), rad * Math.sin(angle + this.angle * 0.4));
        }
        p.endShape(p.CLOSE);

        // 核心高光
        p.fill(
          255,
          255,
          255,
          (35 + this.pressureScale * 20) * Math.min(1, sizeRatio * 1.2)
        );
        p.ellipse(-coreSize * 0.1, -coreSize * 0.1, coreSize * 0.15, coreSize * 0.12);
      }

      p.pop();
    }

    // ===== 4. 酸胀 =====
    else if (this.type === 'wave') {
      p.noStroke();
      p.fill(this.color[0], this.color[1], this.color[2], 10);
      p.ellipse(this.pos.x, this.pos.y, this.pulseSize, this.pulseSize);

      p.fill(this.color[0], this.color[1], this.color[2], 6 + (14 * this.pressureScale));
      p.ellipse(this.pos.x, this.pos.y, this.pulseSize * 0.7, this.pulseSize * 0.7);
    }

    // ===== 修复 show 方法中的 scrape - 纤维更透明 =====
    else if (this.type === 'scrape') {
      const [r, g, b] = this.color;
      const alpha = Math.max(0, this.life / 255);

      const isReddish = r > g && r > b;
      let rCol, gCol, bCol;
      if (isReddish) {
        rCol = Math.min(255, r * 0.8 + 30);
        gCol = Math.min(255, g * 0.4 + 20);
        bCol = Math.min(255, b * 0.4 + 20);
      } else {
        rCol = Math.min(255, r * 0.8 + 30);
        gCol = Math.min(255, g * 0.8 + 30);
        bCol = Math.min(255, b * 0.8 + 30);
      }

      p.push();
      p.translate(this.pos.x, this.pos.y);

      // ===== 1. 主纤维 - 更透明更细 =====
      this.fibers.forEach(f => {
        // 大幅降低透明度
        const fAlpha = f.alpha * alpha * 0.3; // 从 0.8 降到 0.3
        const len = f.len;

        // 颜色更淡
        p.stroke(
          Math.min(255, rCol * 0.5 + 30),
          Math.min(255, gCol * 0.5 + 30),
          Math.min(255, bCol * 0.5 + 30),
          fAlpha
        );
        // 纤维更细
        p.strokeWeight(f.width * 0.5);

        const fiberAngle = this.angle + f.angleOffset;
        const startX = f.x - len * 0.5 * Math.cos(fiberAngle);
        const startY = f.y - len * 0.5 * Math.sin(fiberAngle);
        const midX = f.x;
        const midY = f.y;
        const endX = f.x + len * 0.5 * Math.cos(fiberAngle);
        const endY = f.y + len * 0.5 * Math.sin(fiberAngle);
        const curlEndX = endX + Math.cos(f.curlAngle) * f.curlAmount * 2;
        const curlEndY = endY + Math.sin(f.curlAngle) * f.curlAmount * 2;

        if (f.isBroken) {
          p.line(startX, startY, midX, midY);
          p.stroke(
            Math.min(255, rCol * 0.4 + 20),
            Math.min(255, gCol * 0.4 + 20),
            Math.min(255, bCol * 0.4 + 20),
            fAlpha * 0.3
          );
          p.strokeWeight(f.width * 0.3);
          const scatterX = Math.sin(f.phase + this.life * 0.02) * 2;
          const scatterY = Math.cos(f.phase * 1.3) * 2;
          p.line(midX, midY, midX + scatterX, midY + scatterY);
        } else {
          p.line(startX, startY, midX, midY);
          p.line(midX, midY, endX, endY);
          if (f.curlAmount > 0.1) {
            p.stroke(
              Math.min(255, rCol * 0.4 + 20),
              Math.min(255, gCol * 0.4 + 20),
              Math.min(255, bCol * 0.4 + 20),
              fAlpha * 0.4
            );
            p.strokeWeight(f.width * 0.4);
            p.line(endX, endY, curlEndX, curlEndY);
          }
        }
      });

      // ===== 2. 撕裂碎屑 - 更透明 =====
      this.chunks.forEach(c => {
        if (c.life <= 0 || c.alpha <= 0) return;
        const cAlpha = c.alpha * alpha * 0.3; // 从 0.6 降到 0.3
        p.noStroke();
        p.fill(
          Math.min(255, rCol * 0.5 + 20),
          Math.min(255, gCol * 0.5 + 20),
          Math.min(255, bCol * 0.5 + 20),
          cAlpha
        );
        p.push();
        p.translate(c.x, c.y);
        p.rotate(c.rotation);
        const size = c.size * (0.8 + 0.4 * Math.sin(c.life * 0.05));
        p.ellipse(0, 0, size * 0.6, size * 0.6 * (0.5 + 0.5 * Math.sin(c.life * 0.07 + 1)));
        p.pop();
      });

      // ===== 3. 撕裂组织片 - 刮下的肉片质感 =====
      this.tissuePieces.forEach(t => {
        if (t.life <= 0 || t.alpha <= 0) return;

        const tAlpha = t.alpha * alpha * 0.5;
        // 组织片颜色略深，有血丝感
        p.noStroke();
        p.fill(
          Math.min(255, rCol * 0.6 + 20),
          Math.min(255, gCol * 0.3 + 10),
          Math.min(255, bCol * 0.3 + 10),
          tAlpha
        );

        p.push();
        p.translate(t.x, t.y);
        p.rotate(t.rotation);

        // 不规则形状 - 像撕下的组织片
        const size = t.size * (0.7 + 0.3 * Math.sin(t.life * 0.03 + this.seed));
        p.beginShape();
        const numPoints = 6 + Math.floor(p.random(3));
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * p.TWO_PI + p.sin(i * 1.3 + this.seed) * 0.2;
          const r = size * (0.6 + 0.4 * p.sin(i * 2.1 + this.seed * 1.3 + t.life * 0.01));
          const x = r * p.cos(angle) * t.stretchX;
          const y = r * p.sin(angle) * t.stretchY * 0.6;
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);

        // 组织片上的血丝纹理
        if (p.random() < 0.4) {
          p.stroke(
            Math.min(255, rCol * 0.4 + 10),
            Math.min(255, gCol * 0.15 + 5),
            Math.min(255, bCol * 0.15 + 5),
            tAlpha * 0.3
          );
          p.strokeWeight(0.3);
          const lineAngle = p.random(p.TWO_PI);
          const lineLen = size * 0.6 * p.random(0.3, 0.8);
          p.line(
            -lineLen * 0.5 * p.cos(lineAngle),
            -lineLen * 0.5 * p.sin(lineAngle),
            lineLen * 0.5 * p.cos(lineAngle),
            lineLen * 0.5 * p.sin(lineAngle)
          );
        }

        p.pop();

        // 更新组织片
        t.x += t.driftX * 0.2;
        t.y += t.driftY * 0.2;
        t.rotation += t.rotSpeed;
        t.life -= 0.5;
        t.alpha = Math.max(0, t.alpha - 1);
      });

      // ===== 3. 浅色撕裂边缘 - 更淡 =====
      p.noFill();
      p.stroke(
        Math.min(255, rCol * 0.3 + 20),
        Math.min(255, gCol * 0.3 + 20),
        Math.min(255, bCol * 0.3 + 20),
        20 * alpha
      );
      p.strokeWeight(0.3);
      for (let i = -1; i <= 1; i++) {
        if (i === 0) continue;
        p.beginShape();
        for (let t = -0.6; t <= 0.6; t += 0.1) {
          const x = t * 20 + Math.sin(t * 5 + i * 2) * 2;
          const y = i * 2 + Math.cos(t * 4 + i * 1.5) * 1.5;
          p.vertex(x, y);
        }
        p.endShape();
      }

      p.pop();
    }
  }


  isDead() {
    return this.life < 0;
  }
}

export default PainParticle;