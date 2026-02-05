const shader = `
precision highp float;

// 10秒ループ用ノイズ
float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// 有機的な模様を作るFBM（フラクタル・ブラウン運動）
float fbm(vec3 p, float phase) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * sin(p.x + phase) * cos(p.y + phase);
        p *= 2.0;
        amp *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy / iResolution.xy) * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    // 10秒ループの位相
    float phase = (mod(iTime, 10.0) / 10.0) * 2.0 * 3.14159;

    // Use cyclic z-coordinate for seamless loop
    vec3 p = vec3(uv * 1.0, sin(phase) * 0.5);
    
    // カラーサイクルの計算
    float n = fbm(p * 2.0, phase);
    vec3 col = vec3(0.5 + 0.5 * cos(phase + n + vec3(0.0, 2.0, 4.0)));
    
    // 質感：コントラストを強めて神経繊維のように
    col *= smoothstep(0.1, 0.9, abs(n) * 2.0);
    
    fragColor = vec4(col, 1.0);
}
`;