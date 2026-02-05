const shader = `
// WB Media Art Tool - Core Logic
// Theme: Abstract Liquid Chrome
// Loop Duration: 10.0s

#define PI 3.14159265359

// 回転行列（ループ用）
mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// 10秒ループのための時間変換関数
float getLoopTime(float t) {
    float duration = 10.0;
    // 0から1へ進む進捗率
    float progress = mod(t, duration) / duration;
    // 周期的な位相 (2*PI)
    return progress * 2.0 * PI;
}

// 物体との距離関数 (SDF)
float map(vec3 p, float phase) {
    // 空間を歪ませて液体感を出す
    p.xz *= rot(phase + p.y * 0.5);
    p.xy *= rot(phase * 0.5);
    
    // 複数の球体を結合したような形状
    float d = length(p) - 1.2;
    d += sin(p.x * 3.0 + phase) * 0.2;
    d += cos(p.y * 3.0 - phase) * 0.2;
    d += sin(p.z * 3.0 + phase * 2.0) * 0.1;
    
    return d * 0.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    // getLoopTime guarantees 0 -> 2PI over 10s
    float phase = getLoopTime(iTime);
    
    // カメラ設定
    vec3 ro = vec3(0, 0, -3.5); // 視点
    vec3 rd = normalize(vec3(uv, 1.0)); // 視線
    
    // レイマーチング
    float t = 0.0;
    for(int i = 0; i < 64; i++) {
        vec3 p = ro + rd * t;
        float d = map(p, phase);
        if(d < 0.001 || t > 10.0) break;
        t += d;
    }
    
    // ライティング
    vec3 col = vec3(0.0);
    if(t < 10.0) {
        vec3 p = ro + rd * t;
        // 法線の計算（輝きの元）
        vec2 e = vec2(0.001, 0);
        vec3 n = normalize(map(p, phase) - vec3(map(p-e.xyy, phase), map(p-e.yxy, phase), map(p-e.yyx, phase)));
        
        // 反射ベクトル
        vec3 ref = reflect(rd, n);
        float spec = pow(max(dot(ref, vec3(0, 1, -1)), 0.0), 16.0);
        float diff = max(dot(n, vec3(1)), 0.0) * 0.5 + 0.5;
        
        // 液体金属の色（クローム感）
        col = vec3(diff * 0.5 + spec);
        col += vec3(0.1, 0.2, 0.4) * n.y; // 環境光的な青み
    }
    
    // 背景グラデーション
    col += (1.0 - col) * vec3(0.05, 0.05, 0.1) * (1.0 - length(uv));

    fragColor = vec4(col, 1.0);
}
`;