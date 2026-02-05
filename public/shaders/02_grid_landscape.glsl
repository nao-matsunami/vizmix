const shader = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float loop = mod(iTime, 10.0) / 10.0; // 0.0 to 1.0

    // 擬似3Dパース
    float z = 1.0 / (uv.y + 0.5);
    if(uv.y < -0.45) {
        fragColor = vec4(0, 0, 0, 1);
        return;
    }

    // グリッドの計算 (10秒でループ)
    // Shift z by exact multiple of period
    // We use frequency 10.0 in sin. To loop, total shift * freq must be k * 2PI.
    // Let's change frequency to PI * 4.0 (approx 12.56)
    // And shift by 2.0 over the loop. Total shift = 2.0 * 4PI = 8PI (4 cycles). Perfect.
    
    vec2 grid_uv = vec2(uv.x * z, z + loop * 2.0);
    float freq = 3.14159 * 4.0;
    
    float line = smoothstep(0.9, 0.95, sin(grid_uv.x * freq)) + 
                 smoothstep(0.9, 0.95, sin(grid_uv.y * freq));
    
    vec3 col = vec3(0.8, 0.0, 0.8) * line * (uv.y + 0.5); // ピンクのグリッド
    col += vec3(0.0, 0.5, 0.8) * (1.0 - abs(uv.x)) * (uv.y + 0.5); // 青いグロー
    
    fragColor = vec4(col, 1.0);
}
`;