const shader = `
precision highp float;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = mod(iTime, 10.0);
    
    // Kaleido logic
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    // 6 segments
    float segments = 6.0;
    angle = mod(angle, 2.0 * 3.14159 / segments);
    angle = abs(angle - 3.14159 / segments);
    
    // Polar back to cartesian locally
    vec2 p = vec2(cos(angle), sin(angle)) * radius;
    
    // Rotation
    float rot = t * 0.2 * 3.14159; // 1 full rotation in 10s
    float c = cos(rot);
    float s = sin(rot);
    p = mat2(c, -s, s, c) * p;
    
    // Pattern
    // Use PI multiples for time
    float pattern = sin(p.x * 20.0 + t * 2.0 * 3.14159) * sin(p.y * 20.0 - t * 2.0 * 3.14159);
    pattern += sin(length(p) * 30.0 - t * 4.0 * 3.14159);
    
    vec3 col = 0.5 + 0.5 * cos(t * 0.2 * 3.14159 + pattern + vec3(0,2,4));
    col *= smoothstep(0.0, 0.1, abs(pattern));

    fragColor = vec4(col, 1.0);
}
`;