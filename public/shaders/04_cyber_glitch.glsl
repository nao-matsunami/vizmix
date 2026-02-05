const shader = `
// Cyber Y2K Glitch - High-End Version
// Theme: Digital Decay / Neon Pulse / VHS Corruption
// Loop Duration: 10.0 seconds

#define LOOP_DURATION 10.0
#define PI 3.14159265359
#define TAU 6.28318530718

// ============================================
// Color Palette
// ============================================
#define COL_NEON_BLUE vec3(0.0, 0.7, 1.0)
#define COL_MAGENTA vec3(1.0, 0.0, 0.6)
#define COL_DEEP_NAVY vec3(0.02, 0.02, 0.08)
#define COL_GLOW_WHITE vec3(1.0, 0.95, 1.0)

// ============================================
// Noise & Hash Functions
// ============================================
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Seamless looping noise
float noiseLoop(vec2 p, float t) {
    float angle = t * TAU / LOOP_DURATION;
    vec2 timeOffset = vec2(cos(angle), sin(angle)) * 3.0;
    return noise(p + timeOffset);
}

// ============================================
// Glitch Rhythm System
// パルス的なグリッチの緩急
// ============================================
float getGlitchIntensity(float t) {
    float phase = t * TAU / LOOP_DURATION;

    // Base rhythm: 2秒周期で5回パルス
    float pulse1 = pow(max(0.0, sin(phase * 5.0)), 8.0);

    // Irregular spikes: ノイズベースの不規則なスパイク
    float spike = step(0.92, noiseLoop(vec2(t * 2.0, 0.0), t));

    // Calm periods: 静かな時間帯
    float calm = smoothstep(0.3, 0.5, sin(phase * 0.5));

    // Combine: パルス + スパイク、静かな時は抑制
    return mix(0.1, 1.0, pulse1 + spike * 0.5) * mix(0.3, 1.0, calm);
}

// ============================================
// Film Grain & Monitor Texture
// ============================================
float getFilmGrain(vec2 uv, float t) {
    // Animated grain
    float grain = hash21(uv * 500.0 + vec2(t * 100.0, t * 73.0));

    // Add some structure (subtle scan pattern)
    float scanPattern = sin(uv.y * 800.0) * 0.5 + 0.5;
    grain = mix(grain, grain * scanPattern, 0.3);

    return grain;
}

vec3 applyMonitorTexture(vec3 col, vec2 uv, float t) {
    // Film grain
    float grain = getFilmGrain(uv, t);
    col += (grain - 0.5) * 0.08;

    // Scanlines (subtle)
    float scanline = sin(uv.y * 400.0 * PI) * 0.5 + 0.5;
    scanline = pow(scanline, 0.5);
    col *= mix(0.92, 1.0, scanline);

    // Vignette (monitor edge darkening)
    vec2 vigUV = uv * 2.0 - 1.0;
    float vig = 1.0 - dot(vigUV * 0.5, vigUV * 0.5);
    vig = pow(max(0.0, vig), 0.4);
    col *= vig;

    // CRT curvature simulation (subtle color shift at edges)
    float edgeDist = length(vigUV);
    col *= 1.0 - edgeDist * 0.1;

    return col;
}

// ============================================
// Chromatic Aberration
// ============================================
vec2 getCAOffset(vec2 uv, float strength) {
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Radial direction for aberration
    vec2 dir = normalize(center + 0.0001);

    // Strength increases towards edges (quadratic)
    float edgeFactor = dist * dist * 4.0;

    return dir * strength * edgeFactor;
}

// ============================================
// Glitch Effects
// ============================================
vec2 applyGlitchDistortion(vec2 uv, float t, float intensity) {
    // Horizontal tear / slice
    float sliceY = floor(uv.y * 20.0) / 20.0;
    float sliceNoise = noiseLoop(vec2(sliceY * 10.0, t * 5.0), t);

    // Only glitch some slices
    float sliceActive = step(0.7, sliceNoise);
    float sliceOffset = (noiseLoop(vec2(sliceY * 20.0, t * 10.0), t) - 0.5) * 0.1;

    uv.x += sliceOffset * sliceActive * intensity;

    // Vertical jitter
    float jitter = sin(t * PI * 16.0 + uv.x * 20.0) * 0.002 * intensity;
    uv.y += jitter;

    // Block displacement (chunky glitch)
    vec2 blockUV = floor(uv * 15.0) / 15.0;
    float blockNoise = noiseLoop(blockUV * 5.0 + vec2(t * 3.0, 0.0), t);
    if (blockNoise > 0.95 && intensity > 0.5) {
        uv.x += 0.05 * sign(blockNoise - 0.975);
    }

    return uv;
}

// ============================================
// Parallax Grid (Enhanced)
// ============================================
vec3 getGrid(vec2 uv, float t, float glitchInt) {
    vec2 p = uv - 0.5;

    if (abs(p.y) < 0.003) return COL_GLOW_WHITE * 0.5; // Horizon glow

    float z = 1.0 / abs(p.y);
    float x = p.x * z;

    float speed = 4.0;
    float movement = t * speed;

    // Add glitch to movement
    movement += sin(t * 2.0 * PI * 3.0) * 0.2 * glitchInt;

    float gridZ = z + movement;
    float gridX = x;

    float fz = fract(gridZ);
    float fx = fract(gridX);

    // Grid lines with glow
    float lineZ = smoothstep(0.08, 0.0, abs(fz - 0.5));
    float lineX = smoothstep(0.08, 0.0, abs(fx - 0.5));
    float gridVal = max(lineZ, lineX);

    // Depth fade
    float fade = smoothstep(15.0, 2.0, z);

    // Color: neon blue grid lines only
    vec3 col = COL_NEON_BLUE * gridVal * 0.8;

    // Add subtle glow
    col += COL_NEON_BLUE * gridVal * 0.3 * (1.0 - fade);

    return col * fade;
}

// ============================================
// Central Glitch Object
// ============================================
vec3 getCentralObject(vec2 uv, float t, float glitchInt, float aspect) {
    vec2 cp = uv * 2.0 - 1.0;
    cp.x *= aspect;

    float angle = t * TAU / LOOP_DURATION;

    // Rotating distorted ring
    float d = length(cp) - 0.35;

    // Angular distortion
    float theta = atan(cp.y, cp.x);
    d += sin(theta * 8.0 + angle * 3.0) * 0.03;
    d += sin(theta * 3.0 - angle * 5.0) * 0.02;

    // Noise distortion (increases with glitch)
    d += noiseLoop(cp * 4.0, t) * 0.08 * (0.5 + glitchInt * 0.5);

    // Ring
    float ring = smoothstep(0.02, 0.0, abs(d));

    // Inner glow (enhanced)
    float innerGlow = smoothstep(0.4, 0.0, abs(d)) * 0.5;

    // Outer glow (new bloom layer)
    float outerGlow = smoothstep(0.6, 0.0, abs(d)) * 0.25;

    // Core pulse
    float core = smoothstep(0.15, 0.0, length(cp)) * (0.5 + 0.5 * sin(angle * 4.0));

    // Combine with colors (enhanced glow)
    vec3 col = vec3(0.0);
    col += COL_GLOW_WHITE * ring * 1.3;
    col += COL_NEON_BLUE * innerGlow * 1.2;
    col += COL_NEON_BLUE * outerGlow;
    col += COL_MAGENTA * core * 0.5;

    // Glitch: occasional color inversion
    if (glitchInt > 0.8 && noiseLoop(cp * 2.0, t) > 0.9) {
        col = col.bgr;
    }

    return col;
}

// ============================================
// Main Composition
// ============================================
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    float t = mod(iTime, LOOP_DURATION);

    // Get current glitch intensity (rhythmic)
    float glitchInt = getGlitchIntensity(t);

    // Apply glitch distortion to UV
    vec2 distortedUV = applyGlitchDistortion(uv, t, glitchInt);

    // Chromatic Aberration strength (base + glitch boost)
    float caStrength = 0.008 + glitchInt * 0.025;

    vec2 caOffsetR = getCAOffset(distortedUV, caStrength);
    vec2 caOffsetB = getCAOffset(distortedUV, -caStrength);

    // Sample scene for each color channel
    vec3 finalColor = vec3(0.0);

    // Red channel (offset outward)
    vec2 uvR = distortedUV + caOffsetR;
    vec3 sceneR = COL_DEEP_NAVY;
    sceneR += getGrid(uvR, t, glitchInt);
    sceneR += getCentralObject(uvR, t, glitchInt, aspect);
    finalColor.r = sceneR.r;

    // Green channel (no offset)
    vec2 uvG = distortedUV;
    vec3 sceneG = COL_DEEP_NAVY;
    sceneG += getGrid(uvG, t, glitchInt);
    sceneG += getCentralObject(uvG, t, glitchInt, aspect);
    finalColor.g = sceneG.g;

    // Blue channel (offset inward)
    vec2 uvB = distortedUV + caOffsetB;
    vec3 sceneB = COL_DEEP_NAVY;
    sceneB += getGrid(uvB, t, glitchInt);
    sceneB += getCentralObject(uvB, t, glitchInt, aspect);
    finalColor.b = sceneB.b;

    // Add deep navy background gradient
    vec2 center = uv - 0.5;
    float bgGrad = 1.0 - length(center) * 0.8;
    finalColor += COL_DEEP_NAVY * bgGrad * 0.5;

    // Apply monitor texture (grain, scanlines, vignette)
    finalColor = applyMonitorTexture(finalColor, uv, t);

    // Glow / Bloom simulation (brighten highlights)
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    vec3 glow = finalColor * smoothstep(0.5, 1.0, luminance) * 0.4;
    finalColor += glow;

    // Occasional full-screen flash during intense glitch
    float flash = step(0.95, glitchInt) * step(0.98, noiseLoop(vec2(t * 10.0, 0.0), t));
    finalColor = mix(finalColor, COL_GLOW_WHITE, flash * 0.3);

    // Color grading: push shadows to deep navy, highlights to white
    finalColor = mix(COL_DEEP_NAVY * 0.5, finalColor, smoothstep(0.0, 0.1, luminance));

    // Final gamma correction
    finalColor = pow(max(finalColor, 0.0), vec3(0.95));

    fragColor = vec4(finalColor, 1.0);
}

`;